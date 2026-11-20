import Toast, { type ToastConfig } from 'react-native-toast-message';

import { ExpenseToast } from '@/components/ExpenseToast';
import { layout, spacing } from '@/theme/tokens';

const toastConfig: ToastConfig = {
  expenseSaved: ({ text1, text2, props }) => (
    <ExpenseToast
      title={text1 ?? 'SOLID, BOSSING!'}
      message={text2 ?? ''}
      onUndo={props.onUndo}
    />
  ),
};

export function AppToast() {
  return <Toast config={toastConfig} bottomOffset={layout.tabBarHeight + spacing.lg} />;
}
