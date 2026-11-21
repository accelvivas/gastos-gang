import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { useTodayTotal } from '@/features/entry/hooks/useTodayTotal';
import { formatBudgetPercentage } from '@/features/entry/utils/dailyBudget';
import { notifyBudgetChange } from '@/lib/expenseChanges';
import { formatPeso, toCentavos } from '@/lib/money';
import * as settingsRepo from '@/repositories/settingsRepo';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

function amountInputValue(centavos: number | null): string {
  if (centavos === null) return '';
  return formatPeso(centavos).replace(/[₱,]/g, '');
}

export function DailyBudgetScreen({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const today = useTodayTotal();
  const [enabled, setEnabled] = useState(false);
  const [savedLimit, setSavedLimit] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const current = await settingsRepo.getDailyBudget(db);
      setEnabled(current.enabled);
      setSavedLimit(current.limitCentavos);
      setAmount(amountInputValue(current.limitCentavos));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi ma-load ang budget settings.');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const persist = async (nextEnabled: boolean, limitCentavos?: number) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await settingsRepo.setDailyBudget(db, nextEnabled, limitCentavos);
      setEnabled(saved.enabled);
      setSavedLimit(saved.limitCentavos);
      setAmount(amountInputValue(saved.limitCentavos));
      setMessage(saved.enabled ? 'Daily budget is on, bossing.' : 'Daily budget is off.');
      notifyBudgetChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi na-save ang daily budget.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAmount = () => {
    const limitCentavos = toCentavos(amount);
    if (limitCentavos === null) {
      setError('Maglagay ng valid na budget na higit sa ₱0.00.');
      setMessage(null);
      return;
    }
    void persist(enabled, limitCentavos);
  };

  const toggleEnabled = (nextEnabled: boolean) => {
    if (nextEnabled && savedLimit === null) {
      setError('Set and save a daily limit before enabling the budget.');
      setMessage(null);
      return;
    }
    void persist(nextEnabled);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="DAILY BUDGET" onBack={onBack} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Loading daily budget" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentViewport}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={[styles.introIcon, { backgroundColor: colors.surface }]}><Ionicons name="wallet-outline" size={27} color={colors.primary} /></View>
            <Text style={[styles.title, { color: colors.text }]}>Set your daily spending limit, bossing.</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Para may preno ang gastos.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Daily budget</Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>{enabled ? 'Tracking is on' : 'Tracking is off'}</Text>
              </View>
              <Switch
                accessibilityLabel="Enable daily budget"
                disabled={isSaving || (savedLimit === null && !enabled)}
                onValueChange={toggleEnabled}
                thumbColor={enabled ? colors.primaryText : colors.cream}
                trackColor={{ false: colors.border, true: colors.primary }}
                value={enabled}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.primary }]}>DAILY LIMIT (PHP)</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.currency, { color: colors.primary }]}>₱</Text>
              <TextInput
                accessibilityLabel="Daily budget amount in pesos"
                editable={!isSaving}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setAmount(value);
                  setError(null);
                  setMessage(null);
                }}
                onSubmitEditing={saveAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[styles.input, { color: colors.text }]}
                value={amount}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={saveAmount}
              style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, pressed && styles.pressed, isSaving && styles.disabled]}>
              {isSaving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveText, { color: colors.primaryText }]}>SAVE DAILY LIMIT</Text>}
            </Pressable>
          </View>

          {enabled && today.budgetProgress && savedLimit !== null ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.primary }]}>TODAY&apos;S BUDGET STATUS</Text>
              {today.error ? (
                <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.warning }]}>{today.error}</Text>
              ) : (
                <>
                  <View style={styles.statRow}>
                    <Text style={[styles.muted, { color: colors.textMuted }]}>Spent today</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{today.error ? '—' : formatPeso(today.totalCentavos)}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.muted, { color: colors.textMuted }]}>Daily limit</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{formatPeso(savedLimit)}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.muted, { color: colors.textMuted }]}>Used</Text>
                    <Text style={[styles.statValue, { color: colors.text }, today.budgetProgress.stage === 'over' && { color: colors.warning }]}>
                      {formatBudgetPercentage(today.budgetProgress.percentageUsed)}%
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View style={[
                      styles.progressFill,
                      { width: `${today.budgetProgress.progress * 100}%` },
                      { backgroundColor: colors.primary },
                      today.budgetProgress.stage === 'warning' && { backgroundColor: colors.warningFill },
                      today.budgetProgress.stage === 'over' && { backgroundColor: colors.warning },
                    ]} />
                  </View>
                  <Text style={[styles.remaining, { color: colors.text }]}>
                    {today.budgetProgress.stage === 'over'
                      ? `${formatPeso(today.budgetProgress.overCentavos)} over budget`
                      : `${formatPeso(today.budgetProgress.remainingCentavos)} remaining`}
                  </Text>
                </>
              )}
            </View>
          ) : null}

          {error ? <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.warning }]}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={[styles.success, { color: colors.success }]}>{message}</Text> : null}
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentViewport: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  introIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg },
  title: { ...typography.heading, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center' },
  card: { gap: spacing.md, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  toggleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  toggleCopy: { flex: 1, gap: 2 },
  rowTitle: typography.label,
  muted: typography.caption,
  fieldLabel: { ...typography.label, letterSpacing: 0.8 },
  inputRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderRadius: radii.md, paddingHorizontal: spacing.md },
  currency: { ...typography.heading },
  input: { ...typography.body, flex: 1, paddingVertical: spacing.sm },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  saveText: typography.label,
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  statValue: { ...typography.label, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: radii.pill },
  progressFill: { height: '100%', borderRadius: radii.pill },
  remaining: { ...typography.label, textAlign: 'right' },
  error: { ...typography.caption, textAlign: 'center', fontWeight: '800' },
  success: { ...typography.caption, textAlign: 'center', fontWeight: '800' },
});
