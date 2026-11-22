import type { DbLike } from '@/db/client';
import { addDaysToKey, isLocalDayKey, todayKey } from '@/lib/dates';
import { notifyExpenseChange } from '@/lib/expenseChanges';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';

import { firstOccurrenceAtOrAfter, frequencies, localTime, occurrenceDay, validTime, type Frequency } from './calendar';

export type ScheduleInput = {
  name: string;
  amount: number;
  category_id: number;
  frequency: Frequency;
  start_day: string;
  end_day: string | null;
  due_time: string;
  mode: 'automatic' | 'reminder';
  offsets: number;
};
export type Schedule = ScheduleInput & {
  id: number;
  state: 'active' | 'paused' | 'deleted';
  cursor: number;
  created_at: number;
  updated_at: number;
};
export type Occurrence = {
  schedule_id: number;
  due_day: string;
  name: string;
  amount: number;
  category_id: number;
  status: 'pending' | 'paid' | 'skipped' | 'auto';
  expense_id: number | null;
  payment_day: string | null;
  recorded_amount: number | null;
  snooze_day: string | null;
  snooze_time: string | null;
};
export type Preferences = { enabled: number; preview: number; due_time: string; offsets: number };

const defaults: Preferences = { enabled: 1, preview: 0, due_time: '09:00', offsets: 1 };
const batchSize = 90;
const listeners = new Set<() => void>();

export function subscribeRecurring(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function changed() {
  for (const listener of listeners) listener();
}

export async function readPreferences(db: DbLike) {
  return await db.getFirstAsync<Preferences>('SELECT * FROM recurring_preferences WHERE id = 1') ?? defaults;
}

export function validatePreferences(value: Preferences) {
  if (![0, 1].includes(value.enabled) || ![0, 1].includes(value.preview) ||
      !validTime(value.due_time) || !Number.isInteger(value.offsets) || value.offsets < 0 || value.offsets > 15) {
    throw new Error('Invalid reminder preferences.');
  }
}

export async function savePreferences(db: DbLike, value: Preferences) {
  validatePreferences(value);
  await db.runAsync('INSERT OR REPLACE INTO recurring_preferences VALUES (1, ?, ?, ?, ?)',
    [value.enabled, value.preview, value.due_time, value.offsets]);
  changed();
}

function validAmount(amount: number) {
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT_CENTAVOS;
}

export function validateSchedule(input: ScheduleInput) {
  if (!input.name.trim() || input.name.trim().length > 120) throw new Error('Enter a name up to 120 characters.');
  if (!validAmount(input.amount)) throw new Error('Enter a valid amount greater than zero.');
  if (!Number.isSafeInteger(input.category_id) || input.category_id <= 0) throw new Error('Select a category.');
  if (!frequencies.includes(input.frequency) || !['automatic', 'reminder'].includes(input.mode)) {
    throw new Error('Select a frequency and recording mode.');
  }
  if (!isLocalDayKey(input.start_day) || (input.end_day !== null &&
      (!isLocalDayKey(input.end_day) || input.end_day < input.start_day))) {
    throw new Error('Enter valid dates in YYYY-MM-DD format. End date must follow or match start date.');
  }
  validatePreferences({ ...defaults, due_time: input.due_time, offsets: input.offsets });
}

export function listSchedules(db: DbLike) {
  return db.getAllAsync<Schedule>("SELECT * FROM recurring_expenses WHERE state <> 'deleted' ORDER BY id");
}

export function listOutstanding(db: DbLike, day: string) {
  return db.getAllAsync<Occurrence>(`
    SELECT o.* FROM recurring_occurrences o JOIN recurring_expenses s ON s.id = o.schedule_id
    WHERE o.status = 'pending' AND (o.due_day <= ? OR o.snooze_day IS NOT NULL)
      AND s.state <> 'deleted' ORDER BY o.due_day, o.schedule_id`, [day]);
}

export function listRecentPayments(db: DbLike) {
  return db.getAllAsync<Occurrence>(`
    SELECT o.* FROM recurring_occurrences o JOIN recurring_expenses s ON s.id = o.schedule_id
    WHERE o.status IN ('paid', 'skipped') AND s.state <> 'deleted'
    ORDER BY o.due_day DESC, o.schedule_id DESC LIMIT 30`);
}

export function readOccurrence(db: DbLike, id: number, day: string) {
  return db.getFirstAsync<Occurrence>('SELECT * FROM recurring_occurrences WHERE schedule_id = ? AND due_day = ?', [id, day]);
}

export function nextDay(schedule: Schedule, from?: string) {
  const index = from
    ? Math.max(schedule.cursor, firstOccurrenceAtOrAfter(schedule.start_day, schedule.frequency, from))
    : schedule.cursor;
  const day = occurrenceDay(schedule.start_day, schedule.frequency, index);
  return schedule.end_day && day > schedule.end_day ? null : day;
}

export async function saveSchedule(db: DbLike, input: ScheduleInput, id?: number, now = Date.now()) {
  validateSchedule(input);
  let savedId = id;
  let written = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const category = await tx.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE id = ?', [input.category_id]);
    if (!category) throw new Error('This category is unavailable.');
    const fields = [input.name.trim(), input.amount, input.category_id, input.frequency,
      input.start_day, input.end_day, input.due_time, input.mode, input.offsets];
    if (id === undefined) {
      const result = await tx.runAsync(`INSERT INTO recurring_expenses
        (name, amount, category_id, frequency, start_day, end_day, due_time, mode, offsets, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`, [...fields, now, now]);
      savedId = result.lastInsertRowId;
      return;
    }
    const previous = await tx.getFirstAsync<Schedule>('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
    if (!previous || previous.state === 'deleted') throw new Error('This schedule is unavailable.');
    const cutoff = todayKey(now);
    const cursor = firstOccurrenceAtOrAfter(input.start_day, input.frequency, cutoff);
    // Preserve established due bills; rebuild future unhandled projections using the new schedule.
    if (previous.state === 'active') {
      const result = await processSchedule(tx, previous, localTime(cutoff, '00:00') - 1, batchSize, now);
      if (result.backlog) throw new Error('Process the missed occurrences before editing this schedule.');
      written = result.written;
    }
    await discardFutureProjections(tx, id, addDaysToKey(cutoff, 1));
    await tx.runAsync(`UPDATE recurring_expenses SET name=?, amount=?, category_id=?, frequency=?,
      start_day=?, end_day=?, due_time=?, mode=?, offsets=?, cursor=?, updated_at=? WHERE id=?`,
      [...fields, cursor, now, id]);
  });
  if (written) notifyExpenseChange();
  changed();
  return savedId!;
}

