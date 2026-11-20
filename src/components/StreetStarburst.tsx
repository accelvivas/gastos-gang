import { StyleSheet, View } from 'react-native';

type StreetStarburstProps = {
  color: string;
  size?: number;
};

const ROTATIONS = ['0deg', '45deg', '90deg', '135deg'] as const;

export function StreetStarburst({ color, size = 32 }: StreetStarburstProps) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {ROTATIONS.map((rotation) => (
        <View
          key={rotation}
          style={[
            styles.line,
            {
              backgroundColor: color,
              width: size,
              top: size / 2 - 1,
              transform: [{ rotate: rotation }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', height: 2, borderRadius: 2 },
});
