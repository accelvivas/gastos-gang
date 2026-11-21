import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { NumberPad } from '@/components/NumberPad';
import { StreetBackground } from '@/components/StreetBackground';
import { AmountDisplay } from '@/features/entry/components/AmountDisplay';
import { CategoryGrid } from '@/features/entry/components/CategoryGrid';
import { GastosHeader } from '@/features/entry/components/GastosHeader';
import { NoteInput } from '@/features/entry/components/NoteInput';
import { SectionHeading } from '@/features/entry/components/SectionHeading';
import { TodayDamageCard } from '@/features/entry/components/TodayDamageCard';
import { useActiveCategories } from '@/features/entry/hooks/useActiveCategories';
import { useExpenseEntry } from '@/features/entry/hooks/useExpenseEntry';
import { useTodayTotal } from '@/features/entry/hooks/useTodayTotal';
import { notifyExpenseChange } from '@/lib/expenseChanges';
import { layout, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function EntryScreen() {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const categories = useActiveCategories();
  const today = useTodayTotal();
  const entry = useExpenseEntry({ onExpenseChanged: notifyExpenseChange });

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
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
              budgetLimitCentavos={today.budgetEnabled ? today.budgetLimitCentavos : null}
              budgetProgress={today.budgetProgress}
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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
  categorySection: { gap: spacing.md },
});
