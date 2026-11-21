import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { TabHeading } from '@/components/AppHeader';
import { radii, spacing, streetColors } from '@/theme/tokens';

export function HistoryHeader({
  searchOpen, filterActive, onSearch, onFilter,
}: {
  searchOpen: boolean;
  filterActive: boolean;
  onSearch: () => void;
  onFilter: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <TabHeading title="HISTORY" subtitle="Lahat ng gastos mo, bossing." />
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search expenses" accessibilityState={{ expanded: searchOpen }} onPress={onSearch} style={[styles.button, searchOpen && styles.active]}>
            <Ionicons name="search-outline" size={24} color={searchOpen ? streetColors.lime : streetColors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={filterActive ? 'Filter expenses, filters active' : 'Filter expenses'} onPress={onFilter} style={[styles.button, filterActive && styles.active]}>
            <Ionicons name="filter-outline" size={24} color={filterActive ? streetColors.lime : streetColors.muted} />
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
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: streetColors.border, borderRadius: radii.md, backgroundColor: streetColors.surface },
  active: { borderColor: streetColors.lime },
});
