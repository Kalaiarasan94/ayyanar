import React from 'react';
import { View, StyleSheet } from 'react-native';
import LogoutButton from './LogoutButton';
import InstallAppButton from './InstallAppButton';

export default function HeaderRightActions() {
  return (
    <View style={styles.container}>
      <InstallAppButton variant="header" />
      <LogoutButton variant="header" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
});
