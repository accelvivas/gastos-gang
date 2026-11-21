import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { StreetStarburst } from '@/components/StreetStarburst';
import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

import type { SpendingSummary } from '../summaryData';
import type { SummaryPeriod } from '../summaryPeriods';
import { summaryStyles } from './summaryStyles';

export function summaryDate(key: string, full = false) {
  return dayKeyToLocalDate(key).toLocaleDateString('en-PH',
    full ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric' });
}

export function SummaryHeader() {
  return (
    <View style={summaryStyles.section}>
      <View style={styles.brand}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BrandLogo size={48} />
        </View>
        <Text style={styles.wordmark}>GASTOS <Text style={styles.lime}>GANG.</Text></Text>
        <StreetStarburst size={25} color={streetColors.orange} />
      </View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.screenTitle}>SUMMARY</Text>
        <Text style={summaryStyles.muted}>Saan napunta pera mo, boss?</Text>
      </View>
    </View>
  );
}

export function PeriodToggle({ period, onChange }: { period: SummaryPeriod; onChange: (next: SummaryPeriod) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Spending period" style={styles.toggle}>
      {(['week', 'month'] as const).map((option) => {
        const checked = period === option;
        return (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onChange(option)}
            style={[styles.segment, checked && styles.activeSegment]}>
            <Text style={[styles.segmentText, checked && styles.activeText]}>
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
  const { current, previous } = data.ranges;
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>TOTAL DAMAGE</Text>
        <View style={styles.sticker}><Text style={styles.stickerText}>SHEESH!</Text></View>
      </View>
      <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.45}>
        {formatPeso(data.totalCentavos)}
      </Text>
      <Text style={styles.heroDates}>{summaryDate(current.fromKey)} – {summaryDate(current.toKey)}</Text>
      <View style={styles.comparison}>
        <Text style={[styles.comparisonText, data.comparison.kind === 'higher' && styles.caution]}>
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
          <Text style={styles.insightLabel}>{title}</Text>
          <Text style={styles.insightValue}>{value}</Text>
          {detail && <Text style={summaryStyles.muted}>{detail}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { ...typography.heading, flex: 1, color: streetColors.cream, fontWeight: '900' },
  lime: { color: streetColors.lime },
  heading: { borderLeftWidth: 6, borderLeftColor: streetColors.lime, paddingLeft: spacing.md },
  screenTitle: { ...typography.title, color: streetColors.cream, fontSize: 34, lineHeight: 40 },
  toggle: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderWidth: 1, borderColor: streetColors.border, borderRadius: radii.lg, backgroundColor: streetColors.surface },
  segment: { flex: 1, minHeight: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, borderRadius: radii.md },
  activeSegment: { backgroundColor: streetColors.lime },
  segmentText: { ...typography.label, color: streetColors.cream, textAlign: 'center', textTransform: 'uppercase' },
  activeText: { color: streetColors.black },
  hero: { backgroundColor: streetColors.lime, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.xs },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroLabel: { ...typography.label, flexShrink: 1, color: streetColors.black, letterSpacing: 1 },
  sticker: { backgroundColor: streetColors.orange, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, transform: [{ rotate: '-6deg' }] },
  stickerText: { ...typography.tabLabel, color: streetColors.black },
  amount: { ...typography.amount, color: streetColors.black, fontVariant: ['tabular-nums'] },
  heroDates: { ...typography.caption, color: streetColors.black, fontWeight: '700' },
  comparison: { backgroundColor: streetColors.surface, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs },
  comparisonText: { ...typography.label, color: streetColors.lime },
  caution: { color: streetColors.orange },
  insightLabel: { ...typography.label, color: streetColors.lime },
  insightValue: { ...typography.heading, color: streetColors.cream },
});
