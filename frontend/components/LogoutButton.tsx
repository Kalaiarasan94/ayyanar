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
      
      // Clear web storage directly if window is defined
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('userRole');
          localStorage.removeItem('userName');
          localStorage.removeItem('userId');
          localStorage.clear();
        } catch (e) {
          console.error('Error clearing localStorage:', e);
        }
      }

      // Clear using AsyncStorage
      try {
        await AsyncStorage.multiRemove(['userRole', 'userName', 'userId']);
        await AsyncStorage.removeItem('userRole');
        await AsyncStorage.removeItem('userName');
        await AsyncStorage.removeItem('userId');
      } catch (e) {
        console.error('Error clearing AsyncStorage:', e);
      }
      
      console.log('Logout: storage cleared successfully');
    } catch (error) {
      console.error('Logout: error clearing storage:', error);
    }

    // On Web, direct browser redirection is 100% reliable and resets React state
    if (typeof window !== 'undefined') {
      console.log('Logout: Web platform detected, redirecting via window.location.href...');
      window.location.href = '/';
      return;
    }

    try {
      console.log('Logout: replacing route to /...');
      router.replace('/');
    } catch (routerError) {
      console.error('Logout: router.replace / failed:', routerError);
      try {
        router.replace('/index' as any);
      } catch (fallbackError) {
        console.error('Logout: fallback routing failed:', fallbackError);
        try {
          router.navigate('/' as any);
        } catch (navigateError) {
          console.error('Logout: router.navigate failed:', navigateError);
        }
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
