import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { todayKey } from '@/lib/dates';
import { subscribeToDataReplacement } from '@/lib/expenseChanges';

import { listSchedules, readOccurrence, subscribeRecurring } from './repository';
import { configureForegroundNotifications } from './nativeReminders';
import { parseReminderTarget } from './reminderPlan';
import { reconcileAfterRestore, refreshRecurring } from './runtime';

function readClock() {
  const now = Date.now();
  return {
    day: todayKey(now),
    offset: new Date(now).getTimezoneOffset(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    wallOffset: now - performance.now(),
  };
}

export function RecurringLifecycle() {
  const db = useSQLiteContext();
  const navigationKey = useRootNavigationState()?.key;
  const handled = useRef<string | null>(null);

  useEffect(configureForegroundNotifications, []);

  useEffect(() => {
    let clock = readClock();
    const refresh = () => {
      clock = readClock();
      void refreshRecurring(db).catch(() => console.warn('Could not process recurring expenses.'));
    };
    refresh();
    const stop = subscribeRecurring(refresh);
    const stopRestore = subscribeToDataReplacement(() => {
      void reconcileAfterRestore(db).catch(() => console.warn('Could not reconcile restored payment reminders.'));
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const current = readClock();
      if (clock.day !== current.day || clock.offset !== current.offset || clock.zone !== current.zone ||
          Math.abs(clock.wallOffset - current.wallOffset) > 60_000) refresh();
    }, 30_000);
    return () => {
      stop();
      stopRestore();
      app.remove();
      clearInterval(timer);
    };
  }, [db]);

  useEffect(() => {
    if (!navigationKey || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    let active = true;
    async function open(response: Notifications.NotificationResponse) {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const { identifier, content } = response.notification.request;
      const target = parseReminderTarget(identifier, content.data);
      if (!target || handled.current === identifier) return;
      handled.current = identifier;
      try {
        const [schedules, occurrence] = await Promise.all([
          listSchedules(db), readOccurrence(db, target.scheduleId, target.dueDay),
        ]);
        if (!active) return;
        if (occurrence && schedules.some((schedule) => schedule.id === target.scheduleId)) {
          router.push({ pathname: '/settings/[feature]', params: {
            feature: 'recurring', scheduleId: String(target.scheduleId), dueDay: target.dueDay,
          } });
        }
      } finally {
        if (active && Notifications.getLastNotificationResponse()?.notification.request.identifier === identifier) {
          Notifications.clearLastNotificationResponse();
        }
      }
    }
    const handle = (response: Notifications.NotificationResponse) => {
      void open(response).catch(() => console.warn('Could not open the payment reminder.'));
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    const initial = Notifications.getLastNotificationResponse();
    if (initial) handle(initial);
    return () => { active = false; subscription.remove(); };
  }, [db, navigationKey]);

  return null;
}
