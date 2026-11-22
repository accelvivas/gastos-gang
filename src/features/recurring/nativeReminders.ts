import {
  AndroidImportance, AndroidNotificationVisibility, IosAuthorizationStatus, SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync, getAllScheduledNotificationsAsync, getPermissionsAsync,
  requestPermissionsAsync, scheduleNotificationAsync, setNotificationChannelAsync, setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { DbLike } from '@/db/client';
import { todayKey } from '@/lib/dates';

import { ensureOccurrence, listSchedules, readPreferences, type Occurrence } from './repository';
import { planReminders, reminderPrefix, reminderTitle, type Reminder } from './reminderPlan';

const channelId = 'payment-reminders';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

export function configureForegroundNotifications() {
  if (!supported) return;
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
  return () => setNotificationHandler(null);
}

async function configureChannel() {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(channelId, {
      name: 'Payment Reminders',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 180, 100, 180],
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export async function reminderPermission(db: DbLike, request = false) {
  if (!supported) return 'Unavailable on this platform';
  const current = await getPermissionsAsync();
  const granted = (current.granted && current.status !== 'denied') ||
    current.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    current.ios?.status === IosAuthorizationStatus.EPHEMERAL;
  if (granted) return 'Allowed';
  if (!current.canAskAgain) return 'Denied';
  // Android can report "denied" before the OS has shown its first permission prompt.
  const asked = await db.getFirstAsync<{ id: number }>('SELECT id FROM recurring_device WHERE id=1');
  const mayPrompt = !asked && (current.status === 'undetermined' || Platform.OS === 'android');
  if (!mayPrompt) return 'Denied';
  if (!request) return 'Not requested';
  await configureChannel();
  const claimed = await db.runAsync('INSERT OR IGNORE INTO recurring_device (id) VALUES (1)');
  if (!claimed.changes) return 'Denied';
  await requestPermissionsAsync();
  return reminderPermission(db);
}

export async function scheduleTestReminder(db: DbLike) {
  if (await reminderPermission(db) !== 'Allowed') throw new Error('Allow notifications before scheduling a test.');
  await configureChannel();
  const identifier = 'gastos-payment-test';
  await cancelScheduledNotificationAsync(identifier);
  await scheduleNotificationAsync({
    identifier,
    content: { title: 'Gastos Gang test reminder', body: 'Payment reminders can reach this device.', sound: 'default' },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: Date.now() + 120_000, channelId, delivery: 'bestEffort' },
  });
}

export async function reconcileNotifications(db: DbLike, now = Date.now(), replace = false) {
  if (!supported) return;
  let desired: Reminder[] = [];
  if (await reminderPermission(db) === 'Allowed') {
    await configureChannel();
    await db.withExclusiveTransactionAsync(async (tx) => {
      const preferences = await readPreferences(tx);
      if (!preferences.enabled) return;
      const schedules = await listSchedules(tx);
      const occurrences = await tx.getAllAsync<Occurrence>(`SELECT * FROM recurring_occurrences
        WHERE due_day >= ? OR (status='pending' AND snooze_day >= ?)`, [todayKey(now), todayKey(now)]);
      desired = planReminders(schedules, occurrences, preferences, now);
      for (const { schedule, dueDay } of desired) await ensureOccurrence(tx, schedule, dueDay);
    });
  }
  const byId = new Map(desired.map((item) => [item.id, item]));
  const retained = new Set<string>();
  const native = await getAllScheduledNotificationsAsync();
  for (const item of native) {
    if (!item.identifier.startsWith(reminderPrefix)) continue;
    const expected = byId.get(item.identifier);
    if (!replace && expected && item.content.body === expected.body && item.content.title === reminderTitle) {
      retained.add(item.identifier);
    } else {
      await cancelScheduledNotificationAsync(item.identifier);
    }
  }
  const saved = await db.getAllAsync<{ id: string }>('SELECT id FROM recurring_notifications');
  for (const { id } of saved) {
    if (!byId.has(id)) await db.runAsync('DELETE FROM recurring_notifications WHERE id=?', [id]);
  }
  let failed = false;
  for (const { id, schedule, dueDay, fireAt, body } of desired) {
    if (fireAt <= Date.now()) continue;
    try {
      if (!retained.has(id)) {
        await scheduleNotificationAsync({
          identifier: id,
          content: { title: reminderTitle, body, sound: 'default', data: { scheduleId: schedule.id, dueDay, fireAt } },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: fireAt, channelId, delivery: 'bestEffort' },
        });
      }
      await db.runAsync(`INSERT OR REPLACE INTO recurring_notifications (id, schedule_id, due_day, fire_at)
        SELECT ?, schedule_id, due_day, ? FROM recurring_occurrences
        WHERE schedule_id=? AND due_day=? AND status='pending'`, [id, fireAt, schedule.id, dueDay]);
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error('Some phone reminders could not be scheduled. Gastos Gang will retry.');
}
