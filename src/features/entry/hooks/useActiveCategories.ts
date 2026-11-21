import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import type { Category } from '@/db/types';
import { subscribeToCategoryChanges } from '@/lib/expenseChanges';
import * as categoriesRepo from '@/repositories/categoriesRepo';

export function useActiveCategories() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setError(null);
    try {
      const rows = await categoriesRepo.listActive(db);
      if (currentRequest === requestId.current) {
        setCategories(rows.filter((category) => !category.isArchived));
      }
    } catch {
      if (currentRequest === requestId.current) {
        setError('Could not load categories.');
      }
    } finally {
      if (currentRequest === requestId.current) {
        setIsLoading(false);
      }
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const unsubscribe = subscribeToCategoryChanges(() => void refresh());
    return () => {
      requestId.current += 1;
      unsubscribe();
    };
  }, [refresh]));

  return { categories, error, isLoading, refresh };
}
