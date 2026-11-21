import { memo } from 'react';
import type { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';

import { BrandLogo } from '@/components/BrandLogo';

type LaunchLogoProps = {
  animatedStyle?: AnimatedStyle<ViewStyle>;
  size: number;
};

export const LaunchLogo = memo(function LaunchLogo({ animatedStyle, size }: LaunchLogoProps) {
  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel="Gastos Gang logo"
      testID="launch-logo"
      style={[{ alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
      <BrandLogo size={size} />
    </Animated.View>
  );
});
