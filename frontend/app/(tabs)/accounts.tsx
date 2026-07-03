import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AccountsModule from '../../components/AccountsModule';
import { COLORS, SPACING } from '../../constants/Theme';

// Accounts main-menu tab: shows the Admin or Supervisor account book based on who is logged in
export default function AccountsTabScreen() {
  const [role, setRole] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('userRole').then(setRole);
    }, [])
  );

  if (!role) return null;

  const config =
    role === 'Admin'
      ? {
          role: 'Admin' as const,
          heading: 'Admin Accounts',
          inputSources: ['Owner', 'Client'],
          outputTargets: ['Supervisors', 'Company Expenses'],
        }
      : {
          role: 'Supervisor' as const,
          heading: 'Supervisor Accounts',
          inputSources: ['Owner', 'Admin', 'Client'],
          outputTargets: ['Site Expenses', 'Petrol', 'Company Expenses'],
        };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 96 }}
    >
      <AccountsModule key={role} {...config} />
    </ScrollView>
  );
}
