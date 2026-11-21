import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { StreetStarburst } from '@/components/StreetStarburst';
import { layout, spacing, streetColors, typography } from '@/theme/tokens';

export function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.branding}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BrandLogo size={48} />
        </View>
        <Text accessibilityRole="header" style={styles.wordmark}>
          GASTOS <Text style={styles.lime}>GANG.</Text>
        </Text>
        <StreetStarburst color={streetColors.orange} size={18} />
      </View>
    </View>
  );
}

export function TabHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: streetColors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: streetColors.border },
  branding: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  wordmark: { ...typography.title, flexShrink: 1, color: streetColors.cream, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  lime: { color: streetColors.lime },
  heading: { borderLeftWidth: 6, borderLeftColor: streetColors.lime, paddingLeft: spacing.sm },
  title: { ...typography.title, color: streetColors.cream, fontSize: 34, lineHeight: 40 },
  subtitle: { ...typography.caption, color: streetColors.muted, fontSize: 14, lineHeight: 20 },
});
