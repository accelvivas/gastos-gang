import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import Toast from 'react-native-toast-message';

import type { Expense, ExpenseWithCategory } from '@/db/types';
import { notifyExpenseChange } from '@/lib/expenseChanges';
import {
  beginUndoOperation,
  finishUndoOperation,
  isUndoOperationActive,
} from '@/lib/undoCoordinator';
import { formatPeso } from '@/lib/money';
import * as expensesRepo from '@/repositories/expensesRepo';

const UNDO_WINDOW_MS = 5_000;

type DeleteUndoTarget = {
  expense: Expense;
  categoryName: string;
  categoryColor: string;
  expiresAt: number;
  token: number;
};

type UseDeleteExpenseOptions = {
  now?: () => number;
  onChanged: () => void | Promise<void>;
};

export function useDeleteExpense({ now = Date.now, onChanged }: UseDeleteExpenseOptions) {
  const db = useSQLiteContext();
  const mountedRef = useRef(true);
  const deletingIdsRef = useRef(new Set<number>());
  const restoringRef = useRef(false);
  const undoTargetRef = useRef<DeleteUndoTarget | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<(id: number, token: number) => Promise<void>>(async () => undefined);

  const expireUndo = useCallback(() => {
    const target = undoTargetRef.current;
    if (target) finishUndoOperation(target.token);
    undoTargetRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const ownsToast = Boolean(
        undoTargetRef.current && isUndoOperationActive(undoTargetRef.current.token)
      );
      expireUndo();
      if (ownsToast) Toast.hide();
    };
  }, [expireUndo]);

  const undoDelete = useCallback(
    async (expectedId: number, expectedToken: number) => {
      const target = undoTargetRef.current;
      if (
        !target ||
        target.expense.id !== expectedId ||
        target.token !== expectedToken ||
        !isUndoOperationActive(target.token) ||
        restoringRef.current
      ) return;
      if (now() >= target.expiresAt) {
        expireUndo();
        Toast.hide();
        return;
      }

      restoringRef.current = true;
      try {
        await expensesRepo.restore(db, target.expense);
        notifyExpenseChange();
        const ownsToast = isUndoOperationActive(target.token);
        if (undoTargetRef.current?.token === target.token) expireUndo();
        if (!mountedRef.current) return;
        if (ownsToast) {
          Toast.show({
            type: 'expenseSaved',
            text1: 'BAWI TAYO, BOSSING!',
            text2: `${formatPeso(target.expense.amountCentavos)} · ${target.categoryName}`,
            visibilityTime: 1_800,
            autoHide: true,
            props: { kind: 'info', accentColor: target.categoryColor },
          });
        }
        try {
          await onChanged();
        } catch {
          // The mutation succeeded; focus refresh will reconcile a transient read failure.
        }
        void AccessibilityInfo.announceForAccessibility('Bawi tayo, bossing! Expense restored.');
      } catch {
        if (!mountedRef.current || !isUndoOperationActive(target.token)) return;
        const remaining = Math.max(500, target.expiresAt - now());
        Toast.show({
          type: 'expenseSaved',
          text1: 'Hindi maibalik, boss. Try ulit.',
          visibilityTime: remaining,
          autoHide: true,
          props: {
            kind: 'error',
            onUndo: () => undoRef.current(target.expense.id, target.token),
            undoAccessibilityLabel: 'Retry restoring deleted expense',
          },
        });
      } finally {
        restoringRef.current = false;
      }
    },
    [db, expireUndo, now, onChanged]
  );

  useEffect(() => {
    undoRef.current = undoDelete;
  }, [undoDelete]);

  const deleteExpense = useCallback(
    async (expense: ExpenseWithCategory): Promise<boolean> => {
      if (deletingIdsRef.current.has(expense.id)) return false;
      deletingIdsRef.current.add(expense.id);
      try {
        const deleted = await expensesRepo.remove(db, expense.id);
        notifyExpenseChange();
        if (!mountedRef.current) return true;
        expireUndo();
        const token = beginUndoOperation();
        undoTargetRef.current = {
          expense: deleted,
          categoryName: expense.categoryName,
          categoryColor: expense.categoryColor,
          expiresAt: now() + UNDO_WINDOW_MS,
          token,
        };
        undoTimerRef.current = setTimeout(expireUndo, UNDO_WINDOW_MS);
        Toast.show({
          type: 'expenseSaved',
          text1: 'NABURA NA, BOSS!',
          text2: `${formatPeso(expense.amountCentavos)} · ${expense.categoryName}`,
          visibilityTime: UNDO_WINDOW_MS,
          autoHide: true,
          props: {
            kind: 'info',
            joke: 'Ayos lang, may second chance!',
            accentColor: expense.categoryColor,
            onUndo: () => undoRef.current(expense.id, token),
            undoAccessibilityLabel: 'Undo deleted expense',
          },
        });
        try {
          await onChanged();
        } catch {
          // The deletion succeeded; do not misreport it because a follow-up read failed.
        }
        return true;
      } catch {
        if (mountedRef.current) {
          Toast.show({
            type: 'expenseSaved',
            text1: 'Hindi na-delete, boss. Try ulit.',
            visibilityTime: 2_500,
            autoHide: true,
            props: { kind: 'error' },
          });
        }
        return false;
      } finally {
        deletingIdsRef.current.delete(expense.id);
      }
    },
    [db, expireUndo, now, onChanged]
  );

  return { deleteExpense, undoDelete };
}
