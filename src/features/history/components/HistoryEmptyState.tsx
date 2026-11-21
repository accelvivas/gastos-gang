import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StreetStarburst } from '@/components/StreetStarburst';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

export function HistoryEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <View style={styles.container}>
      <StreetStarburst color={streetColors.orange} size={32} />
      <Text accessibilityRole="header" style={styles.title}>{onClear ? 'WALANG MATCH, BOSS!' : 'WALA PANG GASTOS, BOSS!'}</Text>
      <Text style={styles.body}>{onClear ? 'Try another search or date range.' : 'Tahimik ang wallet mo ah. Solid!'}</Text>
      <Pressable accessibilityRole="button" onPress={onClear ?? (() => router.navigate('/'))} style={styles.button}>
        <Text style={styles.buttonText}>{onClear ? 'CLEAR FILTERS' : 'LOG GASTOS'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  title: { ...typography.heading, color: streetColors.cream, textAlign: 'center' },
  body: { ...typography.body, color: streetColors.muted, textAlign: 'center' },
  button: { minHeight: layout.minimumTapTarget, justifyContent: 'center', borderRadius: radii.md, backgroundColor: streetColors.lime, paddingHorizontal: spacing.xl },
  buttonText: { ...typography.label, color: streetColors.background },
});
