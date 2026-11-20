import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Toast from 'react-native-toast-message';

import type { Category } from '@/db/types';
import { copyAt, gastosCopy } from '@/features/entry/copy/gastosCopy';
import {
  amountDraftToCentavos,
  applyNumberPadKey,
  INITIAL_AMOUNT_DRAFT,
  type NumberPadKey,
} from '@/features/entry/utils/amountInput';
import { getRandomToastMessage } from '@/features/entry/utils/getRandomToastMessage';
import { successHaptic, warningHaptic } from '@/lib/haptics';
import { formatPeso } from '@/lib/money';
import * as expensesRepo from '@/repositories/expensesRepo';

const UNDO_WINDOW_MS = 5_000;

type UseExpenseEntryOptions = {
  onExpenseChanged: () => void | Promise<void>;
  now?: () => number;
  undoWindowMs?: number;
};

type UndoTarget = { id: number; expiresAt: number };

export function useExpenseEntry({
  onExpenseChanged,
  now = Date.now,
  undoWindowMs = UNDO_WINDOW_MS,
}: UseExpenseEntryOptions) {
  const db = useSQLiteContext();
  const [amountDraft, setAmountDraft] = useState(INITIAL_AMOUNT_DRAFT);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const savingRef = useRef(false);
  const undoingRef = useRef(false);
  const undoTargetRef = useRef<UndoTarget | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<(expectedExpenseId?: number) => Promise<void>>(async () => undefined);
  const mountedRef = useRef(true);
  const lastToastMessageByCategory = useRef(new Map<string, string>());
  const undoneCopyIndex = useRef(0);

  const expireUndo = useCallback(() => {
    undoTargetRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      expireUndo();
      Toast.hide();
    };
  }, [expireUndo]);

  const undo = useCallback(async (expectedExpenseId?: number) => {
    const target = undoTargetRef.current;
    if (target && expectedExpenseId !== undefined && target.id !== expectedExpenseId) {
      return;
    }
    if (!target || undoingRef.current || now() >= target.expiresAt) {
      expireUndo();
      Toast.hide();
      return;
    }
    undoingRef.current = true;
    try {
      await expensesRepo.remove(db, target.id);
      expireUndo();
      Toast.hide();
      if (!mountedRef.current) return;
      void onExpenseChanged();
      const undoneMessage = copyAt(gastosCopy.undone, undoneCopyIndex.current++);
      Toast.show({
        type: 'expenseSaved',
        text1: undoneMessage,
        text2: 'Expense removed',
        position: 'bottom',
        visibilityTime: 1_800,
        autoHide: true,
        props: { kind: 'info' },
      });
      void AccessibilityInfo.announceForAccessibility(undoneMessage);
    } catch {
      warningHaptic();
      if (!mountedRef.current) return;
      const message = 'Hindi ma-undo, boss. Try ulit.';
      setError(message);
      const remainingTime = Math.max(500, target.expiresAt - now());
      Toast.show({
        type: 'expenseSaved',
        text1: message,
        position: 'bottom',
        visibilityTime: remainingTime,
        autoHide: true,
        props: {
          kind: 'error',
          onUndo: () => undoRef.current(target.id),
        },
      });
    } finally {
      undoingRef.current = false;
    }
  }, [db, expireUndo, now, onExpenseChanged]);

  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  const saveForCategory = useCallback(
    async (category: Category) => {
      const amountCentavos = amountDraftToCentavos(amountDraft);
      if (savingRef.current) return;
      if (amountCentavos === null) {
        warningHaptic();
        const message = 'Bossing, magkano muna?';
        setError(message);
        Toast.show({
          type: 'expenseSaved',
          text1: message,
          position: 'bottom',
          visibilityTime: 2_000,
          autoHide: true,
          props: { kind: 'error' },
        });
        return;
      }

      savingRef.current = true;
      setIsSaving(true);
      setError(null);
      try {
        const expense = await expensesRepo.create(db, {
          amountCentavos,
          categoryId: category.id,
          note: note.trim() || null,
          createdAt: now(),
        });
        if (!mountedRef.current) return;
        expireUndo();
        const expiresAt = now() + undoWindowMs;
        undoTargetRef.current = { id: expense.id, expiresAt };
        undoTimerRef.current = setTimeout(expireUndo, undoWindowMs);
        setAmountDraft(INITIAL_AMOUNT_DRAFT);
        setNote('');
        setResetCount((count) => count + 1);
        successHaptic();
        void onExpenseChanged();
        const categoryKey = category.name.trim().toLowerCase() || '__custom__';
        const joke = getRandomToastMessage(
          category.name,
          lastToastMessageByCategory.current.get(categoryKey)
        );
        lastToastMessageByCategory.current.set(categoryKey, joke);
        const title = 'GASTOS LOGGED, BOSS!';
        const message = `${formatPeso(amountCentavos)} · ${category.name}`;
        Toast.show({
          type: 'expenseSaved',
          text1: title,
          text2: message,
          position: 'bottom',
          visibilityTime: undoWindowMs,
          autoHide: true,
          props: {
            accentColor: category.color,
            joke,
            kind: 'success',
            onUndo: () => undo(expense.id),
          },
        });
        void AccessibilityInfo.announceForAccessibility(`${title} ${message}. ${joke}`);
      } catch {
        warningHaptic();
        if (!mountedRef.current) return;
        const message = 'Hindi na-save, boss. Try ulit.';
        setError(message);
        Toast.show({
          type: 'expenseSaved',
          text1: message,
          position: 'bottom',
          visibilityTime: 2_500,
          autoHide: true,
          props: { kind: 'error' },
        });
      } finally {
        savingRef.current = false;
        if (mountedRef.current) setIsSaving(false);
      }
    }, [amountDraft, db, expireUndo, note, now, onExpenseChanged, undo, undoWindowMs]
  );

  const pressKey = useCallback((key: NumberPadKey) => {
    setError(null);
    setAmountDraft((current) => applyNumberPadKey(current, key));
  }, []);

  return { amountDraft, error, isSaving, note, pressKey, resetCount, saveForCategory, setNote, undo };
}
