import { StyleSheet } from 'react-native';

import { radii, spacing, streetColors, typography } from '@/theme/tokens';

export const summaryStyles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { ...typography.heading, color: streetColors.cream, fontWeight: '900' },
  muted: { ...typography.caption, color: streetColors.muted, fontSize: 13 },
  card: {
    borderColor: streetColors.border, borderWidth: 1, borderRadius: radii.lg,
    backgroundColor: streetColors.surface, padding: spacing.md, gap: spacing.sm,
  },
});
