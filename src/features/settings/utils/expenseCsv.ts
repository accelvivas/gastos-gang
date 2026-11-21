import type { ExportExpense } from '@/db/types';

export const EXPENSE_CSV_HEADER =
  'id,date,time,category,amount_php,amount_centavos,note,created_at_iso,updated_at_iso';
export const UTF8_BOM = '\uFEFF';

const FORMULA_PREFIX = /^[\s\u0000-\u001F\u007F-\u009F]*[=+\-@]/u;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function safeCsvText(value: string): string {
  const safeValue = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function formatLocalTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Expense timestamp is invalid.');
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatIsoTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Expense timestamp is invalid.');
  }
  return date.toISOString();
}

function formatAmountPesos(amountCentavos: number): string {
  if (!Number.isSafeInteger(amountCentavos)) {
    throw new RangeError('Expense amount must be a safe integer in centavos.');
  }
  const pesos = Math.floor(amountCentavos / 100);
  const centavos = Math.abs(amountCentavos % 100);
  return `${pesos}.${String(centavos).padStart(2, '0')}`;
}

export function formatExpenseCsvRow(expense: ExportExpense): string {
  const cells = [
    String(expense.id),
    expense.localDay,
    formatLocalTime(expense.createdAt),
    expense.categoryName,
    formatAmountPesos(expense.amountCentavos),
    String(expense.amountCentavos),
    expense.note ?? '',
    formatIsoTimestamp(expense.createdAt),
    formatIsoTimestamp(expense.updatedAt),
  ];
  return cells.map(safeCsvText).join(',');
}

export function formatExpenseCsv(expenses: readonly ExportExpense[]): string {
  const rows = expenses.map(formatExpenseCsvRow);
  return `${UTF8_BOM}${EXPENSE_CSV_HEADER}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}
