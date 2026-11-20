import type { DbLike } from '@/db/client';

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: 'fast-food-outline', color: '#F59E0B' },
  { name: 'Transport', icon: 'bus-outline', color: '#3B82F6' },
  { name: 'Load', icon: 'phone-portrait-outline', color: '#8B5CF6' },
  { name: 'Shopping', icon: 'bag-handle-outline', color: '#EC4899' },
  { name: 'Bills', icon: 'receipt-outline', color: '#10B981' },
  { name: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#6B7280' },
] as const;

export async function migrate001Init(db: DbLike): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS categories_active_name_unique
      ON categories(name COLLATE NOCASE)
      WHERE is_archived = 0;

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      note TEXT NULL,
      created_at INTEGER NOT NULL,
      local_day TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS expenses_local_day_idx
      ON expenses(local_day);
    CREATE INDEX IF NOT EXISTS expenses_category_local_day_idx
      ON expenses(category_id, local_day);
    CREATE INDEX IF NOT EXISTS expenses_created_at_id_idx
      ON expenses(created_at, id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const createdAt = Date.now();
  for (const [sortOrder, category] of DEFAULT_CATEGORIES.entries()) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories
        (name, icon, color, sort_order, is_archived, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [category.name, category.icon, category.color, sortOrder, createdAt]
    );
  }
}
