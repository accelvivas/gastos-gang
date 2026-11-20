import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  themePreference: ThemePreference;
  setThemePreference: (themePreference: ThemePreference) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));
