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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

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
    expect(toastCall?.text1).toBe('GASTOS LOGGED, BOSS!');
    expect(toastCall?.text2).toBe('₱70.50 · Food');
    expect(toastCall?.props.joke).toBe('Bossing! Gutom ka o bored ka lang?');
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
    expect(result.current.error).toBe('Hindi na-save, boss. Try ulit.');
    expect(jest.mocked(Toast.show).mock.calls[0]?.[0].props.kind).toBe('error');
  });

  test('avoids consecutive joke repeats and rejects a stale Undo callback', async () => {
    const secondSaved = { ...saved, id: 43, amountCentavos: 200 };
    jest.mocked(expensesRepo.create)
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce(secondSaved);
    jest.mocked(expensesRepo.remove).mockResolvedValue(secondSaved);
    const { result } = await renderHook(() =>
      useExpenseEntry({ onExpenseChanged: jest.fn(), now: () => 1_000 })
    );

    await act(() => result.current.pressKey('1'));
    await act(async () => result.current.saveForCategory(category));
    const firstToast = jest.mocked(Toast.show).mock.calls[0]?.[0];

    await act(() => result.current.pressKey('2'));
    await act(async () => result.current.saveForCategory(category));
    const secondToast = jest.mocked(Toast.show).mock.calls[1]?.[0];

    expect(firstToast?.props.joke).toBe('Bossing! Gutom ka o bored ka lang?');
    expect(secondToast?.props.joke).toBe(
      'Kain ka nang kain, boss. Yung wallet mo nagpapapayat!'
    );

    await act(async () => firstToast?.props.onUndo());
    expect(expensesRepo.remove).not.toHaveBeenCalled();

    await act(async () => secondToast?.props.onUndo());
    expect(expensesRepo.remove).toHaveBeenCalledTimes(1);
    expect(expensesRepo.remove).toHaveBeenCalledWith(mockDb, 43);
  });
});
