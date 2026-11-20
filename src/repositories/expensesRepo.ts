import type { DbLike } from '@/db/client';
import { AppError, isConstraintError, wrapDatabaseError } from '@/db/errors';
import {
  mapExpenseRow,
  mapExpenseWithCategoryRow,
  type Expense,
  type ExpenseRow,
  type ExpenseWithCategory,
  type ExpenseWithCategoryRow,
  type ExportExpense,
} from '@/db/types';
import { isLocalDayKey, toLocalDayKey } from '@/lib/dates';
import { MAX_AMOUNT_CENTAVOS } from '@/lib/money';

const EXPENSE_WITH_CATEGORY_SELECT = `
  SELECT
    e.id,
    e.amount_centavos,
    e.category_id,
    e.note,
    e.created_at,
    e.local_day,
    e.updated_at,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    c.is_archived AS category_is_archived
  FROM expenses e
  INNER JOIN categories c ON c.id = e.category_id
`;

export type CreateExpenseInput = {
  amountCentavos: number;
  categoryId: number;
  note?: string | null;
  createdAt?: number;
};

export type UpdateExpensePatch = {
  amountCentavos?: number;
  categoryId?: number;
  note?: string | null;
  createdAt?: number;
};

export type ExpensePageOptions = {
  limit: number;
  cursor?: {
    createdAt: number;
    id: number;
  };
};

export type CategorySummary = {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  totalCentavos: number;
  count: number;
};

export type DaySummary = {
  day: string;
  totalCentavos: number;
  count: number;
};

function validatePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AppError('VALIDATION', `${field} must be a positive integer.`);
  }
}

function validateAmount(amountCentavos: number): void {
  validatePositiveInteger(amountCentavos, 'Amount');
  if (amountCentavos > MAX_AMOUNT_CENTAVOS) {
    throw new AppError('VALIDATION', 'Amount is over the allowed maximum.');
  }
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new AppError('VALIDATION', 'Timestamp must be a non-negative epoch millisecond integer.');
  }
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note == null) {
    return null;
  }

  const normalized = note.trim();
  if (normalized.length > 200) {
    throw new AppError('VALIDATION', 'Note must be 200 characters or fewer.');
  }
  return normalized || null;
}

function validateDayRange(fromKey: string, toKey: string): void {
  if (!isLocalDayKey(fromKey) || !isLocalDayKey(toKey)) {
    throw new AppError('VALIDATION', 'Day range must use valid YYYY-MM-DD keys.');
  }
  if (fromKey > toKey) {
    throw new AppError('VALIDATION', 'The start day must not be after the end day.');
  }
}

async function findById(db: DbLike, id: number): Promise<Expense | null> {
  const row = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  return row ? mapExpenseRow(row) : null;
}

function throwConstraintOrDatabase(error: unknown, constraintMessage: string, dbMessage: string): never {
  if (error instanceof AppError) {
    throw error;
  }
  if (isConstraintError(error)) {
    throw new AppError('CONSTRAINT', constraintMessage, { cause: error });
  }
  return wrapDatabaseError(error, dbMessage);
}

