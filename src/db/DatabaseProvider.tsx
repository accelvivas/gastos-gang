import { SQLiteProvider } from 'expo-sqlite';
import { Component, type PropsWithChildren, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LaunchLogo } from '@/components/startup/LaunchLogo';
import { LaunchWordmark } from '@/components/startup/LaunchWordmark';
import { initDatabase, type DbLike } from '@/db/client';
import { hydrateThemePreference } from '@/theme/theme-storage';
import { layout, spacing, streetColors, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const DATABASE_NAME = 'gastos-gang.db';

async function initializeDatabase(db: DbLike): Promise<void> {
  await initDatabase(db);
  await hydrateThemePreference(db);
}

type ErrorBoundaryState = {
  error: Error | null;
};

type DatabaseErrorBoundaryProps = PropsWithChildren<{
  onError?: (error: Error) => void;
}>;

class DatabaseErrorBoundary extends Component<DatabaseErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('Database initialization failed.');
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      return <DatabaseErrorScreen />;
    }
    return this.props.children;
  }
}

function DatabaseLoadingScreen() {
  return (
    <SafeAreaView style={[styles.centered, styles.launchLoading]}>
      <LaunchLogo size={76} />
      <LaunchWordmark />
      <ActivityIndicator accessibilityLabel="Preparing your gastos" color={streetColors.lime} />
    </SafeAreaView>
  );
}

function DatabaseErrorScreen() {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Hindi mabuksan ang data
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Please close and reopen Gastos Gang. Your saved expenses were not deleted.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function DatabaseProvider({
  children,
  onError,
}: PropsWithChildren<{ onError?: (error: Error) => void }>) {
  return (
    <DatabaseErrorBoundary onError={onError}>
      <Suspense fallback={<DatabaseLoadingScreen />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
          {children}
        </SQLiteProvider>
      </Suspense>
    </DatabaseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchLoading: { backgroundColor: streetColors.background, gap: spacing.md, paddingHorizontal: spacing.xl },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: typography.heading,
  body: typography.body,
});
