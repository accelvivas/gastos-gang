import { StyleSheet, Text } from 'react-native';

import { spacing, streetColors, typography } from '@/theme/tokens';

export function EntryFooter() {
  return <Text style={styles.footer}>⚡ ONE TAP. GASTOS LOGGED. NEXT!</Text>;
}

const styles = StyleSheet.create({
  footer: { ...typography.label, marginVertical: spacing.md, color: streetColors.muted, textAlign: 'center', letterSpacing: 0.8 },
});
