import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';

import type { TextStyle, ViewStyle } from 'react-native';
import { streetColors } from '@/theme/tokens';

type LaunchWordmarkProps = {
  animatedStyle?: AnimatedStyle<ViewStyle>;
  gastosStyle?: AnimatedStyle<TextStyle>;
  gangStyle?: AnimatedStyle<TextStyle>;
  taglineStyle?: AnimatedStyle<TextStyle>;
};

export const LaunchWordmark = memo(function LaunchWordmark({
  animatedStyle,
  gastosStyle,
  gangStyle,
  taglineStyle,
}: LaunchWordmarkProps) {
  const { width } = useWindowDimensions();
  const fontSize = width < 350 ? 28 : 34;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View accessible accessibilityRole="header" accessibilityLabel="Gastos Gang." testID="launch-wordmark" style={styles.wordmark}>
        <Animated.Text style={[styles.wordmarkText, { fontSize, color: streetColors.cream }, gastosStyle]}>GASTOS</Animated.Text>
        <Animated.Text style={[styles.wordmarkText, { fontSize, color: streetColors.lime }, gangStyle]}>GANG.</Animated.Text>
      </View>
      <Animated.Text
        testID="launch-tagline"
        style={[styles.tagline, taglineStyle]}>
        Track your gastos, bossing!
      </Animated.Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 12,
  },
  wordmark: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
  },
  wordmarkText: { fontWeight: '900', letterSpacing: 0.5 },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    color: streetColors.muted,
  },
});
