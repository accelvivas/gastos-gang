import type { TextStyle } from 'react-native';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
};

export const streetColors = {
  background: '#111714',
  lime: '#C9FC39',
  limePressed: '#AEE52C',
  surface: '#202C24',
  surfaceElevated: '#293A30',
  cream: '#F3F3E8',
  muted: '#9DADA3',
  border: '#526558',
  orange: '#FF805C',
  peach: '#FFA58B',
  olive: '#3B5133',
  brown: '#62463A',
  danger: '#FF6B6B',
  dot: '#264334',
  black: '#101612',
  overlay: 'rgba(0, 0, 0, 0.45)',
  category: {
    food: '#FFB347',
    transport: '#60A5FA',
    load: '#C084FC',
    shopping: '#F472B6',
    bills: '#6EE7B7',
    other: '#E4E2D6',
  },
} as const;

const streetTheme: ThemeColors = {
  background: streetColors.background,
  surface: streetColors.surface,
  surfaceMuted: streetColors.surfaceElevated,
  text: streetColors.cream,
  textMuted: streetColors.muted,
  primary: streetColors.lime,
  primaryPressed: streetColors.limePressed,
  border: streetColors.border,
  success: streetColors.lime,
  warning: streetColors.orange,
  danger: streetColors.danger,
  overlay: streetColors.overlay,
};

export const themes: Record<'light' | 'dark', ThemeColors> = {
  light: streetTheme,
  dark: streetTheme,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  amount: { fontSize: 58, lineHeight: 66, fontWeight: '900', letterSpacing: -2 },
  title: { fontSize: 40, lineHeight: 44, fontWeight: '900', letterSpacing: -1.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: 0.4 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  tabLabel: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

export const layout = {
  minimumTapTarget: 44,
  tabBarHeight: 76,
  contentMaxWidth: 560,
} as const;
