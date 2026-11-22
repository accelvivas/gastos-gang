import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';

import type { ExpenseWithCategory } from '@/db/types';
import { useExpenseHistory } from '@/features/history/hooks/useExpenseHistory';
import { notifyExpenseChange } from '@/lib/expenseChanges';
import * as expensesRepo from '@/repositories/expensesRepo';

const mockDb = {};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    mockUseEffect(callback, [callback]),
}));
jest.mock('@/features/history/hooks/useDeleteExpense', () => ({
  useDeleteExpense: () => ({ deleteExpense: jest.fn(), undoDelete: jest.fn() }),
}));
jest.mock('@/repositories/expensesRepo', () => ({ listPage: jest.fn(), sumByDayKeys: jest.fn() }));

function row(id: number, createdAt: number, localDay = '2026-11-21'): ExpenseWithCategory {
  return {
    id, amountCentavos: id, categoryId: 1, note: null, createdAt, localDay, updatedAt: createdAt,
    categoryName: 'Food', categoryIcon: 'fast-food-outline', categoryColor: '#FFB347',
    categoryIsArchived: false,
  };
}

describe('useExpenseHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(expensesRepo.sumByDayKeys).mockResolvedValue([
      { day: '2026-11-21', totalCentavos: 99_999, count: 40 },
    ]);
  });

  test('loads the first keyset page and uses the database subtotal', async () => {
    jest.mocked(expensesRepo.listPage).mockResolvedValue([row(1, 100)]);
    const { result } = await renderHook(() => useExpenseHistory(() => new Date(2026, 10, 21, 12).getTime()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(expensesRepo.listPage).toHaveBeenCalledWith(mockDb, { limit: 30 });
    expect(expensesRepo.sumByDayKeys).toHaveBeenCalledWith(mockDb, ['2026-11-21'], undefined);
    expect(result.current.sections[0]?.totalCentavos).toBe(99_999);
    expect(result.current.hasMore).toBe(false);
  });

  test('loads one next page for concurrent end events and uses the final row as cursor', async () => {
    const firstPage = Array.from({ length: 30 }, (_, index) => row(100 - index, 1_000 - index));
    const nextPage = [row(70, 970), row(69, 969), row(68, 968)];
    let resolveNext: ((rows: ExpenseWithCategory[]) => void) | undefined;
    jest.mocked(expensesRepo.listPage)
      .mockResolvedValueOnce(firstPage)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    const { result } = await renderHook(() => useExpenseHistory(() => new Date(2026, 10, 21, 12).getTime()));
    await waitFor(() => expect(result.current.expenses).toHaveLength(30));

    let firstLoad: Promise<void> | undefined;
    await act(() => {
      firstLoad = result.current.loadMore();
      void result.current.loadMore();
    });
    expect(expensesRepo.listPage).toHaveBeenCalledTimes(2);
    expect(expensesRepo.listPage).toHaveBeenLastCalledWith(mockDb, {
      limit: 30,
      cursor: { createdAt: 971, id: 71 },
    });
    await act(async () => {
      resolveNext?.(nextPage);
      await firstLoad;
    });
    expect(result.current.expenses.map((expense) => expense.id)).toHaveLength(33);
    expect(new Set(result.current.expenses.map((expense) => expense.id)).size).toBe(33);
    expect(result.current.hasMore).toBe(false);
    expect(expensesRepo.sumByDayKeys).toHaveBeenCalledTimes(1);
  });

  test('fetches only new day subtotals on pagination and recalculates existing days on refresh', async () => {
    const firstPage = Array.from({ length: 30 }, (_, index) => row(100 - index, 1_000 - index));
    jest.mocked(expensesRepo.listPage)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([row(70, 970), row(69, 969, '2026-10-03')])
      .mockResolvedValueOnce([row(100, 1000)]);
    const totals = jest.mocked(expensesRepo.sumByDayKeys);
    totals.mockResolvedValueOnce([{ day: '2026-11-21', totalCentavos: 500, count: 31 }])
      .mockResolvedValueOnce([{ day: '2026-10-03', totalCentavos: 250, count: 1 }])
      .mockResolvedValueOnce([{ day: '2026-11-21', totalCentavos: 600, count: 1 }]);
    const { result } = await renderHook(() => useExpenseHistory());
    await waitFor(() => expect(result.current.expenses).toHaveLength(30));

    await act(() => result.current.loadMore());
    expect(totals).toHaveBeenLastCalledWith(mockDb, ['2026-10-03'], undefined);
    expect(result.current.sections.map(({ totalCentavos }) => totalCentavos)).toEqual([500, 250]);
    await act(() => result.current.refresh());
    expect(result.current.sections.map(({ totalCentavos }) => totalCentavos)).toEqual([600]);
  });

  test('invalidates in-flight pagination when replacement data triggers a refresh', async () => {
    const firstPage = Array.from({ length: 30 }, (_, index) => row(100 - index, 1_000 - index));
    let resolveNext: ((rows: ExpenseWithCategory[]) => void) | undefined;
    jest.mocked(expensesRepo.listPage)
      .mockResolvedValueOnce(firstPage)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }))
      .mockResolvedValueOnce([row(500, 500)]);
    const { result } = await renderHook(() => useExpenseHistory(() => 10_000));
    await waitFor(() => expect(result.current.expenses).toHaveLength(30));

    let loadMore: Promise<void> | undefined;
    await act(() => {
      loadMore = result.current.loadMore();
    });
    expect(result.current.isLoadingMore).toBe(true);

    await act(async () => {
      notifyExpenseChange();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.expenses.map((expense) => expense.id)).toEqual([500]));
    expect(result.current.isLoadingMore).toBe(false);

    await act(async () => {
      resolveNext?.([row(70, 970)]);
      await loadMore;
    });
    expect(result.current.expenses.map((expense) => expense.id)).toEqual([500]);
  });

  test('an obsolete page cannot unlock pagination while the new page is pending', async () => {
    const original = Array.from({ length: 30 }, (_, index) => row(100 - index, 1000 - index));
    const refreshed = Array.from({ length: 30 }, (_, index) => row(200 - index, 2000 - index));
    let finishOld: (rows: ExpenseWithCategory[]) => void = () => undefined;
    let finishCurrent: (rows: ExpenseWithCategory[]) => void = () => undefined;
    jest.mocked(expensesRepo.listPage)
      .mockResolvedValueOnce(original)
      .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(refreshed)
      .mockImplementationOnce(() => new Promise((resolve) => { finishCurrent = resolve; }));
    const { result } = await renderHook(() => useExpenseHistory());
    await waitFor(() => expect(result.current.expenses[0]?.id).toBe(100));
    await act(() => { void result.current.loadMore(); });
    await act(() => result.current.refresh());
    await act(() => { void result.current.loadMore(); });
    await act(() => finishOld([]));
    expect(result.current.isLoadingMore).toBe(true);
    await act(() => { void result.current.loadMore(); });
    expect(expensesRepo.listPage).toHaveBeenCalledTimes(4);
    await act(() => finishCurrent([row(170, 1970)]));
    expect(result.current.expenses.at(-1)?.id).toBe(170);
  });
});
