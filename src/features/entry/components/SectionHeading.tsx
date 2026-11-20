import { StyleSheet, Text, View } from 'react-native';

import { StreetStarburst } from '@/components/StreetStarburst';
import { spacing, streetColors, typography } from '@/theme/tokens';

type SectionHeadingProps = {
  accent: 'bullet' | 'star';
  subtitle: string;
  title: string;
};

export function SectionHeading({ accent, subtitle, title }: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleGroup}>
        {accent === 'bullet' ? <View style={styles.bullet} /> : <StreetStarburst color={streetColors.orange} size={22} />}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bullet: { width: 12, height: 12, borderRadius: 7, backgroundColor: streetColors.orange },
  title: { ...typography.heading, color: streetColors.cream, letterSpacing: 0.8 },
  subtitle: { ...typography.body, color: streetColors.muted, fontSize: 15 },
});
