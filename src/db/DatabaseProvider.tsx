import { SQLiteProvider } from 'expo-sqlite';
import { Component, type ErrorInfo, type PropsWithChildren, Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initDatabase } from '@/db/client';
import { layout, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const DATABASE_NAME = 'gastos-gang.db';

type ErrorBoundaryState = {
  error: Error | null;
};

class DatabaseErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Database initialization failed.', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <DatabaseErrorScreen />;
    }
    return this.props.children;
  }
}

function DatabaseLoadingScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <Text style={[styles.body, { color: colors.textMuted }]}>Preparing your gastos…</Text>
    </View>
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

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <DatabaseErrorBoundary>
      <Suspense fallback={<DatabaseLoadingScreen />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} useSuspense>
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
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: typography.heading,
  body: typography.body,
});
