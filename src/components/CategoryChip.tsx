import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category } from '@/db/types';
import { tapHaptic } from '@/lib/haptics';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type CategoryChipProps = {
  category: Category;
  disabled?: boolean;
  onPress: (category: Category) => void;
};

export const CategoryChip = memo(function CategoryChip({
  category,
  disabled,
  onPress,
}: CategoryChipProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityHint="Saves the entered amount in this category"
      accessibilityLabel={`Save as ${category.name}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tapHaptic();
        onPress(category);
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View style={[styles.accent, { backgroundColor: category.color }]} />
      <CategoryIcon icon={category.icon} color={category.color} size={40} iconSize={23} />
      <Text numberOfLines={1} style={[styles.label, { color: colors.text }]}>
        {category.name}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    width: '31%',
    minHeight: 82,
    minWidth: layout.minimumTapTarget,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.lg,
  },
  accent: { position: 'absolute', left: -1.5, top: 15, width: 5, height: 43, borderRadius: radii.pill },
  label: { ...typography.label, width: '100%', fontSize: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
});
