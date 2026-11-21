import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StreetBackground } from '@/components/StreetBackground';
import { layout, radii, spacing, streetColors, typography } from '@/theme/tokens';

import { useSpendingSummary } from '../useSpendingSummary';
import { CategoryBreakdown } from './CategoryBreakdown';
import { DailySpendingChart } from './DailySpendingChart';
import { PeriodToggle, SpendingInsights, SummaryHeader, TotalSpendingCard } from './SummaryOverview';
import { summaryStyles } from './summaryStyles';

export function SummaryScreen() {
  const { period, setPeriod, refresh, data, status } = useSpendingSummary();
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StreetBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl refreshing={status === 'loading' && data !== null} onRefresh={() => void refresh()}
            tintColor={streetColors.lime} colors={[streetColors.lime]} progressBackgroundColor={streetColors.surface} />
        )}>
        <SummaryHeader />
        <PeriodToggle period={period} onChange={setPeriod} />
        {status === 'error' ? (
          <View style={summaryStyles.card}>
            <Text accessibilityLiveRegion="assertive" style={summaryStyles.title}>Hindi ma-load ang summary, boss. Try ulit.</Text>
            <Action label="Try again" onPress={() => void refresh()} />
          </View>
        ) : data ? (
          <>
            <TotalSpendingCard period={period} data={data} />
            {data.totalCentavos === 0 && (
              <View style={summaryStyles.card}>
                <Text accessibilityRole="header" style={summaryStyles.title}>WALA PANG DAMAGE, BOSS!</Text>
                <Text style={summaryStyles.muted}>Tahimik ang wallet mo ah. Solid!</Text>
                <Action label="Log Gastos" onPress={() => router.navigate('/')} />
              </View>
            )}
            <CategoryBreakdown categories={data.categories} total={data.totalCentavos} />
            <DailySpendingChart days={data.days} biggestDay={data.biggestDay} period={period} />
            <SpendingInsights data={data} />
          </>
        ) : (
          <View style={[summaryStyles.card, styles.loading]}>
            <ActivityIndicator color={streetColors.lime} />
            <Text accessibilityLiveRegion="polite" style={summaryStyles.muted}>Loading spending summary…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: streetColors.background },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  loading: { flexDirection: 'row', alignItems: 'center' },
  action: { minHeight: layout.minimumTapTarget, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: streetColors.lime, borderRadius: radii.md, paddingHorizontal: spacing.lg },
  actionText: { ...typography.label, color: streetColors.black, textTransform: 'uppercase' },
});
