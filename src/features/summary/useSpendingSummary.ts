import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { subscribeToExpenseChanges } from '@/lib/expenseChanges';
import { todayKey } from '@/lib/dates';

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

  const refresh = useCallback(async () => {
    if (!focused.current) return;
    const id = ++requestId.current;
    const day = todayKey();
    setState((previous) => ({
      period, day, status: 'loading',
      data: previous?.period === period && previous.day === day ? previous.data : null,
    }));
    try {
      const data = await loadSpendingSummary(db, period, day);
      if (id === requestId.current) setState({ period, day, data, status: 'ready' });
    } catch {
      if (id === requestId.current) setState({ period, day, data: null, status: 'error' });
    }
  }, [db, period]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        void refresh();
        scheduleMidnight();
      }, Math.max(100, tomorrow.getTime() - now.getTime() + 100));
    };
    void refresh();
    scheduleMidnight();
    const unsubscribe = subscribeToExpenseChanges(() => void refresh());
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        clearTimeout(timer);
        void refresh();
        scheduleMidnight();
      }
    });
    return () => {
      focused.current = false;
      requestId.current += 1;
      clearTimeout(timer);
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
