import { act, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { RecurringLifecycle } from '@/features/recurring/RecurringLifecycle';
import { localTime } from '@/features/recurring/calendar';
import { materializeUpcoming, saveSchedule, setScheduleState } from '@/features/recurring/repository';

import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
let mockNavigationKey: string | undefined;
let mockListener: ((response: Notifications.NotificationResponse) => void) | undefined;

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useRootNavigationState: () => ({ key: mockNavigationKey }),
}));
jest.mock('@/features/recurring/runtime', () => ({ refreshRecurring: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/features/recurring/nativeReminders', () => ({ configureForegroundNotifications: jest.fn() }));
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((listener) => {
    mockListener = listener;
    return { remove: () => { mockListener = undefined; } };
  }),
}));

const dueDay = '2026-11-08';
const fireAt = localTime(dueDay, '09:00');
let id: number;

function response(scheduleId = id): Notifications.NotificationResponse {
  return { actionIdentifier: 'default', notification: { date: fireAt, request: {
    identifier: `gastos-payment:${scheduleId}:${dueDay}:${fireAt}`, trigger: null, content: {
      title: 'Payment reminder', body: null, subtitle: null, categoryIdentifier: null, sound: null, threadIdentifier: null,
      data: { scheduleId, dueDay, fireAt, url: '/settings/restore' },
    },
  } } };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockNavigationKey = 'root';
  mockDb = await createTestDb();
  id = await saveSchedule(mockDb, { name: 'Bill', amount: 100, category_id: 5, frequency: 'monthly',
    start_day: dueDay, end_day: null, due_time: '09:00', mode: 'reminder', offsets: 1 }, undefined, fireAt);
  await materializeUpcoming(mockDb, id, dueDay);
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
});
afterEach(() => mockDb.close());

test('waits for router readiness on a cold start and consumes a duplicate response once', async () => {
  mockNavigationKey = undefined;
  const notification = response();
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(notification);
  const screen = await render(<RecurringLifecycle />);
  expect(router.push).not.toHaveBeenCalled();
  mockNavigationKey = 'root';
  await screen.rerender(<RecurringLifecycle />);
  await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/[feature]',
    params: { feature: 'recurring', scheduleId: String(id), dueDay },
  }));
  await act(() => mockListener?.(notification));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
});

test('ignores a deleted target and opens an existing bill from a warm response', async () => {
  const deletedId = await saveSchedule(mockDb, { name: 'Old bill', amount: 100, category_id: 5,
    frequency: 'monthly', start_day: dueDay, end_day: null, due_time: '09:00', mode: 'reminder', offsets: 1 },
    undefined, fireAt);
  await materializeUpcoming(mockDb, deletedId, dueDay);
  await setScheduleState(mockDb, deletedId, 'deleted', fireAt);
  const deleted = response(deletedId);
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(deleted);
  await render(<RecurringLifecycle />);
  await waitFor(() => expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled());
  expect(router.push).not.toHaveBeenCalled();
  await act(() => mockListener?.(response()));
  await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
});
