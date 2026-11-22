import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ExpenseWithCategory } from '@/db/types';
import { subscribeToExpenseChanges } from '@/lib/expenseChanges';
import { useDeleteExpense } from '@/features/history/hooks/useDeleteExpense';
import { groupExpensesByDay } from '@/features/history/utils/groupExpensesByDay';
import * as expensesRepo from '@/repositories/expensesRepo';

const PAGE_SIZE = 30;

async function totalsForRows(
  db: ReturnType<typeof useSQLiteContext>,
  rows: readonly ExpenseWithCategory[],
  filters?: expensesRepo.ExpenseHistoryFilters,
  loadedTotals?: ReadonlyMap<string, number>
): Promise<Map<string, number>> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!loadedTotals?.has(row.localDay)) keys.add(row.localDay);
  }
  if (keys.size === 0) return new Map();
  const summaries = await expensesRepo.sumByDayKeys(db, [...keys], filters);
  return new Map(summaries.map((summary) => [summary.day, summary.totalCentavos]));
}

export function useExpenseHistory(
  now: () => number = Date.now,
  filters?: expensesRepo.ExpenseHistoryFilters
) {
  const db = useSQLiteContext();
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [totalsByDay, setTotalsByDay] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const refreshingRef = useRef(false);
  const [loadedCriteria, setLoadedCriteria] = useState(() => ({ filters }));
  const criteriaPending = loadedCriteria.filters !== filters;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersionRef.current;
    refreshingRef.current = true;
    loadingMoreRef.current = false;
    setError(null);
    setPaginationError(null);
    setIsLoadingMore(false);
    setIsRefreshing(true);

    try {
      const rows = await expensesRepo.listPage(db, { limit: PAGE_SIZE, ...(filters && { filters }) });
      const totals = await totalsForRows(db, rows, filters);
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      setExpenses(rows);
      setTotalsByDay(totals);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (mountedRef.current && version === requestVersionRef.current) {
        setExpenses([]);
        setTotalsByDay(new Map());
        setHasMore(false);
        setError('Hindi ma-load ang gastos, boss.');
      }
    } finally {
      if (mountedRef.current && version === requestVersionRef.current) {
        refreshingRef.current = false;
        setLoadedCriteria({ filters });
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [db, filters]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return subscribeToExpenseChanges(() => void refresh());
  }, [refresh]));

  const loadMore = useCallback(async () => {
    if (criteriaPending || refreshingRef.current || loadingMoreRef.current || !hasMore || expenses.length === 0) return;
    const cursorExpense = expenses.at(-1);
    if (!cursorExpense) return;
    const version = requestVersionRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setPaginationError(null);

    try {
      const rows = await expensesRepo.listPage(db, {
        limit: PAGE_SIZE,
        cursor: { createdAt: cursorExpense.createdAt, id: cursorExpense.id },
        ...(filters && { filters }),
      });
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      const existingIds = new Set(expenses.map((expense) => expense.id));
      const merged = [...expenses, ...rows.filter((row) => !existingIds.has(row.id))];
      const totals = await totalsForRows(db, rows, filters, totalsByDay);
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      setExpenses(merged);
      if (totals.size > 0) setTotalsByDay((previous) => new Map([...previous, ...totals]));
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (mountedRef.current && version === requestVersionRef.current) {
        setPaginationError('Hindi ma-load ang iba pang gastos.');
      }
    } finally {
      if (mountedRef.current && version === requestVersionRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [criteriaPending, db, expenses, filters, hasMore, totalsByDay]);

  const { deleteExpense, undoDelete } = useDeleteExpense({ now });

  const sections = useMemo(
    () => groupExpensesByDay(expenses, totalsByDay, now()),
    [expenses, now, totalsByDay]
  );

  return {
    deleteExpense,
    error,
    expenses: criteriaPending ? [] : expenses,
    hasMore,
    isLoading: isLoading || criteriaPending,
    isLoadingMore,
    isRefreshing,
    loadMore,
    paginationError,
    refresh,
    sections: criteriaPending ? [] : sections,
    undoDelete,
  };
}
