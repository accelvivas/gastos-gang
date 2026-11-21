import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ExportCsvScreen } from '@/features/settings/components/ExportCsvScreen';
import { CsvExportError } from '@/features/settings/utils/exportExpensesCsv';

const mockExport = jest.fn();
const mockToastShow = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: (...args: unknown[]) => mockToastShow(...args) },
}));
jest.mock('@/features/settings/utils/exportExpensesCsv', () => ({
  ...jest.requireActual('@/features/settings/utils/exportExpensesCsv'),
  exportExpensesCsv: (...args: unknown[]) => mockExport(...args),
}));

beforeEach(() => {
  mockExport.mockReset();
  mockToastShow.mockReset();
});

test('prevents duplicate exports while preparing and avoids claiming a file was saved', async () => {
  let resolveExport!: (result: { status: 'ready'; filename: string; count: number }) => void;
  mockExport.mockImplementation(() => new Promise((resolve) => {
    resolveExport = resolve;
  }));
  await render(<ExportCsvScreen onBack={jest.fn()} />);

  const button = screen.getByLabelText('EXPORT & SHARE CSV');
  await fireEvent.press(button);
  await fireEvent.press(button);

  expect(mockExport).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Preparing your full history. Larger exports may take a moment.')).toBeTruthy();

  await act(async () => {
    resolveExport({
      status: 'ready',
      filename: 'gastos-gang-expenses-20261121-080910.csv',
      count: 3,
    });
  });

  expect(await screen.findByText(/CSV prepared with 3 expenses/)).toBeTruthy();
  expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({
    text2: expect.stringContaining('cannot confirm whether you saved it'),
  }));
});

test('shows branded error feedback when sharing fails', async () => {
  mockExport.mockRejectedValue(new CsvExportError('SHARING_FAILED', 'Share sheet failed.'));
  await render(<ExportCsvScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByLabelText('EXPORT & SHARE CSV'));

  expect(await screen.findByText('Could not open the sharing sheet. Please try again.')).toBeTruthy();
  expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({
    text1: 'EXPORT FAILED',
    props: { kind: 'error' },
  }));
});

test('reports an empty history without offering a false export-success message', async () => {
  mockExport.mockResolvedValue({ status: 'empty' });
  await render(<ExportCsvScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByLabelText('EXPORT & SHARE CSV'));

  expect(await screen.findByText('No expenses to export yet.')).toBeTruthy();
  expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({
    text1: 'NOTHING TO EXPORT YET',
    props: { kind: 'info' },
  }));
});
