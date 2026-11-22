import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect as mockUseEffect, type PropsWithChildren } from 'react';
import { Pressable as MockPressable, Text as MockText } from 'react-native';

import RootLayout from '@/app/_layout';

let mockDatabaseState: 'loading' | 'error' | 'ready' = 'loading';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(() => <MockText>Existing navigator</MockText>, { Screen: () => null }),
  ThemeProvider: ({ children }: PropsWithChildren) => children,
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
}));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: jest.requireActual('react-native').View }));
jest.mock('@/components/AppToast', () => ({ AppToast: () => null }));
jest.mock('@/lib/legacyRecurringNotifications', () => ({
  clearLegacyRecurringNotifications: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/db/DatabaseProvider', () => ({
  DatabaseProvider: function MockDatabaseProvider({ children, onError }: PropsWithChildren<{ onError: (error: Error) => void }>) {
    mockUseEffect(() => { if (mockDatabaseState === 'error') onError(new Error('Initialization failed')); }, [onError]);
    if (mockDatabaseState === 'error') return <MockText>Database error screen</MockText>;
    return mockDatabaseState === 'ready' ? children : <MockText>Database pending</MockText>;
  },
}));
jest.mock('@/components/startup/AnimatedLaunchScreen', () => ({
  AnimatedLaunchScreen: ({ onNativeSplashReady, onCompleted }: { onNativeSplashReady: () => void; onCompleted: () => void }) => (
    <MockPressable accessibilityRole="button" onPress={() => { onNativeSplashReady(); onCompleted(); }}>
      <MockText>Complete launch</MockText>
    </MockPressable>
  ),
}));

test('preserves the database error screen and releases the native splash', async () => {
  mockDatabaseState = 'error';
  await render(<RootLayout />);
  expect(screen.getByText('Database error screen')).toBeTruthy();
  expect(screen.queryByText('Complete launch')).toBeNull();
  await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
});

test('waits for initialization, reveals the existing navigator, and does not remount the overlay', async () => {
  mockDatabaseState = 'loading';
  jest.mocked(SplashScreen.hideAsync).mockClear();
  const root = await render(<RootLayout />);
  expect(screen.getByText('Database pending')).toBeTruthy();
  expect(screen.queryByText('Complete launch')).toBeNull();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  mockDatabaseState = 'ready';
  await root.rerender(<RootLayout />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Complete launch' }));
  expect(screen.queryByText('Complete launch')).toBeNull();
  expect(screen.getByText('Existing navigator')).toBeTruthy();
  await root.rerender(<RootLayout />);
  expect(screen.queryByText('Complete launch')).toBeNull();
  await root.unmount();
  await render(<RootLayout />);
  expect(screen.queryByText('Complete launch')).toBeNull();
});
