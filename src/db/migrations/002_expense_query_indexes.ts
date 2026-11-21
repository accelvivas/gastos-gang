import type { DbLike } from '@/db/client';

export async function migrate002ExpenseQueryIndexes(db: DbLike): Promise<void> {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS expenses_local_day_created_at_id_idx
      ON expenses(local_day, created_at DESC, id DESC);
  `);
}
