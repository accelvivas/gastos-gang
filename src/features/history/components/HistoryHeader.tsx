import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { TabHeading } from '@/components/AppHeader';
import { radii, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function HistoryHeader({
  searchOpen, filterActive, onSearch, onFilter,
}: {
  searchOpen: boolean;
  filterActive: boolean;
  onSearch: () => void;
  onFilter: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <TabHeading title="HISTORY" subtitle="Lahat ng gastos mo, bossing." />
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search expenses" accessibilityState={{ expanded: searchOpen }} onPress={onSearch} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }, searchOpen && { borderColor: colors.primary }]}>
            <Ionicons name="search-outline" size={24} color={searchOpen ? colors.primary : colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={filterActive ? 'Filter expenses, filters active' : 'Filter expenses'} onPress={onFilter} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }, filterActive && { borderColor: colors.primary }]}>
            <Ionicons name="filter-outline" size={24} color={filterActive ? colors.primary : colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.md },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  headingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 138 },
  actions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto' },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radii.md },
});
