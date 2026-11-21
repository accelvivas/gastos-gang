import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/use-app-theme';

const DOTS = Array.from({ length: 100 }, (_, index) => ({
  left: `${3 + (index % 10) * 10.3}%` as `${number}%`,
  top: 18 + Math.floor(index / 10) * 170,
}));

export const StreetBackground = memo(function StreetBackground() {
  const { colors } = useAppTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DOTS.map((dot, index) => (
        <View key={index} style={[styles.dot, dot, { backgroundColor: colors.dot }]} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
});
