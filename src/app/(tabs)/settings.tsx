import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TabHeading } from '@/components/AppHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { layout, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type SettingsFeature =
  | 'categories'
  | 'budget'
  | 'recurring'
  | 'appearance'
  | 'export'
  | 'backup'
  | 'restore'
  | 'about';

function openFeature(feature: SettingsFeature) {
  router.push({ pathname: '/settings/[feature]', params: { feature } });
}

export default function SettingsRoute() {
  const { colors } = useAppTheme();
  const version = Constants.expoConfig?.version;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <TabHeading title="SETTINGS" subtitle="Ayusin natin 'to, bossing." />

        <SettingsSection title="YOUR GANG">
          <SettingsRow
            icon="layers-outline"
            label="Manage Categories"
            subtitle="Organize your gastos lanes"
            onPress={() => openFeature('categories')}
          />
        </SettingsSection>

        <SettingsSection title="DAILY DAMAGE CONTROL">
          <SettingsRow
            icon="wallet-outline"
            label="Daily Budget"
            subtitle="Set your spending guardrail"
            onPress={() => openFeature('budget')}
          />
          <SettingsRow
            icon="repeat-outline"
            label="Recurring Expenses"
            subtitle="Manage regular gastos and payment reminders"
            onPress={() => openFeature('recurring')}
          />
        </SettingsSection>

        <SettingsSection title="APP VIBES">
          <SettingsRow
            icon="color-palette-outline"
            label="Appearance"
            subtitle="Choose how Gastos Gang looks"
            onPress={() => openFeature('appearance')}
          />
        </SettingsSection>

        <SettingsSection title="YOUR DATA">
          <SettingsRow
            icon="download-outline"
            label="Export CSV"
            subtitle="Save expenses as a spreadsheet"
            onPress={() => openFeature('export')}
          />
          <SettingsRow
            icon="cloud-upload-outline"
            label="Back Up Data"
            subtitle="Create and share an offline JSON backup"
            onPress={() => openFeature('backup')}
          />
          <SettingsRow
            icon="cloud-download-outline"
            label="Restore Backup"
            subtitle="Validate and replace data from a backup"
            onPress={() => openFeature('restore')}
          />
        </SettingsSection>

        <SettingsSection title="ABOUT">
          <SettingsRow
            icon="information-circle-outline"
            label="About Gastos Gang"
            subtitle="Gastos Gang mobile app"
            status={version ? `v${version}` : 'Version unavailable'}
            onPress={() => openFeature('about')}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
