import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Theme';
import LogoutButton from '../components/LogoutButton';

export default function RootLayout() {
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
        <Stack.Screen name="supervisor-attendance" options={{ title: 'Supervisor Clock-In' }} />
        <Stack.Screen name="cash-expense" options={{ title: 'Log Daily Expense' }} />
        <Stack.Screen name="accounts-ledger" options={{ title: 'Accounts' }} />
        <Stack.Screen name="owner-accounts" options={{ title: 'Owner Accounts' }} />
        <Stack.Screen name="total-accounts" options={{ title: 'Total Accounts' }} />
        <Stack.Screen name="admin-panel" options={{ title: 'Admin Control Panel' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
