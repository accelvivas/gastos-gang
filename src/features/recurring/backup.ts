import type { DbLike } from '@/db/client';
import { isLocalDayKey } from '@/lib/dates';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';

import { occurrenceDay, validTime } from './calendar';
import { validatePreferences, validateSchedule, type Occurrence, type Preferences, type Schedule } from './repository';

export type RecurringBackup = { schedules: Schedule[]; occurrences: Occurrence[]; preferences: Preferences | null };

const scheduleKeys = ['id', 'name', 'amount', 'category_id', 'frequency', 'start_day', 'end_day', 'due_time', 'mode',
  'offsets', 'state', 'cursor', 'created_at', 'updated_at'] as const;
const occurrenceKeys = ['schedule_id', 'due_day', 'name', 'amount', 'category_id', 'status', 'expense_id',
  'payment_day', 'recorded_amount', 'snooze_day', 'snooze_time'] as const;
const preferenceKeys = ['enabled', 'preview', 'due_time', 'offsets'] as const;

function assert(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid recurring expense backup data.');
}

function row<T>(input: unknown, keys: readonly string[]): T {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  const source = input as Record<string, unknown>;
  assert(Object.keys(source).length === keys.length && keys.every((key) => Object.hasOwn(source, key)));
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as T;
}

const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const validAmount = (value: number) => positive(value) && value <= MAX_AMOUNT_CENTAVOS;

export function validateRecurringBackup(input: unknown, categories: ReadonlySet<number>, expenses: ReadonlySet<number>) {
  const data = row<RecurringBackup>(input, ['schedules', 'occurrences', 'preferences']);
  assert(Array.isArray(data.schedules) && data.schedules.length <= 10_000 &&
    Array.isArray(data.occurrences) && data.occurrences.length <= 100_000);
  const ids = new Set<number>();
  const schedules = data.schedules.map((input) => {
    const schedule = row<Schedule>(input, scheduleKeys);
    validateSchedule(schedule);
    assert(positive(schedule.id) && !ids.has(schedule.id) && categories.has(schedule.category_id) &&
      ['active', 'paused', 'deleted'].includes(schedule.state) &&
      Number.isSafeInteger(schedule.cursor) && schedule.cursor >= 0 &&
      isLocalDayKey(occurrenceDay(schedule.start_day, schedule.frequency, schedule.cursor)) &&
      positive(schedule.created_at) && positive(schedule.updated_at));
    ids.add(schedule.id);
    return schedule;
  });
  const links = new Set<number>();
  const dueKeys = new Set<string>();
  const occurrences = data.occurrences.map((input) => {
    const entry = row<Occurrence>(input, occurrenceKeys);
    const key = `${entry.schedule_id}:${entry.due_day}`;
    assert(ids.has(entry.schedule_id) && !dueKeys.has(key) && isLocalDayKey(entry.due_day) &&
      typeof entry.name === 'string' && entry.name.trim().length > 0 && entry.name.length <= 120 &&
      validAmount(entry.amount) && categories.has(entry.category_id) &&
      ['pending', 'paid', 'skipped', 'auto'].includes(entry.status));
    dueKeys.add(key);
    if (entry.status === 'paid' || entry.status === 'auto') {
      assert(entry.payment_day !== null && isLocalDayKey(entry.payment_day) &&
        entry.recorded_amount !== null && validAmount(entry.recorded_amount));
      if (entry.status === 'auto') assert(entry.payment_day === entry.due_day);
    } else {
      assert(entry.expense_id === null && entry.payment_day === null && entry.recorded_amount === null);
    }
    if (entry.expense_id !== null) {
      assert(expenses.has(entry.expense_id) && !links.has(entry.expense_id));
      links.add(entry.expense_id);
    }
    assert((entry.snooze_day === null && entry.snooze_time === null) ||
      (entry.status === 'pending' && entry.snooze_day !== null && isLocalDayKey(entry.snooze_day) &&
        entry.snooze_time !== null && validTime(entry.snooze_time)));
    return entry;
  });
  const preferences = data.preferences === null ? null : row<Preferences>(data.preferences, preferenceKeys);
  if (preferences) validatePreferences(preferences);
  return { schedules, occurrences, preferences };
}

export async function readRecurringBackup(db: DbLike): Promise<RecurringBackup | undefined> {
  const schedules = await db.getAllAsync<Schedule>('SELECT * FROM recurring_expenses ORDER BY id');
  const occurrences = await db.getAllAsync<Occurrence>('SELECT * FROM recurring_occurrences ORDER BY schedule_id, due_day');
  const preferences = await db.getFirstAsync<Preferences>(
    'SELECT enabled, preview, due_time, offsets FROM recurring_preferences WHERE id=1');
  if (schedules.length || occurrences.length || preferences) return { schedules, occurrences, preferences };
}

export async function clearRecurringBackup(db: DbLike) {
  await db.execAsync(`DELETE FROM recurring_notifications; DELETE FROM recurring_occurrences;
    DELETE FROM recurring_expenses; DELETE FROM recurring_preferences;`);
}

export async function restoreRecurringBackup(db: DbLike, data?: RecurringBackup) {
  if (!data) return;
  for (const schedule of data.schedules) {
    await db.runAsync(`INSERT INTO recurring_expenses (${scheduleKeys.join(',')})
      VALUES (${scheduleKeys.map(() => '?').join(',')})`, scheduleKeys.map((key) => schedule[key]));
  }
  for (const occurrence of data.occurrences) {
    await db.runAsync(`INSERT INTO recurring_occurrences (${occurrenceKeys.join(',')})
      VALUES (${occurrenceKeys.map(() => '?').join(',')})`, occurrenceKeys.map((key) => occurrence[key]));
  }
  if (data.preferences) {
    const preferences = data.preferences;
    await db.runAsync('INSERT INTO recurring_preferences VALUES (1, ?, ?, ?, ?)', preferenceKeys.map((key) => preferences[key]));
  }
}
