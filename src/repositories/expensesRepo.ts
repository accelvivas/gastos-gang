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
    c.is_archived AS category_is_archived,
    o.status AS recurring_source
  FROM expenses e
  INNER JOIN categories c ON c.id = e.category_id
  LEFT JOIN recurring_occurrences o ON o.expense_id = e.id
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
  filters?: ExpenseHistoryFilters;
  cursor?: {
    createdAt: number;
    id: number;
  };
};

export type ExpenseExportCursor = {
  createdAt: number;
  id: number;
};

export const EXPENSE_EXPORT_PAGE_SIZE = 500;

export type ExpenseHistoryFilters = {
  search?: string;
  categoryId?: number;
  dateRange?: { fromKey: string; toKey: string };
};

function historyPredicates(filters?: ExpenseHistoryFilters) {
  const clauses: string[] = [];
  const args: (string | number)[] = [];
  const search = filters?.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[!%_]/g, '!$&')}%`;
    clauses.push("(c.name LIKE ? ESCAPE '!' OR e.note LIKE ? ESCAPE '!')");
    args.push(pattern, pattern);
  }
  if (filters?.categoryId !== undefined) {
    validatePositiveInteger(filters.categoryId, 'Category ID');
    clauses.push('e.category_id = ?');
    args.push(filters.categoryId);
  }
  if (filters?.dateRange) {
    const { fromKey, toKey } = filters.dateRange;
    validateDayRange(fromKey, toKey);
    clauses.push('e.local_day BETWEEN ? AND ?');
    args.push(fromKey, toKey);
  }
  return { clauses, args };
}

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
      const activeCategory = await txn.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE id = ? AND is_archived = 0',
        [input.categoryId]
      );
      if (!activeCategory) {
        throw new AppError('CONSTRAINT', 'The selected category is no longer available.');
      }
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
      const recurringOccurrence = await txn.getFirstAsync<{ scheduleId: number; dueDay: string }>(
        'SELECT schedule_id AS scheduleId, due_day AS dueDay FROM recurring_occurrences WHERE expense_id = ?', [id]
      );
      await txn.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
      deletedExpense = recurringOccurrence ? { ...existing, recurringOccurrence } : existing;
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
      if (expense.recurringOccurrence) {
        await txn.runAsync(`UPDATE recurring_occurrences SET expense_id = ?
          WHERE schedule_id = ? AND due_day = ? AND expense_id IS NULL AND status IN ('paid','auto')`,
          [expense.id, expense.recurringOccurrence.scheduleId, expense.recurringOccurrence.dueDay]);
      }
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
    const { clauses, args } = historyPredicates(options.filters);
    if (options.cursor) {
      const { createdAt, id } = options.cursor;
      clauses.push('(e.created_at, e.id) < (?, ?)');
      args.push(createdAt, id);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<ExpenseWithCategoryRow>(
      `${EXPENSE_WITH_CATEGORY_SELECT} ${where}
       ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
      [...args, options.limit]
    );
    return rows.map(mapExpenseWithCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expense history.');
  }
}

export async function totalForDay(db: DbLike, key: string): Promise<number> {
  return totalForRange(db, key, key);
}

