import { addDaysToKey, dayKeyToLocalDate, startOfMonthKey, startOfWeekKey, todayKey } from '@/lib/dates';

export type SummaryPeriod = 'week' | 'month';

export function summaryRanges(period: SummaryPeriod, today = todayKey()) {
  if (period === 'week') {
    return {
      current: { fromKey: startOfWeekKey(today), toKey: today },
      previous: { fromKey: addDaysToKey(startOfWeekKey(today), -7), toKey: addDaysToKey(today, -7) },
    };
  }

  const fromKey = startOfMonthKey(today);
  const previousEnd = addDaysToKey(fromKey, -1);
  const previousStart = startOfMonthKey(previousEnd);
  // Match the number of elapsed days, capped at the previous month's final day.
  const previousDays = Math.min(dayKeyToLocalDate(today).getDate(), dayKeyToLocalDate(previousEnd).getDate());
  return {
    current: { fromKey, toKey: today },
    previous: { fromKey: previousStart, toKey: addDaysToKey(previousStart, previousDays - 1) },
  };
}
