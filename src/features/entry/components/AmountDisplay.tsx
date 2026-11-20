import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { StreetStarburst } from '@/components/StreetStarburst';
import { formatAmountDraft } from '@/features/entry/utils/amountInput';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

type AmountDisplayProps = { draft: string; error: string | null };

export function AmountDisplay({ draft, error }: AmountDisplayProps) {
  const reduceMotion = useReducedMotion();
  const formatted = formatAmountDraft(draft);
  const amountSize = formatted.length > 12 ? 42 : formatted.length > 9 ? 50 : 62;

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>MAGKANO, BOSS?</Text>
      <View pointerEvents="none" style={styles.leftStar}>
        <StreetStarburst color={streetColors.orange} size={26} />
      </View>
      <Animated.Text
        key={draft}
        accessibilityLabel={`Amount ${formatted}`}
        adjustsFontSizeToFit
        entering={reduceMotion ? undefined : FadeIn.duration(90)}
        numberOfLines={1}
        style={[styles.amount, { fontSize: amountSize }]}> 
        {formatted}
      </Animated.Text>
      <View pointerEvents="none" style={styles.rightStar}>
        <StreetStarburst color={streetColors.orange} size={26} />
      </View>
      {error ? (
        <Animated.Text
          accessibilityLiveRegion="assertive"
          entering={reduceMotion ? undefined : FadeIn.duration(140)}
          exiting={reduceMotion ? undefined : FadeOut.duration(100)}
          numberOfLines={2}
          style={styles.error}>
          {error}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: streetColors.border,
    borderRadius: radii.xl,
    backgroundColor: streetColors.surface,
    paddingHorizontal: 52,
    paddingVertical: spacing.lg,
  },
  prompt: { ...typography.label, color: streetColors.muted, letterSpacing: 1.1 },
  amount: { ...typography.amount, maxWidth: '100%', color: streetColors.cream, lineHeight: 70, fontVariant: ['tabular-nums'] },
  error: { ...typography.caption, color: streetColors.orange, textAlign: 'center', fontWeight: '700' },
  leftStar: { position: 'absolute', left: spacing.xl, top: '56%' },
  rightStar: { position: 'absolute', right: spacing.xl, top: '56%' },
});
