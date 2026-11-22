import type { DbLike } from '@/db/client';

import { reconcileNotifications } from './nativeReminders';
import { processRecurring } from './repository';

type Result = { backlog: boolean; reminderError: boolean };
const work = new WeakMap<DbLike, { pending: boolean; task: Promise<Result> }>();
const results = new WeakMap<DbLike, Result>();
const listeners = new Set<() => void>();
const replacedData = new WeakSet<DbLike>();
const initial = { backlog: false, reminderError: false };

export function recurringStatus(db: DbLike) {
  return results.get(db) ?? initial;
}

export function subscribeRecurringStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reconcileAfterRestore(db: DbLike) {
  replacedData.add(db);
  return refreshRecurring(db);
}

export function refreshRecurring(db: DbLike): Promise<Result> {
  const current = work.get(db);
  if (current) {
    current.pending = true;
    return current.task;
  }
  const entry = {
    pending: true,
    task: Promise.resolve().then(async () => {
      let result = initial;
      while (entry.pending) {
        entry.pending = false;
        const backlog = await processRecurring(db);
        let reminderError = false;
        try {
          const replace = replacedData.delete(db);
          await reconcileNotifications(db, Date.now(), replace);
        } catch {
          reminderError = true;
        }
        result = { backlog, reminderError };
        results.set(db, result);
        for (const listener of listeners) listener();
      }
      return result;
    }).finally(() => work.delete(db)),
  };
  work.set(db, entry);
  return entry.task;
}
