import { StyleSheet, Text } from 'react-native';

import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function GastosHeader() {
  const { colors } = useAppTheme();
  return <Text style={[styles.tagline, { color: colors.textMuted }]}>{gastosCopy.greetings[0]}</Text>;
}

const styles = StyleSheet.create({
  tagline: { ...typography.label, letterSpacing: 1.1 },
});
