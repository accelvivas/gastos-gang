import * as settingsRepo from '@/repositories/settingsRepo';
import { useSettingsStore } from '@/store/settings-store';
import { hydrateThemePreference } from '@/theme/theme-storage';
import { createTestDb } from '../helpers/testDb';

test('restores a saved theme on startup and defaults existing installations to Dark', async () => {
  const db = await createTestDb();

  useSettingsStore.setState({ themePreference: 'light' });
  await hydrateThemePreference(db);
  expect(useSettingsStore.getState().themePreference).toBe('dark');

  await settingsRepo.setTyped(db, 'theme_mode', 'light');
  useSettingsStore.setState({ themePreference: 'dark' });
  await hydrateThemePreference(db);
  expect(useSettingsStore.getState().themePreference).toBe('light');

  await settingsRepo.setTyped(db, 'theme_mode', 'system');
  useSettingsStore.setState({ themePreference: 'dark' });
  await hydrateThemePreference(db);
  expect(useSettingsStore.getState().themePreference).toBe('system');

  db.close();
});
