import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TabHeading } from '@/components/AppHeader';
import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

import type { SpendingSummary } from '../summaryData';
import type { SummaryPeriod } from '../summaryPeriods';
import { useSummaryStyles } from './summaryStyles';

export function summaryDate(key: string, full = false) {
  return dayKeyToLocalDate(key).toLocaleDateString('en-PH',
    full ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric' });
}

export function SummaryHeader() {
  return <TabHeading title="SUMMARY" subtitle="Saan napunta pera mo, boss?" />;
}

export function PeriodToggle({ period, onChange }: { period: SummaryPeriod; onChange: (next: SummaryPeriod) => void }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Spending period"
      style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(['week', 'month'] as const).map((option) => {
        const checked = period === option;
        return (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onChange(option)}
            style={[styles.segment, checked && { backgroundColor: colors.primary }]}>
            <Text style={[styles.segmentText, { color: checked ? colors.primaryText : colors.text }]}>
              {option === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function comparisonText(comparison: SpendingSummary['comparison'], period: SummaryPeriod) {
  switch (comparison.kind) {
    case 'empty': return 'No spending in either period';
    case 'new': return 'New spending vs previous period';
    case 'equal': return 'No change vs previous period';
    case 'higher':
    case 'lower': {
      const direction = comparison.kind === 'higher' ? 'more' : 'less';
      const percentage = Math.abs(comparison.percentageChange ?? 0).toFixed(1);
      return `${formatPeso(Math.abs(comparison.differenceCentavos))} ${direction} (${percentage}%) vs last ${period}`;
    }
  }
}

export function TotalSpendingCard({ data, period }: { data: SpendingSummary; period: SummaryPeriod }) {
  const { colors } = useAppTheme();
  const summaryStyles = useSummaryStyles();
  const { current, previous } = data.ranges;
  return (
    <View style={[styles.hero, { backgroundColor: colors.primary }]}>
      <View style={styles.heroTop}>
        <Text style={[styles.heroLabel, { color: colors.primaryText }]}>TOTAL DAMAGE</Text>
        <View style={[styles.sticker, { backgroundColor: colors.orange }]}><Text style={[styles.stickerText, { color: colors.primaryText }]}>SHEESH!</Text></View>
      </View>
      <Text style={[styles.amount, { color: colors.primaryText }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.45}>
        {formatPeso(data.totalCentavos)}
      </Text>
      <Text style={[styles.heroDates, { color: colors.primaryText }]}>{summaryDate(current.fromKey)} – {summaryDate(current.toKey)}</Text>
      <View style={[styles.comparison, { backgroundColor: colors.surface }]}>
        <Text style={[styles.comparisonText, { color: colors.primary }, data.comparison.kind === 'higher' && { color: colors.warning }]}>
          {comparisonText(data.comparison, period)}
        </Text>
        <Text style={summaryStyles.muted}>
          Previous window · {summaryDate(previous.fromKey)} – {summaryDate(previous.toKey)} · {formatPeso(data.previousTotalCentavos)}
        </Text>
      </View>
    </View>
  );
}

export function SpendingInsights({ data }: { data: SpendingSummary }) {
  const { colors } = useAppTheme();
  const summaryStyles = useSummaryStyles();
  const { topCategory, biggestDay, averageCentavos } = data;
  const items = [
    { title: 'TOP CATEGORY', value: topCategory?.name ?? 'Wala pa, bossing!', detail: topCategory && `${formatPeso(topCategory.totalCentavos)} · ${topCategory.percentage.toFixed(1)}% of spending` },
    { title: 'DAILY AVERAGE', value: formatPeso(averageCentavos), detail: `Across ${data.days.length} elapsed ${data.days.length === 1 ? 'day' : 'days'}` },
    { title: 'BIGGEST DAMAGE DAY', value: biggestDay ? summaryDate(biggestDay.day, true) : 'No spending yet', detail: biggestDay && formatPeso(biggestDay.totalCentavos) },
  ];
  return (
    <View style={summaryStyles.section}>
      <Text accessibilityRole="header" style={summaryStyles.title}>BOSSING INSIGHTS</Text>
      {items.map(({ title, value, detail }) => (
        <View key={title} style={summaryStyles.card}>
          <Text style={[styles.insightLabel, { color: colors.primary }]}>{title}</Text>
          <Text style={[styles.insightValue, { color: colors.text }]}>{value}</Text>
          {detail && <Text style={summaryStyles.muted}>{detail}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderWidth: 1, borderRadius: radii.lg },
  segment: { flex: 1, minHeight: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, borderRadius: radii.md },
  segmentText: { ...typography.label, textAlign: 'center', textTransform: 'uppercase' },
  hero: { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.xs },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroLabel: { ...typography.label, flexShrink: 1, letterSpacing: 1 },
  sticker: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, transform: [{ rotate: '-6deg' }] },
  stickerText: typography.tabLabel,
  amount: { ...typography.amount, fontVariant: ['tabular-nums'] },
  heroDates: { ...typography.caption, fontWeight: '700' },
  comparison: { borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs },
  comparisonText: typography.label,
  insightLabel: typography.label,
  insightValue: typography.heading,
});
