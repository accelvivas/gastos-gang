import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type SettingsSectionProps = PropsWithChildren<{
  title: string;
}>;

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={[styles.accent, { backgroundColor: colors.primary }]} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>{title}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accent: { width: 5, height: 20, borderRadius: 3 },
  title: { ...typography.label, letterSpacing: 1.1 },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radii.lg,
  },
});
