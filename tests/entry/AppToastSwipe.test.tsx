import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  PanResponder,
  type PanResponderCallbacks,
  type PanResponderGestureState,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AppToast } from '@/components/AppToast';

jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));

let panResponderConfig: PanResponderCallbacks | null = null;
const createPanResponder = PanResponder.create.bind(PanResponder);

async function setupToast() {
  const onUndo = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
      <AppToast />
    </SafeAreaProvider>
  );
  await act(() => Toast.show({ type: 'expenseSaved', text1: 'Original toast', visibilityTime: 5000, props: { onUndo } }));
  return onUndo;
}

async function swipe(translationX: number) {
  await act(async () => {
    const gesture = {
      dx: translationX,
      dy: 0,
    } as unknown as PanResponderGestureState;
    expect(screen.getByTestId('expense-toast-swipe').props.collapsable).toBe(false);
    expect(panResponderConfig?.onMoveShouldSetPanResponderCapture?.({} as never, gesture)).toBe(true);
    panResponderConfig?.onPanResponderMove?.({} as never, gesture);
    panResponderConfig?.onPanResponderRelease?.({} as never, gesture);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  panResponderConfig = null;
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    panResponderConfig = config;
    return createPanResponder(config);
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([-130, 130])('dismisses on horizontal release at %i without invoking Undo', async (distance) => {
  const undo = await setupToast();
  await swipe(distance);
  await act(() => { jest.advanceTimersByTime(400); });
  expect(screen.queryByRole('button', { name: 'Undo saved expense' })).toBeNull();
  expect(undo).not.toHaveBeenCalled();
});

test('keeps Undo available after a short swipe and expires on the original timer', async () => {
  const undo = await setupToast();
  await act(() => { jest.advanceTimersByTime(2000); });
  await swipe(30);
  await act(() => { jest.advanceTimersByTime(2999); });
  await fireEvent.press(screen.getByRole('button', { name: 'Undo saved expense' }));
  expect(undo).toHaveBeenCalledTimes(1);
  await act(() => { jest.advanceTimersByTime(1); });
  expect(screen.queryByRole('button', { name: 'Undo saved expense' })).toBeNull();
});

test('an in-flight swipe cannot dismiss a replacement toast', async () => {
  const undo = await setupToast();
  await swipe(130);
  await act(() => Toast.show({ type: 'expenseSaved', text1: 'Replacement toast', visibilityTime: 5000 }));
  await act(() => { jest.advanceTimersByTime(400); });
  expect(screen.getByText(/Replacement toast/)).toBeTruthy();
  expect(undo).not.toHaveBeenCalled();
});
