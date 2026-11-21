let sequence = 0;
let activeToken: number | null = null;
const completionListeners = new Set<() => void>();

export function beginUndoOperation(): number {
  sequence += 1;
  activeToken = sequence;
  return sequence;
}

export function isUndoOperationActive(token: number): boolean {
  return activeToken === token;
}

export function hasActiveUndoOperation(): boolean {
  return activeToken !== null;
}

export function subscribeToUndoCompletion(listener: () => void): () => void {
  completionListeners.add(listener);
  return () => { completionListeners.delete(listener); };
}

export function finishUndoOperation(token: number): void {
  if (activeToken !== token) return;
  activeToken = null;
  for (const listener of completionListeners) listener();
}

export function invalidateUndoOperations(): void {
  sequence += 1;
  activeToken = null;
  for (const listener of completionListeners) listener();
}
