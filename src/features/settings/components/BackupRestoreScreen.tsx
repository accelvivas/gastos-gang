import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import { clearPendingBudgetWarning } from '@/features/entry/budgetWarnings';
import { invalidateUndoOperations } from '@/lib/undoCoordinator';
import { notifyDataReplaced } from '@/lib/expenseChanges';
import { useSettingsStore, type ThemePreference } from '@/store/settings-store';
import { applyNativeThemePreference, useAppTheme } from '@/theme/use-app-theme';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import * as settingsRepo from '@/repositories/settingsRepo';
import {
  BackupFileError,
  BackupRestoreError,
  backupFileSizeIsValid,
  createBackupFilename,
  createBackupSnapshot,
  getCurrentBackupCounts,
  readBackupFile,
  restoreBackupAtomically,
  shareBackupFile,
  verifyBackupFile,
  writeBackupFile,
  type BackupCounts,
  type BackupFileResult,
} from '@/features/settings/utils/backupService';
import {
  MAX_BACKUP_FILE_BYTES,
  type GastosGangBackup,
} from '@/features/settings/utils/backupSchema';

type Props = { onBack: () => void };
type SafetyBackup = {
  backup: GastosGangBackup;
  file: BackupFileResult;
  shared: boolean;
};

function errorText(cause: unknown, context: 'backup' | 'restore' = 'restore'): string {
  if (cause instanceof BackupRestoreError) {
    if (cause.code === 'POST_COMMIT_VERIFY_FAILED' || cause.committed) {
      return 'The data replacement committed, but verification could not finish. Do not retry yet; restart the app and check your data.';
    }
    if (cause.message.includes('changed after the safety backup')) {
      return 'Your device data changed after the safety backup. Create and share a fresh safety backup before restoring.';
    }
    return 'Restore failed. SQLite rolled back the replacement, so your previous data remains intact.';
  }
  if (cause instanceof BackupFileError) {
    if (cause.code === 'FILE_TOO_LARGE') {
      return 'This backup is larger than the supported 25 MB limit.';
    }
    if (cause.code === 'FILE_READ_FAILED') {
      return 'Could not read that file. Choose a readable Gastos Gang JSON backup.';
    }
    if (cause.code === 'FILE_WRITE_FAILED') {
      return context === 'restore'
        ? 'Could not write and verify the safety backup. Restore was not performed.'
        : 'Could not create and verify the backup file.';
    }
    if (cause.code === 'SHARING_UNAVAILABLE') {
      return context === 'restore'
        ? 'Sharing is not available on this device. Restore cannot continue without offering the safety backup externally.'
        : 'Sharing is not available. The backup remains in temporary app storage and is not saved externally.';
    }
    return context === 'restore'
      ? 'Could not open the sharing sheet. The restore was not performed.'
      : 'Could not open the sharing sheet. No external copy was confirmed.';
  }
  if (cause instanceof Error) return cause.message;
  return 'Something went wrong. Please try again.';
}

function countsText(counts: BackupCounts): string {
  const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
    `${count} ${count === 1 ? singular : pluralForm}`;
  return `${plural(counts.expenses, 'expense')} · ${plural(counts.categories, 'category', 'categories')} · ${plural(counts.settings, 'setting')}`;
}

function dateText(value: string): string {
  return new Date(value).toLocaleString();
}


