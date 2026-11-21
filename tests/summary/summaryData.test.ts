import { todayKey } from '@/lib/dates';
import { compareSpending, loadSpendingSummary } from '@/features/summary/summaryData';
import { summaryRanges, type SummaryPeriod } from '@/features/summary/summaryPeriods';
import { archive, listActive } from '@/repositories/categoriesRepo';
import {
  create, listByDayRange, readSpendingSummary, sumByCategory, sumByDay, totalForRange, update,
} from '@/repositories/expensesRepo';

import { createTestDb } from '../helpers/testDb';

test.each([
  ['week', new Date(2026, 0, 1, 0, 1), '2025-12-29', '2026-01-01', '2025-12-22', '2025-12-25'],
  ['week', new Date(2026, 2, 1, 23, 59), '2026-02-23', '2026-03-01', '2026-02-16', '2026-02-22'],
  ['week', new Date(2026, 10, 16), '2026-11-16', '2026-11-16', '2026-11-09', '2026-11-09'],
  ['month', new Date(2024, 2, 31), '2024-03-01', '2024-03-31', '2024-02-01', '2024-02-29'],
  ['month', new Date(2025, 2, 31), '2025-03-01', '2025-03-31', '2025-02-01', '2025-02-28'],
  ['month', new Date(2026, 0, 20), '2026-01-01', '2026-01-20', '2025-12-01', '2025-12-20'],
] satisfies [SummaryPeriod, Date, string, string, string, string][])(
  '%s uses local calendar dates for %s',
  (period, date, fromKey, toKey, prevFrom, prevTo) => {
    expect(summaryRanges(period, todayKey(date.getTime()))).toEqual({
      current: { fromKey, toKey }, previous: { fromKey: prevFrom, toKey: prevTo },
    });
  }
);

test.each([
  [0, 0, 'empty', 0, null],
  [101, 0, 'new', 101, null],
  [100, 100, 'equal', 0, 0],
  [125, 100, 'higher', 25, 25],
  [75, 100, 'lower', -25, -25],
  [0, 100, 'lower', -100, -100],
])('compares %i current centavos with %i previous centavos', (current, previous, kind, differenceCentavos, percentageChange) => {
  expect(compareSpending(current, previous)).toEqual({ kind, differenceCentavos, percentageChange });
});

test('SQL snapshot reconciles integer totals, uses inclusive local days and retains archived categories', async () => {
  const db = await createTestDb();
  try {
    const [food, transport] = await listActive(db);
    for (const [categoryId, amountCentavos, createdAt] of [
      [food!.id, 400, new Date(2026, 10, 16, 0, 0)],
      [food!.id, 301, new Date(2026, 10, 16, 23, 59)],
      [transport!.id, 701, new Date(2026, 10, 18, 23, 59)],
      [transport!.id, 1000, new Date(2026, 10, 19, 0, 0)],
      [food!.id, 502, new Date(2026, 10, 11, 23, 59)],
      [food!.id, 5000, new Date(2026, 10, 12, 0, 0)],
    ] as const) {
      await create(db, { categoryId, amountCentavos, createdAt: createdAt.getTime() });
    }
    await archive(db, food!.id);
    const data = await loadSpendingSummary(db, 'week', '2026-11-18');
    expect(data.totalCentavos).toBe(1402);
    expect(data.previousTotalCentavos).toBe(502);
    expect(data.comparison.differenceCentavos).toBe(900);
    expect(data.categories.map(({ categoryId, totalCentavos, count, percentage }) => [categoryId, totalCentavos, count, percentage]))
      .toEqual([[food!.id, 701, 2, 50], [transport!.id, 701, 1, 50]]);
    expect(data.topCategory?.categoryId).toBe(food!.id);
    expect(data.biggestDay?.day).toBe('2026-11-16');
    expect(data.days.map(({ totalCentavos, count }) => [totalCentavos, count])).toEqual([[701, 2], [0, 0], [701, 1]]);
    expect(data.averageCentavos).toBe(467);
    const { fromKey, toKey } = data.ranges.current;
    const sum = await totalForRange(db, fromKey, toKey);
    expect(sum).toBe(data.totalCentavos);
    expect((await sumByCategory(db, fromKey, toKey)).reduce((total, row) => total + row.totalCentavos, 0)).toBe(sum);
    expect((await sumByDay(db, fromKey, toKey)).reduce((total, row) => total + row.totalCentavos, 0)).toBe(sum);
  } finally {
    db.close();
  }
});

