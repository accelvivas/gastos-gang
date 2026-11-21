import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';

import { useActiveCategories } from '@/features/entry/hooks/useActiveCategories';
import { notifyCategoryChange, notifyExpenseChange } from '@/lib/expenseChanges';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]),
}));

beforeEach(async () => {
  mockDb = await createTestDb();
});

afterEach(() => {
  jest.restoreAllMocks();
  mockDb.close();
});

test('refreshes categories on focus and category changes, not ordinary expense changes', async () => {
  const listActive = jest.spyOn(categoriesRepo, 'listActive');
  const { result, unmount } = await renderHook(() => useActiveCategories());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.categories).toHaveLength(6);
  expect(listActive).toHaveBeenCalledTimes(1);

  await act(() => notifyExpenseChange());
  expect(listActive).toHaveBeenCalledTimes(1);

  await act(() => notifyCategoryChange());
  await waitFor(() => expect(listActive).toHaveBeenCalledTimes(2));
  expect(result.current.categories).toHaveLength(6);
  await unmount();
});
