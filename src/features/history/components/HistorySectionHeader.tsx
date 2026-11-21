import { StyleSheet, Text, View } from 'react-native';

import { formatPeso } from '@/lib/money';
import { spacing, streetColors, typography } from '@/theme/tokens';

type HistorySectionHeaderProps = {
  title: string;
  totalCentavos: number;
};

export function HistorySectionHeader({ title, totalCentavos }: HistorySectionHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View pointerEvents="none" style={styles.stripes}>
          {[0, 1, 2].map((stripe) => <View key={stripe} style={styles.stripe} />)}
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text accessibilityLabel={`${title} total ${formatPeso(totalCentavos)}`} style={styles.total}>
          {formatPeso(totalCentavos)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: streetColors.background },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, backgroundColor: streetColors.lime, borderRadius: 18, overflow: 'hidden' },
  title: { ...typography.heading, flexShrink: 1, color: streetColors.black, fontWeight: '900', textTransform: 'uppercase' },
  total: { ...typography.heading, flexShrink: 1, textAlign: 'right', color: streetColors.black, fontWeight: '900', fontVariant: ['tabular-nums'] },
  stripes: { position: 'absolute', left: '48%', top: -12, flexDirection: 'row', gap: 4, transform: [{ skewX: '-28deg' }] },
  stripe: { width: 10, height: 76, backgroundColor: '#10161222' },
});
