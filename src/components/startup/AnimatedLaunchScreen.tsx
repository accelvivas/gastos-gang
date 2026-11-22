import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { LaunchLogo } from '@/components/startup/LaunchLogo';
import { LaunchWordmark } from '@/components/startup/LaunchWordmark';
import { spacing, streetColors } from '@/theme/tokens';

const EXIT_START = 1900;
const DURATION = 2220;
function reveal(time: number, start: number, end: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

type AnimatedLaunchScreenProps = {
  onNativeSplashReady: () => void;
  onCompleted: () => void;
};

export function AnimatedLaunchScreen({ onNativeSplashReady, onCompleted }: AnimatedLaunchScreenProps) {
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const size = Math.max(72, Math.min(180, width * 0.45, height * 0.31));
  const [hasLayout, setHasLayout] = useState(false);
  const handoff = useRef<Promise<void> | null>(null);
  const clock = useSharedValue(0);
  const scale = useSharedValue(0.62);

  useEffect(() => {
    if (!hasLayout) return;
    let active = true;
    handoff.current ??= SplashScreen.hideAsync().catch((error) => {
      console.warn('Could not hide the native splash screen.', error);
    });
    const finish = () => { if (active) onCompleted(); };
    void handoff.current.then(() => {
      if (!active) return;
      onNativeSplashReady();
      if (reducedMotion) {
        finish();
        return;
      }
      clock.set(0);
      scale.set(0.62);
      scale.set(withDelay(180, withSpring(1, { damping: 15, stiffness: 175, mass: 0.74 })));
      clock.set(withTiming(DURATION, { duration: DURATION, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }));
    });
    return () => {
      active = false;
      cancelAnimation(clock);
      cancelAnimation(scale);
    };
  }, [clock, hasLayout, onCompleted, onNativeSplashReady, reducedMotion, scale]);

  const overlay = useAnimatedStyle(() => ({ opacity: 1 - reveal(clock.get(), EXIT_START, DURATION) }));
  const logo = useAnimatedStyle(() => {
    const time = clock.get();
    return {
      opacity: reveal(time, 180, 375),
      transform: [{ translateY: 18 * (1 - reveal(time, 180, 690)) }, { scale: scale.get() }],
    };
  });
  const wordmark = useAnimatedStyle(() => ({ transform: [{ scale: 0.97 + reveal(clock.get(), 840, 1370) * 0.03 }] }));
  const gastos = useAnimatedStyle(() => {
    const amount = reveal(clock.get(), 840, 1170);
    return { opacity: amount, transform: [{ translateY: 12 * (1 - amount) }] };
  });
  const gang = useAnimatedStyle(() => {
    const amount = reveal(clock.get(), 965, 1295);
    return { opacity: amount, transform: [{ translateY: 12 * (1 - amount) }] };
  });
  const tagline = useAnimatedStyle(() => {
    const amount = reveal(clock.get(), 1290, 1650);
    return { opacity: amount, transform: [{ translateY: 8 * (1 - amount) }] };
  });

  return (
    <Animated.View testID="animated-launch-screen" onLayout={() => setHasLayout(true)}
      style={[styles.overlay, !reducedMotion && overlay]}>
      <SafeAreaView style={styles.centered}>
        <View style={styles.logoFrame}>
          <LaunchLogo size={size} animatedStyle={reducedMotion ? undefined : logo} />
        </View>
        <LaunchWordmark animatedStyle={reducedMotion ? undefined : wordmark}
          gastosStyle={reducedMotion ? undefined : gastos} gangStyle={reducedMotion ? undefined : gang}
          taglineStyle={reducedMotion ? undefined : tagline} />
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: streetColors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  logoFrame: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
});
