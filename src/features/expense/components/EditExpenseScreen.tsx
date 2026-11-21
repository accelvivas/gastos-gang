import CommunityDateTimePicker from '@expo/ui/community/datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad } from '@/components/NumberPad';
import { StreetBackground } from '@/components/StreetBackground';
import { AmountDisplay } from '@/features/entry/components/AmountDisplay';
import { EditCategoryGrid } from '@/features/expense/components/EditCategoryGrid';
import { useExpenseEditor } from '@/features/expense/hooks/useExpenseEditor';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type PickerMode = 'date' | 'time' | null;

export function parseExpenseId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function formatEditDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(ms));
}

export function formatEditTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(ms));
}

export function EditExpenseScreen() {
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editor = useExpenseEditor(parseExpenseId(params.id));
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [allowLeave, setAllowLeave] = useState(false);

  const confirmDiscard = useCallback(({ repeat }: { repeat: () => void }) => {
    Alert.alert('Discard changes?', 'Hindi mase-save ang mga binago mo.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setAllowLeave(true);
          repeat();
        },
      },
    ]);
  }, []);
  const disablePrevention = usePreventRemove(
    editor.hasChanges && !editor.isSaving && !allowLeave,
    confirmDiscard
  );

  const leaveAfterSave = useCallback(async () => {
    if (await editor.save()) {
      disablePrevention();
      router.back();
    }
  }, [disablePrevention, editor]);

  if (editor.status !== 'ready') {
    const isLoading = editor.status === 'loading';
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <StreetBackground />
        <View style={styles.state}>
          {isLoading ? <ActivityIndicator accessibilityLabel="Loading expense" color={colors.primary} /> : null}
          <Text accessibilityLiveRegion="polite" style={[styles.stateText, { color: colors.textMuted }]}>
            {isLoading
              ? 'Kinukuha ang gastos, bossingâ€¦'
              : editor.status === 'not-found'
                ? 'Walang ganitong gastos, boss.'
                : editor.loadError}
          </Text>
          {editor.status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={() => void editor.load()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: colors.primary }]}>TRY AGAIN</Text>
            </Pressable>
          ) : null}
          {!isLoading ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelStateButton}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>GO BACK</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>GASTOS GANG.</Text>
              <Text style={[styles.title, { color: colors.text }]}>EDIT GASTOS</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>May correction, bossing?</Text>
            </View>
            <Pressable accessibilityLabel="Close edit expense" accessibilityRole="button" onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: colors.surface }]}>
              <Ionicons color={colors.text} name="close" size={28} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.primary }]}>AMOUNT</Text>
            <AmountDisplay draft={editor.amountDraft} error={editor.validationError} />
            <NumberPad disabled={editor.isSaving} onKeyPress={editor.pressAmountKey} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.primary }]}>CATEGORY</Text>
            <EditCategoryGrid categories={editor.categories} disabled={editor.isSaving} onSelect={editor.setCategoryId} selectedId={editor.categoryId} />
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.primary }]}>NOTE</Text>
              <Text style={[styles.counter, { color: colors.textMuted }]}>{editor.note.length}/200</Text>
            </View>
            <TextInput
              accessibilityLabel="Expense note"
              editable={!editor.isSaving}
              maxLength={200}
              multiline
              onChangeText={editor.setNote}
              placeholder="Ano 'to, boss? (optional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.noteInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
              value={editor.note}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.primary }]}>WHEN</Text>
            <View style={styles.whenRow}>
              <Pressable accessibilityLabel={`Date ${formatEditDate(editor.createdAt)}`} accessibilityRole="button" onPress={() => setPickerMode('date')} style={[styles.whenButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons color={colors.orange} name="calendar-outline" size={20} />
                <Text style={[styles.whenText, { color: colors.text }]}>{formatEditDate(editor.createdAt)}</Text>
              </Pressable>
              <Pressable accessibilityLabel={`Time ${formatEditTime(editor.createdAt)}`} accessibilityRole="button" onPress={() => setPickerMode('time')} style={[styles.whenButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons color={colors.orange} name="time-outline" size={20} />
                <Text style={[styles.whenText, { color: colors.text }]}>{formatEditTime(editor.createdAt)}</Text>
              </Pressable>
            </View>
            {pickerMode ? (
              <CommunityDateTimePicker
                accentColor={colors.primary}
                mode={pickerMode}
                onDismiss={() => setPickerMode(null)}
                onValueChange={(_event, selected) => {
                  if (pickerMode === 'date') editor.setDate(selected);
                  else editor.setTime(selected);
                  setPickerMode(null);
                }}
                presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
                themeVariant={isDark ? 'dark' : 'light'}
                value={new Date(editor.createdAt)}
              />
            ) : null}
          </View>

          {editor.validationError ? <Text accessibilityLiveRegion="assertive" style={[styles.formError, { color: colors.warning }]}>{editor.validationError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={editor.isSaving || !editor.hasChanges}
            onPress={() => void leaveAfterSave()}
            style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, pressed && styles.pressed, (!editor.hasChanges || editor.isSaving) && styles.disabled]}>
            {editor.isSaving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveText, { color: colors.primaryText }]}>SAVE CHANGES</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={editor.isSaving} onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>CANCEL</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { ...typography.label, letterSpacing: 1.2 },
  title: { ...typography.title, fontSize: 34, lineHeight: 40 },
  subtitle: typography.body,
  closeButton: { width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  section: { gap: spacing.sm },
  label: { ...typography.label, letterSpacing: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  counter: typography.caption,
  noteInput: { minHeight: 92, borderWidth: 1.5, borderRadius: radii.lg, padding: spacing.md, textAlignVertical: 'top', ...typography.body },
  whenRow: { flexDirection: 'row', gap: spacing.sm },
  whenButton: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md },
  whenText: { ...typography.caption, flexShrink: 1, fontWeight: '700' },
  formError: { ...typography.caption, textAlign: 'center', fontWeight: '800' },
  saveButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg },
  saveText: typography.heading,
  cancelButton: { minHeight: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center' },
  cancelText: typography.label,
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  stateText: { ...typography.body, textAlign: 'center' },
  retryButton: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.xl },
  retryText: typography.label,
  cancelStateButton: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.xl },
});
