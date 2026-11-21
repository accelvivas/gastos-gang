import type { DbLike } from '@/db/client';
import { AppError, isConstraintError, wrapDatabaseError } from '@/db/errors';
import { mapCategoryRow, type Category, type CategoryRow } from '@/db/types';

const COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

export const CATEGORY_ICONS = [
  'fast-food-outline',
  'bus-outline',
  'phone-portrait-outline',
  'bag-handle-outline',
  'receipt-outline',
  'ellipsis-horizontal-circle-outline',
  'restaurant-outline',
  'cart-outline',
  'cafe-outline',
  'game-controller-outline',
  'home-outline',
  'heart-outline',
  'fitness-outline',
  'medical-outline',
  'school-outline',
  'airplane-outline',
  'gift-outline',
  'paw-outline',
  'shirt-outline',
  'build-outline',
] as const;

export const CATEGORY_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#10B981',
  '#6B7280',
  '#FF805C',
  '#C9FC39',
] as const;

export type CreateCategoryInput = {
  name: string;
  icon: string;
  color: string;
};

export type UpdateCategoryPatch = Partial<CreateCategoryInput>;

function validateId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError('VALIDATION', 'Category ID must be a positive integer.');
  }
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (normalized.length < 1 || normalized.length > 30) {
    throw new AppError('VALIDATION', 'Category name must be between 1 and 30 characters.');
  }
  return normalized;
}

function normalizeIcon(icon: string): string {
  const normalized = icon.trim();
  if (!(CATEGORY_ICONS as readonly string[]).includes(normalized)) {
    throw new AppError('VALIDATION', 'Choose one of the supported category icons.');
  }
  return normalized;
}

function normalizeColor(color: string): string {
  const normalized = color.trim().toUpperCase();
  if (!COLOR_PATTERN.test(normalized) ||
    !(CATEGORY_COLORS as readonly string[]).includes(normalized)) {
    throw new AppError('VALIDATION', 'Choose one of the supported category colors.');
  }
  return normalized;
}

async function findById(db: DbLike, id: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  return row ? mapCategoryRow(row) : null;
}

function throwCategoryWriteError(error: unknown, message: string): never {
  if (error instanceof AppError) {
    throw error;
  }
  if (isConstraintError(error)) {
    throw new AppError('CONSTRAINT', 'An active category with this name already exists.', {
      cause: error,
    });
  }
  return wrapDatabaseError(error, message);
}

export async function listActive(db: DbLike): Promise<Category[]> {
  try {
    const rows = await db.getAllAsync<CategoryRow>(
      'SELECT * FROM categories WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC'
    );
    return rows.map(mapCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load categories.');
  }
}

export async function listForHistory(db: DbLike): Promise<Category[]> {
  try {
    const rows = await db.getAllAsync<CategoryRow>(
      `SELECT c.* FROM categories c
       WHERE c.is_archived = 0 OR EXISTS (SELECT 1 FROM expenses e WHERE e.category_id = c.id)
       ORDER BY c.is_archived, c.sort_order, c.id`
    );
    return rows.map(mapCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load history categories.');
  }
}

export async function listAll(db: DbLike): Promise<Category[]> {
  try {
    const rows = await db.getAllAsync<CategoryRow>(
      'SELECT * FROM categories ORDER BY is_archived ASC, sort_order ASC, id ASC'
    );
    return rows.map(mapCategoryRow);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load categories.');
  }
}

export async function getById(db: DbLike, id: number): Promise<Category | null> {
  validateId(id);
  try {
    return await findById(db, id);
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to load category.');
  }
}

export async function create(db: DbLike, input: CreateCategoryInput): Promise<Category> {
  const name = normalizeName(input.name);
  const icon = normalizeIcon(input.icon);
  const color = normalizeColor(input.color);
  let createdCategory: Category | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const duplicate = await txn.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND is_archived = 0',
        [name]
      );
      if (duplicate) {
        throw new AppError('CONSTRAINT', 'An active category with this name already exists.');
      }

      const orderRow = await txn.getFirstAsync<{ next_order: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM categories
         WHERE is_archived = 0`
      );
      const result = await txn.runAsync(
        `INSERT INTO categories (name, icon, color, sort_order, is_archived, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [name, icon, color, orderRow?.next_order ?? 0, Date.now()]
      );
      createdCategory = await findById(txn, result.lastInsertRowId);
    });
  } catch (error) {
    throwCategoryWriteError(error, 'Unable to create category.');
  }

  if (!createdCategory) {
    throw new AppError('DB', 'Category was created but could not be read back.');
  }
  return createdCategory;
}

