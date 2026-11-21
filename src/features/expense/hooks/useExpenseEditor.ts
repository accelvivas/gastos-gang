import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Toast from 'react-native-toast-message';

import type { Category, Expense } from '@/db/types';
import {
  amountDraftToCentavos,
  applyNumberPadKey,
  centavosToAmountDraft,
  type NumberPadKey,
} from '@/features/entry/utils/amountInput';
import { notifyExpenseChange, subscribeToCategoryChanges } from '@/lib/expenseChanges';
import * as categoriesRepo from '@/repositories/categoriesRepo';
import * as expensesRepo from '@/repositories/expensesRepo';

export type ExpenseEditorStatus = 'loading' | 'ready' | 'not-found' | 'error';

function validLocalDate(date: Date): boolean {
  return Number.isSafeInteger(date.getTime()) && !Number.isNaN(date.getTime());
}

export function mergeLocalDate(currentMs: number, selected: Date): number | null {
  const current = new Date(currentMs);
  const merged = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
    current.getHours(),
    current.getMinutes(),
    current.getSeconds(),
    current.getMilliseconds()
  );
  if (
    !validLocalDate(merged) ||
    merged.getFullYear() !== selected.getFullYear() ||
    merged.getMonth() !== selected.getMonth() ||
    merged.getDate() !== selected.getDate()
  ) return null;
  return merged.getTime();
}

export function mergeLocalTime(currentMs: number, selected: Date): number | null {
  const current = new Date(currentMs);
  const merged = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    selected.getHours(),
    selected.getMinutes(),
    0,
    0
  );
  if (
    !validLocalDate(merged) ||
    merged.getFullYear() !== current.getFullYear() ||
    merged.getMonth() !== current.getMonth() ||
    merged.getDate() !== current.getDate() ||
    merged.getHours() !== selected.getHours() ||
    merged.getMinutes() !== selected.getMinutes()
  ) return null;
  return merged.getTime();
}

export function useExpenseEditor(id: number | null) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<ExpenseEditorStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amountDraft, setAmountDraft] = useState('0');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [createdAt, setCreatedAt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const load = useCallback(async () => {
    await Promise.resolve();
    if (id === null) {
      setStatus('not-found');
      setLoadError('Invalid expense ID.');
      return;
    }
    setStatus('loading');
    setLoadError(null);
    try {
      const [loadedExpense, allCategories] = await Promise.all([
        expensesRepo.getById(db, id),
        categoriesRepo.listAll(db),
      ]);
      if (!mountedRef.current) return;
      if (!loadedExpense) {
        setStatus('not-found');
        return;
      }
      const selectable = allCategories.filter(
        (category) => !category.isArchived || category.id === loadedExpense.categoryId
      );
      setExpense(loadedExpense);
      setCategories(selectable);
      setAmountDraft(centavosToAmountDraft(loadedExpense.amountCentavos));
      setCategoryId(loadedExpense.categoryId);
      setNote(loadedExpense.note ?? '');
      setCreatedAt(loadedExpense.createdAt);
      setValidationError(null);
      setStatus('ready');
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
      setLoadError('Hindi ma-load ang gastos, boss.');
    }
  }, [db, id]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => subscribeToCategoryChanges(() => {
    void categoriesRepo.listAll(db).then((allCategories) => {
      if (!mountedRef.current) return;
      setCategories(allCategories.filter(
        (category) => !category.isArchived || category.id === categoryId
      ));
    });
  }), [categoryId, db]);

  const amountCentavos = amountDraftToCentavos(amountDraft);
  const normalizedNote = note.trim() || null;
  const hasChanges = Boolean(
    expense &&
      (amountCentavos !== expense.amountCentavos ||
        categoryId !== expense.categoryId ||
        normalizedNote !== expense.note ||
        createdAt !== expense.createdAt)
  );

  const pressAmountKey = useCallback((key: NumberPadKey) => {
    setValidationError(null);
    setAmountDraft((current) => applyNumberPadKey(current, key));
  }, []);

  const setDate = useCallback((selected: Date) => {
    setCreatedAt((current) => mergeLocalDate(current, selected) ?? current);
  }, []);

  const setTime = useCallback((selected: Date) => {
    setCreatedAt((current) => mergeLocalTime(current, selected) ?? current);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!expense || savingRef.current) return false;
    const nextAmount = amountDraftToCentavos(amountDraft);
    if (nextAmount === null || nextAmount <= 0) {
      setValidationError('Maglagay ng amount na higit sa zero.');
      return false;
    }
    if (categoryId === null) {
      setValidationError('Pumili ng category, boss.');
      return false;
    }
    if (note.trim().length > 200) {
      setValidationError('Hanggang 200 characters lang ang note.');
      return false;
    }
    savingRef.current = true;
    setIsSaving(true);
    setValidationError(null);
    try {
      const updated = await expensesRepo.update(db, expense.id, {
        amountCentavos: nextAmount,
        categoryId,
        note: note.trim() || null,
        createdAt,
      });
      notifyExpenseChange();
      if (!mountedRef.current) return true;
      setExpense(updated);
      Toast.show({
        type: 'expenseSaved',
        text1: 'AYOS, BOSSING! UPDATED NA.',
        visibilityTime: 1_800,
        autoHide: true,
        props: { kind: 'success' },
      });
      void AccessibilityInfo.announceForAccessibility('Expense updated.');
      return true;
    } catch {
      if (mountedRef.current) {
        setValidationError('Hindi na-update, boss. Nandito pa ang edits mo.');
      }
      return false;
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }, [amountDraft, categoryId, createdAt, db, expense, note]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  return {
    amountDraft,
    categories,
    categoryId,
    createdAt,
    expense,
    hasChanges,
    isSaving,
    load,
    loadError,
    note,
    pressAmountKey,
    save,
    selectedCategory,
    setCategoryId,
    setDate,
    setNote,
    setTime,
    status,
    validationError,
  };
}
