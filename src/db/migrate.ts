import type { DbLike } from '@/db/client';
import { AppError } from '@/db/errors';
import { MIGRATIONS } from '@/db/migrations';

type UserVersionRow = {
  user_version: number;
};

export async function getSchemaVersion(db: DbLike): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function runMigrations(db: DbLike): Promise<void> {
  const currentVersion = await getSchemaVersion(db);
  const latestVersion = MIGRATIONS.at(-1)?.version ?? 0;

  if (currentVersion > latestVersion) {
    throw new AppError(
      'DB',
      `Database version ${currentVersion} is newer than supported version ${latestVersion}.`
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.execAsync(migration.userVersionStatement);
    });
  }
}
