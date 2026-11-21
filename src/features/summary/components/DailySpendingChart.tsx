import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

import type { SpendingSummary } from '../summaryData';
import type { SummaryPeriod } from '../summaryPeriods';
import { summaryDate } from './SummaryOverview';
import { summaryStyles } from './summaryStyles';

export const DailySpendingChart = memo(function DailySpendingChart({ days, biggestDay, period }: {
  days: SpendingSummary['days'];
  biggestDay: SpendingSummary['biggestDay'];
  period: SummaryPeriod;
}) {
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
  const chartData = days.map((row, i) => {
    const date = dayKeyToLocalDate(row.day);
    const label = period === 'week'
      ? date.toLocaleDateString('en-PH', { weekday: 'short' })
      : i === 0 || i === days.length - 1 || (i + 1) % 5 === 0 ? String(date.getDate()) : '';
    return {
      value: row.totalCentavos,
      label,
      frontColor: row.day === biggestDay?.day ? streetColors.orange : i === index ? streetColors.lime : streetColors.olive,
      onPress: () => setSelectedKey(row.day),
    };
  });
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
                  xAxisColor={streetColors.border} yAxisColor={streetColors.border} rulesColor={streetColors.border}
                  xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} xAxisLabelsHeight={24}
                  roundedTop isAnimated={false} animationDuration={0} allowFontScaling={false}
                  showScrollIndicator={days.length * slot > plotWidth}
                  disableScroll={days.length * slot <= plotWidth}
                />
              )}
            </View>
            {selected && (
              <View style={styles.dayControls}>
                <DayButton direction="previous" disabled={index === 0} onPress={() => setSelectedKey(days[index - 1]?.day ?? null)} />
                <View style={styles.dayDetail} accessibilityLiveRegion="polite">
                  <Text style={styles.date}>{summaryDate(selected.day, true)}</Text>
                  <Text style={styles.money}>{formatPeso(selected.totalCentavos)}</Text>
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
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={direction === 'previous' ? 'Previous spending day' : 'Next spending day'}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Ionicons name={direction === 'previous' ? 'chevron-back' : 'chevron-forward'} size={20} color={streetColors.lime} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  axis: { color: streetColors.muted, fontSize: 10 },
  dayControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: streetColors.border, paddingTop: spacing.sm },
  dayDetail: { flex: 1, alignItems: 'center', gap: spacing.xs },
  date: { ...typography.caption, color: streetColors.cream, textAlign: 'center' },
  money: { ...typography.label, color: streetColors.lime, textAlign: 'center' },
  button: { width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', backgroundColor: streetColors.surfaceElevated, borderRadius: radii.md },
  disabled: { opacity: 0.4 },
});
