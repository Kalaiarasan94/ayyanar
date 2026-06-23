import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPACING } from '../../constants/Theme';
import GlassCard from './GlassCard';
import AppBackground from './AppBackground';

type Props = { 
  children: React.ReactNode; 
  style?: any;
};

export default function ScreenWrapper({ children, style }: Props) {
  return (
    <View style={styles.bg}>
      <AppBackground />
      <View style={styles.container}>
        <GlassCard style={[styles.card, style]}>
          {children}
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, padding: SPACING.md, justifyContent: 'center' },
  card: { flex: 1, padding: SPACING.lg },
});
