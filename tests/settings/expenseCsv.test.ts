import type { ExportExpense } from '@/db/types';
import { formatExpenseCsv, formatExpenseCsvRow } from '@/features/settings/utils/expenseCsv';
import {
  CsvExportError,
  exportExpensesCsv,
  type ExportCsvDependencies,
} from '@/features/settings/utils/exportExpensesCsv';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';
import { createTestDb, type TestDb } from '../helpers/testDb';

function exportExpense(overrides: Partial<ExportExpense> = {}): ExportExpense {
  const createdAt = new Date(2026, 10, 21, 8, 9, 10, 111).getTime();
  return {
    id: 7,
    amountCentavos: 123_456,
    categoryId: 2,
    note: null,
    createdAt,
    localDay: '2026-11-21',
    updatedAt: createdAt + 1_234,
    categoryName: 'Food',
    categoryIcon: 'fast-food-outline',
    categoryColor: '#F59E0B',
    categoryIsArchived: false,
    ...overrides,
  };
}

function createExportHarness(db: TestDb, overrides: Partial<ExportCsvDependencies> = {}) {
  let contents = '';
  const file = {
    uri: 'file:///cache/gastos-gang-expenses-20261121-080910.csv',
    create: jest.fn(),
    write: jest.fn(async (value: string, options?: { append?: boolean }) => {
      contents = options?.append ? contents + value : value;
    }),
  };
  const shareFile = jest.fn(async () => undefined);
  const isSharingAvailable = jest.fn(async () => true);
  const dependencies: ExportCsvDependencies = {
    listPage: expensesRepo.listExportPage,
    createFile: jest.fn(() => file),
    isSharingAvailable,
    shareFile,
    now: () => new Date(2026, 10, 21, 8, 9, 10).getTime(),
    pageSize: 2,
    ...overrides,
  };
  return {
    dependencies,
    file,
    getContents: () => contents,
    isSharingAvailable,
    shareFile,
  };
}

describe('expense CSV formatting', () => {
  test('formats exact headers, pesos, centavos, local time, and ISO timestamps', () => {
    const expense = exportExpense();
    const expectedIso = new Date(expense.createdAt).toISOString();
    const expectedUpdatedIso = new Date(expense.updatedAt).toISOString();

    expect(formatExpenseCsvRow(expense)).toBe(
      `"7","2026-11-21","08:09:10","Food","1234.56","123456","","${expectedIso}","${expectedUpdatedIso}"`
    );
    expect(formatExpenseCsv([])).toBe(
      '\uFEFFid,date,time,category,amount_php,amount_centavos,note,created_at_iso,updated_at_iso\r\n'
    );
  });

  test('quotes commas, quotes, line breaks, carriage returns, empty fields, and Unicode', () => {
    const note = 'Unang linya, "sarap"\r\nIkalawang linya — salamat 🇵🇭';
    const csv = formatExpenseCsv([
      exportExpense({ categoryName: 'Kain, "bossing"', note }),
      exportExpense({ id: 8, note: '' }),
    ]);

    expect(csv.startsWith('\uFEFFid,date,time,category,amount_php,amount_centavos,note,')).toBe(true);
    expect(csv).toContain('"Kain, ""bossing"""');
    expect(csv).toContain('"Unang linya, ""sarap""\r\nIkalawang linya — salamat 🇵🇭"');
    expect(csv).toContain(',""');
  });

  test.each(['=1+1', '  =1+1', '\t=1+1', '\r\n@SUM(A1:A2)', '\u0000-1+1'])(
    'neutralizes formula prefixes after leading controls or whitespace: %p',
    (note) => {
      const csvRow = formatExpenseCsvRow(exportExpense({ note }));
      expect(csvRow).toContain(`,"'${note.replace(/"/g, '""')}",`);
    }
  );

  test('neutralizes formula prefixes in category names as well as notes', () => {
    const csvRow = formatExpenseCsvRow(
      exportExpense({ categoryName: '\n  =HYPERLINK("https://example.invalid")' })
    );
    expect(csvRow).toContain(`,"'\n  =HYPERLINK(""https://example.invalid"")",`);
  });
});

