import Toast, { type ToastConfig } from 'react-native-toast-message';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseToast } from '@/components/ExpenseToast';
import { layout, spacing } from '@/theme/tokens';

const toastConfig: ToastConfig = {
  expenseSaved: ({ text1, text2, props }) => (
    <ExpenseToast
      title={text1 ?? 'SOLID, BOSSING!'}
      message={text2 ?? ''}
      joke={props.joke}
      accentColor={props.accentColor}
      kind={props.kind}
      onUndo={props.onUndo}
    />
  ),
};

export function AppToast() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Toast
      animationConfig={{
        enter: { type: 'timing', duration: reduceMotion ? 0 : 220 },
        exit: { type: 'timing', duration: reduceMotion ? 0 : 180 },
      }}
      config={toastConfig}
      position="bottom"
      bottomOffset={layout.tabBarHeight + insets.bottom + spacing.md}
    />
  );
}
