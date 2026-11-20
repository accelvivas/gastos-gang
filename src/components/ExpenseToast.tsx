import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

type ExpenseToastProps = {
  accentColor?: string;
  joke?: string;
  kind?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onUndo?: () => void;
};

export function ExpenseToast({
  accentColor = streetColors.lime,
  joke: funnyMessage,
  kind = 'success',
  title,
  message,
  onUndo,
}: ExpenseToastProps) {
  const { width: screenWidth } = useWindowDimensions();
  const indicator = kind === 'success' ? '✓' : kind === 'error' ? '!' : '↶';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.toast, { width: Math.min(screenWidth - spacing.xxl, layout.contentMaxWidth) }]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, kind === 'error' && styles.errorTitle]}>
          {indicator} {title}
        </Text>
        {funnyMessage ? <Text style={styles.joke}>{funnyMessage}</Text> : null}
        <View style={styles.footer}>
          {message ? <Text style={styles.message}>{message}</Text> : <View style={styles.footerSpacer} />}
          {onUndo ? (
            <Pressable
              accessibilityLabel="Undo saved expense"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onUndo}
              style={styles.undo}>
              <Text style={styles.undoText}>UNDO</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    maxWidth: layout.contentMaxWidth,
    borderWidth: 1,
    borderColor: streetColors.border,
    borderRadius: radii.lg,
    backgroundColor: streetColors.surface,
    shadowColor: streetColors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  accent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  copy: { gap: spacing.xs, flexShrink: 1 },
  title: {
    ...typography.label,
    color: streetColors.cream,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  errorTitle: { color: streetColors.orange },
  joke: {
    ...typography.body,
    color: streetColors.lime,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  footer: {
    minHeight: layout.minimumTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerSpacer: { flex: 1 },
  message: {
    ...typography.caption,
    color: streetColors.cream,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    flexShrink: 1,
  },
  undo: {
    minWidth: layout.minimumTapTarget,
    minHeight: layout.minimumTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  undoText: { ...typography.label, color: streetColors.orange },
});
