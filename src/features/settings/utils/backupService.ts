import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { CategoryRow, ExpenseRow } from '@/db/types';
import type { DbLike } from '@/db/client';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_CATEGORIES,
  MAX_BACKUP_EXPENSES,
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_SETTINGS,
  parseBackupJson,
  serializeBackup,
  validateBackup,
  type BackupCategory,
  type BackupExpense,
  type BackupSetting,
  type GastosGangBackup,
} from './backupSchema';

type BackupFile = Pick<File, 'uri' | 'name' | 'size' | 'exists' | 'create' | 'write' | 'text'>;
type SqlValue = string | number | null;
type SqlTable = 'categories' | 'expenses' | 'app_settings' | 'settings';

export type BackupCounts = {
  categories: number;
  expenses: number;
  settings: number;
};

export type BackupFileResult = {
  filename: string;
  uri: string;
  size: number;
};

export type BackupFileErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'SHARING_UNAVAILABLE'
  | 'SHARING_FAILED';

export class BackupFileError extends Error {
  constructor(
    readonly code: BackupFileErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BackupFileError';
  }
}

export class BackupRestoreError extends Error {
  constructor(
    readonly code: 'TRANSACTION_FAILED' | 'INTEGRITY_FAILED' | 'POST_COMMIT_VERIFY_FAILED',
    readonly committed: boolean,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BackupRestoreError';
  }
}

type BackupSnapshotOptions = {
  appVersion?: string;
  now?: () => number;
  pageSize?: number;
};

type RestoreOptions = {
  expectedCurrentData?: GastosGangBackup['data'];
};

type FileServiceOptions = {
  createCacheFile?: (filename: string) => BackupFile;
  createFileFromUri?: (uri: string) => BackupFile;
};

type SharingServiceOptions = {
  isAvailable?: () => Promise<boolean>;
  share?: (uri: string, filename: string) => Promise<void>;
};

const EXPENSE_SNAPSHOT_PAGE_SIZE = 500;
const RESTORE_INSERT_BATCH_SIZE = 100;
const SQL_PAGE_SIZE = 500;

function getAppVersion(): string {
  const version = Constants.expoConfig?.version;
  if (!version) {
    throw new Error('The application version is not available.');
  }
  return version;
}

function settingRows(
  legacyRows: readonly { key: string; value: string }[],
  appRows: readonly { key: string; value: string; updated_at: number }[]
): BackupSetting[] {
  return [
    ...appRows.map((row) => ({
      source: 'app_settings' as const,
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    })),
    ...legacyRows.map((row) => ({
      source: 'settings' as const,
      key: row.key,
      value: row.value,
      updatedAt: null,
    })),
  ].sort((left, right) =>
    left.source.localeCompare(right.source) || left.key.localeCompare(right.key)
  );
}

function categoryBackupRow(category: Awaited<ReturnType<typeof categoriesRepo.listAll>>[number]): BackupCategory {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    sortOrder: category.sortOrder,
    isArchived: category.isArchived,
    createdAt: category.createdAt,
  };
}

function expenseBackupRow(expense: Awaited<ReturnType<typeof expensesRepo.listExportPage>>[number]): BackupExpense {
  return {
    id: expense.id,
    amountCentavos: expense.amountCentavos,
    categoryId: expense.categoryId,
    note: expense.note,
    createdAt: expense.createdAt,
    localDay: expense.localDay,
    updatedAt: expense.updatedAt,
  };
}

export async function createBackupSnapshot(
  db: DbLike,
  options: BackupSnapshotOptions = {}
): Promise<GastosGangBackup> {
  const appVersion = options.appVersion ?? getAppVersion();
  const now = options.now ?? Date.now;
  const pageSize = options.pageSize ?? EXPENSE_SNAPSHOT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1_000) {
    throw new RangeError('Backup page size must be between 1 and 1000.');
  }
  const createdAt = new Date(now()).toISOString();
  let snapshot: GastosGangBackup | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const candidate: GastosGangBackup = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt,
      appVersion,
      data: await readPersistentData(txn, pageSize),
    };
    snapshot = validateBackup(candidate);
  });

  if (!snapshot) {
    throw new Error('Database backup snapshot was not produced.');
  }
  return snapshot;
}

