import type { ExpenseWithCategory } from '@/db/types';
import { groupExpensesByDay } from '@/features/history/utils/groupExpensesByDay';

function expense(
  id: number,
  localDay: string,
  createdAt: number,
  overrides: Partial<ExpenseWithCategory> = {}
): ExpenseWithCategory {
  return {
    id,
    amountCentavos: 100,
    categoryId: 1,
    note: null,
    createdAt,
    localDay,
    updatedAt: createdAt,
    categoryName: 'Food',
    categoryIcon: 'fast-food-outline',
    categoryColor: '#FFB347',
    categoryIsArchived: false,
    ...overrides,
  };
}

describe('groupExpensesByDay', () => {
  const now = new Date(2026, 10, 21, 12).getTime();

  test('returns no sections for no expenses', () => {
    expect(groupExpensesByDay([], new Map(), now)).toEqual([]);
  });

  test('groups by persisted localDay and orders sections and rows deterministically', () => {
    const sameTime = new Date(2026, 10, 21, 8).getTime();
    const rows = [
      expense(1, '2026-11-20', new Date(2026, 10, 20, 23, 59).getTime()),
      expense(2, '2026-11-21', sameTime),
      expense(4, '2026-11-21', sameTime),
      expense(3, '2026-11-21', new Date(2026, 10, 21, 9).getTime()),
    ];
    const sections = groupExpensesByDay(rows, new Map(), now);

    expect(sections.map((section) => [section.key, section.title])).toEqual([
      ['2026-11-21', 'Today'],
      ['2026-11-20', 'Yesterday'],
    ]);
    expect(sections[0]?.data.map((row) => row.id)).toEqual([3, 4, 2]);
  });

  test('uses SQL-provided full-day totals instead of only loaded rows', () => {
    const rows = [expense(1, '2026-11-21', now, { amountCentavos: 125 })];
    const sections = groupExpensesByDay(rows, new Map([['2026-11-21', 9_999]]), now);
    expect(sections[0]?.totalCentavos).toBe(9_999);
  });

  test.each([
    ['month boundary', new Date(2026, 2, 1, 12), '2026-02-28'],
    ['year boundary', new Date(2026, 0, 1, 12), '2025-12-31'],
    ['leap day', new Date(2024, 2, 1, 12), '2024-02-29'],
  ])('labels yesterday across a %s', (_name, current, previousKey) => {
    const row = expense(1, previousKey, current.getTime() - 1);
    expect(groupExpensesByDay([row], new Map(), current.getTime())[0]?.title).toBe('Yesterday');
  });

  test('keeps local-midnight records in their persisted sections', () => {
    const before = expense(1, '2026-11-20', new Date(2026, 10, 20, 23, 59, 59).getTime());
    const after = expense(2, '2026-11-21', new Date(2026, 10, 21, 0, 0).getTime());
    expect(groupExpensesByDay([before, after], new Map(), now).map((section) => section.key)).toEqual([
      '2026-11-21',
      '2026-11-20',
    ]);
  });

  test('adds the year for older history and preserves archived category data', () => {
    const archived = expense(1, '2025-06-01', new Date(2025, 5, 1, 12).getTime(), {
      categoryName: 'Old Lane',
      categoryIsArchived: true,
    });
    const section = groupExpensesByDay([archived], new Map(), now)[0];
    expect(section?.title).toContain('2025');
    expect(section?.data[0]).toMatchObject({ categoryName: 'Old Lane', categoryIsArchived: true });
  });
});
