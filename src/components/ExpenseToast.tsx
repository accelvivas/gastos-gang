import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type ExpenseToastProps = {
  accentColor?: string;
  joke?: string;
  kind?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onUndo?: () => void;
  undoAccessibilityLabel?: string;
};

export function ExpenseToast({
  accentColor,
  joke: funnyMessage,
  kind = 'success',
  title,
  message,
  onUndo,
  undoAccessibilityLabel = 'Undo saved expense',
}: ExpenseToastProps) {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const indicator = kind === 'success' ? '✓' : kind === 'error' ? '!' : '↶';
  return (
    <View
      testID="expense-toast"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        { width: Math.min(screenWidth - spacing.xxl, layout.contentMaxWidth), backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.black },
      ]}>
      <View style={[styles.accent, { backgroundColor: accentColor ?? colors.primary }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }, kind === 'error' && { color: colors.warning }]}>
          {indicator} {title}
        </Text>
        {funnyMessage ? <Text style={[styles.joke, { color: colors.primary }]}>{funnyMessage}</Text> : null}
        <View style={styles.footer}>
          {message ? <Text style={[styles.message, { color: colors.text }]}>{message}</Text> : <View style={styles.footerSpacer} />}
          {onUndo ? (
            <Pressable
              accessibilityLabel={undoAccessibilityLabel}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onUndo}
              style={styles.undo}>
              <Text style={[styles.undoText, { color: colors.orange }]}>UNDO</Text>
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
    borderRadius: radii.lg,
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
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  joke: {
    ...typography.body,
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
  undoText: typography.label,
});
