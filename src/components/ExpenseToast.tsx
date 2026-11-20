import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  joke,
  kind = 'success',
  title,
  message,
  onUndo,
}: ExpenseToastProps) {
  const indicator = kind === 'success' ? '✓' : kind === 'error' ? '!' : '↶';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.toast}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, kind === 'error' && styles.errorTitle]}>
          {indicator} {title}
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {joke ? <Text style={styles.joke}>{joke}</Text> : null}
      </View>
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
  );
}

const styles = StyleSheet.create({
  toast: {
    width: '92%',
    maxWidth: layout.contentMaxWidth,
    minHeight: 112,
    borderWidth: 1.5,
    borderColor: streetColors.border,
    borderRadius: radii.lg,
    backgroundColor: streetColors.surface,
    shadowColor: streetColors.black,
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 6,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  accent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 5 },
  copy: { gap: spacing.xs, paddingRight: spacing.sm },
  title: { ...typography.label, color: streetColors.lime, letterSpacing: 0.5 },
  errorTitle: { color: streetColors.orange },
  message: { ...typography.label, color: streetColors.cream, fontSize: 13 },
  joke: { ...typography.body, color: streetColors.muted, fontSize: 14, lineHeight: 20 },
  undo: { minHeight: layout.minimumTapTarget, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.sm },
  undoText: { ...typography.label, color: streetColors.orange },
});