export async function totalForDayAt(
  db: DbLike,
  key: string,
  cutoffMs: number
): Promise<number> {
  validateDayRange(key, key);
  validateTimestamp(cutoffMs);
  try {
    const row = await db.getFirstAsync<{ total_centavos: number }>(
      `SELECT COALESCE(SUM(amount_centavos), 0) AS total_centavos
       FROM expenses
       WHERE local_day = ? AND created_at <= ?`,
      [key, cutoffMs]
    );
    return row?.total_centavos ?? 0;
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to calculate expense total.');
  }
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
  toKey: string,
  filters?: ExpenseHistoryFilters
): Promise<DaySummary[]> {
  validateDayRange(fromKey, toKey);
  try {
    const { clauses, args } = historyPredicates(filters);
    const extra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<{
      day: string;
      total_centavos: number;
      count: number;
    }>(
      `SELECT e.local_day AS day, SUM(e.amount_centavos) AS total_centavos, COUNT(*) AS count
       FROM expenses e JOIN categories c ON c.id = e.category_id
       WHERE e.local_day BETWEEN ? AND ? ${extra}
       GROUP BY e.local_day
       ORDER BY e.local_day ASC`,
      [fromKey, toKey, ...args]
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

type SummaryRange = { fromKey: string; toKey: string };
type SpendingSummaryRow =
  | { kind: 'total' | 'previous'; totalCentavos: number }
  | ({ kind: 'category' } & CategorySummary)
  | ({ kind: 'day' } & DaySummary);

export async function getNextFutureExpenseTimestamp(
  db: DbLike,
  range: SummaryRange,
  cutoffMs: number
): Promise<number | null> {
  validateDayRange(range.fromKey, range.toKey);
  validateTimestamp(cutoffMs);
  try {
    const row = await db.getFirstAsync<{ created_at: number }>(
      `SELECT MIN(created_at) AS created_at
       FROM expenses
       WHERE local_day >= ? AND local_day <= ? AND created_at > ?`,
      [range.fromKey, range.toKey, cutoffMs]
    );
    return row?.created_at ?? null;
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to schedule spending summary refresh.');
  }
}

export async function readSpendingSummary(
  db: DbLike,
  current: SummaryRange,
  previous: SummaryRange,
  cutoffMs: number = Date.now()
) {
  validateDayRange(current.fromKey, current.toKey);
  validateDayRange(previous.fromKey, previous.toKey);
  validateTimestamp(cutoffMs);
  try {
    // One read statement keeps every aggregate on the same SQLite snapshot.
    const rows = await db.getAllAsync<SpendingSummaryRow>(
      `WITH period_rows AS (
         SELECT amount_centavos, local_day, category_id
         FROM expenses
         WHERE local_day >= ? AND local_day <= ? AND created_at <= ?
       )
       SELECT 'total' AS kind, COALESCE(SUM(amount_centavos), 0) AS totalCentavos,
              NULL AS count, NULL AS day, NULL AS categoryId, NULL AS name, NULL AS icon, NULL AS color
       FROM period_rows
       UNION ALL
       SELECT 'previous', COALESCE(SUM(amount_centavos), 0), NULL, NULL, NULL, NULL, NULL, NULL
       FROM expenses
       WHERE local_day >= ? AND local_day <= ? AND created_at <= ?
       UNION ALL
       SELECT 'category', SUM(p.amount_centavos), COUNT(*), NULL, c.id, c.name, c.icon, c.color
       FROM period_rows p JOIN categories c ON c.id = p.category_id
       GROUP BY c.id, c.name, c.icon, c.color
       UNION ALL
       SELECT 'day', SUM(amount_centavos), COUNT(*), local_day, NULL, NULL, NULL, NULL
       FROM period_rows GROUP BY local_day`,
      [
        current.fromKey, current.toKey, cutoffMs,
        previous.fromKey, previous.toKey, cutoffMs,
      ]
    );
    const categories: CategorySummary[] = [];
    const days: DaySummary[] = [];
    let totalCentavos: number | undefined;
    let previousTotalCentavos: number | undefined;
    for (const row of rows) {
      const { totalCentavos: amount } = row;
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new AppError('DB', 'A spending total exceeds the supported precision.');
      }
      if ((row.kind === 'day' || row.kind === 'category') &&
        (!Number.isSafeInteger(row.count) || row.count <= 0)) {
        throw new AppError('DB', 'An expense count exceeds the supported precision.');
      }
      if (row.kind === 'total') totalCentavos = amount;
      if (row.kind === 'previous') previousTotalCentavos = amount;
      if (row.kind === 'category') {
        const { categoryId, name, icon, color, count } = row;
        categories.push({ categoryId, name, icon, color, count, totalCentavos: amount });
      }
      if (row.kind === 'day') days.push({ day: row.day, count: row.count, totalCentavos: amount });
    }
    if (
      totalCentavos === undefined || previousTotalCentavos === undefined ||
      categories.reduce((sum, row) => sum + row.totalCentavos, 0) !== totalCentavos ||
      days.reduce((sum, row) => sum + row.totalCentavos, 0) !== totalCentavos
    ) {
      throw new AppError('DB', 'Spending totals do not reconcile.');
    }
    return {
      totalCentavos, previousTotalCentavos, days,
      categories: categories.sort((a, b) => b.totalCentavos - a.totalCentavos || a.categoryId - b.categoryId),
    };
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load spending summary.');
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

export async function listExportPage(
  db: DbLike,
  cursor?: ExpenseExportCursor,
  limit = EXPENSE_EXPORT_PAGE_SIZE
): Promise<ExportExpense[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new AppError('VALIDATION', 'Export page limit must be between 1 and 1000.');
  }
  if (cursor) {
    validateTimestamp(cursor.createdAt);
    validatePositiveInteger(cursor.id, 'Export cursor ID');
  }

  const cursorClause = cursor
    ? 'WHERE e.created_at > ? OR (e.created_at = ? AND e.id > ?)'
    : '';
  const args = cursor
    ? [cursor.createdAt, cursor.createdAt, cursor.id, limit]
    : [limit];

  try {
    const rows = await db.getAllAsync<ExpenseWithCategoryRow>(
      `${EXPENSE_WITH_CATEGORY_SELECT}
       ${cursorClause}
       ORDER BY e.created_at ASC, e.id ASC
       LIMIT ?`,
      args
    );
    return rows.map(mapExpenseWithCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load expenses for export.');
  }
}
