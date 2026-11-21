import { fireEvent, render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';

import SettingsFeatureRoute from '@/app/settings/[feature]';
import { createTestDb, type TestDb } from '../helpers/testDb';

const mockBack = jest.fn();
let mockDb: TestDb;
let mockFeature = 'appearance';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => ({ feature: mockFeature }),
}));

beforeEach(async () => {
  mockFeature = 'appearance';
  mockDb = await createTestDb();
});

afterEach(() => {
  mockDb.close();
});

test('opens the functional Appearance choices and supports back navigation', async () => {
  await render(<SettingsFeatureRoute />);

  expect(screen.getByText('APPEARANCE')).toBeTruthy();
  expect(await screen.findByRole('radio', { name: 'Dark, Original Geng Geng', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Light, Fresh Vibes' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('opens the CSV export feature from its settings route', async () => {
  mockFeature = 'export';
  await render(<SettingsFeatureRoute />);

  expect(screen.getByText('EXPORT CSV')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'EXPORT & SHARE CSV' })).toBeTruthy();
});

test('opens backup and restore flows from their settings routes', async () => {
  mockFeature = 'backup';
  await render(<SettingsFeatureRoute />);
  expect(screen.getByText('Keep a copy of your Gastos Gang data.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'CREATE AND SHARE BACKUP' })).toBeTruthy();

  mockFeature = 'restore';
  await render(<SettingsFeatureRoute />);
  expect(screen.getByText('Restore a Gastos Gang backup.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'CHOOSE BACKUP FILE' })).toBeTruthy();
});

test('opens the About screen with the official brand, actual app version, and privacy details', async () => {
  mockFeature = 'about';
  await render(<SettingsFeatureRoute />);

  const expectedVersion = Constants.expoConfig?.version
    ? `Version ${Constants.expoConfig.version}`
    : 'Version unavailable';
  expect(screen.getByLabelText('Official Gastos Gang logo')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'GASTOS GANG.' })).toBeTruthy();
  expect(screen.getByText('Track your gastos. Control your damage. Stay in the gang.')).toBeTruthy();
  expect(screen.getByText(expectedVersion)).toBeTruthy();
  expect(screen.getByText('Offline-first expense tracker')).toBeTruthy();
  expect(screen.getByText('Back up regularly')).toBeTruthy();
});
