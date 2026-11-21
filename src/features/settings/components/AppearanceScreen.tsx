import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import type { ThemeMode } from '@/repositories/settingsRepo';
import * as settingsRepo from '@/repositories/settingsRepo';
import { useSettingsStore } from '@/store/settings-store';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const OPTIONS: readonly {
  mode: ThemeMode;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { mode: 'dark', title: 'Dark', subtitle: 'Original Geng Geng', icon: 'moon-outline' },
  { mode: 'light', title: 'Light', subtitle: 'Fresh Vibes', icon: 'sunny-outline' },
  { mode: 'system', title: 'System', subtitle: 'Follow Device', icon: 'phone-portrait-outline' },
];

export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const preference = useSettingsStore((state) => state.themePreference);
  const setPreference = useSettingsStore((state) => state.setThemePreference);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreference = useCallback(async () => {
    setError(null);
    try {
      const saved = await settingsRepo.getTyped<ThemeMode>(db, 'theme_mode');
      setPreference(saved ?? 'dark');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi ma-load ang appearance setting.');
    } finally {
      setIsLoading(false);
    }
  }, [db, setPreference]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPreference(), 0);
    return () => clearTimeout(timer);
  }, [loadPreference]);

  const selectMode = async (mode: ThemeMode) => {
    if (isSaving || mode === preference) return;
    setIsSaving(true);
    setError(null);
    try {
      await settingsRepo.setTyped(db, 'theme_mode', mode);
      setPreference(mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi na-save ang appearance setting.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="APPEARANCE" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.text }]}>Pick your app vibes.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Make Gastos Gang feel right for you, bossing.</Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Appearance mode" style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = preference === option.mode;
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="radio"
                accessibilityLabel={`${option.title}, ${option.subtitle}`}
                accessibilityState={{ checked: selected, disabled: isLoading || isSaving }}
                disabled={isLoading || isSaving}
                onPress={() => void selectMode(option.mode)}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
                  selected && { backgroundColor: colors.surfaceElevated },
                  pressed && styles.pressed,
                  (isLoading || isSaving) && styles.disabled,
                ]}>
                <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name={option.icon} size={23} color={selected ? colors.primary : colors.textMuted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                  <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>{option.subtitle}</Text>
                </View>
                {selected ? <Ionicons accessibilityElementsHidden name="checkmark-circle" size={24} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
        {isLoading ? (
          <ActivityIndicator accessibilityLabel="Loading appearance setting" color={colors.primary} />
        ) : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.warning }]}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  intro: { gap: spacing.xs },
  title: { ...typography.heading, fontSize: 24 },
  subtitle: { ...typography.body },
  options: { gap: spacing.md },
  option: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  iconBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { ...typography.label, fontSize: 16 },
  optionSubtitle: { ...typography.caption },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  error: { ...typography.caption, textAlign: 'center' },
});
