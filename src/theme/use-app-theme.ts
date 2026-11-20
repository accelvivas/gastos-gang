import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settings-store';
import { themes } from '@/theme/tokens';

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const resolvedTheme =
    themePreference === 'system' ? (systemColorScheme ?? 'light') : themePreference;

  return {
    colors: themes[resolvedTheme],
    isDark: resolvedTheme === 'dark',
    resolvedTheme,
    themePreference,
  } as const;
}
