import type { Category } from '@/db/types';
import { toLocalDayKey } from '@/lib/dates';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import { createTestDb, type TestDb } from './helpers/testDb';

describe('expenses repository', () => {
  let db: TestDb;
  let categories: Category[];

  beforeEach(async () => {
    db = await createTestDb();
    categories = await categoriesRepo.listActive(db);
  });

  afterEach(() => {
    db.close();
  });

  test('create, update, remove, and restore preserve the expected data', async () => {
    const food = categories[0];
    const transport = categories[1];
    expect(food).toBeDefined();
    expect(transport).toBeDefined();

    const beforeMidnight = new Date(2026, 10, 20, 23, 59).getTime();
    const afterMidnight = new Date(2026, 10, 21, 0, 1).getTime();
    const created = await expensesRepo.create(db, {
      amountCentavos: 7_000,
      categoryId: food!.id,
      note: '  Dinner  ',
      createdAt: beforeMidnight,
    });
    expect(created.localDay).toBe('2026-11-20');
    expect(created.note).toBe('Dinner');

    const updated = await expensesRepo.update(db, created.id, {
      amountCentavos: 8_500,
      categoryId: transport!.id,
      createdAt: afterMidnight,
      note: ' ',
    });
    expect(updated.localDay).toBe('2026-11-21');
    expect(updated.note).toBeNull();
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);

    const deleted = await expensesRepo.remove(db, created.id);
    expect(await expensesRepo.getById(db, created.id)).toBeNull();
    const restored = await expensesRepo.restore(db, deleted);
    expect(restored).toEqual(deleted);
  });

  test('database constraints reject invalid amounts and foreign keys', async () => {
    const category = categories[0];
    expect(category).toBeDefined();
    const now = Date.now();
    const key = toLocalDayKey(now);

    await expect(
      db.runAsync(
        `INSERT INTO expenses
          (amount_centavos, category_id, note, created_at, local_day, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?)`,
        [0, category!.id, now, key, now]
      )
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `INSERT INTO expenses
          (amount_centavos, category_id, note, created_at, local_day, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?)`,
        [-1, category!.id, now, key, now]
      )
    ).rejects.toThrow();
    await expect(
      expensesRepo.create(db, { amountCentavos: 1_300, categoryId: 99_999 })
    ).rejects.toMatchObject({ code: 'CONSTRAINT' });
  });

  test('keyset pagination does not skip or duplicate identical timestamps', async () => {
    const category = categories[0];
    expect(category).toBeDefined();
    const timestamp = new Date(2026, 10, 20, 12).getTime();
    for (let index = 0; index < 5; index += 1) {
      await expensesRepo.create(db, {
        amountCentavos: 1_000 + index,
        categoryId: category!.id,
        createdAt: timestamp,
      });
    }

    const firstPage = await expensesRepo.listPage(db, { limit: 2 });
    const firstCursor = firstPage.at(-1)!;
    const secondPage = await expensesRepo.listPage(db, {
      limit: 2,
      cursor: { createdAt: firstCursor.createdAt, id: firstCursor.id },
    });
    const secondCursor = secondPage.at(-1)!;
    const thirdPage = await expensesRepo.listPage(db, {
      limit: 2,
      cursor: { createdAt: secondCursor.createdAt, id: secondCursor.id },
    });
    const ids = [...firstPage, ...secondPage, ...thirdPage].map((expense) => expense.id);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([...ids].sort((left, right) => right - left));
  });

  test('range and grouped summaries match hand-computed totals', async () => {
    const food = categories[0];
    const transport = categories[1];
    expect(food).toBeDefined();
    expect(transport).toBeDefined();
    const dayOne = new Date(2026, 10, 20, 9).getTime();
    const dayTwo = new Date(2026, 10, 21, 10).getTime();

    await expensesRepo.create(db, {
      amountCentavos: 7_000,
      categoryId: food!.id,
      createdAt: dayOne,
    });
    await expensesRepo.create(db, {
      amountCentavos: 5_000,
      categoryId: food!.id,
      createdAt: dayTwo,
    });
    await expensesRepo.create(db, {
      amountCentavos: 1_300,
      categoryId: transport!.id,
      createdAt: dayTwo,
    });

    expect(await expensesRepo.totalForRange(db, '2026-11-20', '2026-11-21')).toBe(13_300);
    expect(await expensesRepo.sumByCategory(db, '2026-11-20', '2026-11-21')).toEqual([
      expect.objectContaining({ categoryId: food!.id, totalCentavos: 12_000, count: 2 }),
      expect.objectContaining({ categoryId: transport!.id, totalCentavos: 1_300, count: 1 }),
    ]);
    expect(await expensesRepo.sumByDay(db, '2026-11-20', '2026-11-21')).toEqual([
      { day: '2026-11-20', totalCentavos: 7_000, count: 1 },
      { day: '2026-11-21', totalCentavos: 6_300, count: 2 },
    ]);
  });
});
