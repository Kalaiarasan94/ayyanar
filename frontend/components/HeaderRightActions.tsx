import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import LogoutButton from './LogoutButton';
import InstallAppButton from './InstallAppButton';
import UpdateAppButton from './UpdateAppButton';
import { COLORS, BORDER_RADIUS } from '../constants/Theme';

export default function HeaderRightActions() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <UpdateAppButton variant="header" />
      <InstallAppButton variant="header" />
      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => router.push('/(tabs)/profile')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityLabel="User Profile and Security"
      >
        <MaterialIcons name="account-circle" size={20} color={COLORS.white} />
      </TouchableOpacity>
      <LogoutButton variant="header" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  profileBtn: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
});
