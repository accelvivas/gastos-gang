import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { NumberPadKey } from '@/features/entry/utils/amountInput';
import { tapHaptic } from '@/lib/haptics';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const ROWS: readonly (readonly NumberPadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

type NumberPadProps = {
  disabled?: boolean;
  onKeyPress: (key: NumberPadKey) => void;
};

type KeyProps = NumberPadProps & { padKey: NumberPadKey };

const NumberPadButton = memo(function NumberPadButton({ disabled, onKeyPress, padKey }: KeyProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const label = padKey === 'backspace' ? 'Delete digit' : padKey === '.' ? 'Decimal point' : padKey;
  const isDecimal = padKey === '.';
  const isBackspace = padKey === 'backspace';

  return (
    <Animated.View style={[styles.keyContainer, animatedStyle]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          tapHaptic();
          onKeyPress(padKey);
        }}
        onPressIn={() => {
          scale.value = reduceMotion ? 1 : withTiming(0.94, { duration: 70 });
        }}
        onPressOut={() => {
          scale.value = reduceMotion ? 1 : withTiming(1, { duration: 100 });
        }}
        style={({ pressed }) => [
          styles.key,
          {
            backgroundColor: isDecimal
              ? streetColors.olive
              : isBackspace
                ? streetColors.brown
                : streetColors.surfaceElevated,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}>
        {isBackspace ? (
          <Ionicons name="backspace-outline" color={streetColors.peach} size={30} />
        ) : (
          <Text style={[styles.keyText, { color: isDecimal ? streetColors.lime : colors.text }]}> 
            {padKey}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
});

export const NumberPad = memo(function NumberPad({ disabled, onKeyPress }: NumberPadProps) {
  return (
    <View accessibilityLabel="Amount keypad" style={styles.pad}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((padKey) => (
            <NumberPadButton
              key={padKey}
              disabled={disabled}
              onKeyPress={onKeyPress}
              padKey={padKey}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pad: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  keyContainer: { flex: 1 },
  key: {
    height: 52,
    minHeight: layout.minimumTapTarget,
    minWidth: layout.minimumTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  keyText: { ...typography.heading, fontSize: 27, lineHeight: 32, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
