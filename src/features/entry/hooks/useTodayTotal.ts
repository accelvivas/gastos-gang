import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '@/lib/dates';
import { subscribeToExpenseChanges } from '@/lib/expenseChanges';
import * as expensesRepo from '@/repositories/expensesRepo';

function millisecondsUntilTomorrow(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1_000, tomorrow.getTime() - now.getTime() + 100);
}

export function useTodayTotal() {
  const db = useSQLiteContext();
  const [totalCentavos, setTotalCentavos] = useState(0);
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setError(null);
    try {
      const currentDayKey = todayKey();
      const total = await expensesRepo.totalForDay(db, currentDayKey);
      if (currentRequest === requestId.current) {
        setDayKey(currentDayKey);
        setTotalCentavos(total);
      }
    } catch {
      if (currentRequest === requestId.current) setError("Today's total is unavailable.");
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => void refresh(), [refresh]));
  useEffect(() => subscribeToExpenseChanges(() => void refresh()), [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        void refresh();
        schedule();
      }, millisecondsUntilTomorrow());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [refresh]);

  return { dayKey, error, isLoading, refresh, totalCentavos };
}