async function discardFutureProjections(tx: DbLike, id: number, day: string) {
  await tx.runAsync(`DELETE FROM recurring_notifications WHERE schedule_id = ? AND due_day IN
    (SELECT due_day FROM recurring_occurrences WHERE schedule_id = ? AND due_day >= ?
      AND status = 'pending' AND snooze_day IS NULL)`, [id, id, day]);
  await tx.runAsync(`DELETE FROM recurring_occurrences
    WHERE schedule_id = ? AND due_day >= ? AND status = 'pending' AND snooze_day IS NULL`, [id, day]);
}

export async function setScheduleState(db: DbLike, id: number, state: Schedule['state'], now = Date.now()) {
  let written = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const schedule = await tx.getFirstAsync<Schedule>('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
    if (!schedule || schedule.state === 'deleted' || schedule.state === state) return;
    if (state === 'paused') {
      const result = await processSchedule(tx, schedule, now, batchSize);
      if (result.backlog) throw new Error('Process the missed occurrences before pausing.');
      written = result.written;
      await discardFutureProjections(tx, id, addDaysToKey(todayKey(now), 1));
    }
    const cursor = state === 'active'
      ? Math.max(schedule.cursor, firstOccurrenceAtOrAfter(schedule.start_day, schedule.frequency, todayKey(now)))
      : null;
    await tx.runAsync('UPDATE recurring_expenses SET state=?, cursor=COALESCE(?,cursor), updated_at=? WHERE id=?',
      [state, cursor, now, id]);
  });
  if (written) notifyExpenseChange();
  changed();
}

export async function ensureOccurrence(tx: DbLike, schedule: Schedule, day: string) {
  const result = await tx.runAsync(`INSERT INTO recurring_occurrences (schedule_id, due_day, name, amount, category_id)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(schedule_id, due_day) DO NOTHING`,
    [schedule.id, day, schedule.name, schedule.amount, schedule.category_id]);
  return result.changes > 0;
}

async function record(tx: DbLike, occurrence: Occurrence, amount: number, day: string, status: 'paid' | 'auto', now: number) {
  if (occurrence.status !== 'pending') return false;
  const time = day === todayKey(now) ? now : localTime(day, '12:00');
  const result = await tx.runAsync(`INSERT INTO expenses (amount_centavos, category_id, note, created_at, local_day, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`, [amount, occurrence.category_id, occurrence.name, time, day, now]);
  await tx.runAsync(`UPDATE recurring_occurrences SET status=?, expense_id=?, payment_day=?, recorded_amount=?,
    snooze_day=NULL, snooze_time=NULL WHERE schedule_id=? AND due_day=?`,
    [status, result.lastInsertRowId, day, amount, occurrence.schedule_id, occurrence.due_day]);
  return true;
}

