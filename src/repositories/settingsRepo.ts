import type { DbLike } from '@/db/client';
import { AppError, wrapDatabaseError } from '@/db/errors';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';

type SettingRow = {
  key: string;
  value: string;
};

export type ThemeMode = 'system' | 'light' | 'dark';

export type AppSettingKey =
  | 'daily_budget_enabled'
  | 'daily_budget_centavos'
  | 'theme_mode';

function normalizeKey(key: string): string {
  const normalized = key.trim();
  if (!normalized || normalized.length > 100) {
    throw new AppError('VALIDATION', 'Setting key must be between 1 and 100 characters.');
  }
  return normalized;
}

export async function get(db: DbLike, key: string): Promise<string | null> {
  const normalizedKey = normalizeKey(key);
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [normalizedKey]
    );
    return row?.value ?? null;
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load setting.');
  }
}

export async function set(db: DbLike, key: string, value: string): Promise<void> {
  const normalizedKey = normalizeKey(key);
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION', 'Setting value must be text.');
  }

  try {
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [normalizedKey, value, Date.now()]
    );
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to save setting.');
  }
}

export async function getAll(db: DbLike): Promise<Record<string, string>> {
  try {
    const rows = await db.getAllAsync<SettingRow>(
      'SELECT key, value FROM app_settings ORDER BY key'
    );
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load settings.');
  }
}

export async function getTyped<T extends boolean | number | ThemeMode>(
  db: DbLike,
  key: AppSettingKey
): Promise<T | null> {
  const raw = await get(db, key);
  if (raw === null) return null;

  if (key === 'daily_budget_enabled') {
    if (raw !== 'true' && raw !== 'false') {
      throw new AppError('VALIDATION', 'daily_budget_enabled must be true or false.');
    }
    return (raw === 'true') as T;
  }

  if (key === 'daily_budget_centavos') {
    if (!/^\d+$/.test(raw)) {
      throw new AppError('VALIDATION', 'daily_budget_centavos must be a non-negative integer.');
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT_CENTAVOS) {
      throw new AppError('VALIDATION', 'daily_budget_centavos must be a positive supported integer.');
    }
    return value as T;
  }

  if (raw !== 'system' && raw !== 'light' && raw !== 'dark') {
    throw new AppError('VALIDATION', 'theme_mode must be system, light, or dark.');
  }
  return raw as T;
}

export async function setTyped(
  db: DbLike,
  key: AppSettingKey,
  value: boolean | number | ThemeMode
): Promise<void> {
  if (key === 'daily_budget_enabled') {
    if (typeof value !== 'boolean') {
      throw new AppError('VALIDATION', 'daily_budget_enabled must be boolean.');
    }
    await set(db, key, value ? 'true' : 'false');
    return;
  }

  if (key === 'daily_budget_centavos') {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > MAX_AMOUNT_CENTAVOS
    ) {
      throw new AppError('VALIDATION', 'daily_budget_centavos must be a positive supported integer.');
    }
    await set(db, key, String(value));
    return;
  }

  if (typeof value !== 'string' || (value !== 'system' && value !== 'light' && value !== 'dark')) {
    throw new AppError('VALIDATION', 'theme_mode must be system, light, or dark.');
  }
  await set(db, key, value);
}

export type DailyBudgetSettings = {
  enabled: boolean;
  limitCentavos: number | null;
};

export async function getDailyBudget(db: DbLike): Promise<DailyBudgetSettings> {
  let rows: SettingRow[];
  try {
    rows = await db.getAllAsync<SettingRow>(
      `SELECT key, value FROM app_settings
       WHERE key IN ('daily_budget_enabled', 'daily_budget_centavos')`
    );
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load daily budget.');
  }
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const enabledRaw = values.daily_budget_enabled;
  if (enabledRaw !== undefined && enabledRaw !== 'true' && enabledRaw !== 'false') {
    throw new AppError('VALIDATION', 'daily_budget_enabled must be true or false.');
  }
  const limitRaw = values.daily_budget_centavos;
  let limitCentavos: number | null = null;
  if (limitRaw !== undefined) {
    if (!/^\d+$/.test(limitRaw)) {
      throw new AppError('VALIDATION', 'daily_budget_centavos must be a positive integer.');
    }
    limitCentavos = Number(limitRaw);
    if (
      !Number.isSafeInteger(limitCentavos) ||
      limitCentavos <= 0 ||
      limitCentavos > MAX_AMOUNT_CENTAVOS
    ) {
      throw new AppError('VALIDATION', 'daily_budget_centavos must be a positive supported integer.');
    }
  }
  if (enabledRaw === 'true' && limitCentavos === null) {
    throw new AppError('VALIDATION', 'Set a daily budget amount before enabling the budget.');
  }
  return { enabled: enabledRaw === 'true', limitCentavos };
}

export async function setDailyBudget(
  db: DbLike,
  enabled: boolean,
  limitCentavos?: number
): Promise<DailyBudgetSettings> {
  if (typeof enabled !== 'boolean') {
    throw new AppError('VALIDATION', 'Daily budget enabled must be boolean.');
  }
  if (limitCentavos !== undefined) {
    if (
      !Number.isSafeInteger(limitCentavos) ||
      limitCentavos <= 0 ||
      limitCentavos > MAX_AMOUNT_CENTAVOS
    ) {
      throw new AppError('VALIDATION', 'Daily budget must be a positive supported integer.');
    }
  }

  try {
    let updated: DailyBudgetSettings = { enabled: false, limitCentavos: null };
    await db.withExclusiveTransactionAsync(async (txn) => {
      const current = await getDailyBudget(txn);
      const nextLimit = limitCentavos ?? current.limitCentavos;
      if (enabled && nextLimit === null) {
        throw new AppError('VALIDATION', 'Set a daily budget amount before enabling the budget.');
      }
      if (limitCentavos !== undefined) {
        await setTyped(txn, 'daily_budget_centavos', limitCentavos);
      }
      await setTyped(txn, 'daily_budget_enabled', enabled);
      updated = { enabled, limitCentavos: nextLimit };
    });
    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return wrapDatabaseError(error, 'Unable to save daily budget.');
  }
}
