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

const palette = {
  white: '#FFFFFF',
  cloud: '#F7F6FA',
  mist: '#EFEDF5',
  silver: '#D8D4E2',
  graphite: '#6F697B',
  ink: '#201B2C',
  night: '#15111E',
  nightRaised: '#211B2D',
  nightMuted: '#2B2438',
  nightBorder: '#3D354B',
  lavender: '#9D8CFF',
  violet: '#6C4DFF',
  violetPressed: '#5538DE',
  mint: '#2EAD75',
  amber: '#D99020',
  coral: '#D94B5B',
  blackOverlay: 'rgba(0, 0, 0, 0.45)',
} as const;

export const themes: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: palette.cloud,
    surface: palette.white,
    surfaceMuted: palette.mist,
    text: palette.ink,
    textMuted: palette.graphite,
    primary: palette.violet,
    primaryPressed: palette.violetPressed,
    border: palette.silver,
    success: palette.mint,
    warning: palette.amber,
    danger: palette.coral,
    overlay: palette.blackOverlay,
  },
  dark: {
    background: palette.night,
    surface: palette.nightRaised,
    surfaceMuted: palette.nightMuted,
    text: palette.white,
    textMuted: palette.silver,
    primary: palette.lavender,
    primaryPressed: palette.violet,
    border: palette.nightBorder,
    success: palette.mint,
    warning: palette.amber,
    danger: palette.coral,
    overlay: palette.blackOverlay,
  },
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
  pill: 999,
} as const;

export const typography = {
  amount: { fontSize: 48, lineHeight: 58, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  tabLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

export const layout = {
  minimumTapTarget: 44,
  tabBarHeight: 64,
  contentMaxWidth: 560,
} as const;
