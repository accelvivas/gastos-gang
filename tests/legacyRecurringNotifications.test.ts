import * as Notifications from 'expo-notifications';
import {
  clearLegacyRecurringNotifications,
  legacyRecurringNotificationIds,
} from '@/lib/legacyRecurringNotifications';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn(),
}));

function scheduledNotification(identifier: string): Notifications.NotificationRequest {
  return {
    identifier,
    content: {
      title: null,
      subtitle: null,
      body: null,
      categoryIdentifier: null,
      sound: null,
      launchImageName: null,
      badge: null,
      attachments: [],
      threadIdentifier: null,
    },
    trigger: null,
  };
}

test('selects only scheduled notifications created by recurring expenses', () => {
  expect(legacyRecurringNotificationIds([
    { identifier: 'gastos-payment:12:2026-11-22:1795312800000' },
    { identifier: 'another-feature:reminder' },
  ])).toEqual(['gastos-payment:12:2026-11-22:1795312800000']);
});

test('cancels legacy reminders without affecting other scheduled notifications', async () => {
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    scheduledNotification('gastos-payment:12:2026-11-22:1795312800000'),
    scheduledNotification('another-feature:reminder'),
  ]);

  await clearLegacyRecurringNotifications();

  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync)
    .toHaveBeenCalledWith('gastos-payment:12:2026-11-22:1795312800000');
});