async function readPersistentData(
  db: DbLike,
  pageSize = EXPENSE_SNAPSHOT_PAGE_SIZE
): Promise<GastosGangBackup['data']> {
  const categoryCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM categories'
  );
  const expenseCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM expenses'
  );
  const settingsCount = await db.getFirstAsync<{ count: number }>(
    `SELECT
       (SELECT COUNT(*) FROM app_settings) +
       (SELECT COUNT(*) FROM settings) AS count`
  );
  if ((categoryCount?.count ?? 0) > MAX_BACKUP_CATEGORIES) {
    throw new Error('The database contains too many categories to back up.');
  }
  if ((expenseCount?.count ?? 0) > MAX_BACKUP_EXPENSES) {
    throw new Error('The database contains too many expenses to back up.');
  }
  if ((settingsCount?.count ?? 0) > MAX_BACKUP_SETTINGS) {
    throw new Error('The database contains too many settings to back up.');
  }

  const categories = (await categoriesRepo.listAll(db)).map(categoryBackupRow);
  const expenses: BackupExpense[] = [];
  let cursor: expensesRepo.ExpenseExportCursor | undefined;
  for (;;) {
    const page = await expensesRepo.listExportPage(db, cursor, pageSize);
    if (page.length === 0) break;
    expenses.push(...page.map(expenseBackupRow));
    const last = page[page.length - 1];
    if (!last) break;
    cursor = { createdAt: last.createdAt, id: last.id };
  }
  if (expenses.length !== (expenseCount?.count ?? 0)) {
    throw new Error('The database contains expenses with missing category records.');
  }

  const appSettings = await db.getAllAsync<{ key: string; value: string; updated_at: number }>(
    'SELECT key, value, updated_at FROM app_settings ORDER BY key'
  );
  const legacySettings = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings ORDER BY key'
  );
  return {
    categories,
    expenses,
    settings: settingRows(legacySettings, appSettings),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function createBackupFilename(
  kind: 'backup' | 'before-restore',
  timestamp = Date.now()
): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Backup filename timestamp is invalid.');
  }
  const prefix = kind === 'backup' ? 'gastos-gang-backup' : 'gastos-gang-before-restore';
  return `${prefix}-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}.json`;
}

function cacheFile(filename: string): BackupFile {
  return new File(Paths.cache, filename);
}

export async function writeBackupFile(
  value: unknown,
  filename: string,
  options: FileServiceOptions = {}
): Promise<BackupFileResult> {
  const { json, byteLength } = serializeBackup(value);
  let file: BackupFile;
  try {
    file = (options.createCacheFile ?? cacheFile)(filename);
    file.create({ overwrite: false });
    await file.write(json);
    if (!file.exists || file.size !== byteLength || await file.text() !== json) {
      throw new Error('Written backup did not match the serialized data.');
    }
  } catch (cause) {
    throw new BackupFileError(
      'FILE_WRITE_FAILED',
      'Could not write and verify the backup file.',
      cause
    );
  }
  return { filename: file.name, uri: file.uri, size: byteLength };
}

export async function readBackupFile(
  uri: string,
  options: FileServiceOptions = {}
): Promise<GastosGangBackup> {
  let file: BackupFile;
  let text: string;
  try {
    file = (options.createFileFromUri ?? ((path) => new File(path)))(uri);
    if (!file.exists || file.size <= 0) {
      throw new Error('Selected file is empty or unavailable.');
    }
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      throw new BackupFileError('FILE_TOO_LARGE', 'Backup file exceeds the supported size limit.');
    }
    text = await file.text();
  } catch (cause) {
    if (cause instanceof BackupFileError) throw cause;
    throw new BackupFileError('FILE_READ_FAILED', 'Could not read the selected backup file.', cause);
  }
  return parseBackupJson(text);
}

