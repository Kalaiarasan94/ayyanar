import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { COLORS } from '../constants/Theme';
import LogoutButton from '../components/LogoutButton';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause some errors here, safe to ignore */
});

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after 500ms to ensure everything is rendered
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.headerBackground} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.headerBackground },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '800' },
          headerRight: () => <LogoutButton />,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="upload-bill" options={{ title: 'Log Material Bill' }} />
        <Stack.Screen name="attendance" options={{ title: 'Daily Attendance' }} />
        <Stack.Screen name="cash-expense" options={{ title: 'Log Daily Expense' }} />
        <Stack.Screen name="accounts-ledger" options={{ title: 'Accounts' }} />
        <Stack.Screen name="owner-accounts" options={{ title: 'Owner Accounts' }} />
        <Stack.Screen name="total-accounts" options={{ title: 'Total Accounts' }} />
        <Stack.Screen name="admin-panel" options={{ title: 'Admin Control Panel' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
