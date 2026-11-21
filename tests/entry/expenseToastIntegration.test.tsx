import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { AppToast } from '@/components/AppToast';
import type { Category, Expense } from '@/db/types';
import { useExpenseEntry } from '@/features/entry/hooks/useExpenseEntry';
import * as expensesRepo from '@/repositories/expensesRepo';

const mockDb = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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

const firstExpense: Expense = {
  id: 42,
  amountCentavos: 100,
  categoryId: category.id,
  note: null,
  createdAt: 1_000,
  localDay: '1970-01-01',
  updatedAt: 1_000,
};

const secondExpense: Expense = {
  ...firstExpense,
  id: 43,
  amountCentavos: 200,
};

function ExpenseEntryHarness() {
  const { amountDraft, pressKey, saveForCategory } = useExpenseEntry({
    onExpenseChanged: () => undefined,
  });

  return (
    <View>
      <Text testID="amountDraft">{amountDraft}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter 1" onPress={() => pressKey('1')} />
      <Pressable accessibilityRole="button" accessibilityLabel="Enter 2" onPress={() => pressKey('2')} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save expense"
        onPress={() => void saveForCategory(category)}
      />
    </View>
  );
}

describe('expense toast integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

  test('replaces the visible toast and only the latest Undo target can delete an expense', async () => {
    jest.mocked(expensesRepo.create)
      .mockResolvedValueOnce(firstExpense)
      .mockResolvedValueOnce(secondExpense);
    jest.mocked(expensesRepo.remove).mockResolvedValue(secondExpense);
    const showToast = jest.spyOn(Toast, 'show');

    await render(
      <GestureHandlerRootView>
        <ExpenseEntryHarness />
        <AppToast />
      </GestureHandlerRootView>
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Enter 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));

    const firstJoke = 'Bossing! Gutom ka o bored ka lang?';
    await waitFor(() => expect(screen.getByText(firstJoke)).toBeOnTheScreen());
    const previousUndo = showToast.mock.calls[0]?.[0].props?.onUndo as () => Promise<void>;

    await fireEvent.press(screen.getByRole('button', { name: 'Enter 2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));

    const latestJoke = 'Kain ka nang kain, boss. Yung wallet mo nagpapapayat!';
    await waitFor(() => expect(screen.getByText(latestJoke)).toBeOnTheScreen());
    expect(screen.queryByText(firstJoke)).toBeNull();

    await act(async () => previousUndo());
    expect(expensesRepo.remove).not.toHaveBeenCalled();
    expect(screen.getByText(latestJoke)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo saved expense' }));
    await waitFor(() => expect(expensesRepo.remove).toHaveBeenCalledWith(mockDb, secondExpense.id));
    expect(expensesRepo.remove).toHaveBeenCalledTimes(1);

    act(() => Toast.hide());
  });
});