export async function create(db: DbLike, input: CreateExpenseInput): Promise<Expense> {
  validateAmount(input.amountCentavos);
  validatePositiveInteger(input.categoryId, 'Category ID');
  const note = normalizeNote(input.note);
  const createdAt = input.createdAt ?? Date.now();
  validateTimestamp(createdAt);
  const localDay = toLocalDayKey(createdAt);
  let createdExpense: Expense | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        `INSERT INTO expenses
          (amount_centavos, category_id, note, created_at, local_day, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.amountCentavos, input.categoryId, note, createdAt, localDay, createdAt]
      );
      createdExpense = await findById(txn, result.lastInsertRowId);
    });
  } catch (error) {
    throwConstraintOrDatabase(error, 'The selected category does not exist.', 'Unable to save expense.');
  }

  if (!createdExpense) {
    throw new AppError('DB', 'Expense was saved but could not be read back.');
  }
  return createdExpense;
}

export async function getById(db: DbLike, id: number): Promise<Expense | null> {
  validatePositiveInteger(id, 'Expense ID');
  try {
    return await findById(db, id);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expense.');
  }
}

export async function update(
  db: DbLike,
  id: number,
  patch: UpdateExpensePatch
): Promise<Expense> {
  validatePositiveInteger(id, 'Expense ID');
  if (patch.amountCentavos !== undefined) {
    validateAmount(patch.amountCentavos);
  }
  if (patch.categoryId !== undefined) {
    validatePositiveInteger(patch.categoryId, 'Category ID');
  }
  if (patch.createdAt !== undefined) {
    validateTimestamp(patch.createdAt);
  }
  const hasNotePatch = Object.prototype.hasOwnProperty.call(patch, 'note');
  const normalizedNote = hasNotePatch ? normalizeNote(patch.note) : undefined;
  let updatedExpense: Expense | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Expense not found.');
      }

      const amountCentavos = patch.amountCentavos ?? existing.amountCentavos;
      const categoryId = patch.categoryId ?? existing.categoryId;
      const note = hasNotePatch ? (normalizedNote ?? null) : existing.note;
      const createdAt = patch.createdAt ?? existing.createdAt;
      const localDay = patch.createdAt === undefined ? existing.localDay : toLocalDayKey(createdAt);
      const updatedAt = Math.max(Date.now(), existing.updatedAt + 1);

      await txn.runAsync(
        `UPDATE expenses
         SET amount_centavos = ?, category_id = ?, note = ?, created_at = ?, local_day = ?, updated_at = ?
         WHERE id = ?`,
        [amountCentavos, categoryId, note, createdAt, localDay, updatedAt, id]
      );
      updatedExpense = await findById(txn, id);
    });
  } catch (error) {
    throwConstraintOrDatabase(error, 'The selected category does not exist.', 'Unable to update expense.');
  }

  if (!updatedExpense) {
    throw new AppError('DB', 'Expense was updated but could not be read back.');
  }
  return updatedExpense;
}

export async function remove(db: DbLike, id: number): Promise<Expense> {
  validatePositiveInteger(id, 'Expense ID');
  let deletedExpense: Expense | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Expense not found.');
      }
      await txn.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
      deletedExpense = existing;
    });
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to delete expense.');
  }

  if (!deletedExpense) {
    throw new AppError('DB', 'Expense was deleted but its previous value was unavailable.');
  }
  return deletedExpense;
}

export async function restore(db: DbLike, expense: Expense): Promise<Expense> {
  validatePositiveInteger(expense.id, 'Expense ID');
  validateAmount(expense.amountCentavos);
  validatePositiveInteger(expense.categoryId, 'Category ID');
  validateTimestamp(expense.createdAt);
  validateTimestamp(expense.updatedAt);
  if (!isLocalDayKey(expense.localDay)) {
    throw new AppError('VALIDATION', 'Expense has an invalid local day.');
  }
  const note = normalizeNote(expense.note);
  let restoredExpense: Expense | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO expenses
          (id, amount_centavos, category_id, note, created_at, local_day, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.id,
          expense.amountCentavos,
          expense.categoryId,
          note,
          expense.createdAt,
          expense.localDay,
          expense.updatedAt,
        ]
      );
      restoredExpense = await findById(txn, expense.id);
    });
  } catch (error) {
    throwConstraintOrDatabase(
      error,
      'Expense cannot be restored because its ID or category is unavailable.',
      'Unable to restore expense.'
    );
  }

  if (!restoredExpense) {
    throw new AppError('DB', 'Expense was restored but could not be read back.');
  }
  return restoredExpense;
}

export async function listByDayRange(
  db: DbLike,
  fromKey: string,
  toKey: string
): Promise<ExpenseWithCategory[]> {
  validateDayRange(fromKey, toKey);
  try {
    const rows = await db.getAllAsync<ExpenseWithCategoryRow>(
      `${EXPENSE_WITH_CATEGORY_SELECT}
       WHERE e.local_day BETWEEN ? AND ?
       ORDER BY e.created_at DESC, e.id DESC`,
      [fromKey, toKey]
    );
    return rows.map(mapExpenseWithCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expenses for this date range.');
  }
}

export async function listPage(
  db: DbLike,
  options: ExpensePageOptions
): Promise<ExpenseWithCategory[]> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new AppError('VALIDATION', 'Page limit must be between 1 and 100.');
  }
  if (options.cursor) {
    validateTimestamp(options.cursor.createdAt);
    validatePositiveInteger(options.cursor.id, 'Cursor ID');
  }

  try {
    const rows = options.cursor
      ? await db.getAllAsync<ExpenseWithCategoryRow>(
          `${EXPENSE_WITH_CATEGORY_SELECT}
           WHERE e.created_at < ? OR (e.created_at = ? AND e.id < ?)
           ORDER BY e.created_at DESC, e.id DESC
           LIMIT ?`,
          [
            options.cursor.createdAt,
            options.cursor.createdAt,
            options.cursor.id,
            options.limit,
          ]
        )
      : await db.getAllAsync<ExpenseWithCategoryRow>(
          `${EXPENSE_WITH_CATEGORY_SELECT}
           ORDER BY e.created_at DESC, e.id DESC
           LIMIT ?`,
          [options.limit]
        );
    return rows.map(mapExpenseWithCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expense history.');
  }
}

export async function totalForDay(db: DbLike, key: string): Promise<number> {
  return totalForRange(db, key, key);
}

export async function totalForRange(
  db: DbLike,
  fromKey: string,
  toKey: string
): Promise<number> {
  validateDayRange(fromKey, toKey);
  try {
    const row = await db.getFirstAsync<{ total_centavos: number }>(
      `SELECT COALESCE(SUM(amount_centavos), 0) AS total_centavos
       FROM expenses
       WHERE local_day BETWEEN ? AND ?`,
      [fromKey, toKey]
    );
    return row?.total_centavos ?? 0;
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to calculate expense total.');
  }
}

export async function sumByCategory(
  db: DbLike,
  fromKey: string,
  toKey: string
): Promise<CategorySummary[]> {
  validateDayRange(fromKey, toKey);
  try {
    const rows = await db.getAllAsync<{
      category_id: number;
      name: string;
      color: string;
      icon: string;
      total_centavos: number;
      count: number;
    }>(
      `SELECT
         c.id AS category_id,
         c.name,
         c.color,
         c.icon,
         SUM(e.amount_centavos) AS total_centavos,
         COUNT(*) AS count
       FROM expenses e
       INNER JOIN categories c ON c.id = e.category_id
       WHERE e.local_day BETWEEN ? AND ?
       GROUP BY c.id, c.name, c.color, c.icon
       ORDER BY total_centavos DESC, c.id ASC`,
      [fromKey, toKey]
    );
    return rows.map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      totalCentavos: row.total_centavos,
      count: row.count,
    }));
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to summarize expenses by category.');
  }
}

export async function sumByDay(
  db: DbLike,
  fromKey: string,
  toKey: string
): Promise<DaySummary[]> {
  validateDayRange(fromKey, toKey);
  try {
    const rows = await db.getAllAsync<{
      day: string;
      total_centavos: number;
      count: number;
    }>(
      `SELECT local_day AS day, SUM(amount_centavos) AS total_centavos, COUNT(*) AS count
       FROM expenses
       WHERE local_day BETWEEN ? AND ?
       GROUP BY local_day
       ORDER BY local_day ASC`,
      [fromKey, toKey]
    );
    return rows.map((row) => ({
      day: row.day,
      totalCentavos: row.total_centavos,
      count: row.count,
    }));
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to summarize expenses by day.');
  }
}

export async function listAllForExport(db: DbLike): Promise<ExportExpense[]> {
  try {
    const rows = await db.getAllAsync<ExpenseWithCategoryRow>(
      `${EXPENSE_WITH_CATEGORY_SELECT}
       ORDER BY e.created_at ASC, e.id ASC`
    );
    return rows.map(mapExpenseWithCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expenses for export.');
  }
}
