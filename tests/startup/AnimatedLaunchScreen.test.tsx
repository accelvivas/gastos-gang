import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { cancelAnimation, useReducedMotion, withTiming } from 'react-native-reanimated';

import { AnimatedLaunchScreen } from '@/components/startup/AnimatedLaunchScreen';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      Text: ReactNative.Text,
    },
    cancelAnimation: jest.fn(),
    Easing: { linear: (value: number) => value },
    useAnimatedStyle: jest.fn(() => ({})),
    useSharedValue: jest.fn((initial: number) => React.useRef({ get: () => initial, set: jest.fn() }).current),
    withDelay: jest.fn((_delay: number, animation: unknown) => animation),
    withSpring: jest.fn((value: number) => value),
    withTiming: jest.fn((value: number) => value),
    useReducedMotion: jest.fn(() => false),
  };
});

jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  scheduleOnRN: (callback: () => void) => callback(),
}));

afterEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.clearAllMocks();
});

test('renders the official logo, wordmark, and tagline during startup', async () => {
  await render(
    <AnimatedLaunchScreen
      onNativeSplashReady={jest.fn()}
      onCompleted={jest.fn()}
    />
  );

  expect(screen.getByTestId('launch-logo')).toBeTruthy();
  expect(screen.getByTestId('launch-wordmark')).toBeTruthy();
  expect(screen.getByText('GASTOS')).toBeTruthy();
  expect(screen.getByText(/GANG\./)).toBeTruthy();
  expect(screen.getByText('Track your gastos, bossing!')).toBeTruthy();
});

test('starts only after the native handoff and removes the overlay on animation completion', async () => {
  const onNativeSplashReady = jest.fn();
  const onCompleted = jest.fn();

  let resolveHandoff = () => {};
  jest.mocked(SplashScreen.hideAsync).mockImplementationOnce(() => new Promise<void>((resolve) => { resolveHandoff = resolve; }));
  function Harness() {
    const [visible, setVisible] = useState(true);
    return visible ? <AnimatedLaunchScreen onNativeSplashReady={onNativeSplashReady} onCompleted={() => {
      onCompleted();
      setVisible(false);
    }} /> : null;
  }
  await render(<Harness />);

  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('animated-launch-screen'), 'layout');
  await fireEvent(screen.getByTestId('animated-launch-screen'), 'layout');
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(onNativeSplashReady).not.toHaveBeenCalled();
  expect(withTiming).not.toHaveBeenCalled();
  await act(() => resolveHandoff());
  expect(onNativeSplashReady).toHaveBeenCalledTimes(1);

  const complete = jest.mocked(withTiming).mock.calls[0]?.[2];
  expect(complete).toBeDefined();
  await act(() => complete?.(true));
  expect(onCompleted).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('animated-launch-screen')).toBeNull();
});

test('reduced motion completes the launch quickly', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const onCompleted = jest.fn();

  await render(
    <AnimatedLaunchScreen
      onNativeSplashReady={jest.fn()}
      onCompleted={onCompleted}
    />
  );

  await fireEvent(screen.getByTestId('animated-launch-screen'), 'layout');
  expect(withTiming).not.toHaveBeenCalled();
  expect(onCompleted).toHaveBeenCalledTimes(1);
});

test('unmount cancels motion and rejects a late completion callback', async () => {
  const onCompleted = jest.fn();
  const view = await render(
    <AnimatedLaunchScreen
      onNativeSplashReady={jest.fn()}
      onCompleted={onCompleted}
    />
  );

  await fireEvent(screen.getByTestId('animated-launch-screen'), 'layout');
  const complete = jest.mocked(withTiming).mock.calls[0]?.[2];
  expect(complete).toBeDefined();
  await view.unmount();
  expect(cancelAnimation).toHaveBeenCalledTimes(2);
  await act(() => complete?.(true));
  expect(onCompleted).not.toHaveBeenCalled();
});