async function processSchedule(tx: DbLike, schedule: Schedule, through: number, limit: number, now = through) {
  let { cursor } = schedule;
  let written = 0;
  let processed = 0;
  const today = todayKey(through);
  while (processed < limit) {
    const day = occurrenceDay(schedule.start_day, schedule.frequency, cursor);
    if (day > today || (schedule.end_day && day > schedule.end_day)) break;
    const created = await ensureOccurrence(tx, schedule, day);
    if (schedule.mode === 'automatic' && created) {
      const occurrence = await readOccurrence(tx, schedule.id, day);
      if (occurrence && await record(tx, occurrence, schedule.amount, day, 'auto', now)) written++;
    }
    cursor++;
    processed++;
  }
  if (processed) await tx.runAsync('UPDATE recurring_expenses SET cursor=? WHERE id=?', [cursor, schedule.id]);
  const next = nextDay({ ...schedule, cursor });
  return { written, processed, backlog: next !== null && next <= today };
}

const processing = new WeakMap<DbLike, Promise<boolean>>();

export function processRecurring(db: DbLike, now = Date.now()): Promise<boolean> {
  const running = processing.get(db);
  if (running) return running;
  const task = (async () => {
    let written = 0;
    let limit = batchSize;
    let backlog = false;
    await db.withExclusiveTransactionAsync(async (tx) => {
      const schedules = await tx.getAllAsync<Schedule>(`SELECT * FROM recurring_expenses
        WHERE state='active' AND start_day <= ? ORDER BY updated_at, id`, [todayKey(now)]);
      for (const schedule of schedules) {
        const result = await processSchedule(tx, schedule, now, limit);
        written += result.written;
        limit -= result.processed;
        backlog ||= result.backlog;
      }
    });
    if (written) notifyExpenseChange();
    return backlog;
  })().finally(() => processing.delete(db));
  processing.set(db, task);
  return task;
}

export async function materializeUpcoming(db: DbLike, id: number, day: string) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const schedule = await tx.getFirstAsync<Schedule>('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
    if (schedule?.state !== 'active' || schedule.mode !== 'reminder' ||
        (schedule.end_day && day > schedule.end_day) ||
        day < schedule.start_day ||
        occurrenceDay(schedule.start_day, schedule.frequency,
          firstOccurrenceAtOrAfter(schedule.start_day, schedule.frequency, day)) !== day) {
      throw new Error('This payment is unavailable.');
    }
    await ensureOccurrence(tx, schedule, day);
  });
}

type PaymentAction = { type: 'pay'; amount: number; day: string } |
  { type: 'skip' } | { type: 'snooze'; day: string; time: string };

export async function actOnPayment(db: DbLike, id: number, dueDay: string, action: PaymentAction, now = Date.now()) {
  if (action.type === 'pay' && (!validAmount(action.amount) || !isLocalDayKey(action.day) || action.day > todayKey(now))) {
    throw new Error('Enter a valid payment amount and a date no later than today.');
  }
  if (action.type === 'snooze' && localTime(action.day, action.time) <= now) {
    throw new Error('Choose a future reminder time.');
  }
  let didPay = false;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const occurrence = await tx.getFirstAsync<Occurrence>(`SELECT o.* FROM recurring_occurrences o
      JOIN recurring_expenses s ON s.id=o.schedule_id
      WHERE o.schedule_id=? AND o.due_day=? AND s.state <> 'deleted'`, [id, dueDay]);
    if (!occurrence || occurrence.status !== 'pending') return;
    if (action.type === 'pay') didPay = await record(tx, occurrence, action.amount, action.day, 'paid', now);
    if (action.type === 'skip') {
      await tx.runAsync(`UPDATE recurring_occurrences SET status='skipped', snooze_day=NULL, snooze_time=NULL
        WHERE schedule_id=? AND due_day=?`, [id, dueDay]);
    }
    if (action.type === 'snooze') {
      await tx.runAsync('UPDATE recurring_occurrences SET snooze_day=?, snooze_time=? WHERE schedule_id=? AND due_day=?',
        [action.day, action.time, id, dueDay]);
    }
  });
  if (didPay) notifyExpenseChange();
  changed();
  return didPay;
}

export async function nextOutstandingDay(db: DbLike, schedule: Schedule, today: string) {
  const index = firstOccurrenceAtOrAfter(schedule.start_day, schedule.frequency, addDaysToKey(today, 1));
  let cursor = Math.max(index, schedule.cursor);
  const resolved = new Set((await db.getAllAsync<{ due_day: string }>(`
    SELECT due_day FROM recurring_occurrences WHERE schedule_id=? AND due_day>? AND status <> 'pending'`,
    [schedule.id, today])).map((row) => row.due_day));
  while (resolved.has(occurrenceDay(schedule.start_day, schedule.frequency, cursor))) cursor++;
  return nextDay({ ...schedule, cursor });
}
