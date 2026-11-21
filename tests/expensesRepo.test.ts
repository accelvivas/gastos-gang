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

  test('searches archived category names and literal note text across filtered pages', async () => {
    const food = categories[0]!;
    const transport = categories[1]!;
    const today = new Date(2026, 10, 21, 12).getTime();
    const yesterday = new Date(2026, 10, 20, 12).getTime();
    const base = { categoryId: food.id, amountCentavos: 701, createdAt: today };
    const first = await expensesRepo.create(db, { ...base, note: '50% Lunch' });
    const latest = await expensesRepo.create(db, { ...base, note: '50% dinner' });
    await expensesRepo.create(db, { ...base, note: '500 breakfast' });
    await expensesRepo.create(db, { ...base, note: '50% snack', createdAt: yesterday });
    await expensesRepo.create(db, { ...base, note: '50% ride', categoryId: transport.id });
    await categoriesRepo.archive(db, food.id);

    expect(await categoriesRepo.listForHistory(db)).toContainEqual(
      expect.objectContaining({ id: food.id, isArchived: true })
    );
    expect(await expensesRepo.listPage(db, { limit: 10, filters: { search: food.name.toUpperCase() } }))
      .toHaveLength(4);
    expect(await expensesRepo.listPage(db, { limit: 10, filters: { search: 'LUNCH' } }))
      .toEqual([expect.objectContaining({ id: first.id })]);
    const filters = {
      search: '50%',
      categoryId: food.id,
      dateRange: { fromKey: '2026-11-21', toKey: '2026-11-21' },
    };
    const firstPage = await expensesRepo.listPage(db, { limit: 1, filters });
    expect(firstPage.map((row) => row.id)).toEqual([latest.id]);
    const nextPage = await expensesRepo.listPage(db, {
      limit: 1, filters, cursor: { id: latest.id, createdAt: today },
    });
    expect(nextPage.map((row) => row.id)).toEqual([first.id]);
    expect(await expensesRepo.sumByDay(db, '2026-11-21', '2026-11-21', filters)).toEqual([
      { day: '2026-11-21', totalCentavos: 1402, count: 2 },
    ]);
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

  test('create rejects an archived category', async () => {
    const category = categories[0];
    expect(category).toBeDefined();
    await categoriesRepo.archive(db, category!.id);

    await expect(
      expensesRepo.create(db, { amountCentavos: 1_300, categoryId: category!.id })
    ).rejects.toMatchObject({
      code: 'CONSTRAINT',
      message: 'The selected category is no longer available.',
    });
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

  test('joined history retains archived category visuals', async () => {
    const category = categories[0]!;
    const createdAt = new Date(2026, 10, 21, 10).getTime();
    await expensesRepo.create(db, {
      amountCentavos: 2_500,
      categoryId: category.id,
      createdAt,
    });
    await categoriesRepo.archive(db, category.id);

    expect(await expensesRepo.listByDayRange(db, '2026-11-21', '2026-11-21')).toEqual([
      expect.objectContaining({
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        categoryIsArchived: true,
      }),
    ]);
  });

  test('daily SQL totals follow edit, date move, delete, and exact restore', async () => {
    const category = categories[0]!;
    const firstDay = new Date(2026, 10, 20, 23, 59).getTime();
    const secondDay = new Date(2026, 10, 21, 0, 1).getTime();
    const expense = await expensesRepo.create(db, {
      amountCentavos: 1_000,
      categoryId: category.id,
      createdAt: firstDay,
    });
    expect(await expensesRepo.totalForDay(db, '2026-11-20')).toBe(1_000);

    await expensesRepo.update(db, expense.id, { amountCentavos: 2_500, createdAt: secondDay });
    expect(await expensesRepo.totalForDay(db, '2026-11-20')).toBe(0);
    expect(await expensesRepo.totalForDay(db, '2026-11-21')).toBe(2_500);

    const deleted = await expensesRepo.remove(db, expense.id);
    expect(await expensesRepo.totalForDay(db, '2026-11-21')).toBe(0);
    await expensesRepo.restore(db, deleted);
    expect(await expensesRepo.totalForDay(db, '2026-11-21')).toBe(2_500);
    expect(await expensesRepo.getById(db, expense.id)).toEqual(deleted);
  });
});
