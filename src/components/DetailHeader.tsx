import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function DetailHeader({ title, onBack, action }: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack}
        style={({ pressed }) => [styles.button, {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        }]}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%', maxWidth: layout.contentMaxWidth, minHeight: 64, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
  },
  button: {
    width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderRadius: radii.pill,
  },
  title: { ...typography.label, flex: 1, letterSpacing: 0.8 },
});
