import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatPeso } from '@/lib/money';
import { spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type HistorySectionHeaderProps = {
  title: string;
  totalCentavos: number;
};

export const HistorySectionHeader = memo(function HistorySectionHeader({ title, totalCentavos }: HistorySectionHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <View style={[styles.row, { backgroundColor: colors.primary }]}>
        <View pointerEvents="none" style={styles.stripes}>
          {[0, 1, 2].map((stripe) => <View key={stripe} style={[styles.stripe, { backgroundColor: colors.primaryText }]} />)}
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.primaryText }]}>{title}</Text>
        <Text accessibilityLabel={`${title} total ${formatPeso(totalCentavos)}`} style={[styles.total, { color: colors.primaryText }]}>
          {formatPeso(totalCentavos)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: 18, overflow: 'hidden' },
  title: { ...typography.heading, flexShrink: 1, fontWeight: '900', textTransform: 'uppercase' },
  total: { ...typography.heading, flexShrink: 1, textAlign: 'right', fontWeight: '900', fontVariant: ['tabular-nums'] },
  stripes: { position: 'absolute', left: '48%', top: -12, flexDirection: 'row', gap: 4, transform: [{ skewX: '-28deg' }] },
  stripe: { width: 10, height: 76, opacity: 0.12 },
});
