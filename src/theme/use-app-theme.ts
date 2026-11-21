import { Appearance, useColorScheme } from 'react-native';

import type { ThemePreference } from '@/store/settings-store';
import { useSettingsStore } from '@/store/settings-store';
import { themes } from '@/theme/tokens';

export function applyNativeThemePreference(themePreference: ThemePreference): void {
  Appearance.setColorScheme(themePreference === 'system' ? 'auto' : themePreference);
}

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const resolvedTheme =
    themePreference === 'system' ? (systemColorScheme ?? 'dark') : themePreference;

  return {
    colors: themes[resolvedTheme],
    isDark: resolvedTheme === 'dark',
    resolvedTheme,
    themePreference,
  } as const;
}