export async function verifyBackupFile(
  fileResult: BackupFileResult,
  expectedBackup?: unknown
): Promise<void> {
  try {
    const file = new File(fileResult.uri);
    if (!file.exists || file.size !== fileResult.size || file.size > MAX_BACKUP_FILE_BYTES) {
      throw new Error('Backup file is missing or has changed.');
    }
    const savedBackup = parseBackupJson(await file.text());
    if (
      expectedBackup !== undefined &&
      JSON.stringify(savedBackup) !== JSON.stringify(validateBackup(expectedBackup))
    ) {
      throw new Error('Backup file contents have changed.');
    }
  } catch (cause) {
    throw new BackupFileError(
      'FILE_WRITE_FAILED',
      'The safety backup file could not be verified.',
      cause
    );
  }
}

export async function isBackupSharingAvailable(
  options: SharingServiceOptions = {}
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (options.isAvailable ?? Sharing.isAvailableAsync)();
}

export async function shareBackupFile(
  uri: string,
  filename: string,
  options: SharingServiceOptions = {}
): Promise<void> {
  let available: boolean;
  try {
    available = await isBackupSharingAvailable(options);
  } catch (cause) {
    throw new BackupFileError('SHARING_UNAVAILABLE', 'Could not check file sharing availability.', cause);
  }
  if (!available) {
    throw new BackupFileError('SHARING_UNAVAILABLE', 'File sharing is not available on this device.');
  }

  try {
    await (options.share ?? ((fileUri, fileName) => Sharing.shareAsync(fileUri, {
      dialogTitle: fileName,
      mimeType: 'application/json',
    })))(uri, filename);
  } catch (cause) {
    throw new BackupFileError('SHARING_FAILED', 'Could not open the sharing sheet.', cause);
  }
}

