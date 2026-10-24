import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppBackground from './AppBackground';

type Props = { 
  children: React.ReactNode; 
  style?: any;
};

export default function ScreenWrapper({ children, style }: Props) {
  return (
    <View style={styles.bg}>
      <AppBackground />
      <View style={[styles.container, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
