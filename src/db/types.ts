export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: number;
};

export type Expense = {
  id: number;
  amountCentavos: number;
  categoryId: number;
  note: string | null;
  createdAt: number;
  localDay: string;
  updatedAt: number;
  recurringOccurrence?: { scheduleId: number; dueDay: string };
};

export type ExpenseWithCategory = Expense & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  categoryIsArchived: boolean;
  recurringSource?: 'auto' | 'paid';
};

export type ExportExpense = ExpenseWithCategory;

export type CategoryRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_archived: number;
  created_at: number;
};

export type ExpenseRow = {
  id: number;
  amount_centavos: number;
  category_id: number;
  note: string | null;
  created_at: number;
  local_day: string;
  updated_at: number;
};

export type ExpenseWithCategoryRow = ExpenseRow & {
  category_name: string;
  category_icon: string;
  category_color: string;
  category_is_archived: number;
  recurring_source?: 'auto' | 'paid' | null;
};

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
  };
}

export function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amountCentavos: row.amount_centavos,
    categoryId: row.category_id,
    note: row.note,
    createdAt: row.created_at,
    localDay: row.local_day,
    updatedAt: row.updated_at,
  };
}

export function mapExpenseWithCategoryRow(row: ExpenseWithCategoryRow): ExpenseWithCategory {
  return {
    ...mapExpenseRow(row),
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    categoryIsArchived: row.category_is_archived === 1,
    ...(row.recurring_source ? { recurringSource: row.recurring_source } : {}),
  };
}
