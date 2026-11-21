import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { StreetStarburst } from '@/components/StreetStarburst';
import { layout, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export const AppHeader = memo(function AppHeader() {
  const { colors } = useAppTheme();
  return (
    <View
      testID="app-header"
      style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.branding}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BrandLogo size={48} />
        </View>
        <Text accessibilityRole="header" style={[styles.wordmark, { color: colors.text }]}>
          GASTOS <Text style={{ color: colors.primary }}>GANG.</Text>
        </Text>
        <StreetStarburst color={colors.orange} size={18} />
      </View>
    </View>
  );
});

export function TabHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.heading, { borderLeftColor: colors.primary }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  branding: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  wordmark: { ...typography.title, flexShrink: 1, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  heading: { borderLeftWidth: 6, paddingLeft: spacing.sm },
  title: { ...typography.title, fontSize: 34, lineHeight: 40 },
  subtitle: { ...typography.caption, fontSize: 14, lineHeight: 20 },
});
