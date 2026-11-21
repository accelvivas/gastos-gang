import type { DbLike } from '@/db/client';

export async function migrate003AppSettings(db: DbLike): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
