import { StyleSheet, Text } from 'react-native';

import { gastosCopy } from '@/features/entry/copy/gastosCopy';
import { streetColors, typography } from '@/theme/tokens';

export function GastosHeader() {
  return <Text style={styles.tagline}>{gastosCopy.greetings[0]}</Text>;
}

const styles = StyleSheet.create({
  tagline: { ...typography.label, color: streetColors.muted, letterSpacing: 1.1 },
});
