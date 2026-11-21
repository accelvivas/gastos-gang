import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { StreetBackground } from '@/components/StreetBackground';
import { AppearanceScreen } from '@/features/settings/components/AppearanceScreen';
import { AboutScreen } from '@/features/settings/components/AboutScreen';
import { BackupScreen, RestoreScreen } from '@/features/settings/components/BackupRestoreScreen';
import { CategoryManagementScreen } from '@/features/settings/components/CategoryManagementScreen';
import { DailyBudgetScreen } from '@/features/settings/components/DailyBudgetScreen';
import { ExportCsvScreen } from '@/features/settings/components/ExportCsvScreen';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const TITLES: Record<string, string> = {
  categories: 'MANAGE CATEGORIES',
  budget: 'DAILY BUDGET',
  appearance: 'APP VIBES',
  export: 'EXPORT CSV',
  backup: 'BACK UP DATA',
  restore: 'RESTORE BACKUP',
  about: 'ABOUT GASTOS GANG',
};

export default function SettingsFeatureRoute() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const { colors } = useAppTheme();
  const title = TITLES[feature] ?? 'SETTINGS';

  if (feature === 'categories') {
    return <CategoryManagementScreen onBack={() => router.back()} />;
  }
  if (feature === 'budget') {
    return <DailyBudgetScreen onBack={() => router.back()} />;
  }
  if (feature === 'appearance') {
    return <AppearanceScreen onBack={() => router.back()} />;
  }
  if (feature === 'export') {
    return <ExportCsvScreen onBack={() => router.back()} />;
  }
  if (feature === 'backup') {
    return <BackupScreen onBack={() => router.back()} />;
  }
  if (feature === 'restore') {
    return <RestoreScreen onBack={() => router.back()} />;
  }
  if (feature === 'about') {
    return <AboutScreen onBack={() => router.back()} />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons
              name={feature === 'about' ? 'information-circle-outline' : 'construct-outline'}
              size={30}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Coming in the next implementation step</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>This settings feature is not available yet.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  headerTitle: { ...typography.label, flex: 1, letterSpacing: 0.8 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.xl,
  },
  iconBox: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  title: { ...typography.heading, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center' },
});
