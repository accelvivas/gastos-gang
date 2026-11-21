import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '@/lib/dates';
import {
  subscribeToBudgetChanges,
  subscribeToDataReplacement,
  subscribeToExpenseChanges,
} from '@/lib/expenseChanges';
import * as expensesRepo from '@/repositories/expensesRepo';
import * as settingsRepo from '@/repositories/settingsRepo';
import {
  getBudgetWarningMessage,
  getDailyBudgetProgress,
  type BudgetStage,
} from '@/features/entry/utils/dailyBudget';
import { showBudgetWarning } from '@/features/entry/budgetWarnings';

function nextLocalMidnightTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime() + 100;
}

export function useTodayTotal() {
  const db = useSQLiteContext();
  const [totalCentavos, setTotalCentavos] = useState(0);
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetLimitCentavos, setBudgetLimitCentavos] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const previousBudgetState = useRef<{
    dayKey: string;
    enabled: boolean;
    limitCentavos: number | null;
    stage: BudgetStage | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
    setError(null);
    setNextRefreshAt(null);
    try {
      const cutoffMs = Date.now();
      const currentDayKey = todayKey();
      const [total, budget, nextFutureTimestamp] = await Promise.all([
        expensesRepo.totalForDayAt(db, currentDayKey, cutoffMs),
        settingsRepo.getDailyBudget(db),
        expensesRepo.getNextFutureExpenseTimestamp(
          db,
          { fromKey: currentDayKey, toKey: currentDayKey },
          cutoffMs
        ),
      ]);
      if (currentRequest !== requestId.current) return;
      const progress = budget.enabled && budget.limitCentavos !== null
        ? getDailyBudgetProgress(total, budget.limitCentavos)
        : null;
      const previous = previousBudgetState.current;
      const message = getBudgetWarningMessage(previous, {
        dayKey: currentDayKey,
        enabled: budget.enabled,
        stage: progress?.stage ?? null,
      });
      if (message) {
        showBudgetWarning(message);
      }
      previousBudgetState.current = {
        dayKey: currentDayKey,
        enabled: budget.enabled,
        limitCentavos: budget.limitCentavos,
        stage: progress?.stage ?? null,
      };
      setBudgetEnabled(budget.enabled);
      setBudgetLimitCentavos(budget.limitCentavos);
      const nextAt = nextFutureTimestamp === null
        ? nextLocalMidnightTimestamp()
        : Math.min(nextLocalMidnightTimestamp(), nextFutureTimestamp);
      setNextRefreshAt(nextAt);
      if (currentRequest === requestId.current) {
        setDayKey(currentDayKey);
        setTotalCentavos(total);
      }
    } catch {
      if (currentRequest === requestId.current) {
        setError("Today's total is unavailable.");
        setNextRefreshAt(nextLocalMidnightTimestamp());
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const unsubscribeExpense = subscribeToExpenseChanges(() => void refresh());
    const unsubscribeBudget = subscribeToBudgetChanges(() => void refresh());
    const unsubscribeReplacement = subscribeToDataReplacement(() => {
      previousBudgetState.current = null;
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      requestId.current += 1;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      unsubscribeExpense();
      unsubscribeBudget();
      unsubscribeReplacement();
      subscription.remove();
    };
  }, [refresh]));

  useEffect(() => {
    if (nextRefreshAt === null) return;
    const timer = setTimeout(
      () => {
        if (refreshTimer.current === timer) refreshTimer.current = null;
        void refresh();
      },
      Math.max(1, nextRefreshAt - Date.now())
    );
    refreshTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (refreshTimer.current === timer) refreshTimer.current = null;
    };
  }, [nextRefreshAt, refresh]);

  useEffect(() => {
    return () => { requestId.current += 1; };
  }, []);

  const budgetProgress = useMemo(
    () => budgetEnabled && budgetLimitCentavos !== null
      ? getDailyBudgetProgress(totalCentavos, budgetLimitCentavos)
      : null,
    [budgetEnabled, budgetLimitCentavos, totalCentavos]
  );
  return {
    budgetEnabled,
    budgetLimitCentavos,
    budgetProgress,
    dayKey,
    error,
    isLoading,
    refresh,
    totalCentavos,
  };
}
