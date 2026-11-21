import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Appearance, Text } from 'react-native';

import { useSettingsStore } from '@/store/settings-store';
import { themes } from '@/theme/tokens';
import { applyNativeThemePreference, useAppTheme } from '@/theme/use-app-theme';

let mockSystemScheme: 'light' | 'dark' | null = 'light';
const mockSystemSchemeListeners = new Set<() => void>();

function mockSetSystemScheme(scheme: 'light' | 'dark') {
  mockSystemScheme = scheme;
  mockSystemSchemeListeners.forEach((listener) => listener());
}

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => {
  const React = jest.requireActual('react');
  const useColorSchemeMock = () => {
    const [scheme, setScheme] = React.useState(mockSystemScheme);
    React.useEffect(() => {
      const listener = () => setScheme(mockSystemScheme);
      mockSystemSchemeListeners.add(listener);
      return () => { mockSystemSchemeListeners.delete(listener); };
    }, []);
    return scheme;
  };
  return {
    __esModule: true,
    default: useColorSchemeMock,
  };
});

function ThemeLabel({ children }: { children?: ReactNode }) {
  const { resolvedTheme, colors } = useAppTheme();
  return <Text testID="theme-label">{children}{resolvedTheme}:{colors.background}</Text>;
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((offset) => linearChannel(Number.parseInt(hex.slice(offset, offset + 2), 16)));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

function contrast(first: string, second: string): number {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

beforeEach(() => {
  mockSystemScheme = 'light';
  useSettingsStore.setState({ themePreference: 'dark' });
});

afterEach(async () => {
  await act(async () => useSettingsStore.setState({ themePreference: 'dark' }));
});

test('resolves explicit Dark and Light modes to their app palettes', async () => {
  await render(<ThemeLabel />);
  expect(screen.getByTestId('theme-label')).toHaveTextContent(`dark:${themes.dark.background}`);

  await act(async () => useSettingsStore.setState({ themePreference: 'light' }));
  expect(screen.getByTestId('theme-label')).toHaveTextContent(`light:${themes.light.background}`);
});

test('System follows device scheme changes while mounted', async () => {
  useSettingsStore.setState({ themePreference: 'system' });
  const result = await render(<ThemeLabel />);
  expect(screen.getByTestId('theme-label')).toHaveTextContent(`light:${themes.light.background}`);

  await act(async () => mockSetSystemScheme('dark'));
  expect(screen.getByTestId('theme-label')).toHaveTextContent(`dark:${themes.dark.background}`);
  result.unmount();
});

test('native system surfaces follow the selected app appearance mode', () => {
  const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  applyNativeThemePreference('dark');
  applyNativeThemePreference('light');
  applyNativeThemePreference('system');

  expect(setColorScheme.mock.calls).toEqual([['dark'], ['light'], ['auto']]);
  setColorScheme.mockRestore();
});

test('light palette keeps body, chart-axis, and primary-button text at readable contrast', () => {
  expect(contrast(themes.light.text, themes.light.background)).toBeGreaterThanOrEqual(7);
  expect(contrast(themes.light.textMuted, themes.light.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(themes.light.primaryText, themes.light.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(themes.light.orange, themes.light.surface)).toBeGreaterThanOrEqual(4.5);
});
