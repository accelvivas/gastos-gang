import { StyleSheet, Text, View } from 'react-native';

import { StreetStarburst } from '@/components/StreetStarburst';
import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

export function GastosHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1} style={styles.brand}>
          <Text style={styles.brandCream}>GASTOS </Text>
          <Text style={styles.brandLime}>GANG.</Text>
        </Text>
        <Text style={styles.tagline}>{gastosCopy.greetings[0]}</Text>
      </View>
      <View style={styles.sticker}>
        <StreetStarburst color={streetColors.background} size={38} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  brand: typography.title,
  brandCream: { color: streetColors.cream },
  brandLime: { color: streetColors.lime },
  tagline: { ...typography.label, color: streetColors.muted, letterSpacing: 1.1 },
  sticker: {
    width: 62,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderTopRightRadius: 12,
    backgroundColor: streetColors.orange,
  },
});
