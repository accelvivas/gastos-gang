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
    db.close();
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
});