export async function getCurrentBackupCounts(db: DbLike): Promise<BackupCounts> {
  let counts: BackupCounts | null = null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getFirstAsync<{
      categories: number;
      expenses: number;
      settings: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM categories) AS categories,
         (SELECT COUNT(*) FROM expenses) AS expenses,
         ((SELECT COUNT(*) FROM app_settings) + (SELECT COUNT(*) FROM settings)) AS settings`
    );
    if (rows) counts = rows;
  });
  if (!counts) throw new Error('Could not read current database counts.');
  return counts;
}

function sqlTableValues(
  table: SqlTable,
  backup: GastosGangBackup
): { columns: readonly string[]; rows: SqlValue[][] } {
  if (table === 'categories') {
    return {
      columns: ['id', 'name', 'icon', 'color', 'sort_order', 'is_archived', 'created_at'],
      rows: backup.data.categories.map((row) => [
        row.id, row.name, row.icon, row.color, row.sortOrder, row.isArchived ? 1 : 0, row.createdAt,
      ]),
    };
  }
  if (table === 'expenses') {
    return {
      columns: ['id', 'amount_centavos', 'category_id', 'note', 'created_at', 'local_day', 'updated_at'],
      rows: backup.data.expenses.map((row) => [
        row.id, row.amountCentavos, row.categoryId, row.note, row.createdAt, row.localDay, row.updatedAt,
      ]),
    };
  }
  if (table === 'app_settings') {
    return {
      columns: ['key', 'value', 'updated_at'],
      rows: backup.data.settings
        .filter((row) => row.source === 'app_settings')
        .map((row) => row.source === 'app_settings' ? [row.key, row.value, row.updatedAt] : []),
    };
  }
  return {
    columns: ['key', 'value'],
    rows: backup.data.settings
      .filter((row) => row.source === 'settings')
      .map((row) => row.source === 'settings' ? [row.key, row.value] : []),
  };
}

async function insertTableRows(db: DbLike, table: SqlTable, backup: GastosGangBackup): Promise<void> {
  const { columns, rows } = sqlTableValues(table, backup);
  if (rows.length === 0) return;
  for (let offset = 0; offset < rows.length; offset += RESTORE_INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + RESTORE_INSERT_BATCH_SIZE);
    const rowPlaceholders = `(${columns.map(() => '?').join(', ')})`;
    const placeholders = batch.map(() => rowPlaceholders).join(', ');
    const values = batch.flat();
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
  }
}

function expectedSettings(
  backup: GastosGangBackup,
  source: BackupSetting['source']
): BackupSetting[] {
  return backup.data.settings.filter((setting) => setting.source === source);
}

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new BackupRestoreError('INTEGRITY_FAILED', false, message);
  }
}

async function verifyBasicIntegrity(db: DbLike, backup: GastosGangBackup): Promise<void> {
  const counts = await db.getFirstAsync<{
    categories: number;
    expenses: number;
    appSettings: number;
    legacySettings: number;
    uniqueCategories: number;
    uniqueExpenses: number;
    totalCentavos: number;
    invalidAmounts: number;
    duplicateActiveNames: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM categories) AS categories,
       (SELECT COUNT(*) FROM expenses) AS expenses,
       (SELECT COUNT(*) FROM app_settings) AS appSettings,
       (SELECT COUNT(*) FROM settings) AS legacySettings,
       (SELECT COUNT(DISTINCT id) FROM categories) AS uniqueCategories,
       (SELECT COUNT(DISTINCT id) FROM expenses) AS uniqueExpenses,
       (SELECT COALESCE(SUM(amount_centavos), 0) FROM expenses) AS totalCentavos,
       (SELECT COUNT(*) FROM expenses
         WHERE typeof(amount_centavos) != 'integer'
           OR amount_centavos < 1 OR amount_centavos > ?) AS invalidAmounts,
       (SELECT COUNT(*) FROM (
         SELECT name FROM categories WHERE is_archived = 0
         GROUP BY name COLLATE NOCASE HAVING COUNT(*) > 1
       )) AS duplicateActiveNames`,
    [MAX_AMOUNT_CENTAVOS]
  );
  ensure(Boolean(counts), 'Restore verification could not read database totals.');
  const expectedTotal = backup.data.expenses.reduce(
    (total, expense) => total + expense.amountCentavos,
    0
  );
  ensure(Number.isSafeInteger(expectedTotal), 'Backup total exceeds safe integer precision.');
  ensure(counts!.categories === backup.data.categories.length, 'Restored category count does not match.');
  ensure(counts!.expenses === backup.data.expenses.length, 'Restored expense count does not match.');
  ensure(
    counts!.appSettings === expectedSettings(backup, 'app_settings').length &&
      counts!.legacySettings === expectedSettings(backup, 'settings').length,
    'Restored settings count does not match.'
  );
  ensure(
    counts!.categories === counts!.uniqueCategories &&
      counts!.expenses === counts!.uniqueExpenses,
    'Restored records contain duplicate IDs.'
  );
  ensure(counts!.totalCentavos === expectedTotal, 'Restored financial total does not match.');
  ensure(counts!.invalidAmounts === 0, 'Restored amount values are invalid.');
  ensure(counts!.duplicateActiveNames === 0, 'Restored active category names are duplicated.');

  const foreignKeyErrors = await db.getAllAsync<{ table: string; rowid: number; parent: string }>(
    'PRAGMA foreign_key_check'
  );
  ensure(foreignKeyErrors.length === 0, 'Restored data contains broken category references.');

  const appSettings = await db.getAllAsync<{ key: string; value: string; updated_at: number }>(
    'SELECT key, value, updated_at FROM app_settings ORDER BY key'
  );
  const expectedAppSettings = expectedSettings(backup, 'app_settings');
  ensure(appSettings.length === expectedAppSettings.length, 'Restored app settings are incomplete.');
  const appSettingsByKey = new Map(appSettings.map((setting) => [setting.key, setting]));
  for (const expected of expectedAppSettings) {
    const actual = appSettingsByKey.get(expected.key);
    ensure(
      Boolean(actual) &&
        actual!.value === expected.value &&
        actual!.updated_at === expected.updatedAt,
      'Restored app settings do not match the backup.'
    );
  }

  const legacySettings = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings ORDER BY key'
  );
  const expectedLegacySettings = expectedSettings(backup, 'settings');
  ensure(legacySettings.length === expectedLegacySettings.length, 'Restored legacy settings are incomplete.');
  const legacySettingsByKey = new Map(legacySettings.map((setting) => [setting.key, setting]));
  for (const expected of expectedLegacySettings) {
    const actual = legacySettingsByKey.get(expected.key);
    ensure(
      Boolean(actual) && actual!.value === expected.value,
      'Restored legacy settings do not match the backup.'
    );
  }
}

