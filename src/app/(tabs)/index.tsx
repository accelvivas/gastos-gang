import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const DEV_DATABASE_ROUTE = '/dev-db' as Href;

export default function EntryRoute() {
  const { colors } = useAppTheme();

  return (
    <ScreenPlaceholder
      title="Gastos Gang"
      description="One-tap expense entry lands here in Phase 2.">
      {__DEV__ ? (
        <Link href={DEV_DATABASE_ROUTE} asChild>
          <Pressable
            accessibilityLabel="Open database verification screen"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.devButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={[styles.devButtonText, { color: colors.surface }]}>Check database</Text>
          </Pressable>
        </Link>
      ) : null}
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  devButton: {
    minHeight: layout.minimumTapTarget,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  devButtonText: typography.label,
});
