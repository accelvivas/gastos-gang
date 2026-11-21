import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type HistoryListFooterProps = {
  hasMore: boolean;
  isLoadingMore: boolean;
  paginationError: string | null;
  onRetry: () => void;
};

export function HistoryListFooter(props: HistoryListFooterProps) {
  const { colors } = useAppTheme();
  if (props.isLoadingMore) {
    return <ActivityIndicator accessibilityLabel="Loading more expenses" color={colors.primary} style={styles.footer} />;
  }
  if (props.paginationError) {
    return (
      <View style={styles.footer}>
        <Text style={[styles.error, { color: colors.warning }]}>{props.paginationError}</Text>
        <Pressable accessibilityRole="button" onPress={props.onRetry} style={styles.retry}>
          <Text style={[styles.retryText, { color: colors.primary }]}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
  if (!props.hasMore) return (
    <View style={styles.end}>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <Text style={[styles.done, { color: colors.textMuted }]}>Yun na lahat, bossing!</Text>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
    </View>
  );
  return null;
}

const styles = StyleSheet.create({
  footer: { minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginVertical: spacing.lg },
  error: typography.caption,
  retry: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  retryText: typography.label,
  end: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  rule: { flexShrink: 1, width: 48, height: 1 },
  done: { ...typography.caption, flexShrink: 1, textAlign: 'center' },
});
