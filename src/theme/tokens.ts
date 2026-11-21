import type { TextStyle } from 'react-native';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  border: string;
  success: string;
  warning: string;
  warningBackground: string;
  warningText: string;
  warningFill: string;
  danger: string;
  shadow: string;
  progressTrack: string;
  overlay: string;
  cream: string;
  orange: string;
  peach: string;
  olive: string;
  brown: string;
  black: string;
  dot: string;
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

const darkTheme: ThemeColors = {
  background: streetColors.background,
  surface: streetColors.surface,
  surfaceMuted: streetColors.surfaceElevated,
  surfaceElevated: streetColors.surfaceElevated,
  text: streetColors.cream,
  textMuted: streetColors.muted,
  primary: streetColors.lime,
  primaryPressed: streetColors.limePressed,
  primaryText: streetColors.black,
  border: streetColors.border,
  success: streetColors.lime,
  warning: streetColors.orange,
  warningBackground: '#E8C547',
  warningText: '#3A2D00',
  warningFill: '#6A5300',
  danger: streetColors.danger,
  shadow: '#080C09',
  progressTrack: 'rgba(17, 23, 20, 0.22)',
  overlay: streetColors.overlay,
  cream: streetColors.cream,
  orange: streetColors.orange,
  peach: streetColors.peach,
  olive: streetColors.olive,
  brown: streetColors.brown,
  black: streetColors.black,
  dot: streetColors.dot,
};

export const themes: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#FBF6EA',
    surface: '#FFFDF7',
    surfaceMuted: '#F0E7D5',
    surfaceElevated: '#F0E7D5',
    text: '#1B2A20',
    textMuted: '#536557',
    primary: '#4B6800',
    primaryPressed: '#395000',
    primaryText: '#FFFDF7',
    border: '#718273',
    success: '#3E641D',
    warning: '#A94326',
    warningBackground: '#F3D978',
    warningText: '#3A2D00',
    warningFill: '#735415',
    danger: '#A42E2E',
    shadow: '#D5CBB8',
    progressTrack: 'rgba(27, 42, 32, 0.16)',
    overlay: 'rgba(17, 23, 20, 0.58)',
    cream: '#FFFDF7',
    orange: '#A94326',
    peach: '#F3A58A',
    olive: '#3F6241',
    brown: '#74504A',
    black: '#1B2A20',
    dot: '#E8DDC8',
  },
  dark: darkTheme,
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
