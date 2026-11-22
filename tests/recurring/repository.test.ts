import { createBackupSnapshot, restoreBackupAtomically } from '@/features/settings/utils/backupService';
import { firstOccurrenceAtOrAfter, occurrenceDay, localTime } from '@/features/recurring/calendar';
import {
  actOnPayment, listOutstanding, listSchedules, materializeUpcoming, nextOutstandingDay, processRecurring,
  readOccurrence, saveSchedule, setScheduleState, type ScheduleInput,
} from '@/features/recurring/repository';
import { addDaysToKey } from '@/lib/dates';
import * as expenses from '@/repositories/expensesRepo';

import { createTestDb, type TestDb } from '../helpers/testDb';

const day = '2026-11-05';
const now = localTime(day, '10:00');
const input: ScheduleInput = { name: 'Internet', category_id: 5, amount: 150_000, start_day: day,
  end_day: null, due_time: '09:00', mode: 'reminder', offsets: 1, frequency: 'daily' };

let db: TestDb;
beforeEach(async () => { db = await createTestDb(); });
afterEach(() => db.close());

test.each([
  ['daily', '2026-11-06'], ['weekly', '2026-11-12'],
  ['monthly', '2026-12-05'], ['yearly', '2027-11-05'],
] as const)('creates a %s schedule and calculates its next date', async (frequency, next) => {
  await saveSchedule(db, { ...input, frequency }, undefined, now);
  const [schedule] = await listSchedules(db);
  expect(await nextOutstandingDay(db, schedule!, day)).toBe(next);
});

test.each([
  ['2024-01-31', 'monthly', 1, '2024-02-29'], ['2024-01-31', 'monthly', 2, '2024-03-31'],
  ['2024-02-29', 'yearly', 1, '2025-02-28'], ['2024-02-29', 'yearly', 4, '2028-02-29'],
] as const)('preserves the original calendar anchor %s', (start, frequency, index, expected) => {
  expect(occurrenceDay(start, frequency, index)).toBe(expected);
});

test('uses calendar days and a local reminder time across daylight-saving boundaries', () => {
  const start = '2026-03-07';
  const after = '2026-03-09';
  expect(firstOccurrenceAtOrAfter(start, 'daily', after)).toBe(2);
  expect(occurrenceDay(start, 'daily', 2)).toBe(after);
  for (const date of [start, '2026-03-08', after, '2026-11-01']) {
    const reminder = new Date(localTime(date, '09:00'));
    expect(reminder.getHours()).toBe(9);
    expect(reminder.getDate()).toBe(Number(date.slice(-2)));
  }
});

test.each([{ amount: 0 }, { amount: -99 }, { amount: Infinity }, { amount: 10 ** 10 },
  { start_day: '2026-02-30' }, { end_day: '2026-01-01' }, { due_time: '24:00' }, { category_id: 500 },
])('rejects invalid schedule data %p', async (patch) => {
  await expect(saveSchedule(db, { ...input, ...patch }, undefined, now)).rejects.toThrow();
  expect(await listSchedules(db)).toEqual([]);
});

test('automatically records each due date once, including missed days, and preserves edits and deletes', async () => {
  const id = await saveSchedule(db, { ...input, mode: 'automatic', amount: 5_000, start_day: '2026-11-02' }, undefined, now);
  const first = processRecurring(db, now);
  expect(processRecurring(db, now)).toBe(first);
  await first;
  await processRecurring(db, now);
  const rows = await expenses.listByDayRange(db, '2026-11-01', '2026-11-07');
  expect(rows).toHaveLength(4);
  expect(rows.every((row) => row.recurringSource === 'auto')).toBe(true);
  expect(await expenses.totalForRange(db, '2026-11-01', day)).toBe(20_000);
  expect(await readOccurrence(db, id, '2026-11-06')).toBeNull();
  await expenses.update(db, rows[0]!.id, { amountCentavos: 2_000 });
  const original = await expenses.remove(db, rows[1]!.id);
  await processRecurring(db, now);
  expect(await expenses.totalForRange(db, '2026-11-01', day)).toBe(12_000);
  await expenses.restore(db, original);
  expect(await expenses.totalForRange(db, '2026-11-01', day)).toBe(17_000);
  expect((await expenses.listByDayRange(db, '2026-11-01', day)).every((row) => row.recurringSource === 'auto')).toBe(true);
});

test('rolls back an interrupted recording and resumes without duplicates', async () => {
  await saveSchedule(db, { ...input, mode: 'automatic' }, undefined, now);
  const run = db.runAsync.bind(db);
  const fault = jest.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
    if (sql.includes('SET status=?, expense_id=')) throw new Error('Interrupted write');
    return run(sql, params);
  });
  await expect(processRecurring(db, now)).rejects.toThrow('Interrupted write');
  expect(await expenses.totalForDay(db, day)).toBe(0);
  fault.mockRestore();
  await processRecurring(db, now);
  await processRecurring(db, now);
  expect(await expenses.totalForDayAt(db, day, now)).toBe(input.amount);
});

