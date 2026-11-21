import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '@/db/types';
import { defaultHistoryFilter, periods, type HistoryFilter } from '@/features/history/utils/historyFilters';
import { dayKeyToLocalDate, toLocalDayKey } from '@/lib/dates';
import { listForHistory } from '@/repositories/categoriesRepo';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

export function HistoryFilterSheet({ initial, onApply, onClose }: {
  initial: HistoryFilter;
  onApply: (filter: HistoryFilter, categoryName?: string) => void;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const [draft, setDraft] = useState(initial);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [picking, setPicking] = useState<'fromKey' | 'toKey' | null>(null);
  useEffect(() => {
    let active = true;
    listForHistory(db).then(
      (rows) => { if (active) setCategories(rows); },
      () => { if (active) setFailed(true); }
    );
    return () => { active = false; };
  }, [attempt, db]);

  const invalid = draft.period === 'custom' && draft.fromKey > draft.toKey;
  return (
    <Modal transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>FILTER GASTOS</Text>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.options}>
              <Choice label="All categories" selected={draft.categoryId === undefined} onPress={() => setDraft({ ...draft, categoryId: undefined })} />
              {categories?.map((category) => (
                <Choice key={category.id} label={category.isArchived ? `${category.name} (archived)` : category.name} selected={draft.categoryId === category.id} onPress={() => setDraft({ ...draft, categoryId: category.id })} />
              ))}
            </View>
            {failed ? (
              <Choice label="Retry loading categories" onPress={() => { setFailed(false); setAttempt(attempt + 1); }} />
            ) : categories === null ? <Text style={styles.label}>Loading categories…</Text> : null}
            <Text style={styles.label}>DATE RANGE</Text>
            <View style={styles.options}>
              {periods.filter(([period]) => Platform.OS !== 'web' || period !== 'custom').map(([period, label]) => (
                <Choice key={period} label={label} selected={draft.period === period} onPress={() => { setPicking(null); setDraft({ ...draft, period }); }} />
              ))}
            </View>
            {draft.period === 'custom' && (
              <>
                <View style={styles.options}>
                  <Choice label={`From ${draft.fromKey}`} onPress={() => setPicking('fromKey')} />
                  <Choice label={`To ${draft.toKey}`} onPress={() => setPicking('toKey')} />
                </View>
                {picking && (
                  <>
                    <DateTimePicker
                      key={picking}
                      mode="date"
                      value={dayKeyToLocalDate(draft[picking])}
                      presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
                      themeVariant="dark"
                      onDismiss={() => setPicking(null)}
                      onValueChange={(_, date) => {
                        setDraft((current) => ({ ...current, [picking]: toLocalDayKey(date.getTime()) }));
                        if (Platform.OS === 'android') setPicking(null);
                      }}
                    />
                    {Platform.OS === 'ios' && <Choice label="Done choosing date" onPress={() => setPicking(null)} />}
                  </>
                )}
                {invalid && <Text accessibilityLiveRegion="polite" style={styles.error}>Start date must come before or be the same as the end date.</Text>}
              </>
            )}
          </ScrollView>
          <View style={styles.options}>
            <Choice label="Cancel" onPress={onClose} />
            <Choice label="Reset" onPress={() => { setPicking(null); setDraft(defaultHistoryFilter()); }} />
            <Choice label="Apply" primary disabled={invalid || picking !== null} onPress={() => {
              onApply(draft, categories?.find((category) => category.id === draft.categoryId)?.name);
            }} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Choice({ label, selected, primary, disabled, onPress }: {
  label: string; selected?: boolean; primary?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole={selected === undefined ? 'button' : 'radio'} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, (primary || selected) && styles.active, disabled && styles.disabled]}>
      <Text style={[styles.choiceText, (primary || selected) && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: streetColors.overlay },
  sheet: { width: '100%', maxWidth: 540, alignSelf: 'center', maxHeight: '90%', padding: spacing.lg, gap: spacing.md, backgroundColor: streetColors.surface, borderRadius: radii.lg },
  title: { ...typography.heading, color: streetColors.lime },
  content: { gap: spacing.sm, paddingBottom: spacing.sm },
  label: { ...typography.label, color: streetColors.muted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { minHeight: 44, minWidth: 44, justifyContent: 'center', borderWidth: 1, borderColor: streetColors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  choiceText: { ...typography.label, color: streetColors.cream },
  active: { backgroundColor: streetColors.lime, borderColor: streetColors.lime },
  activeText: { color: streetColors.black },
  disabled: { opacity: 0.4 },
  error: { ...typography.caption, color: streetColors.orange },
});
