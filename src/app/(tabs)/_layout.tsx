import { Tabs } from 'expo-router';

import { layout, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: layout.tabBarHeight,
        },
        tabBarItemStyle: { minHeight: layout.minimumTapTarget },
        tabBarLabelStyle: typography.tabLabel,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Entry' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
