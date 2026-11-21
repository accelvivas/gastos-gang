import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type CategoryIconProps = {
  icon: string;
  color: string;
  size: number;
  iconSize: number;
};

function isIonicon(name: string): name is keyof typeof Ionicons.glyphMap {
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name);
}

function linearChannel(hex: string): number {
  const channel = parseInt(hex, 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function iconColor(background: string, light: string, dark: string): string {
  if (!/^#[\da-f]{6}$/i.test(background)) return light;

  const luminance =
    0.2126 * linearChannel(background.slice(1, 3)) +
    0.7152 * linearChannel(background.slice(3, 5)) +
    0.0722 * linearChannel(background.slice(5, 7));
  return luminance >= 0.18 ? dark : light;
}

export const CategoryIcon = memo(function CategoryIcon({ icon, color, size, iconSize }: CategoryIconProps) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.badge, { width: size, height: size, backgroundColor: color }]}>
      <Ionicons
        allowFontScaling={false}
        color={iconColor(color, colors.cream, colors.black)}
        name={isIonicon(icon) ? icon : 'help-circle-outline'}
        size={iconSize}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
});
