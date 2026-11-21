import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function AboutScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const version = Constants.expoConfig?.version;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="ABOUT GASTOS GANG" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.brandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BrandLogo size={112} accessibilityLabel="Official Gastos Gang logo" />
          <Text
            accessibilityRole="header"
            accessibilityLabel="GASTOS GANG."
            style={[styles.wordmark, { color: colors.text }]}>
            GASTOS <Text style={{ color: colors.primary }}>GANG.</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Track your gastos. Control your damage. Stay in the gang.
          </Text>
          <Text style={[styles.version, { color: colors.orange }]}>
            {version ? `Version ${version}` : 'Version unavailable'}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow icon="wallet-outline" title="Offline-first expense tracker">
            Track everyday spending on this device, even when you are offline.
          </InfoRow>
          <InfoRow icon="phone-portrait-outline" title="Your data stays local">
            Expenses, categories, and preferences are stored in local SQLite storage. Nothing is uploaded automatically; files leave the app only when you choose to export or share them.
          </InfoRow>
          <InfoRow icon="cloud-upload-outline" title="Back up regularly">
            Create regular backups from Settings → Your Data → Back Up Data. Backup files are not encrypted, so keep them somewhere private.
          </InfoRow>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  children,
  icon,
  title,
}: {
  children: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  brandCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  wordmark: { ...typography.title, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  tagline: { ...typography.body, textAlign: 'center' },
  version: typography.label,
  infoCard: { gap: spacing.lg, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  copy: { flex: 1, gap: spacing.xs },
  infoTitle: typography.label,
  body: typography.body,
});
