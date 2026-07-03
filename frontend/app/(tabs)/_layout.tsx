import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { COLORS } from '../../constants/Theme';
import LogoutButton from '../../components/LogoutButton';

export default function TabsLayout() {
  const [role, setRole] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem('userRole').then(setRole);
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderTopColor: COLORS.glassBorder,
          borderTopWidth: 1,
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 10,
          ...Platform.select({
            web: {
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as any,
            default: {},
          }),
        },
        headerStyle: {
          backgroundColor: COLORS.headerBackground,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: '800',
        },
        headerRight: () => <LogoutButton />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sites"
        options={{
          title: 'Sites',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="location-city" size={size} color={color} />
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="admin-panel-settings" size={size} color={color} />
          ),
          href: role === 'Admin' ? '/admin' : null,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="account-balance-wallet" size={size} color={color} />
          ),
          href: role === 'Admin' || role === 'Supervisor' ? '/accounts' : null,
        }}
      />
      <Tabs.Screen
        name="upload-bill"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="receipt" size={size} color={color} />
          ),
          href: (role === 'Supervisor' || role === 'Site Engineer') ? '/upload-bill' : null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment-ind" size={size} color={color} />
          ),
          href: (role === 'Supervisor' || role === 'Site Engineer') ? '/attendance' : null,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Actions',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="apps" size={size} color={color} />
          ),
          href: role === 'Admin' ? null : '/actions',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
