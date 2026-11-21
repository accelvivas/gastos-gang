import type { ExpenseWithCategory } from '@/db/types';
import type { HistorySection } from '@/features/history/types';
import { dayKeyToLocalDate, formatDayHeader } from '@/lib/dates';

function historyDayTitle(key: string, nowMs: number): string {
  const title = formatDayHeader(key, nowMs);
  if (title === 'Today' || title === 'Yesterday') return title;

  const date = dayKeyToLocalDate(key);
  const currentYear = new Date(nowMs).getFullYear();
  return date.getFullYear() === currentYear ? title : `${title}, ${date.getFullYear()}`;
}

export function groupExpensesByDay(
  expenses: readonly ExpenseWithCategory[],
  totalsByDay: ReadonlyMap<string, number>,
  nowMs = Date.now()
): HistorySection[] {
  const grouped = new Map<string, ExpenseWithCategory[]>();

  for (const expense of expenses) {
    const rows = grouped.get(expense.localDay) ?? [];
    rows.push(expense);
    grouped.set(expense.localDay, rows);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, rows]) => ({
      key,
      title: historyDayTitle(key, nowMs),
      totalCentavos:
        totalsByDay.get(key) ?? rows.reduce((sum, expense) => sum + expense.amountCentavos, 0),
      data: [...rows].sort(
        (left, right) => right.createdAt - left.createdAt || right.id - left.id
      ),
    }));
}
