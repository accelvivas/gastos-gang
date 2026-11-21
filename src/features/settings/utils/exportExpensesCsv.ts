import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { DbLike } from '@/db/client';
import type { ExportExpense } from '@/db/types';
import * as expensesRepo from '@/repositories/expensesRepo';
import { EXPENSE_CSV_HEADER, formatExpenseCsvRow, UTF8_BOM } from './expenseCsv';

type ExportFile = Pick<File, 'uri' | 'create' | 'write'>;

export type ExportCsvDependencies = {
  listPage: typeof expensesRepo.listExportPage;
  createFile: (filename: string) => ExportFile;
  isSharingAvailable: () => Promise<boolean>;
  shareFile: (uri: string) => Promise<void>;
  now: () => number;
  pageSize: number;
};

export type ExportCsvResult =
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'ready'; filename: string; count: number };

export type CsvExportErrorCode =
  | 'FILE_WRITE'
  | 'SHARING_UNAVAILABLE'
  | 'SHARING_FAILED';

export class CsvExportError extends Error {
  constructor(
    readonly code: CsvExportErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CsvExportError';
  }
}

const defaultDependencies: ExportCsvDependencies = {
  listPage: expensesRepo.listExportPage,
  createFile: (filename) => new File(Paths.cache, filename),
  isSharingAvailable: async () => (
    Platform.OS !== 'web' && await Sharing.isAvailableAsync()
  ),
  shareFile: (uri) => Sharing.shareAsync(uri, {
    dialogTitle: 'Gastos Gang expenses',
    mimeType: 'text/csv',
  }),
  now: Date.now,
  pageSize: expensesRepo.EXPENSE_EXPORT_PAGE_SIZE,
};

function exportFilename(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Export timestamp is invalid.');
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `gastos-gang-expenses-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.csv`;
}

function cursorForLast(expenses: readonly ExportExpense[]) {
  const last = expenses[expenses.length - 1];
  if (!last) {
    throw new Error('Cannot create an export cursor from an empty page.');
  }
  return { createdAt: last.createdAt, id: last.id };
}

export async function exportExpensesCsv(
  db: DbLike,
  overrides: Partial<ExportCsvDependencies> = {}
): Promise<ExportCsvResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const firstPage = await dependencies.listPage(db, undefined, dependencies.pageSize);
  if (firstPage.length === 0) {
    return { status: 'empty' };
  }

  let sharingAvailable: boolean;
  try {
    sharingAvailable = await dependencies.isSharingAvailable();
  } catch (cause) {
    throw new CsvExportError(
      'SHARING_UNAVAILABLE',
      'Unable to check whether file sharing is available.',
      cause
    );
  }
  if (!sharingAvailable) {
    return { status: 'unavailable' };
  }

  const filename = exportFilename(dependencies.now());
  let file: ExportFile;
  try {
    file = dependencies.createFile(filename);
    file.create({ overwrite: true });
    await file.write(`${UTF8_BOM}${EXPENSE_CSV_HEADER}\r\n`);
  } catch (cause) {
    throw new CsvExportError('FILE_WRITE', 'Unable to create the CSV export file.', cause);
  }

  let page = firstPage;
  let count = 0;
  while (page.length > 0) {
    const csvRows = page.map(formatExpenseCsvRow).join('\r\n');
    try {
      await file.write(`${csvRows}\r\n`, { append: true });
    } catch (cause) {
      throw new CsvExportError('FILE_WRITE', 'Unable to write the CSV export file.', cause);
    }

    count += page.length;
    page = await dependencies.listPage(
      db,
      cursorForLast(page),
      dependencies.pageSize
    );
  }

  try {
    await dependencies.shareFile(file.uri);
  } catch (cause) {
    throw new CsvExportError('SHARING_FAILED', 'Unable to open the sharing sheet.', cause);
  }

  return { status: 'ready', filename, count };
}
