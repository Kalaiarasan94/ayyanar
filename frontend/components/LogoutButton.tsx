import React from 'react';
import { Alert, Text, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS } from '../constants/Theme';

type LogoutButtonProps = {
  variant?: 'header' | 'solid' | 'menu';
  showText?: boolean;
};

export default function LogoutButton({ variant = 'header', showText = true }: LogoutButtonProps) {
  const router = useRouter();

  const performLogout = async () => {
    try {
      console.log('Logout: clearing storage...');

      // AsyncStorage works on every platform (it is backed by localStorage on web)
      await AsyncStorage.multiRemove(['userRole', 'userName', 'userId']);

      console.log('Logout: storage cleared successfully');
    } catch (error) {
      console.error('Logout: error clearing storage:', error);
    }

    // Hermes defines a global `window` on native, so we must check Platform.OS —
    // window.location / localStorage only exist on real web browsers.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      console.log('Logout: Web platform detected, redirecting via window.location...');
      window.location.assign('/');
      return;
    }

    try {
      console.log('Logout: replacing route to /...');
      router.replace('/');
    } catch (routerError) {
      console.error('Logout: router.replace / failed:', routerError);
      try {
        router.navigate('/' as any);
      } catch (navigateError) {
        console.error('Logout: router.navigate failed:', navigateError);
      }
    }
  };

  const handleLogout = () => {
    performLogout();
  };

  const isSolid = variant === 'solid';
  const isMenu = variant === 'menu';
  const iconColor = isSolid ? COLORS.white : COLORS.primary;

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMenu ? 12 : 5,
        marginRight: variant === 'header' ? 12 : 0,
        backgroundColor: isSolid ? COLORS.primary : 'rgba(226, 26, 18, 0.1)',
        paddingHorizontal: isMenu ? 24 : 10,
        paddingVertical: isMenu ? 16 : 6,
        borderRadius: isMenu ? BORDER_RADIUS.xl : 6,
        borderWidth: isMenu ? 1 : 0,
        borderColor: COLORS.glassBorder,
      }}
    >
      <MaterialIcons name="logout" size={isMenu ? 24 : 16} color={iconColor} />
      {showText && (
        <Text style={{ color: iconColor, fontWeight: 'bold', fontSize: isMenu ? 16 : 12 }}>
          LOGOUT
        </Text>
      )}
    </TouchableOpacity>
  );
}
