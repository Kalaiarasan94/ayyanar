import React from 'react';
import { ScrollView } from 'react-native';
import AccountsModule from '../components/AccountsModule';
import { COLORS, SPACING } from '../constants/Theme';

export default function OwnerAccountsScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 96 }}
    >
      <AccountsModule
        role="Owner"
        heading="Owner Accounts"
        inputSources={['Client', 'Govt', 'Loan']}
        outputTargets={['Admin', 'Supervisors', 'Personal Expenses']}
      />
    </ScrollView>
  );
}
