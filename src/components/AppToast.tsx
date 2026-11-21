import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type PanResponderGestureState,
} from 'react-native';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ExpenseToast } from '@/components/ExpenseToast';
import { layout, spacing } from '@/theme/tokens';

type SwipeToastProps = React.ComponentProps<typeof ExpenseToast> & {
  isVisible: boolean;
  hide: () => void;
  activeRef: RefObject<object | null>;
};

function SwipeToast({ isVisible, hide, activeRef, onUndo, ...content }: SwipeToastProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const dismissing = useSharedValue(false);
  // The host supplies a new hide callback whenever it shows a new toast.
  const token = useMemo(() => ({ hide, isVisible }), [hide, isVisible]);

  useLayoutEffect(() => {
    if (isVisible) {
      offset.set(0);
      dismissing.set(false);
      activeRef.current = token;
    }
    return () => {
      if (activeRef.current === token) activeRef.current = null;
      cancelAnimation(offset);
    };
  }, [activeRef, dismissing, isVisible, offset, token]);

  const dismiss = useCallback(() => {
    if (activeRef.current === token) hide();
  }, [activeRef, hide, token]);
  // PanResponder callbacks are registered during render and use the live Reanimated shared values.
  // eslint-disable-next-line react-hooks/refs
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gestureState: PanResponderGestureState) => (
      isVisible &&
      !dismissing.get() &&
      Math.abs(gestureState.dx) >= 12 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
    ),
    onPanResponderMove: (_event, gestureState) => {
      if (!dismissing.get()) offset.set(gestureState.dx);
    },
    onPanResponderRelease: (_event, gestureState) => {
      if (dismissing.get()) return;
      if (Math.abs(gestureState.dx) < Math.min(96, width * 0.22)) {
        offset.set(withTiming(0, { duration: reduceMotion ? 0 : 160 }));
        return;
      }
      dismissing.set(true);
      offset.set(withTiming(Math.sign(gestureState.dx) * width, {
        duration: reduceMotion ? 0 : 180,
      }, (finished) => {
        if (finished) scheduleOnRN(dismiss);
      }));
    },
    onPanResponderTerminate: () => {
      if (!dismissing.get()) offset.set(withTiming(0, { duration: reduceMotion ? 0 : 160 }));
    },
  }), [dismiss, dismissing, isVisible, offset, reduceMotion, width]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View
      testID="expense-toast-swipe"
      collapsable={false}
      pointerEvents={isVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      {...panResponder.panHandlers}>
      <Animated.View style={slide}>
        <ExpenseToast {...content} onUndo={onUndo && (() => {
          if (activeRef.current === token && !dismissing.get()) onUndo();
        })} />
      </Animated.View>
    </View>
  );
}

export function AppToast() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const activeRef = useRef<object | null>(null);
  const [toastVersion, setToastVersion] = useState(0);
  // Invalidate before React commits a replacement or a timer-driven hide.
  const invalidateSwipe = () => { activeRef.current = null; };
  const toastConfig = useMemo<ToastConfig>(() => ({
    expenseSaved: ({ text1, text2, props, isVisible, hide }) => (
      <SwipeToast
        key={toastVersion}
        activeRef={activeRef}
        isVisible={isVisible}
        hide={hide}
        title={text1 ?? 'SOLID, BOSSING!'}
        message={text2 ?? ''}
        joke={props.joke}
        accentColor={props.accentColor}
        kind={props.kind}
        onUndo={props.onUndo}
        undoAccessibilityLabel={props.undoAccessibilityLabel}
      />
    ),
  }), [toastVersion]);
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Toast
        animationConfig={{
          enter: { type: 'timing', duration: reduceMotion ? 0 : 220 },
          exit: { type: 'timing', duration: reduceMotion ? 0 : 180 },
        }}
        config={toastConfig}
        swipeable={false}
        onShow={() => {
          invalidateSwipe();
          setToastVersion((version) => version + 1);
        }}
        onHide={invalidateSwipe}
        position="bottom"
        bottomOffset={layout.tabBarHeight + insets.bottom + spacing.md}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1 },
});
