import type { DbLike } from '@/db/client';
import { createBackupFilename, createBackupSnapshot, getCurrentBackupCounts, readBackupFile, restoreBackupAtomically, shareBackupFile, writeBackupFile } from '@/features/settings/utils/backupService';
import { BACKUP_FORMAT, MAX_BACKUP_FILE_BYTES, type GastosGangBackup } from '@/features/settings/utils/backupSchema';
import { notifyDataReplaced, subscribeToBudgetChanges, subscribeToCategoryChanges, subscribeToExpenseChanges } from '@/lib/expenseChanges';
import { invalidateUndoOperations, beginUndoOperation, isUndoOperationActive } from '@/lib/undoCoordinator';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import { createTestDb, type TestDb } from '../helpers/testDb';

function backupFixture(): GastosGangBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    createdAt: '2026-11-21T06:30:00.000Z',
    appVersion: '1.0.0',
    data: {
      categories: [{
        id: 1,
        name: 'Food',
        icon: 'fast-food-outline',
        color: '#F59E0B',
        sortOrder: 0,
        isArchived: false,
        createdAt: 1_700_000_000_000,
      }],
      expenses: [],
      settings: [],
    },
  };
}

function createMemoryFile(uri: string, name = 'backup.json') {
  let contents = '';
  return {
    file: {
      uri,
      name,
      get size() { return new TextEncoder().encode(contents).length; },
      get exists() { return contents.length > 0; },
      create: jest.fn(() => { contents = ''; }),
      write: jest.fn(async (value: string) => { contents = value; }),
      text: jest.fn(async () => contents),
    },
    getContents: () => contents,
  };
}

