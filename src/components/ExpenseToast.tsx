import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

type ExpenseToastProps = {
  title: string;
  message: string;
  onUndo?: () => void;
};

export function ExpenseToast({ title, message, onUndo }: ExpenseToastProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.toast}>
      <View style={styles.copy}>
        <Text style={styles.title}>✓ {title}</Text>
        <Text style={styles.message}>{message}</Text>
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
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: streetColors.border,
    borderRadius: radii.lg,
    backgroundColor: streetColors.surface,
    shadowColor: streetColors.black,
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 6,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.label, color: streetColors.lime, letterSpacing: 0.5 },
  message: { ...typography.caption, color: streetColors.cream },
  undo: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.md },
  undoText: { ...typography.label, color: streetColors.orange },
});
