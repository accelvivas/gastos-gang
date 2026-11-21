import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TabHeading } from '@/components/AppHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

export default function SettingsRoute() {
  return (
    <View style={styles.screen}>
      <StreetBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <TabHeading title="SETTINGS" subtitle="Ayusin ang app mo, boss." />
        <View style={styles.card}>
          <Text style={styles.description}>Categories, budget, theme, and export arrive in Phase 5.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: streetColors.background },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: { padding: spacing.md, backgroundColor: streetColors.surface, borderColor: streetColors.border, borderWidth: 1, borderRadius: radii.lg },
  description: { ...typography.body, color: streetColors.muted },
});
