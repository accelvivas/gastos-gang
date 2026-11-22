import { isLocalDayKey } from '@/lib/dates';
import { validateRecurringBackup, type RecurringBackup } from '@/features/recurring/backup';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/repositories/categoriesRepo';

export const BACKUP_FORMAT = 'gastos-gang-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const RECURRING_BACKUP_SCHEMA_VERSION = 2;

export function backupVersion(data: GastosGangBackup['data']) {
  return data.recurring ? RECURRING_BACKUP_SCHEMA_VERSION : BACKUP_SCHEMA_VERSION;
}
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_CATEGORIES = 10_000;
export const MAX_BACKUP_EXPENSES = 100_000;
export const MAX_BACKUP_SETTINGS = 5_000;

export type BackupCategory = {
  id: number;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: number;
};

export type BackupExpense = {
  id: number;
  amountCentavos: number;
  categoryId: number;
  note: string | null;
  createdAt: number;
  localDay: string;
  updatedAt: number;
};

export type BackupSetting =
  | { source: 'app_settings'; key: string; value: string; updatedAt: number }
  | { source: 'settings'; key: string; value: string; updatedAt: null };

export type GastosGangBackup = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION | typeof RECURRING_BACKUP_SCHEMA_VERSION;
  createdAt: string;
  appVersion: string;
  data: {
    categories: BackupCategory[];
    expenses: BackupExpense[];
    settings: BackupSetting[];
    recurring?: RecurringBackup;
  };
};

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function invalid(message: string): never {
  throw new BackupValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function requireRecord(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    return invalid(`${label} has missing or unsupported fields.`);
  }
  return value;
}

function requireString(
  value: unknown,
  label: string,
  maximumLength: number,
  options: { nonEmpty?: boolean; trimmed?: boolean } = {}
): string {
  if (
    typeof value !== 'string' ||
    value.length > maximumLength ||
    (options.nonEmpty && value.length === 0) ||
    (options.trimmed && value !== value.trim())
  ) {
    return invalid(`${label} is invalid.`);
  }
  return value;
}

function requireInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return invalid(`${label} must be a supported integer.`);
  }
  return value;
}

function requireIsoTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label, 30, { nonEmpty: true });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)) {
    return invalid(`${label} must be an ISO 8601 UTC timestamp.`);
  }
  try {
    if (new Date(timestamp).toISOString() !== timestamp) {
      return invalid(`${label} is not a valid date.`);
    }
  } catch {
    return invalid(`${label} is not a valid date.`);
  }
  return timestamp;
}

function validateCategory(value: unknown): BackupCategory {
  const row = requireRecord(value, 'Category', [
    'id', 'name', 'icon', 'color', 'sortOrder', 'isArchived', 'createdAt',
  ]);
  const name = requireString(row.name, 'Category name', 30, { nonEmpty: true, trimmed: true });
  const icon = requireString(row.icon, 'Category icon', 100, { nonEmpty: true });
  const color = requireString(row.color, 'Category color', 20, { nonEmpty: true });
  if (!(CATEGORY_ICONS as readonly string[]).includes(icon)) {
    return invalid('Category icon is not supported.');
  }
  if (!(CATEGORY_COLORS as readonly string[]).includes(color)) {
    return invalid('Category color is not supported.');
  }
  if (typeof row.isArchived !== 'boolean') {
    return invalid('Category archived state must be boolean.');
  }
  return {
    id: requireInteger(row.id, 'Category ID', 1),
    name,
    icon,
    color,
    sortOrder: requireInteger(row.sortOrder, 'Category sort order', 0),
    isArchived: row.isArchived,
    createdAt: requireInteger(row.createdAt, 'Category timestamp', 0),
  };
}

function validateExpense(value: unknown): BackupExpense {
  const row = requireRecord(value, 'Expense', [
    'id', 'amountCentavos', 'categoryId', 'note', 'createdAt', 'localDay', 'updatedAt',
  ]);
  const note = row.note === null
    ? null
    : requireString(row.note, 'Expense note', 200);
  const localDay = requireString(row.localDay, 'Expense local day', 10, { nonEmpty: true });
  if (!isLocalDayKey(localDay)) {
    return invalid('Expense local day must be a valid YYYY-MM-DD date.');
  }
  return {
    id: requireInteger(row.id, 'Expense ID', 1),
    amountCentavos: requireInteger(row.amountCentavos, 'Expense amount', 1, MAX_AMOUNT_CENTAVOS),
    categoryId: requireInteger(row.categoryId, 'Expense category ID', 1),
    note,
    createdAt: requireInteger(row.createdAt, 'Expense timestamp', 0),
    localDay,
    updatedAt: requireInteger(row.updatedAt, 'Expense update timestamp', 0),
  };
}