test('empty aggregates produce zero totals and no spending insights claiming a peak', async () => {
  const db = await createTestDb();
  try {
    const data = await loadSpendingSummary(db, 'month', '2024-02-29');
    expect(data).toMatchObject({ totalCentavos: 0, previousTotalCentavos: 0, averageCentavos: 0, topCategory: null, biggestDay: null, categories: [] });
    expect(data.days).toHaveLength(29);
    expect(data.days.every((day) => day.totalCentavos === 0 && day.count === 0)).toBe(true);
  } finally {
    db.close();
  }
});

test('rejects an aggregate SQLite cannot represent safely in JavaScript', async () => {
  const db = await createTestDb();
  try {
    // SQLite's INTEGER supports this amount even though the UI and JS number type do not.
    const [category] = await listActive(db);
    await db.runAsync(
      "INSERT INTO expenses (amount_centavos, category_id, created_at, local_day, updated_at) VALUES (9007199254740992, ?, 0, '2026-11-21', 0)",
      [category!.id]
    );
    const { current, previous } = summaryRanges('week', '2026-11-21');
    await expect(readSpendingSummary(db, current, previous)).rejects.toThrow('supported precision');
  } finally {
    db.close();
  }
});

test('future timestamps are excluded at every Summary aggregate boundary', async () => {
  const db = await createTestDb();
  try {
    const cutoff = new Date(2026, 10, 21, 12).getTime();
    jest.spyOn(Date, 'now').mockReturnValue(cutoff);
    const [food, transport] = await listActive(db);

    await create(db, { amountCentavos: 100, categoryId: food!.id, createdAt: cutoff - 3_600_000 });
    await create(db, { amountCentavos: 200, categoryId: food!.id, createdAt: cutoff });
    await create(db, { amountCentavos: 300, categoryId: transport!.id, createdAt: cutoff + 1 });
    await create(db, { amountCentavos: 400, categoryId: transport!.id, createdAt: new Date(2026, 10, 21, 21).getTime() });
    await create(db, { amountCentavos: 500, categoryId: transport!.id, createdAt: new Date(2026, 10, 22, 9).getTime() });
    await create(db, { amountCentavos: 600, categoryId: transport!.id, createdAt: new Date(2026, 10, 10, 12).getTime() });

    const data = await loadSpendingSummary(db, 'week', '2026-11-21', cutoff);

    expect(data.totalCentavos).toBe(300);
    expect(data.previousTotalCentavos).toBe(600);
    expect(data.comparison.differenceCentavos).toBe(-300);
    expect(data.categories.reduce((sum, row) => sum + row.totalCentavos, 0)).toBe(data.totalCentavos);
    expect(data.days.reduce((sum, row) => sum + row.totalCentavos, 0)).toBe(data.totalCentavos);
  } finally {
    jest.restoreAllMocks();
    db.close();
  }
});

test('future expense becomes eligible and Summary updates after editing', async () => {
  const db = await createTestDb();
  try {
    const cutoff = new Date(2026, 10, 21, 12).getTime();
    const future = new Date(2026, 10, 21, 21).getTime();
    const [food] = await listActive(db);
    const expense = await create(db, { amountCentavos: 500, categoryId: food!.id, createdAt: future });

    expect((await loadSpendingSummary(db, 'week', '2026-11-21', cutoff)).totalCentavos).toBe(0);
    expect((await loadSpendingSummary(db, 'week', '2026-11-21', future)).totalCentavos).toBe(500);

    await update(db, expense.id, { createdAt: future + 1 });
    expect((await loadSpendingSummary(db, 'week', '2026-11-21', future)).totalCentavos).toBe(0);
    await update(db, expense.id, { createdAt: cutoff });
    expect((await loadSpendingSummary(db, 'week', '2026-11-21', future)).totalCentavos).toBe(500);

    const history = await listByDayRange(db, '2026-11-21', '2026-11-21');
    expect(history).toContainEqual(expect.objectContaining({ id: expense.id }));
  } finally {
    db.close();
  }
});
