const listeners = new Set<() => void>();

export function subscribeToExpenseChanges(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyExpenseChange() {
  for (const listener of listeners) listener();
}
