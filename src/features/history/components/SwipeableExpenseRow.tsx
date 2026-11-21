import { Ionicons } from '@expo/vector-icons';
import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { ExpenseWithCategory } from '@/db/types';
import { ExpenseRow } from '@/features/history/components/ExpenseRow';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type SwipeableExpenseRowProps = {
  expense: ExpenseWithCategory;
  onDelete: (expense: ExpenseWithCategory) => void;
  onOpen: (id: number, methods: SwipeableMethods) => void;
  onPress: (expense: ExpenseWithCategory) => void;
};

function DeleteAction({
  expense,
  onDelete,
  progress,
  revealed,
}: {
  expense: ExpenseWithCategory;
  onDelete: (expense: ExpenseWithCategory) => void;
  progress: SharedValue<number>;
  revealed: boolean;
}) {
  const { colors } = useAppTheme();
  const animatedStyle = useAnimatedStyle(() => ({ opacity: Math.min(progress.value, 1) }));
  return (
    <Animated.View accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'} style={[styles.actionContainer, animatedStyle]}>
      <Pressable
        accessibilityLabel={`Delete ${expense.categoryName} expense`}
        accessibilityRole="button"
        onPress={() => onDelete(expense)}
        style={[styles.deleteButton, { backgroundColor: colors.orange }]}>
        <Ionicons name="trash-outline" size={19} color={colors.primaryText} />
        <Text style={[styles.deleteText, { color: colors.primaryText }]}>DELETE</Text>
      </Pressable>
    </Animated.View>
  );
}

export const SwipeableExpenseRow = memo(function SwipeableExpenseRow({
  expense,
  onDelete,
  onOpen,
  onPress,
}: SwipeableExpenseRowProps) {
  const ref = useRef<SwipeableMethods>(null);
  const [revealed, setRevealed] = useState(false);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      overshootRight={false}
      rightThreshold={36}
      onSwipeableOpen={() => {
        setRevealed(true);
        if (ref.current) onOpen(expense.id, ref.current);
      }}
      onSwipeableWillClose={() => setRevealed(false)}
      renderRightActions={(progress, _translation, methods) => (
        <DeleteAction
          expense={expense}
          progress={progress}
          revealed={revealed}
          onDelete={(row) => {
            methods.close();
            onDelete(row);
          }}
        />
      )}
      containerStyle={styles.swipeable}>
      <ExpenseRow expense={expense} onDelete={onDelete} onPress={onPress} />
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  swipeable: { borderRadius: radii.lg, marginBottom: spacing.sm },
  actionContainer: { width: 92, minHeight: layout.minimumTapTarget },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  deleteText: { ...typography.label, fontSize: 12 },
});