function validateSetting(value: unknown): BackupSetting {
  if (!isRecord(value) || (value.source !== 'settings' && value.source !== 'app_settings')) {
    return invalid('Setting source is invalid.');
  }
  const row = requireRecord(value, 'Setting', ['source', 'key', 'value', 'updatedAt']);
  const key = requireString(row.key, 'Setting key', 100, { nonEmpty: true });
  const settingValue = requireString(row.value, 'Setting value', 10_000);

  if (row.source === 'app_settings') {
    const updatedAt = requireInteger(row.updatedAt, 'Setting timestamp', 0);
    if (key === 'daily_budget_enabled' && settingValue !== 'true' && settingValue !== 'false') {
      return invalid('Daily budget enabled setting is invalid.');
    }
    if (key === 'daily_budget_centavos') {
      if (!/^\d+$/.test(settingValue)) {
        return invalid('Daily budget amount setting is invalid.');
      }
      requireInteger(Number(settingValue), 'Daily budget amount', 1, MAX_AMOUNT_CENTAVOS);
    }
    if (key === 'theme_mode' &&
      settingValue !== 'dark' && settingValue !== 'light' && settingValue !== 'system') {
      return invalid('Theme setting is invalid.');
    }
    return { source: 'app_settings', key, value: settingValue, updatedAt };
  }

  if (row.updatedAt !== null) {
    return invalid('Legacy settings must not have an update timestamp.');
  }
  return { source: 'settings', key, value: settingValue, updatedAt: null };
}

function validateUniqueIds<T extends { id: number }>(
  rows: readonly T[],
  label: string
): void {
  const ids = new Set<number>();
  for (const row of rows) {
    if (ids.has(row.id)) invalid(`${label} IDs must be unique.`);
    ids.add(row.id);
  }
}

export function validateBackup(value: unknown): GastosGangBackup {
  const root = requireRecord(value, 'Backup', [
    'format', 'schemaVersion', 'createdAt', 'appVersion', 'data',
  ]);
  if (root.format !== BACKUP_FORMAT) {
    return invalid('This is not a Gastos Gang backup.');
  }
  if (root.schemaVersion !== BACKUP_SCHEMA_VERSION && root.schemaVersion !== RECURRING_BACKUP_SCHEMA_VERSION) {
    return invalid('This backup version is not supported.');
  }
  const createdAt = requireIsoTimestamp(root.createdAt, 'Backup createdAt');
  const appVersion = requireString(root.appVersion, 'Backup appVersion', 64, { nonEmpty: true });
  const keys = ['categories', 'expenses', 'settings'];
  if (root.schemaVersion === RECURRING_BACKUP_SCHEMA_VERSION) keys.push('recurring');
  const data = requireRecord(root.data, 'Backup data', keys);
  if (
    !Array.isArray(data.categories) ||
    data.categories.length > MAX_BACKUP_CATEGORIES ||
    !Array.isArray(data.expenses) ||
    data.expenses.length > MAX_BACKUP_EXPENSES ||
    !Array.isArray(data.settings) ||
    data.settings.length > MAX_BACKUP_SETTINGS
  ) {
    return invalid('Backup data is missing or exceeds supported record limits.');
  }

  const categories = data.categories.map(validateCategory);
  const expenses = data.expenses.map(validateExpense);
  const settings = data.settings.map(validateSetting);
  validateUniqueIds(categories, 'Category');
  validateUniqueIds(expenses, 'Expense');

  if (categories.length === 0 || !categories.some((category) => !category.isArchived)) {
    return invalid('Backup must contain at least one active category.');
  }

  const activeNames = new Set<string>();
  const categoryIds = new Set(categories.map((category) => category.id));
  for (const category of categories) {
    if (category.isArchived) continue;
    const normalizedName = category.name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    if (activeNames.has(normalizedName)) {
      return invalid('Active category names must be unique.');
    }
    activeNames.add(normalizedName);
  }
  for (const expense of expenses) {
    if (!categoryIds.has(expense.categoryId)) {
      return invalid(`Expense ${expense.id} references a missing category.`);
    }
  }

  const settingKeys = new Set<string>();
  const appSettingValues = new Map<string, string>();
  for (const setting of settings) {
    const identity = `${setting.source}\u0000${setting.key}`;
    if (settingKeys.has(identity)) {
      return invalid('Setting keys must be unique within their storage table.');
    }
    settingKeys.add(identity);
    if (setting.source === 'app_settings') {
      appSettingValues.set(setting.key, setting.value);
    }
  }
  if (
    appSettingValues.get('daily_budget_enabled') === 'true' &&
    !appSettingValues.has('daily_budget_centavos')
  ) {
    return invalid('An enabled daily budget must include its saved limit.');
  }

  let recurring: RecurringBackup | undefined;
  if (root.schemaVersion === RECURRING_BACKUP_SCHEMA_VERSION) {
    try {
      recurring = validateRecurringBackup(data.recurring, categoryIds, new Set(expenses.map(({ id }) => id)));
    } catch {
      return invalid('Backup contains invalid recurring expense data.');
    }
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: root.schemaVersion,
    createdAt,
    appVersion,
    data: recurring ? { categories, expenses, settings, recurring } : { categories, expenses, settings },
  };
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > MAX_BACKUP_FILE_BYTES) return bytes;
  }
  return bytes;
}

export function parseBackupJson(text: string): GastosGangBackup {
  if (utf8ByteLength(text) > MAX_BACKUP_FILE_BYTES) {
    return invalid('Backup file is larger than the supported size limit.');
  }
  const json = text.startsWith('\uFEFF') ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return invalid('Backup file contains invalid JSON.');
  }
  return validateBackup(parsed);
}

export function serializeBackup(value: unknown): { json: string; byteLength: number } {
  const backup = validateBackup(value);
  const json = JSON.stringify(backup);
  const byteLength = utf8ByteLength(json);
  if (byteLength > MAX_BACKUP_FILE_BYTES) {
    return invalid('Backup data is larger than the supported file size limit.');
  }
  return { json, byteLength };
}