describe('SQLite backup snapshots and atomic restore', () => {
  let source: TestDb;
  let target: TestDb;

  beforeEach(async () => {
    source = await createTestDb();
    target = await createTestDb();
  });

  afterEach(() => {
    source.close();
    target.close();
  });

  test('round-trips active and archived categories, future expenses, exact settings, and Unicode notes', async () => {
    const active = (await categoriesRepo.listActive(source))[0]!;
    const archived = await categoriesRepo.create(source, {
      name: 'Commute',
      icon: 'bus-outline',
      color: '#3B82F6',
    });
    const oldTime = new Date(2020, 4, 18, 8, 30).getTime();
    const futureTime = new Date(2035, 0, 2, 12, 45).getTime();
    await expensesRepo.create(source, {
      amountCentavos: 123_456,
      categoryId: archived.id,
      note: 'Pamasahe, "bossing" 🇵🇭',
      createdAt: oldTime,
    });
    await expensesRepo.create(source, {
      amountCentavos: 500,
      categoryId: active.id,
      note: 'Future gastos — salamat!',
      createdAt: futureTime,
    });
    await categoriesRepo.archive(source, archived.id);
    await source.runAsync(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['daily_budget_enabled', 'true', 101]
    );
    await source.runAsync(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['daily_budget_centavos', '50000', 102]
    );
    await source.runAsync(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['theme_mode', 'light', 103]
    );
    await source.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?)',
      ['legacy-preference', 'keep me']
    );

    const original = await createBackupSnapshot(source, {
      appVersion: '1.0.0',
      now: () => Date.UTC(2026, 10, 21, 6, 30),
      pageSize: 1,
    });
    const existingCategory = (await categoriesRepo.listActive(target))[0]!;
    await expensesRepo.create(target, { amountCentavos: 99, categoryId: existingCategory.id });

    await expect(restoreBackupAtomically(target, original)).resolves.toEqual({
      categories: original.data.categories.length,
      expenses: 2,
      settings: 4,
    });
    const restored = await createBackupSnapshot(target, {
      appVersion: '1.0.0',
      now: () => Date.UTC(2026, 10, 21, 6, 30),
    });

    expect(restored.data).toEqual(original.data);
    expect(restored.data.categories.some((category) => category.isArchived)).toBe(true);
    expect(restored.data.expenses.map((expense) => expense.note)).toContain('Pamasahe, "bossing" 🇵🇭');
    expect(await getCurrentBackupCounts(target)).toEqual({
      categories: original.data.categories.length,
      expenses: 2,
      settings: 4,
    });
  });

  test('repeated restore replaces records rather than duplicating them', async () => {
    const backup = backupFixture();
    await restoreBackupAtomically(target, backup);
    await restoreBackupAtomically(target, backup);

    expect(await getCurrentBackupCounts(target)).toEqual({
      categories: 1,
      expenses: 0,
      settings: 0,
    });
  });

  test('rejects invalid references before changing existing data', async () => {
    const category = (await categoriesRepo.listActive(target))[0]!;
    await expensesRepo.create(target, { amountCentavos: 700, categoryId: category.id });
    const before = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    const invalid = backupFixture();
    invalid.data.expenses.push({
      id: 4,
      amountCentavos: 5,
      categoryId: 999,
      note: null,
      createdAt: 2_000_000_000_000,
      localDay: '2033-05-18',
      updatedAt: 2_000_000_000_000,
    });

    await expect(restoreBackupAtomically(target, invalid)).rejects.toThrow('references a missing category');
    const after = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    expect(after.data).toEqual(before.data);
  });

  test('rolls back all deletes and inserts when a transactional insert fails', async () => {
    const category = (await categoriesRepo.listActive(target))[0]!;
    await expensesRepo.create(target, { amountCentavos: 700, categoryId: category.id });
    const before = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    const replacement = backupFixture();
    replacement.data.expenses.push({
      id: 5,
      amountCentavos: 20,
      categoryId: 1,
      note: 'replacement',
      createdAt: 2_000_000_000_000,
      localDay: '2033-05-18',
      updatedAt: 2_000_000_000_000,
    });

    const failingDb: DbLike = {
      execAsync: target.execAsync.bind(target),
      runAsync: target.runAsync.bind(target),
      getFirstAsync: target.getFirstAsync.bind(target),
      getAllAsync: target.getAllAsync.bind(target),
      withTransactionAsync: target.withTransactionAsync.bind(target),
      withExclusiveTransactionAsync: (task) => target.withExclusiveTransactionAsync((txn) => {
        const failingTxn = Object.create(txn) as DbLike;
        failingTxn.runAsync = async (sql, params) => {
          if (sql.includes('INSERT INTO expenses')) throw new Error('simulated insert failure');
          return txn.runAsync(sql, params);
        };
        return task(failingTxn);
      }),
    };

    await expect(restoreBackupAtomically(failingDb, replacement)).rejects.toMatchObject({
      code: 'TRANSACTION_FAILED',
      committed: false,
    });
    const after = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    expect(after.data).toEqual(before.data);
  });

  test('aborts before replacement if data changed since the external safety backup', async () => {
    const before = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    const category = (await categoriesRepo.listActive(target))[0]!;
    await expensesRepo.create(target, { amountCentavos: 40, categoryId: category.id });
    const afterChange = await createBackupSnapshot(target, { appVersion: '1.0.0' });

    await expect(restoreBackupAtomically(target, backupFixture(), {
      expectedCurrentData: before.data,
    })).rejects.toMatchObject({ code: 'INTEGRITY_FAILED', committed: false });
    const after = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    expect(after.data).toEqual(afterChange.data);
  });

  test('reports post-commit verification failure without pretending the transaction rolled back', async () => {
    let failPostCommitRead = true;
    const category = (await categoriesRepo.listActive(target))[0]!;
    const replacement = backupFixture();
    replacement.data.expenses.push({
      id: 8,
      amountCentavos: 10,
      categoryId: 1,
      note: null,
      createdAt: 2_000_000_000_000,
      localDay: '2033-05-18',
      updatedAt: 2_000_000_000_000,
    });
    await expensesRepo.create(target, { amountCentavos: 200, categoryId: category.id });
    const flakyDb: DbLike = {
      execAsync: target.execAsync.bind(target),
      runAsync: target.runAsync.bind(target),
      getFirstAsync: async (sql, params) => {
        if (failPostCommitRead) {
          failPostCommitRead = false;
          throw new Error('simulated post-commit read failure');
        }
        return target.getFirstAsync(sql, params);
      },
      getAllAsync: target.getAllAsync.bind(target),
      withTransactionAsync: target.withTransactionAsync.bind(target),
      withExclusiveTransactionAsync: target.withExclusiveTransactionAsync.bind(target),
    };

    await expect(restoreBackupAtomically(flakyDb, replacement)).rejects.toMatchObject({
      code: 'POST_COMMIT_VERIFY_FAILED',
      committed: true,
    });
    const committed = await createBackupSnapshot(target, { appVersion: '1.0.0' });
    expect(committed.data.expenses).toHaveLength(1);
    expect(committed.data.expenses[0]?.id).toBe(8);
  });

  test('captures large expense histories through bounded keyset pages', async () => {
    const category = (await categoriesRepo.listActive(source))[0]!;
    const baseTime = 2_200_000_000_000;
    await source.withExclusiveTransactionAsync(async (txn) => {
      for (let offset = 0; offset < 1_200; offset += 100) {
        const batch = Array.from({ length: 100 }, (_, index) => {
          const id = offset + index + 1;
          return [id, 1, category.id, `note-${id}`, baseTime + id, '2039-09-10', baseTime + id];
        });
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        await txn.runAsync(
          `INSERT INTO expenses (id, amount_centavos, category_id, note, created_at, local_day, updated_at) VALUES ${placeholders}`,
          batch.flat()
        );
      }
    });

    const snapshot = await createBackupSnapshot(source, { appVersion: '1.0.0', pageSize: 37 });
    expect(snapshot.data.expenses).toHaveLength(1_200);
    await restoreBackupAtomically(target, snapshot);
    expect(await getCurrentBackupCounts(target)).toMatchObject({ expenses: 1_200 });
  });
});

