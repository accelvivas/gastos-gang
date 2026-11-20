import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';

import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { dayKeyToLocalDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

type TodayDamageCardProps = {
  dayKey: string;
  totalCentavos: number;
  unavailable?: boolean;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function formatDatePill(dayKey: string): string {
  const date = dayKeyToLocalDate(dayKey);
  return `${WEEKDAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function TodayDamageCard({ dayKey, totalCentavos, unavailable }: TodayDamageCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(280)} style={styles.shadow}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.label}>TODAY&apos;S DAMAGE</Text>
          <View style={styles.datePill}>
            <Text style={styles.dateText}>{formatDatePill(dayKey)}</Text>
          </View>
        </View>
        <Animated.Text
          key={`${dayKey}-${totalCentavos}`}
          accessibilityLabel={`Today's spending ${formatPeso(totalCentavos)}`}
          adjustsFontSizeToFit
          entering={reduceMotion ? undefined : ZoomIn.duration(180)}
          numberOfLines={1}
          style={styles.amount}>
          {unavailable ? '—' : formatPeso(totalCentavos)}
        </Animated.Text>
        <Text numberOfLines={2} style={styles.caption}>
          {totalCentavos === 0 && !unavailable
            ? gastosCopy.zeroToday[0]
            : 'SMALL GASTOS, BIG AWARENESS.'}
        </Text>
        <View pointerEvents="none" style={styles.stripes}>
          {[0, 1, 2].map((stripe) => <View key={stripe} style={styles.stripe} />)}
        </View>
        <View pointerEvents="none" style={styles.sheeshSticker}>
          <Text style={styles.sheeshText}>SHEESH!</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: { marginBottom: spacing.md, paddingBottom: 7, borderRadius: radii.xl, backgroundColor: '#080C09' },
  card: { minHeight: 204, overflow: 'visible', borderRadius: radii.xl, backgroundColor: streetColors.lime, padding: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.heading, flexShrink: 1, color: streetColors.black, fontSize: 17 },
  datePill: { borderRadius: radii.pill, backgroundColor: streetColors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateText: { ...typography.caption, color: streetColors.lime, fontWeight: '900', letterSpacing: 0.5 },
  amount: { ...typography.amount, zIndex: 2, marginTop: spacing.md, color: streetColors.black, fontSize: 54, lineHeight: 62, fontVariant: ['tabular-nums'] },
  caption: { ...typography.label, zIndex: 2, maxWidth: '76%', marginTop: spacing.sm, color: streetColors.black, letterSpacing: 0.7 },
  stripes: { position: 'absolute', right: 22, bottom: 22, flexDirection: 'row', gap: 10, opacity: 0.24, transform: [{ rotate: '30deg' }] },
  stripe: { width: 13, height: 76, backgroundColor: streetColors.olive },
  sheeshSticker: { position: 'absolute', right: 18, bottom: -13, borderRadius: radii.sm, backgroundColor: streetColors.orange, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, transform: [{ rotate: '-7deg' }] },
  sheeshText: { ...typography.label, color: streetColors.black, fontSize: 16, letterSpacing: 1 },
});
