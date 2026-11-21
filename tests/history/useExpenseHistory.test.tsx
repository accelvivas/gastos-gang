import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';

import type { ExpenseWithCategory } from '@/db/types';
import { useExpenseHistory } from '@/features/history/hooks/useExpenseHistory';
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
jest.mock('@/repositories/expensesRepo', () => ({ listPage: jest.fn(), sumByDay: jest.fn() }));

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
    jest.mocked(expensesRepo.sumByDay).mockResolvedValue([
      { day: '2026-11-21', totalCentavos: 99_999, count: 40 },
    ]);
  });

  test('loads the first keyset page and uses the database subtotal', async () => {
    jest.mocked(expensesRepo.listPage).mockResolvedValue([row(1, 100)]);
    const { result } = await renderHook(() => useExpenseHistory(() => new Date(2026, 10, 21, 12).getTime()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(expensesRepo.listPage).toHaveBeenCalledWith(mockDb, { limit: 30 });
    expect(expensesRepo.sumByDay).toHaveBeenCalledWith(mockDb, '2026-11-21', '2026-11-21');
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
  });
});
