import { Link, type Href } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad } from '@/components/NumberPad';
import { StreetBackground } from '@/components/StreetBackground';
import { AmountDisplay } from '@/features/entry/components/AmountDisplay';
import { CategoryGrid } from '@/features/entry/components/CategoryGrid';
import { EntryFooter } from '@/features/entry/components/EntryFooter';
import { GastosHeader } from '@/features/entry/components/GastosHeader';
import { NoteInput } from '@/features/entry/components/NoteInput';
import { SectionHeading } from '@/features/entry/components/SectionHeading';
import { TodayDamageCard } from '@/features/entry/components/TodayDamageCard';
import { useActiveCategories } from '@/features/entry/hooks/useActiveCategories';
import { useExpenseEntry } from '@/features/entry/hooks/useExpenseEntry';
import { useTodayTotal } from '@/features/entry/hooks/useTodayTotal';
import { layout, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const DEV_DATABASE_ROUTE = '/dev-db' as Href;

export function EntryScreen() {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const categories = useActiveCategories();
  const today = useTodayTotal();
  const { refresh: refreshTodayTotal } = today;
  const refreshTotal = useCallback(() => void refreshTodayTotal(), [refreshTodayTotal]);
  const entry = useExpenseEntry({ onExpenseChanged: refreshTotal });

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260)} style={styles.content}>
            <GastosHeader />
            <TodayDamageCard
              dayKey={today.dayKey}
              totalCentavos={today.totalCentavos}
              unavailable={Boolean(today.error)}
            />
            <View style={styles.section}>
              <SectionHeading accent="bullet" title="QUICK DROP" subtitle="no drama, just digits" />
              <AmountDisplay draft={entry.amountDraft} error={entry.error} />
              <NumberPad disabled={entry.isSaving} onKeyPress={entry.pressKey} />
              <NoteInput
                key={entry.resetCount}
                note={entry.note}
                onChangeNote={entry.setNote}
                onClearAmount={() => entry.pressKey('clear')}
              />
            </View>
            <View style={styles.categorySection}>
              <SectionHeading accent="star" title="PICK YOUR LANE" subtitle="tap = saved." />
              <CategoryGrid
                categories={categories.categories}
                disabled={entry.isSaving}
                error={categories.error}
                isLoading={categories.isLoading}
                onRetry={() => void categories.refresh()}
                onSelect={(category) => void entry.saveForCategory(category)}
              />
            </View>
            <EntryFooter />
            {__DEV__ ? (
              <Link href={DEV_DATABASE_ROUTE} asChild>
                <Pressable accessibilityRole="link" style={styles.devLink}>
                  <Text style={[styles.devText, { color: colors.textMuted }]}>Database tools</Text>
                </Pressable>
              </Link>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
  categorySection: { gap: spacing.md },
  devLink: { minHeight: layout.minimumTapTarget, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  devText: typography.caption,
});
