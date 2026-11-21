import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { CategoryIcon } from '@/components/CategoryIcon';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

import type { SpendingSummary } from '../summaryData';
import { useSummaryStyles } from './summaryStyles';

export const CategoryBreakdown = memo(function CategoryBreakdown({ categories, total }: {
  categories: SpendingSummary['categories'];
  total: number;
}) {
  const { colors } = useAppTheme();
  const summaryStyles = useSummaryStyles();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const selected = categories.find((row) => row.categoryId === selectedId);
  const radius = Math.min(100, Math.floor(chartWidth / 2) - 4);
  const select = (id: number) => setSelectedId((previous) => previous === id ? null : id);
  const chartData = categories.map((row) => ({
    value: row.totalCentavos,
    color: row.color,
    strokeWidth: row.categoryId === selectedId ? 3 : 0,
    strokeColor: colors.text,
    onPress: () => select(row.categoryId),
  }));

  return (
    <View style={summaryStyles.section}>
      <Text accessibilityRole="header" style={summaryStyles.title}>SAAN NAPUNTA, BOSS?</Text>
      <Text style={summaryStyles.muted}>Breakdown ng gastos mo.</Text>
      <View style={summaryStyles.card}>
        {categories.length === 0 ? <Text style={summaryStyles.muted}>Wala pang category spending.</Text> : (
          <>
            <View testID="summary-category-chart" style={styles.donut} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
              accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {radius > 0 && (
                <PieChart donut data={chartData} radius={radius} innerRadius={radius * 0.71}
                    innerCircleColor={colors.surface} isAnimated={false} paddingHorizontal={0} paddingVertical={0}
                  centerLabelComponent={() => (
                    <View style={[styles.center, { width: radius * 1.23 }]}>
                      <Text style={summaryStyles.muted} numberOfLines={1}>{selected?.name ?? 'TOTAL'}</Text>
                      <Text style={[styles.money, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.45}>
                        {formatPeso(selected?.totalCentavos ?? total)}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
            {selected && (
              <Text style={[styles.detail, { color: colors.primary }]} accessibilityLiveRegion="polite">
                {selected.name} · {formatPeso(selected.totalCentavos)} · {selected.percentage.toFixed(1)}% of spending
              </Text>
            )}
            {categories.map((row) => (
              <Pressable key={row.categoryId}
                accessibilityRole="button" accessibilityState={{ selected: row.categoryId === selectedId }}
                accessibilityLabel={`${row.name}, ${formatPeso(row.totalCentavos)}, ${row.percentage.toFixed(1)} percent of spending`}
                onPress={() => select(row.categoryId)}
                style={[styles.row, row.categoryId === selectedId && { backgroundColor: colors.surfaceElevated }]}>
                <CategoryIcon icon={row.icon} color={row.color} size={32} iconSize={18} />
                <Text style={[styles.name, { color: colors.text }]}>{row.name}</Text>
                <View style={styles.values}>
                  <Text style={[styles.money, { color: colors.text }]}>{formatPeso(row.totalCentavos)}</Text>
                  <Text style={summaryStyles.muted}>{row.percentage.toFixed(1)}%</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  donut: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: spacing.sm },
  center: { alignItems: 'center', gap: spacing.xs },
  detail: { ...typography.caption, textAlign: 'center', paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: layout.minimumTapTarget, padding: spacing.xs, borderRadius: radii.md },
  name: { ...typography.label, flex: 1 },
  values: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '54%' },
  money: { ...typography.label, fontVariant: ['tabular-nums'] },
});
