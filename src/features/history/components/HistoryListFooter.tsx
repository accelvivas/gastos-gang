import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, spacing, streetColors, typography } from '@/theme/tokens';

type HistoryListFooterProps = {
  hasMore: boolean;
  isLoadingMore: boolean;
  paginationError: string | null;
  onRetry: () => void;
};

export function HistoryListFooter(props: HistoryListFooterProps) {
  if (props.isLoadingMore) {
    return <ActivityIndicator accessibilityLabel="Loading more expenses" color={streetColors.lime} style={styles.footer} />;
  }
  if (props.paginationError) {
    return (
      <View style={styles.footer}>
        <Text style={styles.error}>{props.paginationError}</Text>
        <Pressable accessibilityRole="button" onPress={props.onRetry} style={styles.retry}>
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
  if (!props.hasMore) return (
    <View style={styles.end}>
      <View style={styles.rule} />
      <Text style={styles.done}>Yun na lahat, bossing!</Text>
      <View style={styles.rule} />
    </View>
  );
  return null;
}

const styles = StyleSheet.create({
  footer: { minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginVertical: spacing.lg },
  error: { ...typography.caption, color: streetColors.orange },
  retry: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  retryText: { ...typography.label, color: streetColors.lime },
  end: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  rule: { flexShrink: 1, width: 48, height: 1, backgroundColor: streetColors.border },
  done: { ...typography.caption, flexShrink: 1, color: streetColors.muted, textAlign: 'center' },
});
