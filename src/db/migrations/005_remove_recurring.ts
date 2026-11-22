import type { DbLike } from '@/db/client';

export async function migrate005RemoveRecurring(db: DbLike): Promise<void> {
  await db.execAsync(`
    DROP TRIGGER IF EXISTS recurring_unlink_deleted_expense;
    DROP TABLE IF EXISTS recurring_notifications;
    DROP TABLE IF EXISTS recurring_occurrences;
    DROP TABLE IF EXISTS recurring_expenses;
    DROP TABLE IF EXISTS recurring_preferences;
  `);
}
