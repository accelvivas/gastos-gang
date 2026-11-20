import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addSampleExpense,
  clearAllExpenses,
  type DevDatabaseStats,
  getDevDatabaseStats,
  seedDemoData,
} from '@/db/dev';
import { formatPeso } from '@/lib/money';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

// TODO(Phase 6): remove this temporary database verification route.
export default function DevDatabaseRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <DevDatabaseScreen />;
}

function DevDatabaseScreen() {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [stats, setStats] = useState<DevDatabaseStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStats(await getDevDatabaseStats(db));
      setError(null);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [db]);

  useEffect(() => {
    let isActive = true;
    void getDevDatabaseStats(db)
      .then((nextStats) => {
        if (isActive) {
          setStats(nextStats);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(errorMessage(loadError));
        }
      });

    return () => {
      isActive = false;
    };
  }, [db]);

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (actionError) {
        setError(errorMessage(actionError));
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.note, { color: colors.warning }]}>Development only</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Stat label="Schema version" value={stats?.schemaVersion ?? '…'} />
          <Stat label="Categories" value={stats?.categoryCount ?? '…'} />
          <Stat label="Expenses" value={stats?.expenseCount ?? '…'} />
          <Stat
            label="Today total"
            value={stats ? formatPeso(stats.todayTotalCentavos) : '…'}
          />
        </View>
        <DevButton
          label="Add sample expense"
          disabled={busy}
          onPress={() => void runAction(() => addSampleExpense(db))}
        />
        <DevButton
          label="Seed demo data"
          disabled={busy}
          onPress={() => void runAction(() => seedDemoData(db))}
        />
        <DevButton
          label="Clear expenses"
          disabled={busy}
          onPress={() => void runAction(() => clearAllExpenses(db))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function DevButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.primary, opacity: disabled || pressed ? 0.55 : 1 },
      ]}>
      <Text style={[styles.buttonLabel, { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  note: typography.label,
  error: typography.body,
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statRow: {
    minHeight: layout.minimumTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  body: typography.body,
  value: typography.heading,
  button: {
    minHeight: layout.minimumTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: typography.label,
});
