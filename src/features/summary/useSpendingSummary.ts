import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { subscribeToExpenseChanges } from '@/lib/expenseChanges';
import { todayKey } from '@/lib/dates';
import { getNextFutureExpenseTimestamp } from '@/repositories/expensesRepo';

import { loadSpendingSummary, type SpendingSummary } from './summaryData';
import type { SummaryPeriod } from './summaryPeriods';

type RequestState = {
  period: SummaryPeriod;
  day: string;
  data: SpendingSummary | null;
  status: 'loading' | 'ready' | 'error';
};

export function useSpendingSummary() {
  const db = useSQLiteContext();
  const [period, setPeriod] = useState<SummaryPeriod>('week');
  const [state, setState] = useState<RequestState | null>(null);
  const requestId = useRef(0);
  const focused = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<() => void>(() => undefined);

  const refresh = useCallback(async () => {
    if (!focused.current) return;
    const id = ++requestId.current;
    const cutoffMs = Date.now();
    const day = todayKey(cutoffMs);
    setState((previous) => ({
      period, day, status: 'loading',
      data: previous?.period === period && previous.day === day ? previous.data : null,
    }));
    try {
      const data = await loadSpendingSummary(db, period, day, cutoffMs);
      if (id === requestId.current) {
        setState({ period, day, data, status: 'ready' });
        const nextFuture = await getNextFutureExpenseTimestamp(db, data.ranges.current, cutoffMs);
        if (id !== requestId.current) return;
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        const now = new Date(cutoffMs);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const midnightDelay = Math.max(100, tomorrow.getTime() - cutoffMs + 100);
        const futureDelay = nextFuture === null ? null : Math.max(1, nextFuture - cutoffMs);
        const delay = futureDelay === null ? midnightDelay : Math.min(midnightDelay, futureDelay);
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null;
          refreshRef.current();
        }, delay);
      }
    } catch {
      if (id === requestId.current) setState({ period, day, data: null, status: 'error' });
    }
  }, [db, period]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const unsubscribe = subscribeToExpenseChanges(() => void refresh());
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
        void refresh();
      }
    });
    return () => {
      focused.current = false;
      requestId.current += 1;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      unsubscribe();
      appState.remove();
    };
  }, [refresh]));

  const visible = state?.period === period ? state : null;
  return {
    period, setPeriod, refresh,
    data: visible?.data ?? null,
    status: visible?.status ?? 'loading',
  };
}
