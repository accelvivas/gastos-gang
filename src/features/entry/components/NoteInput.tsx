import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type NoteInputProps = {
  note: string;
  onChangeNote: (note: string) => void;
  onClearAmount: () => void;
};

export function NoteInput({ note, onChangeNote, onClearAmount }: NoteInputProps) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Add a note (optional)" accessibilityRole="button" onPress={() => setExpanded(true)} style={styles.addButton}>
          <Text style={[styles.plus, { backgroundColor: colors.surfaceElevated, color: colors.primary }]}>+</Text>
          <Text style={[styles.addText, { color: colors.primary }]}>Add a note (optional)</Text>
        </Pressable>
        <Pressable accessibilityLabel="Clear amount" accessibilityRole="button" onPress={onClearAmount} style={styles.clearButton}>
          <Text style={[styles.clearText, { color: colors.textMuted }]}>CLEAR AMOUNT ×</Text>
        </Pressable>
      </View>
      {expanded || note ? (
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Expense note"
            autoFocus
            maxLength={200}
            onChangeText={onChangeNote}
            placeholder="Lunch with the tropa"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            value={note}
          />
          <Pressable accessibilityLabel="Done editing note" accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.done}>
            <Text style={[styles.doneText, { color: colors.primary }]}>DONE</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  addButton: { minHeight: layout.minimumTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  plus: { width: 34, height: 34, borderRadius: 17, textAlign: 'center', fontSize: 29, lineHeight: 34, fontWeight: '500' },
  addText: { ...typography.label, fontSize: 15 },
  clearButton: { minHeight: layout.minimumTapTarget, justifyContent: 'center' },
  clearText: { ...typography.caption, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { ...typography.body, flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md },
  done: { minHeight: layout.minimumTapTarget, justifyContent: 'center' },
  doneText: typography.label,
});
