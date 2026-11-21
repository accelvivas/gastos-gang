import type { DbLike } from '@/db/client';
import { fillMissingDays } from '@/lib/dates';
import { readSpendingSummary } from '@/repositories/expensesRepo';

import { summaryRanges, type SummaryPeriod } from './summaryPeriods';

export function compareSpending(current: number, previous: number) {
  const differenceCentavos = current - previous;
  return {
    differenceCentavos,
    percentageChange: previous === 0 ? null : (differenceCentavos / previous) * 100,
    kind: previous === 0
      ? current === 0 ? 'empty' : 'new'
      : differenceCentavos === 0 ? 'equal' : differenceCentavos > 0 ? 'higher' : 'lower',
  } as const;
}

export async function loadSpendingSummary(
  db: DbLike,
  period: SummaryPeriod,
  day: string,
  cutoffMs: number = Date.now()
) {
  const ranges = summaryRanges(period, day);
  const data = await readSpendingSummary(db, ranges.current, ranges.previous, cutoffMs);
  const days = fillMissingDays(data.days, ranges.current.fromKey, ranges.current.toKey);
  const categories = data.categories.filter((row) => row.totalCentavos > 0).map((row) => ({
    ...row,
    percentage: (row.totalCentavos / data.totalCentavos) * 100,
  }));
  const biggestDay = days.reduce<(typeof days)[number] | null>((best, row) =>
    row.totalCentavos > (best?.totalCentavos ?? 0) ? row : best, null);
  // Round half-up to the nearest centavo using integer arithmetic, including zero days.
  const elapsed = BigInt(days.length);
  const averageCentavos = Number((BigInt(data.totalCentavos) + elapsed / 2n) / elapsed);
  return {
    ...data, ranges, days, categories, averageCentavos, biggestDay,
    topCategory: categories[0] ?? null,
    comparison: compareSpending(data.totalCentavos, data.previousTotalCentavos),
  };
}

export type SpendingSummary = Awaited<ReturnType<typeof loadSpendingSummary>>;
