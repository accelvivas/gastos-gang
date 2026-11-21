import { act } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';

import { showBudgetWarning } from '@/features/entry/budgetWarnings';
import { beginUndoOperation, finishUndoOperation } from '@/lib/undoCoordinator';

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('defers a budget warning until the active Undo window and its toast finish', () => {
  jest.useFakeTimers();
  const token = beginUndoOperation();

  showBudgetWarning('Bossing, malapit na sa budget limit!');
  expect(Toast.show).not.toHaveBeenCalled();

  act(() => finishUndoOperation(token));
  act(() => jest.advanceTimersByTime(1_899));
  expect(Toast.show).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(1));
  expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
    text1: 'Bossing, malapit na sa budget limit!',
  }));
});
