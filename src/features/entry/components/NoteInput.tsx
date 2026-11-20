import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

type NoteInputProps = {
  note: string;
  onChangeNote: (note: string) => void;
  onClearAmount: () => void;
};

export function NoteInput({ note, onChangeNote, onClearAmount }: NoteInputProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Add a note (optional)" accessibilityRole="button" onPress={() => setExpanded(true)} style={styles.addButton}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.addText}>Add a note (optional)</Text>
        </Pressable>
        <Pressable accessibilityLabel="Clear amount" accessibilityRole="button" onPress={onClearAmount} style={styles.clearButton}>
          <Text style={styles.clearText}>CLEAR AMOUNT ×</Text>
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
            placeholderTextColor={streetColors.muted}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={styles.input}
            value={note}
          />
          <Pressable accessibilityLabel="Done editing note" accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.done}>
            <Text style={styles.doneText}>DONE</Text>
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
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: streetColors.olive, color: streetColors.lime, textAlign: 'center', fontSize: 29, lineHeight: 34, fontWeight: '500' },
  addText: { ...typography.label, color: streetColors.lime, fontSize: 15 },
  clearButton: { minHeight: layout.minimumTapTarget, justifyContent: 'center' },
  clearText: { ...typography.caption, color: streetColors.muted, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { ...typography.body, flex: 1, minHeight: 48, borderWidth: 1, borderColor: streetColors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: streetColors.cream, backgroundColor: streetColors.surface },
  done: { minHeight: layout.minimumTapTarget, justifyContent: 'center' },
  doneText: { ...typography.label, color: streetColors.lime },
});
