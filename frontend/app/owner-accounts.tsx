import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AccountsModule from '../components/AccountsModule';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

export default function OwnerAccountsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 96 }}
    >
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#8C0F16',
          borderRadius: BORDER_RADIUS.md,
          paddingVertical: 14,
          marginBottom: SPACING.md,
        }}
        onPress={() => router.push('/indirect-bills')}
      >
        <MaterialIcons name="fact-check" size={18} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Review & Approve Indirect Bills</Text>
      </TouchableOpacity>

      <AccountsModule
        role="Owner"
        heading="Owner Accounts"
        inputSources={['Admin', 'Supervisors', 'Client', 'Govt', 'Loan']}
        outputTargets={['Admin', 'Supervisors', 'Personal Expenses']}
      />
    </ScrollView>
  );
}