function ActionButton({
  accessibilityLabel,
  disabled,
  icon,
  label,
  loading,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: colors.primary },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator accessibilityLabel={label} color={colors.primaryText} />
      ) : (
        <>
          <Ionicons name={icon} size={20} color={colors.primaryText} />
          <Text style={[styles.actionText, { color: colors.primaryText }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function BackupScreen({ onBack }: Props) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const operationRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedFile, setSavedFile] = useState<BackupFileResult | null>(null);

  const share = useCallback(async (file: BackupFileResult) => {
    await shareBackupFile(file.uri, file.filename);
  }, []);

  const createBackup = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const backup = await createBackupSnapshot(db);
      const filename = createBackupFilename('backup');
      const file = await writeBackupFile(backup, filename);
      setSavedFile(file);
      await share(file);
      const readyMessage =
        'Backup file prepared. The share sheet closed; this app cannot tell whether you saved a copy. The file is not encrypted.';
      setMessage(readyMessage);
      Toast.show({
        type: 'expenseSaved',
        text1: 'BACKUP FILE READY',
        text2: 'Choose a destination to save or share your copy.',
        position: 'bottom',
        props: { kind: 'info' },
      });
    } catch (cause) {
      const message = errorText(cause, 'backup');
      setError(message);
      Toast.show({
        type: 'expenseSaved',
        text1: 'BACKUP FAILED',
        text2: message,
        position: 'bottom',
        props: { kind: 'error' },
      });
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [db, share]);

  const shareAgain = useCallback(async () => {
    if (!savedFile || operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    try {
      await share(savedFile);
      setMessage('The share sheet closed. Saving the backup is not confirmed.');
    } catch (cause) {
      setError(errorText(cause, 'backup'));
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [savedFile, share]);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="BACK UP DATA" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Keep a copy of your Gastos Gang data.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            This backup includes all categories, expenses, and saved preferences, including archived categories and future-dated expenses.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.orange} />
            <Text style={[styles.detail, { color: colors.text }]}>
              Privacy notice: the JSON file contains personal financial information and is not encrypted. Store it somewhere private.
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            <Text style={[styles.detail, { color: colors.text }]}>
              The backup is prepared on this device. Nothing is uploaded automatically.
            </Text>
          </View>
          <ActionButton
            accessibilityLabel="CREATE AND SHARE BACKUP"
            disabled={isBusy}
            icon="share-outline"
            label="CREATE & SHARE BACKUP"
            loading={isBusy}
            onPress={() => void createBackup()}
          />
          {isBusy ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.textMuted }]}>
              Reading a consistent SQLite snapshot and verifying the backup file…
            </Text>
          ) : null}
          {savedFile ? (
            <ActionButton
              accessibilityLabel="SHARE BACKUP AGAIN"
              disabled={isBusy}
              icon="repeat-outline"
              label="SHARE BACKUP AGAIN"
              onPress={() => void shareAgain()}
            />
          ) : null}
          {error ? <Text accessibilityLiveRegion="assertive" style={[styles.status, { color: colors.warning }]}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.text }]}>{message}</Text> : null}
          {savedFile ? (
            <Text style={[styles.mutedStatus, { color: colors.textMuted }]}>
              Temporary file: {savedFile.filename}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function RestoreScreen({ onBack }: Props) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const operationRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backup, setBackup] = useState<GastosGangBackup | null>(null);
  const [currentCounts, setCurrentCounts] = useState<BackupCounts | null>(null);
  const [safety, setSafety] = useState<SafetyBackup | null>(null);
  const [acknowledgedExternalSave, setAcknowledgedExternalSave] = useState(false);

  const pickBackup = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (!asset) throw new Error('The selected file could not be opened.');
      setBackup(null);
      setCurrentCounts(null);
      setSafety(null);
      setAcknowledgedExternalSave(false);
      if (asset.size !== undefined && !backupFileSizeIsValid(asset.size)) {
        throw new BackupFileError(
          asset.size > MAX_BACKUP_FILE_BYTES ? 'FILE_TOO_LARGE' : 'FILE_READ_FAILED',
          'Selected backup file size is invalid.'
        );
      }
      const parsed = await readBackupFile(asset.uri);
      const counts = await getCurrentBackupCounts(db);
      setBackup(parsed);
      setCurrentCounts(counts);
      setSafety(null);
      setAcknowledgedExternalSave(false);
      setMessage('Backup validated. No database changes have been made.');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [db]);

  const createSafetyBackup = useCallback(async () => {
    if (!backup || operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    setMessage(null);
    setSafety(null);
    setAcknowledgedExternalSave(false);
    try {
      const safetyBackup = await createBackupSnapshot(db);
      const filename = createBackupFilename('before-restore');
      const file = await writeBackupFile(safetyBackup, filename);
      setSafety({ backup: safetyBackup, file, shared: false });
      await shareBackupFile(file.uri, file.filename);
      setSafety({ backup: safetyBackup, file, shared: true });
      setMessage(
        'The safety-backup share sheet closed. This app cannot confirm whether you saved it; the temporary file may not survive uninstall.'
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [backup, db]);

  const shareSafetyAgain = useCallback(async () => {
    if (!safety || operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    setAcknowledgedExternalSave(false);
    try {
      await shareBackupFile(safety.file.uri, safety.file.filename);
      setSafety({ ...safety, shared: true });
      setMessage(
        'The share sheet closed. Confirm below only if you saved an external copy you can access later.'
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [safety]);

  const performRestore = useCallback(async () => {
    if (!backup || !safety?.shared || !acknowledgedExternalSave || operationRef.current) return;
    operationRef.current = true;
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      await verifyBackupFile(safety.file, safety.backup);
      clearPendingBudgetWarning();
      Toast.hide();
      invalidateUndoOperations();
      const restored = await restoreBackupAtomically(db, backup, {
        expectedCurrentData: safety.backup.data,
      });

      let refreshError: unknown = null;
      try {
        notifyDataReplaced();
        const theme = await settingsRepo.getTyped<ThemePreference>(db, 'theme_mode') ?? 'dark';
        useSettingsStore.getState().setThemePreference(theme);
        applyNativeThemePreference(theme);
      } catch (cause) {
        refreshError = cause;
      }
      if (refreshError) {
        const refreshMessage =
          `Restore committed (${countsText(restored)}), but the app could not refresh all screens. Restart the app; the database transaction was not rolled back.`;
        setMessage(refreshMessage);
        Toast.show({
          type: 'expenseSaved',
          text1: 'RESTORE COMMITTED',
          text2: 'The app needs a refresh. Restart it to reload restored data.',
          position: 'bottom',
          props: { kind: 'error' },
        });
      } else {
        setMessage(
          `Restore committed and verified: ${countsText(restored)}. App screens were notified; restart if any screen stays stale or shows a refresh error.`
        );
        Toast.show({
          type: 'expenseSaved',
          text1: 'RESTORE COMMITTED',
          text2: 'Data is replaced. Restart if any screen does not refresh.',
          position: 'bottom',
          props: { kind: 'success' },
        });
      }
      setBackup(null);
      setSafety(null);
      setAcknowledgedExternalSave(false);
    } catch (cause) {
      const message = errorText(cause);
      setError(message);
      if (
        cause instanceof BackupRestoreError &&
        cause.code === 'INTEGRITY_FAILED' &&
        cause.message.includes('changed after the safety backup')
      ) {
        setSafety(null);
        setAcknowledgedExternalSave(false);
      }
      Toast.show({
        type: 'expenseSaved',
        text1: cause instanceof BackupRestoreError && cause.committed ? 'RESTORE NEEDS ATTENTION' : 'RESTORE FAILED',
        text2: message,
        position: 'bottom',
        props: { kind: 'error' },
      });
    } finally {
      operationRef.current = false;
      setIsBusy(false);
    }
  }, [acknowledgedExternalSave, backup, db, safety]);

  const confirmRestore = () => {
    if (!backup || !safety?.shared || !acknowledgedExternalSave || isBusy) return;
    Alert.alert(
      'REPLACE ALL DATA',
      "Bossing, mapapalitan ang gastos at settings sa phone na 'to. Make sure may backup ka muna.",
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'REPLACE ALL DATA', style: 'destructive', onPress: () => void performRestore() },
      ]
    );
  };

  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="RESTORE BACKUP" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-download-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Restore a Gastos Gang backup.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Restore replaces all current expenses, categories, and saved settings. Merging is not supported.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Ionicons name="warning-outline" size={20} color={colors.orange} />
            <Text style={[styles.detail, { color: colors.text }]}>
              Backups contain personal financial information and are not encrypted. The selected file is validated before any database changes.
            </Text>
          </View>
          <ActionButton
            accessibilityLabel="CHOOSE BACKUP FILE"
            disabled={isBusy}
            icon="folder-open-outline"
            label="CHOOSE BACKUP FILE"
            loading={isBusy && !backup}
            onPress={() => void pickBackup()}
          />

          {backup && currentCounts ? (
            <>
              <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.previewHeading, { color: colors.primary }]}>BACKUP PREVIEW</Text>
                <Text style={[styles.detail, { color: colors.text }]}>Created: {dateText(backup.createdAt)}</Text>
                <Text style={[styles.detail, { color: colors.text }]}>App version: {backup.appVersion}</Text>
                <Text style={[styles.detail, { color: colors.text }]}>
                  {plural(backup.data.expenses.length, 'expense')} · {plural(backup.data.categories.length, 'category')} · {plural(backup.data.settings.length, 'setting')}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.previewHeading, { color: colors.orange }]}>CURRENT DEVICE</Text>
                <Text style={[styles.detail, { color: colors.text }]}>{countsText(currentCounts)}</Text>
                <Text style={[styles.warningText, { color: colors.warning }]}>
                  Restoring replaces this device&apos;s expenses, categories, and settings.
                </Text>
              </View>

              {!safety ? (
                <ActionButton
                  accessibilityLabel="CREATE AND SHARE SAFETY BACKUP"
                  disabled={isBusy}
                  icon="shield-checkmark-outline"
                  label="CREATE & SHARE SAFETY BACKUP"
                  loading={isBusy}
                  onPress={() => void createSafetyBackup()}
                />
              ) : (
                <View style={[styles.safetyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Text style={[styles.previewHeading, { color: colors.primary }]}>SAFETY BACKUP</Text>
                  <Text style={[styles.detail, { color: colors.text }]}>{safety.file.filename}</Text>
                  <Text style={[styles.mutedStatus, { color: colors.textMuted }]}>
                    {countsText({
                      categories: safety.backup.data.categories.length,
                      expenses: safety.backup.data.expenses.length,
                      settings: safety.backup.data.settings.length,
                    })}
                  </Text>
                  <Text style={[styles.mutedStatus, { color: colors.textMuted }]}>
                    Temporary app storage may not survive uninstall. You must share this file somewhere external before continuing.
                  </Text>
                  <ActionButton
                    accessibilityLabel="SHARE SAFETY BACKUP AGAIN"
                    disabled={isBusy}
                    icon="share-outline"
                    label="SHARE SAFETY BACKUP AGAIN"
                    onPress={() => void shareSafetyAgain()}
                  />
                  {safety.shared ? (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="I saved the safety backup outside this app"
                      accessibilityState={{ checked: acknowledgedExternalSave, disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => setAcknowledgedExternalSave((value) => !value)}
                      style={styles.acknowledgment}>
                      <Ionicons
                        name={acknowledgedExternalSave ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={acknowledgedExternalSave ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.detail, { color: colors.text }]}>
                        I saved the safety backup somewhere outside this app.
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              {safety?.shared ? (
                <ActionButton
                  accessibilityLabel="REPLACE ALL DATA"
                  disabled={isBusy || !acknowledgedExternalSave}
                  icon="warning-outline"
                  label="REPLACE ALL DATA"
                  loading={isBusy}
                  onPress={confirmRestore}
                />
              ) : null}
            </>
          ) : null}

          {isBusy ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.textMuted }]}>
              {backup ? 'Preparing a safety backup or restoring your data…' : 'Reading and validating the selected backup…'}
            </Text>
          ) : null}
          {error ? <Text accessibilityLiveRegion="assertive" style={[styles.status, { color: colors.warning }]}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.text }]}>{message}</Text> : null}
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
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  actionText: { ...typography.label, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  status: { ...typography.caption, textAlign: 'center' },
  mutedStatus: { ...typography.caption, textAlign: 'center' },
  preview: { gap: spacing.sm, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  previewHeading: { ...typography.label, letterSpacing: 0.8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  warningText: { ...typography.caption, fontWeight: '800' },
  safetyCard: { gap: spacing.md, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  acknowledgment: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
