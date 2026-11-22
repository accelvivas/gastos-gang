import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
} from 'expo-notifications';
import type { NotificationRequest } from 'expo-notifications';

const legacyRecurringNotificationPrefix = 'gastos-payment:';

export function legacyRecurringNotificationIds(
  scheduled: readonly Pick<NotificationRequest, 'identifier'>[]
): string[] {
  return scheduled
    .filter(({ identifier }) => identifier.startsWith(legacyRecurringNotificationPrefix))
    .map(({ identifier }) => identifier);
}

export async function clearLegacyRecurringNotifications(): Promise<void> {
  const scheduled = await getAllScheduledNotificationsAsync();
  const obsoleteIds = legacyRecurringNotificationIds(scheduled);
  await Promise.all(obsoleteIds.map((identifier) => cancelScheduledNotificationAsync(identifier)));
}
