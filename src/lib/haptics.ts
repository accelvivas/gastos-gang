import * as Haptics from 'expo-haptics';

function safely(run: () => Promise<void>): void {
  void run().catch(() => undefined);
}

export function tapHaptic(): void {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function successHaptic(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningHaptic(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
