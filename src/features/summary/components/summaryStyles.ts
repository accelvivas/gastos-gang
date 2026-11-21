import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function useSummaryStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    section: { gap: spacing.sm },
    title: { ...typography.heading, color: colors.text, fontWeight: '900' },
    muted: { ...typography.caption, color: colors.textMuted, fontSize: 13 },
    card: {
      borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg,
      backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm,
    },
  }), [colors]);
}
