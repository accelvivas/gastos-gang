import type { DbLike } from '@/db/client';
import { AppError, wrapDatabaseError } from '@/db/errors';

type SettingRow = {
  key: string;
  value: string;
};

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
      'SELECT value FROM settings WHERE key = ?',
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
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [normalizedKey, value]
    );
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to save setting.');
  }
}

export async function getAll(db: DbLike): Promise<Record<string, string>> {
  try {
    const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings ORDER BY key');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load settings.');
  }
}
