import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import { createTestDb, type TestDb } from './helpers/testDb';

describe('categories repository', () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('active names are unique case-insensitively but reusable after archive', async () => {
    const food = (await categoriesRepo.listActive(db))[0]!;
    await expect(
      categoriesRepo.create(db, { name: ' food ', icon: 'pizza-outline', color: '#123456' })
    ).rejects.toMatchObject({ code: 'CONSTRAINT' });

    await categoriesRepo.archive(db, food.id);
    const replacement = await categoriesRepo.create(db, {
      name: 'FOOD',
      icon: 'pizza-outline',
      color: '#123456',
    });
    expect(replacement.name).toBe('FOOD');
    await expect(categoriesRepo.unarchive(db, food.id)).rejects.toMatchObject({
      code: 'CONSTRAINT',
    });
  });

  test('cannot archive the last active category', async () => {
    const categories = await categoriesRepo.listActive(db);
    for (const category of categories.slice(0, -1)) {
      await categoriesRepo.archive(db, category.id);
    }

    await expect(categoriesRepo.archive(db, categories.at(-1)!.id)).rejects.toMatchObject({
      code: 'CONSTRAINT',
    });
  });

  test('deleteIfUnused refuses categories that have expenses', async () => {
    const food = (await categoriesRepo.listActive(db))[0]!;
    await expensesRepo.create(db, { amountCentavos: 7_000, categoryId: food.id });

    await expect(categoriesRepo.deleteIfUnused(db, food.id)).rejects.toMatchObject({
      code: 'CONSTRAINT',
    });
  });

  test('reorder validates the full active set and persists order', async () => {
    const categories = await categoriesRepo.listActive(db);
    await expect(
      categoriesRepo.reorder(
        db,
        categories.slice(1).map((category) => category.id)
      )
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const reversedIds = categories.map((category) => category.id).reverse();
    const reordered = await categoriesRepo.reorder(db, reversedIds);
    expect(reordered.map((category) => category.id)).toEqual(reversedIds);
    expect(reordered.map((category) => category.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
