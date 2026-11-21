import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsRoute from '@/app/(tabs)/settings';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

afterEach(() => {
  mockPush.mockClear();
});

test('renders the Phase 5.1 Settings menu and subtitle', async () => {
  await render(<SettingsRoute />);

  expect(screen.getByText("Ayusin natin 'to, bossing.")).toBeTruthy();
  expect(screen.getByText('YOUR GANG')).toBeTruthy();
  expect(screen.getByText('DAILY DAMAGE CONTROL')).toBeTruthy();
  expect(screen.getByText('APP VIBES')).toBeTruthy();
  expect(screen.getByText('YOUR DATA')).toBeTruthy();
  expect(screen.getByText('ABOUT')).toBeTruthy();
  expect(screen.getByText('Manage Categories')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Manage Categories' }).props.accessibilityHint)
    .toContain('Organize your gastos lanes');
  expect(screen.getByText('Daily Budget')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back Up Data' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Restore Backup' })).toBeTruthy();
});

test('unfinished menu rows navigate to clearly labeled placeholder states', async () => {
  await render(<SettingsRoute />);

  fireEvent.press(screen.getByRole('button', { name: 'Manage Categories' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/settings/[feature]',
    params: { feature: 'categories' },
  });

  fireEvent.press(screen.getByRole('button', { name: 'Appearance' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/settings/[feature]',
    params: { feature: 'appearance' },
  });

  fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/settings/[feature]',
    params: { feature: 'export' },
  });

  fireEvent.press(screen.getByRole('button', { name: 'Back Up Data' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/settings/[feature]',
    params: { feature: 'backup' },
  });

  fireEvent.press(screen.getByRole('button', { name: 'Restore Backup' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/settings/[feature]',
    params: { feature: 'restore' },
  });
});
