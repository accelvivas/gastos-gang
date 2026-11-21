import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ focused, name }: { focused: boolean; name: TabIconName }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.iconContainer, focused && { backgroundColor: colors.primary }]}>
      <Ionicons
        name={name}
        size={focused ? 25 : 24}
        color={focused ? colors.primaryText : colors.textMuted}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.shell, { backgroundColor: colors.background }]}>
      <AppHeader />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1.5,
          height: layout.tabBarHeight + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: insets.bottom + spacing.sm,
        },
        tabBarItemStyle: { minHeight: layout.minimumTapTarget },
        tabBarIconStyle: styles.iconSlot,
        tabBarLabelStyle: { ...typography.tabLabel, textTransform: 'uppercase' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Entry', tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="time-outline" /> }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary', tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="receipt-outline" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="settings-outline" /> }} />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  iconSlot: { height: 42, marginBottom: spacing.xs },
  iconContainer: { width: 52, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg },
});
