import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { StreetStarburst } from '@/components/StreetStarburst';
import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

export function GastosHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <View style={styles.branding}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BrandLogo size={52} />
          </View>
          <Text accessibilityRole="header" style={styles.wordmark}>
            GASTOS <Text style={styles.wordmarkLime}>GANG.</Text>
          </Text>
        </View>
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
  branding: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { ...typography.title, flex: 1, color: streetColors.cream, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  wordmarkLime: { color: streetColors.lime },
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
