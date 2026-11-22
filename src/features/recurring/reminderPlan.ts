import { addDaysToKey, isLocalDayKey, todayKey } from '@/lib/dates';
import { formatPeso } from '@/lib/money';

import { firstOccurrenceAtOrAfter, localTime, occurrenceDay, reminderOffsets } from './calendar';
import type { Occurrence, Preferences, Schedule } from './repository';

export const reminderPrefix = 'gastos-payment:';
export const reminderTitle = 'Bayaran time, Geng! 💸';
export type Reminder = { id: string; schedule: Schedule; dueDay: string; fireAt: number; body: string };

export function planReminders(schedules: Schedule[], occurrences: Occurrence[], preferences: Preferences, now: number) {
  if (!preferences.enabled) return [];
  const today = todayKey(now);
  const horizon = addDaysToKey(today, 30);
  const lastDue = addDaysToKey(horizon, 7);
  const lastTime = localTime(addDaysToKey(horizon, 1), '00:00');
  const known = new Map(occurrences.map((row) => [`${row.schedule_id}:${row.due_day}`, row]));
  const result: Reminder[] = [];
  function add(schedule: Schedule, dueDay: string, fireAt: number, occurrence?: Occurrence) {
    if (fireAt <= now || fireAt >= lastTime) return;
    const body = preferences.preview
      ? `${occurrence?.name ?? schedule.name} · ${formatPeso(occurrence?.amount ?? schedule.amount)} · Due ${dueDay}`
      : 'You have a payment reminder. Tap to review.';
    result.push({ id: `${reminderPrefix}${schedule.id}:${dueDay}:${fireAt}`, schedule, dueDay, fireAt, body });
  }

  for (const schedule of schedules) {
    if (schedule.state !== 'active') continue;
    for (const occurrence of occurrences) {
      if (occurrence.schedule_id === schedule.id && occurrence.status === 'pending' &&
          occurrence.snooze_day && occurrence.snooze_time) {
        add(schedule, occurrence.due_day, localTime(occurrence.snooze_day, occurrence.snooze_time), occurrence);
      }
    }
    if (schedule.mode !== 'reminder') continue;
    const start = firstOccurrenceAtOrAfter(schedule.start_day, schedule.frequency, today);
    for (let index = start; ; index++) {
      const day = occurrenceDay(schedule.start_day, schedule.frequency, index);
      if (day > lastDue || (schedule.end_day && day > schedule.end_day)) break;
      const occurrence = known.get(`${schedule.id}:${day}`);
      if ((occurrence && occurrence.status !== 'pending') || occurrence?.snooze_day) continue;
      for (const [bit, offset] of reminderOffsets.entries()) {
        if (schedule.offsets & (1 << bit)) {
          add(schedule, day, localTime(addDaysToKey(day, -offset), schedule.due_time), occurrence);
        }
      }
    }
  }
  return result.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id)).slice(0, 60);
}

export function parseReminderTarget(identifier: string, data: Record<string, unknown> = {}) {
  const { scheduleId, dueDay, fireAt } = data;
  if (typeof scheduleId !== 'number' || !Number.isSafeInteger(scheduleId) || scheduleId <= 0 ||
      typeof dueDay !== 'string' || !isLocalDayKey(dueDay) ||
      typeof fireAt !== 'number' || !Number.isSafeInteger(fireAt) ||
      identifier !== `${reminderPrefix}${scheduleId}:${dueDay}:${fireAt}`) return null;
  return { scheduleId, dueDay };
}
