import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StreetStarburst } from '@/components/StreetStarburst';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function HistoryEmptyState({ onClear }: { onClear?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <StreetStarburst color={colors.orange} size={32} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{onClear ? 'WALANG MATCH, BOSS!' : 'WALA PANG GASTOS, BOSS!'}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{onClear ? 'Try another search or date range.' : 'Tahimik ang wallet mo ah. Solid!'}</Text>
      <Pressable accessibilityRole="button" onPress={onClear ?? (() => router.navigate('/'))} style={[styles.button, { backgroundColor: colors.primary }]}>
        <Text style={[styles.buttonText, { color: colors.primaryText }]}>{onClear ? 'CLEAR FILTERS' : 'LOG GASTOS'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  title: { ...typography.heading, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center' },
  button: { minHeight: layout.minimumTapTarget, justifyContent: 'center', borderRadius: radii.md, paddingHorizontal: spacing.xl },
  buttonText: typography.label,
});
