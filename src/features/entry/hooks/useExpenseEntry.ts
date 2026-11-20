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
  const invalidCopyIndex = useRef(0);
  const savedCopyIndex = useRef(0);
  const undoneCopyIndex = useRef(0);

  const expireUndo = useCallback(() => {
    undoTargetRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  }, []);

  useEffect(() => expireUndo, [expireUndo]);

  const undo = useCallback(async () => {
    const target = undoTargetRef.current;
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
      void onExpenseChanged();
      const undoneMessage = copyAt(gastosCopy.undone, undoneCopyIndex.current++);
      Toast.show({
        type: 'expenseSaved',
        text1: undoneMessage,
        text2: 'Expense removed',
        position: 'bottom',
        visibilityTime: 1_800,
        autoHide: true,
        props: {},
      });
      void AccessibilityInfo.announceForAccessibility(undoneMessage);
    } catch {
      warningHaptic();
      setError('Could not undo. Please try again.');
    } finally {
      undoingRef.current = false;
    }
  }, [db, expireUndo, now, onExpenseChanged]);

  const saveForCategory = useCallback(
    async (category: Category) => {
      const amountCentavos = amountDraftToCentavos(amountDraft);
      if (savingRef.current) return;
      if (amountCentavos === null) {
        warningHaptic();
        setError(copyAt(gastosCopy.invalidAmount, invalidCopyIndex.current++));
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
        expireUndo();
        const expiresAt = now() + undoWindowMs;
        undoTargetRef.current = { id: expense.id, expiresAt };
        undoTimerRef.current = setTimeout(expireUndo, undoWindowMs);
        setAmountDraft(INITIAL_AMOUNT_DRAFT);
        setNote('');
        setResetCount((count) => count + 1);
        successHaptic();
        void onExpenseChanged();
        const title = copyAt(gastosCopy.saved, savedCopyIndex.current++);
        const message = `${formatPeso(amountCentavos)} saved to ${category.name}`;
        Toast.show({
          type: 'expenseSaved',
          text1: title,
          text2: message,
          position: 'bottom',
          visibilityTime: undoWindowMs,
          autoHide: true,
          props: { onUndo: undo },
        });
        void AccessibilityInfo.announceForAccessibility(`${title} ${message}`);
      } catch (saveError) {
        warningHaptic();
        setError(saveError instanceof Error ? saveError.message : 'Could not save expense.');
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    }, [amountDraft, db, expireUndo, note, now, onExpenseChanged, undo, undoWindowMs]
  );

  const pressKey = useCallback((key: NumberPadKey) => {
    setError(null);
    setAmountDraft((current) => applyNumberPadKey(current, key));
  }, []);

  return { amountDraft, error, isSaving, note, pressKey, resetCount, saveForCategory, setNote, undo };
}