test('reports a bounded backlog and processes the remainder on demand', async () => {
  await saveSchedule(db, { ...input, mode: 'automatic', start_day: addDaysToKey(day, -94) }, undefined, now);
  await expect(processRecurring(db, now)).resolves.toBe(true);
  expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM expenses')).toEqual({ count: 90 });
  await expect(processRecurring(db, now)).resolves.toBe(false);
  expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM expenses')).toEqual({ count: 95 });
});

test('preserves outstanding bills when paused and skips dates that elapsed during the pause', async () => {
  const id = await saveSchedule(db, input, undefined, now);
  await processRecurring(db, now);
  await materializeUpcoming(db, id, '2026-11-06');
  await setScheduleState(db, id, 'paused', now);
  const resumeDay = '2026-11-09';
  const resumeAt = localTime(resumeDay, '10:00');
  await processRecurring(db, resumeAt);
  expect((await listOutstanding(db, resumeDay)).map((row) => row.due_day)).toEqual([day]);
  await setScheduleState(db, id, 'active', resumeAt);
  await processRecurring(db, resumeAt);
  expect((await listOutstanding(db, resumeDay)).map((row) => row.due_day)).toEqual([day, resumeDay]);
  await setScheduleState(db, id, 'deleted', resumeAt);
  expect(await listSchedules(db)).toEqual([]);
  expect(await listOutstanding(db, resumeDay)).toEqual([]);
  expect(await readOccurrence(db, id, day)).toBeTruthy();
});

test('records the actual payment once, in the actual payment period, and excludes unpaid bills', async () => {
  const id = await saveSchedule(db, input, undefined, now);
  await processRecurring(db, now);
  expect(await expenses.totalForRange(db, '2026-11-01', day)).toBe(0);
  const action = { type: 'pay' as const, amount: 135_000, day: '2026-11-04' };
  await expect(actOnPayment(db, id, day, action, now)).resolves.toBe(true);
  await expect(actOnPayment(db, id, day, action, now)).resolves.toBe(false);
  expect(await expenses.sumByDay(db, action.day, day)).toEqual([expect.objectContaining({
    day: action.day, totalCentavos: 135_000,
  })]);
  expect(await readOccurrence(db, id, day)).toMatchObject({ due_day: day, payment_day: action.day, status: 'paid' });
  const [expense] = await expenses.listByDayRange(db, action.day, day);
  expect(expense).toMatchObject({ recurringSource: 'paid', amountCentavos: 135_000 });
  await setScheduleState(db, id, 'deleted', now);
  expect(await expenses.totalForDayAt(db, action.day, now)).toBe(135_000);
});

test.each([1, 3, 7])('snoozes for %s days while preserving the due date and tracking only actual spending', async (days) => {
  const id = await saveSchedule(db, input, undefined, now);
  await processRecurring(db, now);
  const snooze = addDaysToKey(day, days);
  await actOnPayment(db, id, day, { type: 'snooze', day: snooze, time: '09:00' }, now);
  await expect(actOnPayment(db, id, day, { type: 'snooze', day, time: '09:00' }, now)).rejects.toThrow('future');
  expect(await readOccurrence(db, id, day)).toMatchObject({ due_day: day, snooze_day: snooze, status: 'pending' });
  expect(await expenses.totalForRange(db, day, snooze)).toBe(0);
});

test('skips only one occurrence and retains the next one', async () => {
  const id = await saveSchedule(db, input, undefined, now);
  const next = addDaysToKey(day, 1);
  await processRecurring(db, now);
  await actOnPayment(db, id, day, { type: 'skip' }, now);
  await processRecurring(db, localTime(next, '10:00'));
  expect(await readOccurrence(db, id, day)).toMatchObject({ status: 'skipped' });
  expect(await listOutstanding(db, next)).toEqual([expect.objectContaining({ due_day: next })]);
  expect(await expenses.totalForRange(db, day, next)).toBe(0);
});

test('restores schedules, paid links and audit rows without importing device notification identifiers', async () => {
  const id = await saveSchedule(db, input, undefined, now);
  await processRecurring(db, now);
  await actOnPayment(db, id, day, { type: 'pay', amount: 124_500, day }, now);
  await db.runAsync('INSERT INTO recurring_notifications VALUES (?, ?, ?, ?)', ['local-only', id, day, now]);
  const snapshot = await createBackupSnapshot(db, { appVersion: '1.0.0', now: () => now });
  expect(snapshot.schemaVersion).toBe(2);
  expect(JSON.stringify(snapshot)).not.toContain('local-only');
  const fresh = await createTestDb();
  try {
    await restoreBackupAtomically(fresh, snapshot);
    await processRecurring(fresh, now);
    expect(await actOnPayment(fresh, id, day, { type: 'pay', amount: 124_500, day }, now)).toBe(false);
    expect(await expenses.totalForDayAt(fresh, day, now)).toBe(124_500);
    expect((await createBackupSnapshot(fresh, { appVersion: '1.0.0', now: () => now })).data).toEqual(snapshot.data);
    expect(await fresh.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    const corrupt = structuredClone(snapshot);
    corrupt.data.recurring!.occurrences[0]!.expense_id = 99_999;
    await expect(restoreBackupAtomically(fresh, corrupt)).rejects.toThrow('invalid recurring');
    expect(await expenses.totalForDayAt(fresh, day, now)).toBe(124_500);
  } finally {
    fresh.close();
  }
});