describe('backup file operations', () => {
  test('writes and reads a verified, dynamically named backup file', async () => {
    const memory = createMemoryFile('file:///cache/backup.json');
    const backup = backupFixture();
    const filename = createBackupFilename('backup', new Date(2026, 10, 21, 8, 9, 10).getTime());
    const saved = await writeBackupFile(backup, filename, {
      createCacheFile: () => memory.file,
    });
    const loaded = await readBackupFile(saved.uri, {
      createFileFromUri: () => memory.file,
    });

    expect(filename).toBe('gastos-gang-backup-20261121-080910.json');
    expect(saved.size).toBeGreaterThan(0);
    expect(loaded).toEqual(backup);
    expect(memory.file.create).toHaveBeenCalledWith({ overwrite: false });
  });

  test('preserves an existing safety backup when its filename collides', async () => {
    const { file } = createMemoryFile('file:///cache/before-restore.json');
    file.create.mockImplementation(() => { throw new Error('File already exists'); });
    await expect(writeBackupFile(backupFixture(), file.name, {
      createCacheFile: () => file,
    })).rejects.toMatchObject({ code: 'FILE_WRITE_FAILED' });
    expect(file.create).toHaveBeenCalledWith({ overwrite: false });
    expect(file.write).not.toHaveBeenCalled();
  });

  test('rejects a write whose readback differs even when the byte count matches', async () => {
    const { file } = createMemoryFile('file:///cache/backup.json');
    file.text.mockResolvedValue('different data');
    await expect(writeBackupFile(backupFixture(), file.name, {
      createCacheFile: () => file,
    })).rejects.toMatchObject({ code: 'FILE_WRITE_FAILED' });
    expect(file.text).toHaveBeenCalledTimes(1);
  });

  test('surfaces file write, read, and share failures', async () => {
    const failedWrite = createMemoryFile('file:///cache/fail.json');
    failedWrite.file.write.mockRejectedValue(new Error('disk full'));
    await expect(writeBackupFile(backupFixture(), 'backup.json', {
      createCacheFile: () => failedWrite.file,
    })).rejects.toMatchObject({ code: 'FILE_WRITE_FAILED' });

    const unreadable = createMemoryFile('file:///cache/unreadable.json');
    await writeBackupFile(backupFixture(), 'backup.json', {
      createCacheFile: () => unreadable.file,
    });
    unreadable.file.text.mockRejectedValue(new Error('permission denied'));
    await expect(readBackupFile(unreadable.file.uri, {
      createFileFromUri: () => unreadable.file,
    })).rejects.toMatchObject({ code: 'FILE_READ_FAILED' });

    await expect(shareBackupFile('file:///cache/backup.json', 'backup.json', {
      isAvailable: async () => false,
      share: async () => undefined,
    })).rejects.toMatchObject({ code: 'SHARING_UNAVAILABLE' });
    await expect(shareBackupFile('file:///cache/backup.json', 'backup.json', {
      isAvailable: async () => true,
      share: async () => { throw new Error('share failed'); },
    })).rejects.toMatchObject({ code: 'SHARING_FAILED' });
  });

  test('rejects an oversized selected file before reading it', async () => {
    const oversizedFile = {
      uri: 'file:///cache/oversized.json',
      name: 'oversized.json',
      size: MAX_BACKUP_FILE_BYTES + 1,
      exists: true,
      create: jest.fn(),
      write: jest.fn(async () => undefined),
      text: jest.fn(async () => ''),
    };

    await expect(readBackupFile(oversizedFile.uri, {
      createFileFromUri: () => oversizedFile,
    })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(oversizedFile.text).not.toHaveBeenCalled();
  });
});

describe('restore refresh coordination', () => {
  test('notifies all feature refresh channels and invalidates pre-restore Undo tokens', () => {
    const categoryChanged = jest.fn();
    const expenseChanged = jest.fn();
    const budgetChanged = jest.fn();
    const unsubscribeCategory = subscribeToCategoryChanges(categoryChanged);
    const unsubscribeExpense = subscribeToExpenseChanges(expenseChanged);
    const unsubscribeBudget = subscribeToBudgetChanges(budgetChanged);
    const undoToken = beginUndoOperation();

    notifyDataReplaced();
    invalidateUndoOperations();

    expect(categoryChanged).toHaveBeenCalledTimes(1);
    expect(expenseChanged).toHaveBeenCalledTimes(1);
    expect(budgetChanged).toHaveBeenCalledTimes(1);
    expect(isUndoOperationActive(undoToken)).toBe(false);
    unsubscribeCategory();
    unsubscribeExpense();
    unsubscribeBudget();
  });
});
