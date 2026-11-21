import { StyleSheet, Text, View } from 'react-native';

import { StreetStarburst } from '@/components/StreetStarburst';
import { spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type SectionHeadingProps = {
  accent: 'bullet' | 'star';
  subtitle: string;
  title: string;
};

export function SectionHeading({ accent, subtitle, title }: SectionHeadingProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titleGroup}>
        {accent === 'bullet' ? <View style={[styles.bullet, { backgroundColor: colors.orange }]} /> : <StreetStarburst color={colors.orange} size={22} />}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bullet: { width: 12, height: 12, borderRadius: 7 },
  title: { ...typography.heading, letterSpacing: 0.8 },
  subtitle: { ...typography.body, fontSize: 15 },
});
