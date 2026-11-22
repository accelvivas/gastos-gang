import { runMigrations } from '@/db/migrate';
import { MIGRATIONS } from '@/db/migrations';
import { createTestDb, TestDb } from './helpers/testDb';

describe('database migrations', () => {
  test('fresh database reaches the latest version and seeds six categories', async () => {
    const db = await createTestDb();
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const categories = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM categories'
    );

    expect(version?.user_version).toBe(MIGRATIONS.at(-1)?.version);
    expect(categories?.count).toBe(6);
    expect(await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'recurring_%'"
    )).toEqual([]);
    db.close();
  });

  test('removes legacy recurring data while preserving ordinary expenses', async () => {
    const db = new TestDb();
    try {
      await db.execAsync('PRAGMA foreign_keys = ON;');
      for (const migration of MIGRATIONS.filter(({ version }) => version <= 4)) {
        await migration.up(db);
        await db.execAsync(migration.userVersionStatement);
      }

      const category = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories LIMIT 1');
      expect(category).not.toBeNull();
      await db.runAsync(
        `INSERT INTO expenses (id, amount_centavos, category_id, created_at, local_day, updated_at)
         VALUES (42, 12345, ?, 1, '2026-11-21', 1)`,
        [category!.id]
      );
      const schedule = await db.runAsync(
        `INSERT INTO recurring_expenses
          (name, amount, category_id, frequency, start_day, due_time, mode, offsets, state, cursor, created_at, updated_at)
         VALUES ('Monthly', 500, ?, 'monthly', '2026-11-01', '09:00', 'reminder', 1, 'active', 0, 1, 1)`,
        [category!.id]
      );
      await db.runAsync(
        `INSERT INTO recurring_occurrences (schedule_id, due_day, name, amount, category_id)
         VALUES (?, '2026-11-21', 'Monthly', 500, ?)`,
        [schedule.lastInsertRowId, category!.id]
      );
      await db.runAsync(
        `INSERT INTO recurring_notifications (id, schedule_id, due_day, fire_at)
         VALUES ('gastos-payment:1:2026-11-21:1', ?, '2026-11-21', 1)`,
        [schedule.lastInsertRowId]
      );

      await runMigrations(db);

      expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 5 });
      expect(await db.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'recurring_%'"
      )).toEqual([]);
      expect(await db.getFirstAsync('SELECT id FROM expenses WHERE id = 42')).toEqual({ id: 42 });
      expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      db.close();
    }
  });

  test('running migrations repeatedly changes nothing', async () => {
    const db = await createTestDb();
    await runMigrations(db);
    await runMigrations(db);

    const categories = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM categories'
    );
    expect(categories?.count).toBe(6);
    db.close();
  });

  test('rejects a database newer than the app supports', async () => {
    const db = new TestDb();
    await db.execAsync('PRAGMA user_version = 999;');

    await expect(runMigrations(db)).rejects.toThrow('newer than supported');
    db.close();
  });

  test('rolls back interrupted upgrades and preserves existing expenses on retry', async () => {
    const db = new TestDb();
    try {
      await db.execAsync('PRAGMA foreign_keys = ON;');
      const initial = MIGRATIONS[0]!;
      await initial.up(db);
      await db.execAsync(initial.userVersionStatement);
      await db.runAsync(
        `INSERT INTO expenses (id, amount_centavos, category_id, created_at, local_day, updated_at)
         SELECT 42, 12345, MIN(id), 1, '2026-11-21', 1 FROM categories`
      );
      const original = await db.getAllAsync('SELECT * FROM expenses');
      const exec = db.execAsync.bind(db);
      const fault = jest.spyOn(db, 'execAsync').mockImplementation(async (sql) => {
        if (sql === MIGRATIONS[1]!.userVersionStatement) throw new Error('Interrupted upgrade');
        await exec(sql);
      });
      await expect(runMigrations(db)).rejects.toThrow('Interrupted upgrade');
      expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
      expect(await db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE name = 'expenses_local_day_created_at_id_idx'"
      )).toBeNull();
      expect(await db.getAllAsync('SELECT * FROM expenses')).toEqual(original);
      fault.mockRestore();

      await runMigrations(db);
      expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.at(-1)?.version });
      expect(await db.getAllAsync('SELECT * FROM expenses')).toEqual(original);
      expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
    } finally {
      db.close();
    }
  });

  test('expense range and keyset index is created for future migrations', async () => {
    const db = await createTestDb();
    const index = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'expenses_local_day_created_at_id_idx'"
    );
    const plan = await db.getAllAsync<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM expenses INDEXED BY expenses_local_day_created_at_id_idx WHERE local_day BETWEEN ? AND ? ORDER BY created_at DESC, id DESC LIMIT 30",
      ['2026-11-01', '2026-11-30']
    );

    expect(index?.name).toBe('expenses_local_day_created_at_id_idx');
    expect(plan.map((row) => row.detail).join(' ')).toContain('expenses_local_day_created_at_id_idx');
    db.close();
  });

  test('app_settings table exists without affecting existing data tables', async () => {
    const db = await createTestDb();
    const table = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'"
    );
    const categories = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM categories'
    );

    expect(table?.name).toBe('app_settings');
    expect(categories?.count).toBe(6);
    db.close();
  });
});
