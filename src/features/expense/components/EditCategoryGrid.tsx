import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category } from '@/db/types';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

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
  const { colors } = useAppTheme();
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
              { borderColor: colors.border, backgroundColor: colors.surface },
              selected && { borderColor: category.color, backgroundColor: `${category.color}20` },
              pressed && styles.pressed,
            ]}>
            <CategoryIcon icon={category.icon} color={category.color} size={26} iconSize={16} />
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{category.name}</Text>
            {category.isArchived ? <Text style={[styles.archived, { color: colors.orange }]}>ARCHIVED</Text> : null}
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
    gap: 2, borderWidth: 1.5, borderRadius: radii.md, padding: spacing.sm,
  },
  name: { ...typography.caption, fontWeight: '800' },
  archived: { fontSize: 8, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
