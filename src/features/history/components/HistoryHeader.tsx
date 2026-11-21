import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { StreetStarburst } from '@/components/StreetStarburst';
import { radii, spacing, streetColors, typography } from '@/theme/tokens';

const bars = [2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 3, 1, 2];

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
      <View style={styles.brandRow}>
        <View style={styles.branding}>
          <BrandLogo size={52} />
          <Text accessibilityRole="header" style={styles.wordmark}>
            GASTOS <Text style={styles.wordmarkLime}>GANG.</Text>
          </Text>
        </View>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.spark}>
            <StreetStarburst color={streetColors.orange} size={16} />
          </View>
          <View style={styles.sticker}>
            <Text style={styles.stickerText} maxFontSizeMultiplier={1.25}>{'YOUR\nGASTOS\nRECEIPTS'}</Text>
            <View style={styles.barcode}>
              {bars.map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.heading}>HISTORY</Text>
          <Text style={styles.subtitle}>Lahat ng gastos mo, bossing.</Text>
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
  container: { gap: 20, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.xs },
  branding: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { ...typography.title, flex: 1, color: streetColors.cream, fontSize: 22, lineHeight: 26, letterSpacing: -0.7 },
  wordmarkLime: { color: streetColors.lime },
  art: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  spark: { alignSelf: 'flex-start' },
  sticker: { backgroundColor: streetColors.lime, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, transform: [{ rotate: '-8deg' }] },
  stickerText: { color: streetColors.black, fontSize: 9, lineHeight: 10, fontWeight: '900', letterSpacing: 0.4 },
  barcode: { marginTop: spacing.xs, flexDirection: 'row', gap: 1 },
  bar: { height: 10, backgroundColor: streetColors.black },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  headingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 138, borderLeftWidth: 6, borderLeftColor: streetColors.lime, paddingLeft: spacing.sm },
  heading: { ...typography.title, color: streetColors.cream, fontSize: 34, lineHeight: 39 },
  subtitle: { ...typography.caption, color: streetColors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto' },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: streetColors.border, borderRadius: radii.md, backgroundColor: streetColors.surface },
  active: { borderColor: streetColors.lime },
});
