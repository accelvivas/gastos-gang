import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';

import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';
import {
  formatBudgetPercentage,
  type DailyBudgetProgress,
} from '@/features/entry/utils/dailyBudget';

type TodayDamageCardProps = {
  dayKey: string;
  totalCentavos: number;
  budgetLimitCentavos?: number | null;
  budgetProgress?: DailyBudgetProgress | null;
  unavailable?: boolean;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function formatDatePill(dayKey: string): string {
  const date = dayKeyToLocalDate(dayKey);
  return `${WEEKDAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export const TodayDamageCard = memo(function TodayDamageCard({
  dayKey,
  totalCentavos,
  budgetLimitCentavos = null,
  budgetProgress = null,
  unavailable,
}: TodayDamageCardProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const budgetTone = budgetProgress?.stage ?? 'normal';

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(280)}
      style={[styles.shadow, { backgroundColor: colors.shadow }]}>
      <View style={[
        styles.card,
        { backgroundColor: colors.primary },
        budgetTone === 'warning' && { backgroundColor: colors.warningBackground },
        budgetTone === 'over' && { backgroundColor: colors.orange },
      ]}>
        <View style={styles.topRow}>
          <Text style={[styles.label, { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText }]}>TODAY&apos;S DAMAGE</Text>
          <View style={[styles.datePill, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dateText, { color: colors.primary }]}>{formatDatePill(dayKey)}</Text>
          </View>
        </View>
        <Animated.Text
          key={`${dayKey}-${totalCentavos}`}
          accessibilityLabel={`Today's spending ${formatPeso(totalCentavos)}`}
          adjustsFontSizeToFit
          entering={reduceMotion ? undefined : ZoomIn.duration(180)}
          numberOfLines={1}
          style={[styles.amount, { color: colors.primaryText }]}>
          {unavailable ? '—' : formatPeso(totalCentavos)}
        </Animated.Text>
        <Text numberOfLines={2} style={[styles.caption, { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText }]}>
          {totalCentavos === 0 && !unavailable
            ? gastosCopy.zeroToday[0]
            : 'SMALL GASTOS, BIG AWARENESS.'}
        </Text>
        {budgetLimitCentavos !== null && budgetProgress && !unavailable ? (
          <View style={styles.budgetDetails}>
            <View style={styles.budgetTopline}>
              <Text style={[styles.budgetLabel, { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText }]}>DAILY BUDGET: {formatPeso(budgetLimitCentavos)}</Text>
              <Text style={[
                styles.budgetStatus,
                { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText },
              ]}>
                {budgetTone === 'over' ? 'OVER BUDGET' : budgetTone === 'warning' ? 'NEAR LIMIT' : 'ON TRACK'}
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Daily budget used"
              accessibilityValue={{ min: 0, max: 100, now: Math.min(budgetProgress.percentageUsed, 100) }}
              style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${budgetProgress.progress * 100}%` },
                  { backgroundColor: colors.olive },
                  budgetTone === 'warning' && { backgroundColor: colors.warningFill },
                  budgetTone === 'over' && { backgroundColor: colors.black },
                ]}
              />
            </View>
            <View style={styles.budgetBottomline}>
              <Text style={[styles.budgetPercent, { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText }]}>{formatBudgetPercentage(budgetProgress.percentageUsed)}% USED</Text>
              <Text style={[styles.budgetAmount, { color: budgetTone === 'warning' ? colors.warningText : colors.primaryText }]}>
                {budgetTone === 'over'
                  ? `${formatPeso(budgetProgress.overCentavos)} over budget, bossing.`
                  : `${formatPeso(budgetProgress.remainingCentavos)} remaining, bossing.`}
              </Text>
            </View>
          </View>
        ) : null}
        <View pointerEvents="none" style={styles.stripes}>
          {[0, 1, 2].map((stripe) => <View key={stripe} style={[styles.stripe, { backgroundColor: colors.olive }]} />)}
        </View>
        <View pointerEvents="none" style={[styles.sheeshSticker, { backgroundColor: colors.orange }]}>
          <Text style={[styles.sheeshText, { color: colors.primaryText }]}>SHEESH!</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shadow: { marginBottom: spacing.md, paddingBottom: 7, borderRadius: radii.xl },
  card: { minHeight: 204, overflow: 'visible', borderRadius: radii.xl, padding: spacing.xl },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.heading, flexShrink: 1, fontSize: 17 },
  datePill: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateText: { ...typography.caption, fontWeight: '900', letterSpacing: 0.5 },
  amount: { ...typography.amount, zIndex: 2, marginTop: spacing.md, fontSize: 54, lineHeight: 62, fontVariant: ['tabular-nums'] },
  caption: { ...typography.label, zIndex: 2, maxWidth: '76%', marginTop: spacing.sm, letterSpacing: 0.7 },
  stripes: { position: 'absolute', right: 22, bottom: 22, flexDirection: 'row', gap: 10, opacity: 0.24, transform: [{ rotate: '30deg' }] },
  stripe: { width: 13, height: 76 },
  sheeshSticker: { position: 'absolute', right: 18, bottom: -13, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, transform: [{ rotate: '-7deg' }] },
  sheeshText: { ...typography.label, fontSize: 16, letterSpacing: 1 },
  budgetDetails: { zIndex: 2, gap: spacing.sm, marginTop: spacing.md },
  budgetTopline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  budgetLabel: { ...typography.caption, fontWeight: '900' },
  budgetStatus: { ...typography.caption, fontWeight: '900', letterSpacing: 0.4 },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: radii.pill },
  progressFill: { height: '100%', borderRadius: radii.pill },
  budgetBottomline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  budgetPercent: { ...typography.caption, fontWeight: '900' },
  budgetAmount: { ...typography.caption, flexShrink: 1, fontWeight: '800', textAlign: 'right' },
});
