import Toast from 'react-native-toast-message';

import {
  hasActiveUndoOperation,
  subscribeToUndoCompletion,
} from '@/lib/undoCoordinator';

let pendingMessage: string | null = null;
let unsubscribe: (() => void) | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingWarning() {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;

  if (!pendingMessage) return;
  if (hasActiveUndoOperation()) {
    waitForUndoCompletion();
    return;
  }

  const message = pendingMessage;
  pendingMessage = null;
  Toast.show({
    type: 'expenseSaved',
    text1: message,
    visibilityTime: 2_800,
    autoHide: true,
    props: { kind: 'error' },
  });
}

function waitForUndoCompletion() {
  if (unsubscribe) return;
  unsubscribe = subscribeToUndoCompletion(() => {
    unsubscribe?.();
    unsubscribe = null;
    releaseTimer = setTimeout(flushPendingWarning, 1_900);
  });
}

export function showBudgetWarning(message: string) {
  pendingMessage = message;
  if (hasActiveUndoOperation()) {
    waitForUndoCompletion();
    return;
  }
  flushPendingWarning();
}

export function clearPendingBudgetWarning(): void {
  pendingMessage = null;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
}
