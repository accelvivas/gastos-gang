import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { CsvExportError, exportExpensesCsv } from '@/features/settings/utils/exportExpensesCsv';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

function errorMessage(error: unknown): string {
  if (error instanceof CsvExportError) {
    if (error.code === 'FILE_WRITE') {
      return 'Could not create the CSV file. Check available storage and try again.';
    }
    if (error.code === 'SHARING_UNAVAILABLE') {
      return 'File sharing is not available on this device.';
    }
    return 'Could not open the sharing sheet. Please try again.';
  }
  return 'Could not read your expense history. Please try again.';
}

export function ExportCsvScreen({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const exportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportCsv = useCallback(async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setIsExporting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await exportExpensesCsv(db);
      if (result.status === 'empty') {
        const emptyMessage = 'No expenses to export yet.';
        setMessage(emptyMessage);
        Toast.show({
          type: 'expenseSaved',
          text1: 'NOTHING TO EXPORT YET',
          text2: 'Add an expense first, bossing.',
          position: 'bottom',
          props: { kind: 'info' },
        });
        return;
      }
      if (result.status === 'unavailable') {
        const unavailableMessage = 'File sharing is not available on this device.';
        setError(unavailableMessage);
        Toast.show({
          type: 'expenseSaved',
          text1: 'SHARING UNAVAILABLE',
          text2: unavailableMessage,
          position: 'bottom',
          props: { kind: 'error' },
        });
        return;
      }

      const readyMessage =
        `CSV prepared with ${result.count} expenses. The share sheet closed; saving is not confirmed. Export again if you canceled.`;
      setMessage(readyMessage);
      Toast.show({
        type: 'expenseSaved',
        text1: 'CSV READY',
        text2: 'Share sheet closed. The app cannot confirm whether you saved it.',
        position: 'bottom',
        props: { kind: 'info' },
      });
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      Toast.show({
        type: 'expenseSaved',
        text1: 'EXPORT FAILED',
        text2: message,
        position: 'bottom',
        props: { kind: 'error' },
      });
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  }, [db]);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="EXPORT CSV" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="download-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Take your gastos data with you.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Export your complete expense history as a spreadsheet-ready CSV.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={20} color={colors.orange} />
            <Text style={[styles.detail, { color: colors.text }]}>
              Includes archived categories and future-dated expenses.
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={[styles.detail, { color: colors.text }]}>
              This CSV contains readable financial information. Share it only with people and services you trust.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="EXPORT & SHARE CSV"
            accessibilityState={{ disabled: isExporting }}
            disabled={isExporting}
            onPress={() => void exportCsv()}
            style={({ pressed }) => [
              styles.exportButton,
              { backgroundColor: colors.primary },
              pressed && !isExporting && styles.pressed,
              isExporting && styles.disabled,
            ]}>
            {isExporting ? (
              <ActivityIndicator accessibilityLabel="Preparing CSV export" color={colors.primaryText} />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={colors.primaryText} />
                <Text style={[styles.exportText, { color: colors.primaryText }]}>EXPORT &amp; SHARE CSV</Text>
              </>
            )}
          </Pressable>
          {isExporting ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.textMuted }]}>
              Preparing your full history. Larger exports may take a moment.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.status, { color: colors.warning }]}>
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.text }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  intro: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  introIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg },
  title: { ...typography.heading, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center' },
  card: { gap: spacing.lg, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detail: { ...typography.body, flex: 1 },
  exportButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
  },
  exportText: typography.label,
  status: { ...typography.caption, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
