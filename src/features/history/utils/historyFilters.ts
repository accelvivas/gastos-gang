import { addDaysToKey, startOfMonthKey, todayKey } from '@/lib/dates';

export const periods = [
  ['all', 'All time'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'Last 7 days'],
  ['month', 'This month'],
  ['custom', 'Custom range'],
] as const;

export type HistoryFilter = {
  categoryId?: number;
  period: (typeof periods)[number][0];
  fromKey: string;
  toKey: string;
};

export function defaultHistoryFilter(day = todayKey()): HistoryFilter {
  return { period: 'all', fromKey: day, toKey: day };
}

export function historyRange(filter: HistoryFilter, day: string) {
  switch (filter.period) {
    case 'all': return undefined;
    case 'today': return { fromKey: day, toKey: day };
    case 'yesterday': {
      const previous = addDaysToKey(day, -1);
      return { fromKey: previous, toKey: previous };
    }
    case 'week': return { fromKey: addDaysToKey(day, -6), toKey: day };
    case 'month': return { fromKey: startOfMonthKey(day), toKey: day };
    case 'custom': return { fromKey: filter.fromKey, toKey: filter.toKey };
  }
}
