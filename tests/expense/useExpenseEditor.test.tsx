import { act, renderHook, waitFor } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';

import type { Category, Expense } from '@/db/types';
import {
  mergeLocalDate,
  mergeLocalTime,
  useExpenseEditor,
} from '@/features/expense/hooks/useExpenseEditor';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';

const mockDb = {};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock('@/repositories/categoriesRepo', () => ({ listAll: jest.fn() }));
jest.mock('@/repositories/expensesRepo', () => ({ getById: jest.fn(), update: jest.fn() }));

const archived: Category = {
  id: 1, name: 'Old Food', icon: 'fast-food-outline', color: '#FFB347',
  sortOrder: 0, isArchived: true, createdAt: 1,
};
const active: Category = {
  id: 2, name: 'Transport', icon: 'bus-outline', color: '#60A5FA',
  sortOrder: 1, isArchived: false, createdAt: 1,
};
const unrelatedArchived: Category = { ...archived, id: 3, name: 'Old Other' };
const original: Expense = {
  id: 42,
  amountCentavos: 7_000,
  categoryId: archived.id,
  note: 'Lunch',
  createdAt: new Date(2026, 10, 20, 23, 30).getTime(),
  localDay: '2026-11-20',
  updatedAt: 10,
};

describe('useExpenseEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(categoriesRepo.listAll).mockResolvedValue([active, archived, unrelatedArchived]);
    jest.mocked(expensesRepo.getById).mockResolvedValue(original);
    jest.mocked(expensesRepo.update).mockImplementation(async (_db, _id, patch) => ({
      ...original,
      ...patch,
      note: patch.note === undefined ? original.note : patch.note,
      localDay: patch.createdAt ? '2026-11-21' : original.localDay,
      updatedAt: 11,
    }));
  });

  test('loads by ID and offers active categories plus the current archived category', async () => {
    const { result } = await renderHook(() => useExpenseEditor(42));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(expensesRepo.getById).toHaveBeenCalledWith(mockDb, 42);
    expect(result.current.amountDraft).toBe('70');
    expect(result.current.categories.map((category) => category.id)).toEqual([2, 1]);
    expect(result.current.hasChanges).toBe(false);
  });

  test('rejects an invalid ID without reading SQLite', async () => {
    const { result } = await renderHook(() => useExpenseEditor(null));
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(expensesRepo.getById).not.toHaveBeenCalled();
    expect(categoriesRepo.listAll).not.toHaveBeenCalled();
  });

  test('reports a missing expense', async () => {
    jest.mocked(expensesRepo.getById).mockResolvedValue(null);
    const { result } = await renderHook(() => useExpenseEditor(999));
    await waitFor(() => expect(result.current.status).toBe('not-found'));
  });

  test('saves integer centavos, an active category, trimmed note, and edited local time once', async () => {
    const { result } = await renderHook(() => useExpenseEditor(42));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const moved = new Date(2026, 10, 21, 8, 45);
    await act(() => {
      result.current.pressAmountKey('clear');
      result.current.pressAmountKey('9');
      result.current.pressAmountKey('.');
      result.current.pressAmountKey('5');
      result.current.setCategoryId(active.id);
      result.current.setNote('  Jeep fare  ');
      result.current.setDate(moved);
      result.current.setTime(moved);
    });
    await act(async () => {
      await Promise.all([result.current.save(), result.current.save()]);
    });

    expect(expensesRepo.update).toHaveBeenCalledTimes(1);
    expect(expensesRepo.update).toHaveBeenCalledWith(mockDb, 42, {
      amountCentavos: 950,
      categoryId: 2,
      note: 'Jeep fare',
      createdAt: moved.getTime(),
    });
    expect(jest.mocked(Toast.show).mock.calls[0]?.[0].text1).toBe('AYOS, BOSSING! UPDATED NA.');
  });

  test('turns whitespace into null and preserves drafts when save fails', async () => {
    jest.mocked(expensesRepo.update).mockRejectedValue(new Error('locked'));
    const { result } = await renderHook(() => useExpenseEditor(42));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(() => result.current.setNote('   '));
    await act(async () => { await result.current.save(); });

    expect(expensesRepo.update).toHaveBeenCalledWith(mockDb, 42, expect.objectContaining({ note: null }));
    expect(result.current.note).toBe('   ');
    expect(result.current.validationError).toContain('Nandito pa ang edits');
  });
});

describe('local date/time editing', () => {
  test('moves the date across midnight while retaining the original wall-clock time', () => {
    const current = new Date(2026, 10, 20, 23, 30, 15, 20);
    const selected = new Date(2026, 10, 21, 12);
    expect(new Date(mergeLocalDate(current.getTime(), selected)!)).toEqual(
      new Date(2026, 10, 21, 23, 30, 15, 20)
    );
  });

  test('changes local time while retaining the local calendar date', () => {
    const current = new Date(2026, 10, 20, 23, 30, 15, 20);
    const selected = new Date(2020, 0, 1, 8, 45);
    expect(new Date(mergeLocalTime(current.getTime(), selected)!)).toEqual(
      new Date(2026, 10, 20, 8, 45, 0, 0)
    );
  });
});
