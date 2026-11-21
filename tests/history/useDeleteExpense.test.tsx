import { act, renderHook } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';

import type { Expense, ExpenseWithCategory } from '@/db/types';
import { useDeleteExpense } from '@/features/history/hooks/useDeleteExpense';
import * as expensesRepo from '@/repositories/expensesRepo';

const mockDb = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock('@/repositories/expensesRepo', () => ({ remove: jest.fn(), restore: jest.fn() }));

function joined(id: number): ExpenseWithCategory {
  return {
    id,
    amountCentavos: 7_000,
    categoryId: 3,
    note: 'Lunch',
    createdAt: 1_000,
    localDay: '1970-01-01',
    updatedAt: 1_001,
    categoryName: 'Food',
    categoryIcon: 'fast-food-outline',
    categoryColor: '#FFB347',
    categoryIsArchived: false,
  };
}

function snapshot(row: ExpenseWithCategory): Expense {
  const { id, amountCentavos, categoryId, note, createdAt, localDay, updatedAt } = row;
  return { id, amountCentavos, categoryId, note, createdAt, localDay, updatedAt };
}

describe('useDeleteExpense', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('deletes once and restores the exact snapshot immediately before expiry', async () => {
    const row = joined(42);
    const deleted = snapshot(row);
    jest.mocked(expensesRepo.remove).mockResolvedValue(deleted);
    jest.mocked(expensesRepo.restore).mockResolvedValue(deleted);
    const onChanged = jest.fn();
    const { result, unmount } = await renderHook(() => useDeleteExpense({ onChanged }));

    await act(async () => {
      await Promise.all([result.current.deleteExpense(row), result.current.deleteExpense(row)]);
    });
    expect(expensesRepo.remove).toHaveBeenCalledTimes(1);
    const undo = jest.mocked(Toast.show).mock.calls[0]?.[0].props.onUndo as (() => Promise<void>);

    await act(async () => {
      jest.advanceTimersByTime(4_999);
      await undo();
    });
    expect(expensesRepo.restore).toHaveBeenCalledWith(mockDb, deleted);
    expect(onChanged).toHaveBeenCalledTimes(2);
    unmount();
  });

  test.each([5_000, 5_001])('rejects undo at %i milliseconds', async (elapsed) => {
    const row = joined(7);
    jest.mocked(expensesRepo.remove).mockResolvedValue(snapshot(row));
    const { result, unmount } = await renderHook(() => useDeleteExpense({ onChanged: jest.fn() }));
    await act(async () => { await result.current.deleteExpense(row); });
    const undo = jest.mocked(Toast.show).mock.calls[0]?.[0].props.onUndo as (() => Promise<void>);

    await act(async () => {
      jest.advanceTimersByTime(elapsed);
      await undo();
    });
    expect(expensesRepo.restore).not.toHaveBeenCalled();
    unmount();
  });

  test('rejects a replaced stale callback and repeated Undo taps', async () => {
    const first = joined(1);
    const second = joined(2);
    jest.mocked(expensesRepo.remove)
      .mockResolvedValueOnce(snapshot(first))
      .mockResolvedValueOnce(snapshot(second));
    let resolveRestore: ((value: Expense) => void) | undefined;
    jest.mocked(expensesRepo.restore).mockImplementation(
      () => new Promise((resolve) => { resolveRestore = resolve; })
    );
    const { result, unmount } = await renderHook(() => useDeleteExpense({ onChanged: jest.fn() }));
    await act(async () => { await result.current.deleteExpense(first); });
    const staleUndo = jest.mocked(Toast.show).mock.calls[0]?.[0].props.onUndo as (() => Promise<void>);
    await act(async () => { await result.current.deleteExpense(second); });
    const currentUndo = jest.mocked(Toast.show).mock.calls[1]?.[0].props.onUndo as (() => Promise<void>);

    await act(async () => { await staleUndo(); });
    expect(expensesRepo.restore).not.toHaveBeenCalled();
    let firstPromise: Promise<void> | undefined;
    await act(() => {
      firstPromise = currentUndo();
      void currentUndo();
    });
    expect(expensesRepo.restore).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRestore?.(snapshot(second));
      await firstPromise;
    });
    unmount();
  });

  test('keeps the retry bound to the same snapshot after restoration failure', async () => {
    const row = joined(9);
    const deleted = snapshot(row);
    jest.mocked(expensesRepo.remove).mockResolvedValue(deleted);
    jest.mocked(expensesRepo.restore).mockRejectedValueOnce(new Error('busy'));
    const { result, unmount } = await renderHook(() => useDeleteExpense({ onChanged: jest.fn() }));
    await act(async () => { await result.current.deleteExpense(row); });
    const undo = jest.mocked(Toast.show).mock.calls[0]?.[0].props.onUndo as (() => Promise<void>);
    await act(async () => { await undo(); });

    const retryCall = jest.mocked(Toast.show).mock.calls[1]?.[0];
    expect(retryCall?.text1).toContain('Try ulit');
    expect(retryCall?.props.undoAccessibilityLabel).toBe('Retry restoring deleted expense');
    unmount();
  });
});
