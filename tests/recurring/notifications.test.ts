import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { localTime } from '@/features/recurring/calendar';
import { reconcileNotifications, reminderPermission } from '@/features/recurring/nativeReminders';
import { parseReminderTarget } from '@/features/recurring/reminderPlan';
import { actOnPayment, processRecurring, savePreferences, saveSchedule, type ScheduleInput } from '@/features/recurring/repository';

import { createTestDb, type TestDb } from '../helpers/testDb';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const day = '2026-11-05';
const now = localTime(day, '10:00');
const due = '2026-11-08';
const input: ScheduleInput = { name: 'Electricity', amount: 150_000, category_id: 5, frequency: 'monthly',
  start_day: due, end_day: due, due_time: '12:00', mode: 'reminder', offsets: 5 };
type Request = Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>>[number];
let db: TestDb;
let queued: Request[];

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  db = await createTestDb();
  queued = [];
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
    { granted: true, status: 'granted', canAskAgain: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockImplementation(async () => [...queued]);
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async (item) => {
    queued.push(item as Request);
    return item.identifier!;
  });
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockImplementation(async (id) => {
    queued = queued.filter((item) => item.identifier !== id);
  });
});
afterEach(() => { db.close(); jest.restoreAllMocks(); });

test('schedules the selected billing cycle and persists native IDs without duplicating requests', async () => {
  await saveSchedule(db, input, undefined, now);
  await reconcileNotifications(db, now);
  const ids = await db.getAllAsync<{ id: string; due_day: string; fire_at: number }>(
    'SELECT id, due_day, fire_at FROM recurring_notifications ORDER BY fire_at');
  expect(ids.map((item) => [item.due_day, item.fire_at])).toEqual([
    [due, localTime(day, '12:00')], [due, localTime(due, '12:00')],
  ]);
  expect(queued.map((item) => item.identifier)).toEqual(ids.map((item) => item.id));
  expect(queued[0]?.content.body).not.toContain(input.name);
  await reconcileNotifications(db, now);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  await savePreferences(db, { enabled: 1, preview: 1, due_time: '09:00', offsets: 1 });
  await reconcileNotifications(db, now);
  expect(queued[0]?.content.body).toContain(input.name);
});

test('changes native dates after an edit, replaces notifications after snooze, and cancels on payment', async () => {
  const id = await saveSchedule(db, input, undefined, now);
  await reconcileNotifications(db, now);
  await saveSchedule(db, { ...input, due_time: '13:00' }, id, now);
  await reconcileNotifications(db, now);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(queued[0]?.identifier).toContain(String(localTime(day, '13:00')));
  await actOnPayment(db, id, due, { type: 'snooze', day: '2026-11-10', time: '14:15' }, now);
  await reconcileNotifications(db, now);
  expect(queued).toHaveLength(1);
  expect(queued[0]?.identifier).toContain(String(localTime('2026-11-10', '14:15')));
  await actOnPayment(db, id, due, { type: 'pay', day, amount: 135_000 }, now);
  await reconcileNotifications(db, now);
  expect(queued).toEqual([]);
  expect(await db.getAllAsync('SELECT id FROM recurring_notifications')).toEqual([]);
});

test('does not prompt a denied user and preserves in-app tracking', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
    { granted: false, status: 'denied', canAskAgain: true } as Notifications.NotificationPermissionsStatus);
  await expect(reminderPermission(db, true)).resolves.toBe('Denied');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  await saveSchedule(db, { ...input, start_day: day }, undefined, now);
  await processRecurring(db, now);
  await reconcileNotifications(db, now);
  expect(queued).toEqual([]);
  expect(await db.getFirstAsync('SELECT status FROM recurring_occurrences')).toEqual({ status: 'pending' });
});

test('asks once on Android 13+ even when the initial native status is denied', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const denied = { granted: false, status: 'denied', canAskAgain: true } as Notifications.NotificationPermissionsStatus;
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);
  await expect(reminderPermission(db)).resolves.toBe('Not requested');
  await expect(reminderPermission(db, true)).resolves.toBe('Denied');
  await expect(reminderPermission(db, true)).resolves.toBe('Denied');
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('accepts only internally structured payment targets and ignores arbitrary destinations', async () => {
  await saveSchedule(db, input, undefined, now);
  await reconcileNotifications(db, now);
  const notification = queued[0]!;
  expect(parseReminderTarget(notification.identifier, notification.content.data)).toEqual({ scheduleId: 1, dueDay: due });
  expect(parseReminderTarget(notification.identifier, { url: '/settings/restore' })).toBeNull();
  expect(parseReminderTarget(notification.identifier, { ...notification.content.data, scheduleId: 999 })).toBeNull();
  expect(parseReminderTarget(notification.identifier, { ...notification.content.data, dueDay: '2026-02-30' })).toBeNull();
});
