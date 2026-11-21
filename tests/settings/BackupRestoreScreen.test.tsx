import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { RestoreScreen } from '@/features/settings/components/BackupRestoreScreen';
import { BACKUP_FORMAT, type GastosGangBackup } from '@/features/settings/utils/backupSchema';

const mockGetDocumentAsync = jest.fn();
const mockCreateBackupSnapshot = jest.fn();
const mockGetCurrentBackupCounts = jest.fn();
const mockReadBackupFile = jest.fn();
const mockRestoreBackupAtomically = jest.fn();
const mockShareBackupFile = jest.fn();
const mockVerifyBackupFile = jest.fn();
const mockWriteBackupFile = jest.fn();
const mockToastShow = jest.fn();
const mockToastHide = jest.fn();
const mockGetTyped = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: (...args: unknown[]) => mockToastShow(...args), hide: () => mockToastHide() },
}));
jest.mock('@/repositories/settingsRepo', () => ({
  getTyped: (...args: unknown[]) => mockGetTyped(...args),
}));
jest.mock('@/features/settings/utils/backupService', () => ({
  ...jest.requireActual('@/features/settings/utils/backupService'),
  createBackupSnapshot: (...args: unknown[]) => mockCreateBackupSnapshot(...args),
  getCurrentBackupCounts: (...args: unknown[]) => mockGetCurrentBackupCounts(...args),
  readBackupFile: (...args: unknown[]) => mockReadBackupFile(...args),
  restoreBackupAtomically: (...args: unknown[]) => mockRestoreBackupAtomically(...args),
  shareBackupFile: (...args: unknown[]) => mockShareBackupFile(...args),
  verifyBackupFile: (...args: unknown[]) => mockVerifyBackupFile(...args),
  writeBackupFile: (...args: unknown[]) => mockWriteBackupFile(...args),
}));

function backup(): GastosGangBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    createdAt: '2026-11-21T06:30:00.000Z',
    appVersion: '1.0.0',
    data: {
      categories: [{
        id: 1,
        name: 'Food',
        icon: 'fast-food-outline',
        color: '#F59E0B',
        sortOrder: 0,
        isArchived: false,
        createdAt: 1_700_000_000_000,
      }],
      expenses: [],
      settings: [],
    },
  };
}

async function selectBackup() {
  mockGetDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/selected.json', name: 'selected.json', size: 100 }],
  });
  mockReadBackupFile.mockResolvedValue(backup());
  mockGetCurrentBackupCounts.mockResolvedValue({ categories: 6, expenses: 3, settings: 2 });
  await fireEvent.press(screen.getByRole('button', { name: 'CHOOSE BACKUP FILE' }));
  expect(await screen.findByText('BACKUP PREVIEW')).toBeTruthy();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTyped.mockResolvedValue('dark');
});

test('does not restore when safety-backup creation or writing fails', async () => {
  mockCreateBackupSnapshot.mockResolvedValue(backup());
  mockWriteBackupFile.mockRejectedValue(new Error('disk full'));
  await render(<RestoreScreen onBack={jest.fn()} />);
  await selectBackup();

  await fireEvent.press(screen.getByRole('button', { name: 'CREATE AND SHARE SAFETY BACKUP' }));

  expect(await screen.findByText('disk full')).toBeTruthy();
  expect(mockRestoreBackupAtomically).not.toHaveBeenCalled();
});

test('requires external safety-backup acknowledgment and explicit replace confirmation', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const safetyFile = {
    filename: 'gastos-gang-before-restore-20261121-063000.json',
    uri: 'file:///cache/safety.json',
    size: 200,
  };
  mockCreateBackupSnapshot.mockResolvedValue(backup());
  mockWriteBackupFile.mockResolvedValue(safetyFile);
  mockShareBackupFile.mockResolvedValue(undefined);
  mockRestoreBackupAtomically.mockResolvedValue({ categories: 1, expenses: 0, settings: 0 });

  await render(<RestoreScreen onBack={jest.fn()} />);
  await selectBackup();
  await fireEvent.press(screen.getByRole('button', { name: 'CREATE AND SHARE SAFETY BACKUP' }));
  expect(await screen.findByText(/temporary file may not survive uninstall/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'I saved the safety backup outside this app' }));
  await fireEvent.press(screen.getByRole('button', { name: 'REPLACE ALL DATA' }));

  expect(mockRestoreBackupAtomically).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'REPLACE ALL DATA',
    "Bossing, mapapalitan ang gastos at settings sa phone na 'to. Make sure may backup ka muna.",
    expect.any(Array)
  );
  const confirmation = alertSpy.mock.calls[0]?.[2]?.find((button) => button.text === 'REPLACE ALL DATA');
  await act(async () => {
    confirmation?.onPress?.();
    await Promise.resolve();
  });

  expect(await screen.findByText(/Restore committed and verified/)).toBeTruthy();
  expect(mockVerifyBackupFile).toHaveBeenCalledWith(safetyFile, backup());
  expect(mockRestoreBackupAtomically).toHaveBeenCalledWith(
    expect.anything(),
    expect.any(Object),
    { expectedCurrentData: backup().data }
  );
  alertSpy.mockRestore();
});

test('treats document-picker cancellation as a no-op', async () => {
  mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
  await render(<RestoreScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: 'CHOOSE BACKUP FILE' }));

  expect(mockReadBackupFile).not.toHaveBeenCalled();
  expect(mockRestoreBackupAtomically).not.toHaveBeenCalled();
  expect(screen.queryByText('BACKUP PREVIEW')).toBeNull();
});

test('reports a committed restore when post-commit theme refresh fails', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockGetDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/selected.json', name: 'selected.json', size: 100 }],
  });
  mockReadBackupFile.mockResolvedValue(backup());
  mockGetCurrentBackupCounts.mockResolvedValue({ categories: 6, expenses: 3, settings: 2 });
  mockCreateBackupSnapshot.mockResolvedValue(backup());
  mockWriteBackupFile.mockResolvedValue({
    filename: 'gastos-gang-before-restore-20261121-063000.json',
    uri: 'file:///cache/safety.json',
    size: 200,
  });
  mockShareBackupFile.mockResolvedValue(undefined);
  mockRestoreBackupAtomically.mockResolvedValue({ categories: 1, expenses: 0, settings: 0 });
  mockGetTyped.mockRejectedValue(new Error('theme hydration failed'));

  await render(<RestoreScreen onBack={jest.fn()} />);
  await selectBackup();
  await fireEvent.press(screen.getByRole('button', { name: 'CREATE AND SHARE SAFETY BACKUP' }));
  await screen.findByText(/temporary file may not survive uninstall/);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'I saved the safety backup outside this app' }));
  await fireEvent.press(screen.getByRole('button', { name: 'REPLACE ALL DATA' }));
  const confirmation = alertSpy.mock.calls[0]?.[2]?.find((button) => button.text === 'REPLACE ALL DATA');

  await act(async () => {
    confirmation?.onPress?.();
    await Promise.resolve();
  });

  expect(await screen.findByText(/Restore committed \(0 expenses/)).toBeTruthy();
  expect(screen.getByText(/database transaction was not rolled back/)).toBeTruthy();
  expect(mockRestoreBackupAtomically).toHaveBeenCalledTimes(1);
  alertSpy.mockRestore();
});