async function verifyExactRows(db: DbLike, backup: GastosGangBackup): Promise<void> {
  const categoryRows = await db.getAllAsync<CategoryRow>(
    'SELECT id, name, icon, color, sort_order, is_archived, created_at FROM categories ORDER BY id'
  );
  const expectedCategories = backup.data.categories.slice().sort((left, right) => left.id - right.id);
  ensure(categoryRows.length === expectedCategories.length, 'Restored category rows are incomplete.');
  for (let index = 0; index < categoryRows.length; index += 1) {
    const actual = categoryRows[index];
    const expected = expectedCategories[index];
    ensure(
      Boolean(actual && expected) &&
        actual!.id === expected!.id &&
        actual!.name === expected!.name &&
        actual!.icon === expected!.icon &&
        actual!.color === expected!.color &&
        actual!.sort_order === expected!.sortOrder &&
        actual!.is_archived === (expected!.isArchived ? 1 : 0) &&
        actual!.created_at === expected!.createdAt,
      'Restored category metadata does not match the backup.'
    );
  }

  const expectedExpenses = backup.data.expenses.slice().sort((left, right) => left.id - right.id);
  let offset = 0;
  let lastId = 0;
  while (offset < expectedExpenses.length) {
    const rows = await db.getAllAsync<ExpenseRow>(
      `SELECT id, amount_centavos, category_id, note, created_at, local_day, updated_at
       FROM expenses WHERE id > ? ORDER BY id ASC LIMIT ?`,
      [lastId, SQL_PAGE_SIZE]
    );
    ensure(rows.length > 0, 'Restored expense rows are incomplete.');
    for (const actual of rows) {
      const expected = expectedExpenses[offset];
      ensure(
        Boolean(expected) &&
          actual.id === expected!.id &&
          actual.amount_centavos === expected!.amountCentavos &&
          actual.category_id === expected!.categoryId &&
          actual.note === expected!.note &&
          actual.created_at === expected!.createdAt &&
          actual.local_day === expected!.localDay &&
          actual.updated_at === expected!.updatedAt,
        'Restored expense data does not match the backup.'
      );
      lastId = actual.id;
      offset += 1;
    }
  }
}

export async function restoreBackupAtomically(
  db: DbLike,
  input: unknown,
  options: RestoreOptions = {}
): Promise<BackupCounts> {
  const backup = validateBackup(input);
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (options.expectedCurrentData) {
        const currentData = await readPersistentData(txn);
        const currentSnapshot = validateBackup({
          format: BACKUP_FORMAT,
          schemaVersion: BACKUP_SCHEMA_VERSION,
          createdAt: backup.createdAt,
          appVersion: backup.appVersion,
          data: currentData,
        });
        if (JSON.stringify(currentSnapshot.data) !== JSON.stringify(options.expectedCurrentData)) {
          throw new BackupRestoreError(
            'INTEGRITY_FAILED',
            false,
            'Current data changed after the safety backup was created. Create a new safety backup before restoring.'
          );
        }
      }
      await txn.runAsync('DELETE FROM expenses');
      await txn.runAsync('DELETE FROM categories');
      await txn.runAsync('DELETE FROM app_settings');
      await txn.runAsync('DELETE FROM settings');
      await insertTableRows(txn, 'categories', backup);
      await insertTableRows(txn, 'expenses', backup);
      await insertTableRows(txn, 'app_settings', backup);
      await insertTableRows(txn, 'settings', backup);
      await verifyBasicIntegrity(txn, backup);
      await verifyExactRows(txn, backup);
    });
  } catch (cause) {
    if (cause instanceof BackupRestoreError) throw cause;
    throw new BackupRestoreError(
      'TRANSACTION_FAILED',
      false,
      'Database restore failed; the transaction was rolled back.',
      cause
    );
  }

  try {
    await verifyBasicIntegrity(db, backup);
  } catch (cause) {
    throw new BackupRestoreError(
      'POST_COMMIT_VERIFY_FAILED',
      true,
      'Database restore committed, but post-commit verification failed.',
      cause
    );
  }

  return {
    categories: backup.data.categories.length,
    expenses: backup.data.expenses.length,
    settings: backup.data.settings.length,
  };
}

export function backupFileSizeIsValid(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_BACKUP_FILE_BYTES;
}
