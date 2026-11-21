import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { DailySpendingChart } from '@/features/summary/components/DailySpendingChart';
import { useSettingsStore } from '@/store/settings-store';
import { themes } from '@/theme/tokens';

const mockChart = jest.fn();

jest.mock('react-native-gifted-charts', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BarChart: (props: unknown) => {
      mockChart(props);
      return React.createElement(View, { testID: 'mock-bar-chart' });
    },
  };
});

const days = [
  { day: '2026-11-20', totalCentavos: 30_000, count: 2 },
  { day: '2026-11-21', totalCentavos: 15_000, count: 1 },
];

type ChartProps = {
  xAxisColor: string;
  yAxisColor: string;
  rulesColor: string;
  xAxisLabelTextStyle: StyleProp<TextStyle>;
  yAxisTextStyle: StyleProp<TextStyle>;
  data: { frontColor: string; onPress: () => void }[];
};

function assertChartPalette(theme: 'dark' | 'light') {
  const props = mockChart.mock.calls.at(-1)?.[0] as ChartProps;
  const colors = themes[theme];
  expect(props.xAxisColor).toBe(colors.border);
  expect(props.yAxisColor).toBe(colors.border);
  expect(props.rulesColor).toBe(colors.border);
  expect(StyleSheet.flatten(props.xAxisLabelTextStyle)?.color).toBe(colors.textMuted);
  expect(StyleSheet.flatten(props.yAxisTextStyle)?.color).toBe(colors.textMuted);
  expect(props.data.map((bar) => bar.frontColor)).toEqual([
    colors.orange,
    theme === 'dark' ? colors.olive : colors.primary,
  ]);
}

test('keeps chart axes, labels, and data series theme-readable', async () => {
  useSettingsStore.setState({ themePreference: 'dark' });
  const result = await render(
    <DailySpendingChart days={days} biggestDay={days[0]!} period="week" />
  );
  const layoutEvent = { nativeEvent: { layout: { width: 300, height: 180, x: 0, y: 0 } } };
  await fireEvent(screen.getByTestId('summary-daily-chart', { includeHiddenElements: true }), 'layout', layoutEvent);
  assertChartPalette('dark');

  const darkProps = mockChart.mock.calls.at(-1)?.[0] as ChartProps;
  await act(async () => darkProps.data[1]!.onPress());
  expect((mockChart.mock.calls.at(-1)?.[0] as ChartProps).data[1]!.frontColor)
    .toBe(themes.dark.primary);

  mockChart.mockClear();
  await act(async () => useSettingsStore.setState({ themePreference: 'light' }));
  assertChartPalette('light');
  result.unmount();
  await act(async () => useSettingsStore.setState({ themePreference: 'dark' }));
});