describe('CSV expense export', () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('does not create or share a file when there are no expenses', async () => {
    const harness = createExportHarness(db);

    await expect(exportExpensesCsv(db, harness.dependencies)).resolves.toEqual({ status: 'empty' });
    expect(harness.dependencies.createFile).not.toHaveBeenCalled();
    expect(harness.shareFile).not.toHaveBeenCalled();
  });

  test('exports all expenses in stable chronological order, including archived and future records', async () => {
    const category = (await categoriesRepo.listActive(db))[0]!;
    const earlier = new Date(2035, 0, 2, 9).getTime();
    const sameTime = new Date(2035, 0, 2, 10).getTime();
    const first = await expensesRepo.create(db, {
      amountCentavos: 9_999,
      categoryId: category.id,
      note: 'First',
      createdAt: earlier,
    });
    const second = await expensesRepo.create(db, {
      amountCentavos: 12_345,
      categoryId: category.id,
      note: 'Archived category record',
      createdAt: sameTime,
    });
    const third = await expensesRepo.create(db, {
      amountCentavos: 5_001,
      categoryId: category.id,
      note: 'Same timestamp, later ID',
      createdAt: sameTime,
    });
    await categoriesRepo.archive(db, category.id);
    const harness = createExportHarness(db);

    await expect(exportExpensesCsv(db, harness.dependencies)).resolves.toEqual({
      status: 'ready',
      filename: 'gastos-gang-expenses-20261121-080910.csv',
      count: 3,
    });

    const csv = harness.getContents();
    expect(csv).toContain('"Archived category record"');
    expect(csv.indexOf(`"${first.id}"`)).toBeLessThan(csv.indexOf(`"${second.id}"`));
    expect(csv.indexOf(`"${second.id}"`)).toBeLessThan(csv.indexOf(`"${third.id}"`));
    expect(csv).toContain('"2035-01-02"');
    expect(csv).toContain('"123.45","12345"');
    expect(harness.file.create).toHaveBeenCalledWith({ overwrite: true });
    expect(harness.shareFile).toHaveBeenCalledWith(harness.file.uri);
  });

  test('does not write a file if native sharing is unavailable', async () => {
    const category = (await categoriesRepo.listActive(db))[0]!;
    await expensesRepo.create(db, { amountCentavos: 1, categoryId: category.id });
    const harness = createExportHarness(db, {
      isSharingAvailable: async () => false,
    });

    await expect(exportExpensesCsv(db, harness.dependencies)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(harness.dependencies.createFile).not.toHaveBeenCalled();
    expect(harness.shareFile).not.toHaveBeenCalled();
  });

  test('reports file creation and write failures without opening sharing', async () => {
    const category = (await categoriesRepo.listActive(db))[0]!;
    await expensesRepo.create(db, { amountCentavos: 1, categoryId: category.id });
    const harness = createExportHarness(db, {
      createFile: () => ({
        uri: 'file:///cache/export.csv',
        create: () => {
          throw new Error('Storage unavailable');
        },
        write: async () => undefined,
      }),
    });

    await expect(exportExpensesCsv(db, harness.dependencies)).rejects.toMatchObject({
      code: 'FILE_WRITE',
    });
    expect(harness.shareFile).not.toHaveBeenCalled();
  });

  test('reports file write failures without opening sharing', async () => {
    const category = (await categoriesRepo.listActive(db))[0]!;
    await expensesRepo.create(db, { amountCentavos: 1, categoryId: category.id });
    const harness = createExportHarness(db, {
      createFile: () => ({
        uri: 'file:///cache/export.csv',
        create: () => undefined,
        write: async () => {
          throw new Error('Storage full');
        },
      }),
    });

    await expect(exportExpensesCsv(db, harness.dependencies)).rejects.toMatchObject({
      code: 'FILE_WRITE',
    });
    expect(harness.shareFile).not.toHaveBeenCalled();
  });

  test('reports share failures after a complete file has been written', async () => {
    const category = (await categoriesRepo.listActive(db))[0]!;
    await expensesRepo.create(db, { amountCentavos: 1, categoryId: category.id });
    const harness = createExportHarness(db, {
      shareFile: async () => {
        throw new Error('Share sheet unavailable');
      },
    });

    await expect(exportExpensesCsv(db, harness.dependencies)).rejects.toMatchObject({
      name: CsvExportError.name,
      code: 'SHARING_FAILED',
    });
  });
});
