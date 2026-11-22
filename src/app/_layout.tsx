import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppToast } from '@/components/AppToast';
import { AnimatedLaunchScreen } from '@/components/startup/AnimatedLaunchScreen';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { RecurringLifecycle } from '@/features/recurring/RecurringLifecycle';
import { useAppStartup } from '@/hooks/useAppStartup';
import { streetColors } from '@/theme/tokens';
import { applyNativeThemePreference, useAppTheme } from '@/theme/use-app-theme';

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Could not prevent the native splash screen from hiding.', error);
});

function DatabaseReadyReporter({ onReady }: { onReady: () => void }) {
  const didReportReady = useRef(false);

  useEffect(() => {
    if (didReportReady.current) return;
    didReportReady.current = true;
    onReady();
  }, [didReportReady, onReady]);

  return null;
}

export default function RootLayout() {
  const { colors, isDark, themePreference } = useAppTheme();
  const startup = useAppStartup();
  const launching = startup.phase !== 'completed' && startup.phase !== 'error';
  const rootBackground = launching ? streetColors.background : colors.background;
  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    if (startup.phase !== 'error') return;
    SplashScreen.hideAsync().catch((error) => {
      console.warn('Could not hide the native splash screen after a startup error.', error);
    });
  }, [startup.phase]);

  useEffect(() => {
    applyNativeThemePreference(themePreference);
    SystemUI.setBackgroundColorAsync(rootBackground).catch((error) => {
      console.warn('Could not update the application background color.', error);
    });
  }, [rootBackground, themePreference]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: rootBackground }}>
      <DatabaseProvider onError={startup.markError}>
        <ThemeProvider value={navigationTheme}>
          {startup.phase !== 'error' ? (
            <DatabaseReadyReporter onReady={startup.markReady} />
          ) : null}
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="expense/[id]"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="settings/[feature]"
              options={{ presentation: 'modal', headerShown: false }}
            />
            {__DEV__ ? <Stack.Screen name="dev-db" options={{ title: 'Database check' }} /> : null}
          </Stack>
          <RecurringLifecycle />
          <StatusBar style={launching || isDark ? 'light' : 'dark'} />
          <AppToast />
          {(startup.phase === 'ready' || startup.phase === 'animating') ? (
            <AnimatedLaunchScreen
              onNativeSplashReady={startup.markAnimating}
              onCompleted={startup.markCompleted}
            />
          ) : null}
        </ThemeProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
