import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

import type { SpendingSummary } from '../summaryData';
import type { SummaryPeriod } from '../summaryPeriods';
import { summaryDate } from './SummaryOverview';
import { useSummaryStyles } from './summaryStyles';

export const DailySpendingChart = memo(function DailySpendingChart({ days, biggestDay, period }: {
  days: SpendingSummary['days'];
  biggestDay: SpendingSummary['biggestDay'];
  period: SummaryPeriod;
}) {
  const { colors } = useAppTheme();
  const summaryStyles = useSummaryStyles();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const selectedIndex = days.findIndex((day) => day.day === selectedKey);
  const index = selectedIndex >= 0 ? selectedIndex : Math.max(0, days.findIndex((day) => day.day === biggestDay?.day));
  const selected = days[index];
  const max = biggestDay?.totalCentavos ?? 0;
  const axisWidth = Math.max(66, formatPeso(max, { hideZeroDecimals: true }).length * 6);
  const plotWidth = chartWidth - axisWidth - 8;
  const slot = days.length > 7 ? 34 : Math.max(26, Math.min(52, Math.floor(plotWidth / days.length)));
  const barWidth = Math.min(slot - 8, 24);
  const chartDays = useMemo(() => days.map((row, i) => {
    const date = dayKeyToLocalDate(row.day);
    const label = period === 'week'
      ? date.toLocaleDateString('en-PH', { weekday: 'short' })
      : i === 0 || i === days.length - 1 || (i + 1) % 5 === 0 ? String(date.getDate()) : '';
    return {
      value: row.totalCentavos,
      label,
      onPress: () => setSelectedKey(row.day),
    };
  }), [days, period]);
  const chartData = chartDays.map((bar, i) => ({
    ...bar,
    frontColor: days[i]?.day === biggestDay?.day ? colors.orange : i === index ? colors.primary : colors.olive,
  }));
  const stepValue = Math.ceil(max / 3);
  const axisLabels = [0, 1, 2, 3].map((step) => formatPeso(Math.min(stepValue * step, Number.MAX_SAFE_INTEGER), { hideZeroDecimals: true }));

  return (
    <View style={summaryStyles.section}>
      <Text accessibilityRole="header" style={summaryStyles.title}>DAILY DAMAGE</Text>
      <Text style={summaryStyles.muted}>Kailan malakas gumastos, boss?</Text>
      <View style={summaryStyles.card}>
        {max === 0 ? <Text style={summaryStyles.muted}>Wala pang gastos sa period na ito.</Text> : (
          <>
            <View testID="summary-daily-chart" onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
              accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {plotWidth > 0 && (
                <BarChart data={chartData} height={126} width={plotWidth} yAxisLabelWidth={axisWidth}
                  barWidth={barWidth} spacing={slot - barWidth} initialSpacing={4} endSpacing={4}
                  noOfSections={3} maxValue={stepValue * 3} stepValue={stepValue} yAxisLabelTexts={axisLabels}
                  xAxisColor={colors.border} yAxisColor={colors.border} rulesColor={colors.border}
                  xAxisLabelTextStyle={[styles.axis, { color: colors.textMuted }]}
                  yAxisTextStyle={[styles.axis, { color: colors.textMuted }]} xAxisLabelsHeight={24}
                  roundedTop isAnimated={false} animationDuration={0} allowFontScaling={false}
                  showScrollIndicator={days.length * slot > plotWidth}
                  disableScroll={days.length * slot <= plotWidth}
                />
              )}
            </View>
            {selected && (
              <View style={[styles.dayControls, { borderTopColor: colors.border }]}>
                <DayButton direction="previous" disabled={index === 0} onPress={() => setSelectedKey(days[index - 1]?.day ?? null)} />
                <View style={styles.dayDetail} accessibilityLiveRegion="polite">
                  <Text style={[styles.date, { color: colors.text }]}>{summaryDate(selected.day, true)}</Text>
                  <Text style={[styles.money, { color: colors.primary }]}>{formatPeso(selected.totalCentavos)}</Text>
                  <Text style={summaryStyles.muted}>{selected.count} {selected.count === 1 ? 'expense' : 'expenses'}</Text>
                </View>
                <DayButton direction="next" disabled={index === days.length - 1} onPress={() => setSelectedKey(days[index + 1]?.day ?? null)} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
});

function DayButton({ direction, disabled, onPress }: { direction: 'previous' | 'next'; disabled: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={direction === 'previous' ? 'Previous spending day' : 'Next spending day'}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, { backgroundColor: colors.surfaceElevated }, disabled && styles.disabled]}>
      <Ionicons name={direction === 'previous' ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  axis: { fontSize: 10 },
  dayControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm },
  dayDetail: { flex: 1, alignItems: 'center', gap: spacing.xs },
  date: { ...typography.caption, textAlign: 'center' },
  money: { ...typography.label, textAlign: 'center' },
  button: { width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  disabled: { opacity: 0.4 },
});
