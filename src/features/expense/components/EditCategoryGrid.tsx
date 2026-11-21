import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category } from '@/db/types';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

type EditCategoryGridProps = {
  categories: readonly Category[];
  disabled: boolean;
  onSelect: (id: number) => void;
  selectedId: number | null;
};

export const EditCategoryGrid = memo(function EditCategoryGrid({
  categories,
  disabled,
  onSelect,
  selectedId,
}: EditCategoryGridProps) {
  return (
    <View accessibilityLabel="Expense category" style={styles.grid}>
      {categories.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            accessibilityLabel={`${category.name}${category.isArchived ? ', archived' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(category.id)}
            style={({ pressed }) => [
              styles.chip,
              selected && { borderColor: category.color, backgroundColor: `${category.color}20` },
              pressed && styles.pressed,
            ]}>
            <CategoryIcon icon={category.icon} color={category.color} size={26} iconSize={16} />
            <Text numberOfLines={1} style={styles.name}>{category.name}</Text>
            {category.isArchived ? <Text style={styles.archived}>ARCHIVED</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: '31%', minHeight: 66, minWidth: layout.minimumTapTarget, justifyContent: 'center',
    gap: 2, borderWidth: 1.5, borderColor: streetColors.border, borderRadius: radii.md,
    backgroundColor: streetColors.surface, padding: spacing.sm,
  },
  name: { ...typography.caption, color: streetColors.cream, fontWeight: '800' },
  archived: { color: streetColors.orange, fontSize: 8, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
