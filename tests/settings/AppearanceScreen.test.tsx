import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppearanceScreen } from '@/features/settings/components/AppearanceScreen';
import * as settingsRepo from '@/repositories/settingsRepo';
import { useSettingsStore } from '@/store/settings-store';
import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

beforeEach(async () => {
  mockDb = await createTestDb();
  useSettingsStore.setState({ themePreference: 'dark' });
});

afterEach(() => {
  mockDb.close();
  useSettingsStore.setState({ themePreference: 'dark' });
});

test('offers all appearance choices, persists selection, and marks the active mode', async () => {
  await render(<AppearanceScreen onBack={jest.fn()} />);

  const dark = await screen.findByRole('radio', { name: 'Dark, Original Geng Geng', checked: true });
  expect(dark).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Light, Fresh Vibes' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'System, Follow Device' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Light, Fresh Vibes' }));
  await waitFor(async () => {
    await expect(settingsRepo.getTyped<settingsRepo.ThemeMode>(mockDb, 'theme_mode')).resolves.toBe('light');
  });
  expect(useSettingsStore.getState().themePreference).toBe('light');
  expect(screen.getByRole('radio', { name: 'Light, Fresh Vibes', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'System, Follow Device' }));
  await waitFor(async () => {
    await expect(settingsRepo.getTyped<settingsRepo.ThemeMode>(mockDb, 'theme_mode')).resolves.toBe('system');
  });
  expect(useSettingsStore.getState().themePreference).toBe('system');

  await fireEvent.press(screen.getByRole('radio', { name: 'Dark, Original Geng Geng' }));
  await waitFor(async () => {
    await expect(settingsRepo.getTyped<settingsRepo.ThemeMode>(mockDb, 'theme_mode')).resolves.toBe('dark');
  });
});
