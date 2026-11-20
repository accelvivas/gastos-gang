import { act, renderHook } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';

import type { Category, Expense } from '@/db/types';
import { useExpenseEntry } from '@/features/entry/hooks/useExpenseEntry';
import * as expensesRepo from '@/repositories/expensesRepo';

const mockDb = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock('@/lib/haptics', () => ({ successHaptic: jest.fn(), warningHaptic: jest.fn() }));
jest.mock('@/repositories/expensesRepo', () => ({ create: jest.fn(), remove: jest.fn() }));

const category: Category = {
  id: 3,
  name: 'Food',
  icon: 'fast-food-outline',
  color: '#F59E0B',
  sortOrder: 0,
  isArchived: false,
  createdAt: 1,
};

const saved: Expense = {
  id: 42,
  amountCentavos: 7_050,
  categoryId: category.id,
  note: 'Lunch',
  createdAt: 1_000,
  localDay: '1970-01-01',
  updatedAt: 1_000,
};

describe('useExpenseEntry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('commits once, resets only after success, and undoes the exact inserted ID', async () => {
    jest.mocked(expensesRepo.create).mockResolvedValue(saved);
    jest.mocked(expensesRepo.remove).mockResolvedValue(saved);
    const onExpenseChanged = jest.fn();
    const { result } = await renderHook(() =>
      useExpenseEntry({ onExpenseChanged, now: () => 1_000, undoWindowMs: 5_000 })
    );

    await act(() => {
      result.current.pressKey('7');
      result.current.pressKey('0');
      result.current.pressKey('.');
      result.current.pressKey('5');
      result.current.setNote('  Lunch  ');
    });
    await act(async () => {
      await Promise.all([result.current.saveForCategory(category), result.current.saveForCategory(category)]);
    });

    expect(expensesRepo.create).toHaveBeenCalledTimes(1);
    expect(expensesRepo.create).toHaveBeenCalledWith(mockDb, {
      amountCentavos: 7_050,
      categoryId: 3,
      note: 'Lunch',
      createdAt: 1_000,
    });
    expect(result.current.amountDraft).toBe('0');
    expect(result.current.note).toBe('');
    expect(result.current.resetCount).toBe(1);

    const toastCall = jest.mocked(Toast.show).mock.calls[0]?.[0];
    expect(toastCall).toBeDefined();
    expect(toastCall?.text1).toBe('SOLID, BOSSING!');
    expect(toastCall?.text2).toBe('₱70.50 saved to Food');
    await act(async () => {
      await toastCall?.props.onUndo();
    });
    expect(expensesRepo.remove).toHaveBeenCalledWith(mockDb, 42);
    expect(onExpenseChanged).toHaveBeenCalledTimes(2);
  });

  test('preserves the draft and note when the database write fails', async () => {
    jest.mocked(expensesRepo.create).mockRejectedValue(new Error('Disk unavailable'));
    const { result } = await renderHook(() => useExpenseEntry({ onExpenseChanged: jest.fn() }));
    await act(() => {
      result.current.pressKey('9');
      result.current.setNote('Coffee');
    });
    await act(async () => {
      await result.current.saveForCategory(category);
    });
    expect(result.current.amountDraft).toBe('9');
    expect(result.current.note).toBe('Coffee');
    expect(result.current.error).toBe('Disk unavailable');
  });
});
