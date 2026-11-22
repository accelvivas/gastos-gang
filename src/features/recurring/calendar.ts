import { addDaysToKey, dayKeyToLocalDate, toLocalDayKey } from '@/lib/dates';

export const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Frequency = typeof frequencies[number];
export const reminderOffsets = [0, 1, 3, 7] as const;
export const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function occurrenceDay(start: string, frequency: Frequency, index: number): string {
  if (frequency === 'daily' || frequency === 'weekly') {
    return addDaysToKey(start, index * (frequency === 'daily' ? 1 : 7));
  }
  const anchor = dayKeyToLocalDate(start);
  const month = anchor.getMonth() + index * (frequency === 'monthly' ? 1 : 12);
  const lastDay = new Date(anchor.getFullYear(), month + 1, 0).getDate();
  // Clamp short months and non-leap years, retaining the original anchor.
  return toLocalDayKey(new Date(anchor.getFullYear(), month, Math.min(lastDay, anchor.getDate())).getTime());
}

export function firstOccurrenceAtOrAfter(start: string, frequency: Frequency, day: string): number {
  if (day <= start) return 0;
  const anchor = dayKeyToLocalDate(start);
  const target = dayKeyToLocalDate(day);
  if (frequency === 'daily' || frequency === 'weekly') {
    const utcDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const days = (utcDay(target) - utcDay(anchor)) / 86_400_000;
    return Math.ceil(days / (frequency === 'weekly' ? 7 : 1));
  }
  const months = 12 * (target.getFullYear() - anchor.getFullYear()) + target.getMonth() - anchor.getMonth();
  const index = Math.floor(months / (frequency === 'yearly' ? 12 : 1));
  return occurrenceDay(start, frequency, index) < day ? index + 1 : index;
}

export function localTime(day: string, time: string): number {
  if (!validTime(time)) throw new Error('Enter a time in HH:MM format.');
  const date = dayKeyToLocalDate(day);
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3));
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}