export async function update(
  db: DbLike,
  id: number,
  patch: UpdateCategoryPatch
): Promise<Category> {
  validateId(id);
  let updatedCategory: Category | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Category not found.');
      }

      const name = patch.name === undefined ? existing.name : normalizeName(patch.name);
      const icon = patch.icon === undefined ? existing.icon : normalizeIcon(patch.icon);
      const color = patch.color === undefined ? existing.color : normalizeColor(patch.color);
      if (name !== existing.name) {
        const duplicate = await txn.getFirstAsync<{ id: number }>(
          'SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND is_archived = 0 AND id != ?',
          [name, id]
        );
        if (duplicate) {
          throw new AppError('CONSTRAINT', 'An active category with this name already exists.');
        }
      }
      await txn.runAsync('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', [
        name,
        icon,
        color,
        id,
      ]);
      updatedCategory = await findById(txn, id);
    });
  } catch (error) {
    throwCategoryWriteError(error, 'Unable to update category.');
  }

  if (!updatedCategory) {
    throw new AppError('DB', 'Category was updated but could not be read back.');
  }
  return updatedCategory;
}

export async function reorder(db: DbLike, orderedIds: readonly number[]): Promise<Category[]> {
  orderedIds.forEach(validateId);
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new AppError('VALIDATION', 'Category order contains duplicate IDs.');
  }
  let reordered: Category[] = [];

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const activeRows = await txn.getAllAsync<CategoryRow>(
        'SELECT * FROM categories WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC'
      );
      const activeIds = activeRows.map((row) => row.id);
      const hasSameIds =
        activeIds.length === orderedIds.length &&
        activeIds.every((id) => orderedIds.includes(id));
      if (!hasSameIds) {
        throw new AppError('VALIDATION', 'Category order must include every active category once.');
      }

      for (const [sortOrder, id] of orderedIds.entries()) {
        await txn.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [sortOrder, id]);
      }
      const rows = await txn.getAllAsync<CategoryRow>(
        'SELECT * FROM categories WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC'
      );
      reordered = rows.map(mapCategoryRow);
    });
    return reordered;
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to reorder categories.');
  }
}

export async function archive(db: DbLike, id: number): Promise<Category> {
  validateId(id);
  let archived: Category | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Category not found.');
      }
      if (existing.isArchived) {
        archived = existing;
        return;
      }

      const countRow = await txn.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM categories WHERE is_archived = 0'
      );
      if ((countRow?.count ?? 0) <= 1) {
        throw new AppError('CONSTRAINT', 'At least one active category is required.');
      }

      await txn.runAsync('UPDATE categories SET is_archived = 1 WHERE id = ?', [id]);
      archived = await findById(txn, id);
    });
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to archive category.');
  }

  if (!archived) {
    throw new AppError('DB', 'Category was archived but could not be read back.');
  }
  return archived;
}

export async function unarchive(db: DbLike, id: number): Promise<Category> {
  validateId(id);
  let unarchived: Category | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Category not found.');
      }
      if (!existing.isArchived) {
        unarchived = existing;
        return;
      }

      const duplicate = await txn.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND is_archived = 0',
        [existing.name]
      );
      if (duplicate) {
        throw new AppError(
          'CONSTRAINT',
          'An active category with this name already exists.'
        );
      }

      const orderRow = await txn.getFirstAsync<{ next_order: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM categories
         WHERE is_archived = 0`
      );
      await txn.runAsync('UPDATE categories SET is_archived = 0, sort_order = ? WHERE id = ?', [
        orderRow?.next_order ?? 0,
        id,
      ]);
      unarchived = await findById(txn, id);
    });
  } catch (error) {
    throwCategoryWriteError(error, 'Unable to restore category.');
  }

  if (!unarchived) {
    throw new AppError('DB', 'Category was restored but could not be read back.');
  }
  return unarchived;
}

export async function deleteIfUnused(db: DbLike, id: number): Promise<Category> {
  validateId(id);
  let deleted: Category | null = null;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await findById(txn, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Category not found.');
      }
      const expenseCount = await txn.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM expenses WHERE category_id = ?',
        [id]
      );
      if ((expenseCount?.count ?? 0) > 0) {
        throw new AppError(
          'CONSTRAINT',
          'Category has expenses and must be archived instead of deleted.'
        );
      }

      await txn.runAsync('DELETE FROM categories WHERE id = ?', [id]);
      deleted = existing;
    });
  } catch (error) {
    return wrapDatabaseError(error, 'Unable to delete category.');
  }

  if (!deleted) {
    throw new AppError('DB', 'Category was deleted but its previous value was unavailable.');
  }
  return deleted;
}
