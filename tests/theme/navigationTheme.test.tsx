import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TabsLayout from '@/app/(tabs)/_layout';
import { useSettingsStore } from '@/store/settings-store';
import { layout, spacing, themes } from '@/theme/tokens';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const MockTabs = (props: {
    screenOptions: {
      tabBarStyle: object;
      tabBarActiveTintColor: string;
      tabBarInactiveTintColor: string;
    };
    children: ReactNode;
  }) => React.createElement(
    View,
    {
      testID: 'tab-bar',
      accessibilityLabel: JSON.stringify({
        style: props.screenOptions.tabBarStyle,
        active: props.screenOptions.tabBarActiveTintColor,
        inactive: props.screenOptions.tabBarInactiveTintColor,
      }),
    },
    props.children
  );
  const Tabs = Object.assign(MockTabs, { Screen: () => null });
  return { Tabs };
});

test.each([0, 24, 34, 48])('reserves the bottom inset once at %i dp', async (bottom) => {
  await render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 360, height: 800 },
      insets: { top: 24, right: 0, bottom, left: 0 },
    }}>
      <TabsLayout />
    </SafeAreaProvider>
  );

  const { style } = JSON.parse(screen.getByTestId('tab-bar').props.accessibilityLabel);
  expect(style.height).toBe(layout.tabBarHeight + bottom);
  expect(style.paddingBottom).toBe(bottom + spacing.sm);
});

test('fixed branded header and bottom navigation use the selected palette', async () => {
  useSettingsStore.setState({ themePreference: 'light' });
  const renderTabs = () => (
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 24, right: 0, bottom: 0, left: 0 },
    }}>
      <TabsLayout />
    </SafeAreaProvider>
  );
  const result = await render(renderTabs());

  const headerStyle = StyleSheet.flatten(screen.getByTestId('app-header').props.style);
  expect(headerStyle.backgroundColor).toBe(themes.light.background);
  expect(headerStyle.borderBottomColor).toBe(themes.light.border);

  const tabColors = JSON.parse(screen.getByTestId('tab-bar').props.accessibilityLabel) as {
    style: { backgroundColor: string; borderTopColor: string };
    active: string;
    inactive: string;
  };
  expect(tabColors.style.backgroundColor).toBe(themes.light.surface);
  expect(tabColors.style.borderTopColor).toBe(themes.light.border);
  expect(tabColors.active).toBe(themes.light.primary);
  expect(tabColors.inactive).toBe(themes.light.textMuted);

  await act(async () => {
    useSettingsStore.setState({ themePreference: 'dark' });
    result.rerender(renderTabs());
  });
  expect(StyleSheet.flatten(screen.getByTestId('app-header').props.style).backgroundColor)
    .toBe(themes.dark.background);
});
