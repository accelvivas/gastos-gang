import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryChip } from '@/components/CategoryChip';
import type { Category } from '@/db/types';
import { layout, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type CategoryGridProps = {
  categories: Category[];
  disabled?: boolean;
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  onSelect: (category: Category) => void;
};

export function CategoryGrid(props: CategoryGridProps) {
  const { colors } = useAppTheme();
  if (props.isLoading) return <ActivityIndicator accessibilityLabel="Loading categories" color={colors.primary} />;
  if (props.error) {
    return (
      <View style={styles.state}>
        <Text style={[styles.stateText, { color: colors.danger }]}>{props.error}</Text>
        <Pressable accessibilityRole="button" onPress={props.onRetry} style={styles.retry}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  const active = props.categories.filter((category) => !category.isArchived);
  if (active.length === 0) return <Text style={[styles.stateText, { color: colors.textMuted }]}>No active categories yet.</Text>;
  return (
    <View accessibilityLabel="Expense categories" style={styles.grid}>
      {active.map((category) => (
        <CategoryChip key={category.id} category={category} disabled={props.disabled} onPress={props.onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  state: { alignItems: 'center', gap: spacing.sm },
  stateText: { ...typography.body, textAlign: 'center' },
  retry: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  retryText: typography.label,
});
