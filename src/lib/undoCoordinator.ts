let sequence = 0;
let activeToken: number | null = null;

export function beginUndoOperation(): number {
  sequence += 1;
  activeToken = sequence;
  return sequence;
}

export function isUndoOperationActive(token: number): boolean {
  return activeToken === token;
}

export function finishUndoOperation(token: number): void {
  if (activeToken === token) activeToken = null;
}
