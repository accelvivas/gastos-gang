import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import type { ExpenseWithCategory } from '@/db/types';
import { formatPeso } from '@/lib/money';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

type ExpenseRowProps = {
  expense: ExpenseWithCategory;
  onDelete?: (expense: ExpenseWithCategory) => void;
  onPress: (expense: ExpenseWithCategory) => void;
};

export function formatExpenseTime(createdAt: number): string {
  const date = new Date(createdAt);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export const ExpenseRow = memo(function ExpenseRow({ expense, onDelete, onPress }: ExpenseRowProps) {
  const amount = formatPeso(expense.amountCentavos);
  const time = formatExpenseTime(expense.createdAt);
  return (
    <Pressable
      accessibilityHint="Opens this expense for editing"
      accessibilityLabel={[expense.categoryName, expense.categoryIsArchived ? 'Archived category' : '', amount, time, expense.note].filter(Boolean).join(', ')}
      accessibilityRole="button"
      accessibilityActions={onDelete ? [{ name: 'delete', label: 'Delete expense' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDelete?.(expense);
      }}
      onPress={() => onPress(expense)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.accent, { backgroundColor: expense.categoryColor }]} />
      <CategoryIcon icon={expense.categoryIcon} color={expense.categoryColor} size={44} iconSize={23} />
      <View style={styles.details}>
        <Text numberOfLines={1} style={styles.category}>{expense.categoryName}</Text>
        <Text numberOfLines={1} style={styles.time}>{time}{expense.note ? ` · ${expense.note}` : ''}</Text>
        {expense.categoryIsArchived ? <Text style={styles.archived}>ARCHIVED</Text> : null}
      </View>
      <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>{amount}</Text>
      <Ionicons name="chevron-forward" size={17} color={streetColors.muted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: streetColors.border,
    borderRadius: radii.lg,
    backgroundColor: streetColors.surface,
    padding: spacing.sm,
    paddingLeft: spacing.lg,
  },
  pressed: { opacity: 0.76 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  details: { flex: 1, minWidth: 0, gap: 2 },
  category: { ...typography.label, color: streetColors.cream, fontSize: 16 },
  archived: { ...typography.caption, color: streetColors.orange, fontSize: 9, fontWeight: '800' },
  amount: { ...typography.label, flexShrink: 1, maxWidth: '43%', color: streetColors.cream, fontSize: 17, fontVariant: ['tabular-nums'] },
  time: { ...typography.caption, color: streetColors.muted },
});
