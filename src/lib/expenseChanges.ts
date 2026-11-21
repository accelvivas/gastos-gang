const listeners = new Set<() => void>();
const categoryListeners = new Set<() => void>();
const budgetListeners = new Set<() => void>();
const replacementListeners = new Set<() => void>();

export function subscribeToExpenseChanges(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyExpenseChange() {
  for (const listener of listeners) listener();
}

export function subscribeToCategoryChanges(listener: () => void) {
  categoryListeners.add(listener);
  return () => { categoryListeners.delete(listener); };
}

export function notifyCategoryChange() {
  for (const listener of categoryListeners) listener();
  notifyExpenseChange();
}

export function subscribeToBudgetChanges(listener: () => void) {
  budgetListeners.add(listener);
  return () => { budgetListeners.delete(listener); };
}

export function notifyBudgetChange() {
  for (const listener of budgetListeners) listener();
}

export function subscribeToDataReplacement(listener: () => void) {
  replacementListeners.add(listener);
  return () => { replacementListeners.delete(listener); };
}

export function notifyDataReplaced() {
  for (const listener of replacementListeners) listener();
  notifyCategoryChange();
  notifyBudgetChange();
}
