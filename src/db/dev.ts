import type { DbLike } from '@/db/client';
import { AppError } from '@/db/errors';
import { toLocalDayKey, todayKey } from '@/lib/dates';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';

const DEMO_AMOUNTS = [1_300, 4_500, 7_000, 12_550, 15_000, 25_000, 32_000, 89_900] as const;

export type DevDatabaseStats = {
  schemaVersion: number;
  categoryCount: number;
  expenseCount: number;
  todayTotalCentavos: number;
};

function assertDevelopment(): void {
  if (!__DEV__) {
    throw new AppError('CONSTRAINT', 'Developer database tools are disabled in production.');
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export async function getDevDatabaseStats(db: DbLike): Promise<DevDatabaseStats> {
  assertDevelopment();
  const [versionRow, categoryRow, expenseRow, todayTotalCentavos] = await Promise.all([
    db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM categories'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM expenses'),
    expensesRepo.totalForDay(db, todayKey()),
  ]);

  return {
    schemaVersion: versionRow?.user_version ?? 0,
    categoryCount: categoryRow?.count ?? 0,
    expenseCount: expenseRow?.count ?? 0,
    todayTotalCentavos,
  };
}

export async function addSampleExpense(db: DbLike): Promise<void> {
  assertDevelopment();
  const category = (await categoriesRepo.listActive(db))[0];
  if (!category) {
    throw new AppError('CONSTRAINT', 'Create a category before adding a sample expense.');
  }
  await expensesRepo.create(db, {
    amountCentavos: 7_000,
    categoryId: category.id,
    note: 'Dev sample',
  });
}

export async function seedDemoData(db: DbLike, options: { days?: number } = {}): Promise<void> {
  assertDevelopment();
  const days = options.days ?? 45;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError('VALIDATION', 'Demo data days must be between 1 and 365.');
  }

  const categories = await categoriesRepo.listActive(db);
  if (categories.length === 0) {
    throw new AppError('CONSTRAINT', 'Create a category before seeding demo expenses.');
  }

  const random = createSeededRandom(0x47415354);
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      if (dayOffset > 0 && random() < 0.22) {
        continue;
      }
      const entries = 1 + Math.floor(random() * 3);
      for (let entry = 0; entry < entries; entry += 1) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        const hour = dayOffset % 11 === 0 ? 0 : dayOffset % 10 === 0 ? 23 : Math.floor(random() * 20) + 4;
        const minute = hour === 0 ? 2 : hour === 23 ? 58 : Math.floor(random() * 60);
        date.setHours(hour, minute, 0, 0);

        const category = categories[Math.floor(random() * categories.length)];
        const amount = DEMO_AMOUNTS[Math.floor(random() * DEMO_AMOUNTS.length)];
        if (!category || amount === undefined) {
          throw new AppError('DB', 'Unable to select deterministic demo data.');
        }

        const createdAt = date.getTime();
        await txn.runAsync(
          `INSERT INTO expenses
            (amount_centavos, category_id, note, created_at, local_day, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?)`,
          [amount, category.id, createdAt, toLocalDayKey(createdAt), createdAt]
        );
      }
    }
  });
}

export async function clearAllExpenses(db: DbLike): Promise<void> {
  assertDevelopment();
  await db.runAsync('DELETE FROM expenses');
}
