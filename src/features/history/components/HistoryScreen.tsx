import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { StreetBackground } from '@/components/StreetBackground';
import type { ExpenseWithCategory } from '@/db/types';
import { HistoryEmptyState } from '@/features/history/components/HistoryEmptyState';
import { HistoryFilterSheet } from '@/features/history/components/HistoryFilterSheet';
import { HistoryHeader } from '@/features/history/components/HistoryHeader';
import { HistoryListFooter } from '@/features/history/components/HistoryListFooter';
import { HistorySectionHeader } from '@/features/history/components/HistorySectionHeader';
import { SwipeableExpenseRow } from '@/features/history/components/SwipeableExpenseRow';
import { useExpenseHistory } from '@/features/history/hooks/useExpenseHistory';
import type { HistorySection } from '@/features/history/types';
import { defaultHistoryFilter, historyRange, periods } from '@/features/history/utils/historyFilters';
import { todayKey } from '@/lib/dates';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

export function HistoryScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState(defaultHistoryFilter);
  const [appliedCategoryName, setAppliedCategoryName] = useState<string>();
  const day = todayKey();
  const filterActive = filter.categoryId !== undefined || filter.period !== 'all';
  const criteria = useMemo(() => {
    const dateRange = historyRange(filter, day);
    if (!debouncedSearch && filter.categoryId === undefined && !dateRange) return undefined;
    return { search: debouncedSearch, categoryId: filter.categoryId, dateRange };
  }, [day, debouncedSearch, filter]);
  const history = useExpenseHistory(Date.now, criteria);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const clearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
  };
  const clearFilters = () => {
    clearSearch();
    setFilter(defaultHistoryFilter());
    setAppliedCategoryName(undefined);
    Keyboard.dismiss();
  };
  const deleteExpense = history.deleteExpense;
  const openRowRef = useRef<{ id: number; methods: SwipeableMethods } | null>(null);

  const openEditor = useCallback((expense: ExpenseWithCategory) => {
    router.push({ pathname: '/expense/[id]', params: { id: String(expense.id) } });
  }, []);

  const handleSwipeOpen = useCallback((id: number, methods: SwipeableMethods) => {
    if (openRowRef.current && openRowRef.current.id !== id) openRowRef.current.methods.close();
    openRowRef.current = { id, methods };
  }, []);

  const handleDelete = useCallback(
    (expense: ExpenseWithCategory) => {
      if (openRowRef.current?.id === expense.id) {
        openRowRef.current.methods.close();
        openRowRef.current = null;
      }
      void deleteExpense(expense);
    },
    [deleteExpense]
  );

  const renderItem = useCallback(
    ({ item }: { item: ExpenseWithCategory }) => (
      <SwipeableExpenseRow
        expense={item}
        onDelete={handleDelete}
        onOpen={handleSwipeOpen}
        onPress={openEditor}
      />
    ),
    [handleDelete, handleSwipeOpen, openEditor]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: HistorySection }) => (
      <HistorySectionHeader title={section.title} totalCentavos={section.totalCentavos} />
    ),
    []
  );

  const searching = search.trim() !== debouncedSearch;
  const empty = history.isLoading || searching ? (
    <ActivityIndicator accessibilityLabel="Loading expense history" color={streetColors.lime} style={styles.centered} />
  ) : history.error ? (
    <View style={styles.centered}>
      <Text accessibilityLiveRegion="assertive" style={styles.error}>{history.error}</Text>
      <Pressable accessibilityRole="button" onPress={() => void history.refresh()} style={styles.retry}>
        <Text style={styles.retryText}>TRY AGAIN</Text>
      </Pressable>
    </View>
  ) : (
    <HistoryEmptyState onClear={criteria ? clearFilters : undefined} />
  );

  return (
    <View style={styles.screen}>
      <StreetBackground />
      <SectionList
        sections={searching ? [] : history.sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={
          <View>
            <HistoryHeader searchOpen={searchOpen} filterActive={filterActive} onSearch={() => {
              if (searchOpen) { clearSearch(); Keyboard.dismiss(); }
              setSearchOpen(!searchOpen);
            }} onFilter={() => { Keyboard.dismiss(); setFilterOpen(true); }} />
            {searchOpen && (
              <View style={styles.search}>
                <TextInput accessibilityLabel="Search by category or note" autoFocus autoCapitalize="none" onChangeText={setSearch} onSubmitEditing={Keyboard.dismiss} placeholder="Search gastos, bossing…" placeholderTextColor={streetColors.muted} returnKeyType="search" style={styles.input} value={search} />
                {search !== '' && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clearSearch} style={styles.clear}>
                    <Text style={styles.retryText}>CLEAR</Text>
                  </Pressable>
                )}
              </View>
            )}
            {filterActive && (
              <Text style={styles.filterLabel}>
                {periods.find(([period]) => period === filter.period)?.[1]}
                {filter.period === 'custom' ? ` · ${filter.fromKey} – ${filter.toKey}` : ''}
                {filter.categoryId !== undefined ? ` · ${appliedCategoryName ?? 'Category filter on'}` : ''}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          !searching && history.expenses.length > 0 ? (
            <HistoryListFooter
              hasMore={history.hasMore}
              isLoadingMore={history.isLoadingMore}
              paginationError={history.paginationError}
              onRetry={() => void history.loadMore()}
            />
          ) : undefined
        }
        contentContainerStyle={styles.content}
        onEndReached={() => { if (!searching) void history.loadMore(); }}
        onEndReachedThreshold={0.35}
        onRefresh={() => void history.refresh()}
        refreshing={history.isRefreshing}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />
      {filterOpen && (
        <HistoryFilterSheet initial={filter} onClose={() => setFilterOpen(false)} onApply={(next, name) => {
          setFilter(next);
          setAppliedCategoryName((previous) => name ?? (next.categoryId === filter.categoryId ? previous : undefined));
          setFilterOpen(false);
        }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: streetColors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  search: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, backgroundColor: streetColors.surface, borderColor: streetColors.border, borderWidth: 1, borderRadius: radii.md },
  input: { ...typography.body, flex: 1, minHeight: 48, paddingHorizontal: spacing.md, color: streetColors.cream },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  filterLabel: { ...typography.caption, color: streetColors.lime, marginBottom: spacing.sm },
  error: { ...typography.body, color: streetColors.orange, textAlign: 'center' },
  retry: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.xl },
  retryText: { ...typography.label, color: streetColors.lime },
});
