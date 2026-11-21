import { act, renderHook, waitFor } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect as mockUseEffect } from 'react';

import { useTodayTotal } from '@/features/entry/hooks/useTodayTotal';
import { notifyBudgetChange, notifyDataReplaced, notifyExpenseChange } from '@/lib/expenseChanges';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import * as settingsRepo from '@/repositories/settingsRepo';
import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
let mockAppStateListener: ((state: AppStateStatus) => void) | null = null;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]),
}));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 21, 12));
  mockDb = await createTestDb();
  mockAppStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    mockAppStateListener = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(Toast.show).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockDb.close();
});

test('refreshes spending through expense and budget changes and warns once per upward crossing', async () => {
  const category = (await categoriesRepo.listActive(mockDb))[0]!;
  await settingsRepo.setDailyBudget(mockDb, true, 10_000);
  const { result, unmount } = await renderHook(() => useTodayTotal());
  await waitFor(() => expect(result.current.budgetLimitCentavos).toBe(10_000));
  expect(result.current.totalCentavos).toBe(0);

  const saved = await expensesRepo.create(mockDb, { amountCentavos: 8_000, categoryId: category.id, createdAt: Date.now() });
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.budgetProgress?.stage).toBe('warning'));
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Toast.show).mock.calls[0]?.[0].text1).toBe(
    'Bossing, malapit na sa budget limit!'
  );

  const edited = await expensesRepo.create(mockDb, { amountCentavos: 500, categoryId: category.id, createdAt: Date.now() });
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.totalCentavos).toBe(8_500));
  expect(Toast.show).toHaveBeenCalledTimes(1);

  await expensesRepo.create(mockDb, { amountCentavos: 2_000, categoryId: category.id, createdAt: Date.now() });
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.budgetProgress?.stage).toBe('over'));
  expect(Toast.show).toHaveBeenCalledTimes(2);
  expect(jest.mocked(Toast.show).mock.calls[1]?.[0].text1).toBe(
    'Aray! Lagpas budget na tayo, bossing!'
  );

  await expensesRepo.update(mockDb, saved.id, { amountCentavos: 6_000 });
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.totalCentavos).toBe(8_500));
  const deleted = await expensesRepo.remove(mockDb, edited.id);
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.totalCentavos).toBe(8_000));
  await expensesRepo.restore(mockDb, deleted);
  await act(() => notifyExpenseChange());
  await waitFor(() => expect(result.current.totalCentavos).toBe(8_500));

  await settingsRepo.setDailyBudget(mockDb, false);
  await act(() => notifyBudgetChange());
  await waitFor(() => expect(result.current.budgetEnabled).toBe(false));
  expect(result.current.budgetLimitCentavos).toBe(10_000);
  await unmount();
});

test('refreshes a future expense when it becomes eligible without polling', async () => {
  const category = (await categoriesRepo.listActive(mockDb))[0]!;
  await settingsRepo.setDailyBudget(mockDb, true, 1_000);
  const now = Date.now();
  await expensesRepo.create(mockDb, {
    amountCentavos: 1_200,
    categoryId: category.id,
    createdAt: now + 2_000,
  });
  const { result, unmount } = await renderHook(() => useTodayTotal());
  await waitFor(() => expect(result.current.totalCentavos).toBe(0));
  expect(Toast.show).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(2_100);
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.totalCentavos).toBe(1_200));
  expect(result.current.budgetProgress?.percentageUsed).toBe(120);
  expect(Toast.show).toHaveBeenCalledTimes(1);
  await unmount();
});

test('refreshes for the next local day at midnight', async () => {
  const category = (await categoriesRepo.listActive(mockDb))[0]!;
  const beforeMidnight = new Date(2026, 10, 21, 23, 59, 30).getTime();
  await expensesRepo.create(mockDb, {
    amountCentavos: 1_200,
    categoryId: category.id,
    createdAt: beforeMidnight,
  });
  jest.setSystemTime(new Date(2026, 10, 21, 23, 59, 59));
  const { result, unmount } = await renderHook(() => useTodayTotal());
  await waitFor(() => expect(result.current.totalCentavos).toBe(1_200));

  await act(async () => {
    jest.advanceTimersByTime(1_200);
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.dayKey).toBe('2026-11-22'));
  expect(result.current.totalCentavos).toBe(0);
  await unmount();
});

test('refreshes after the app resumes from the background', async () => {
  const category = (await categoriesRepo.listActive(mockDb))[0]!;
  const { result, unmount } = await renderHook(() => useTodayTotal());
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  await expensesRepo.create(mockDb, {
    amountCentavos: 2_500,
    categoryId: category.id,
    createdAt: Date.now(),
  });
  await act(() => mockAppStateListener?.('active'));
  await waitFor(() => expect(result.current.totalCentavos).toBe(2_500));
  await unmount();
});

test('refreshes restored data without replaying budget threshold warnings', async () => {
  const category = (await categoriesRepo.listActive(mockDb))[0]!;
  await settingsRepo.setDailyBudget(mockDb, true, 1_000);
  const { result, unmount } = await renderHook(() => useTodayTotal());
  await waitFor(() => expect(result.current.budgetLimitCentavos).toBe(1_000));
  expect(Toast.show).not.toHaveBeenCalled();

  await expensesRepo.create(mockDb, {
    amountCentavos: 900,
    categoryId: category.id,
    createdAt: Date.now(),
  });
  await act(() => notifyDataReplaced());

  await waitFor(() => expect(result.current.totalCentavos).toBe(900));
  expect(result.current.budgetProgress?.stage).toBe('warning');
  expect(Toast.show).not.toHaveBeenCalled();
  await unmount();
});
