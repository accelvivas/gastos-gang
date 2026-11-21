import type { DbLike } from '@/db/client';
import * as settingsRepo from '@/repositories/settingsRepo';
import { useSettingsStore, type ThemePreference } from '@/store/settings-store';

export async function hydrateThemePreference(db: DbLike): Promise<void> {
  const savedTheme = await settingsRepo.getTyped<ThemePreference>(db, 'theme_mode');
  useSettingsStore.getState().setThemePreference(savedTheme ?? 'dark');
}
