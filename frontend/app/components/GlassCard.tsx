import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPACING, COLORS } from '../../constants/Theme';

type Props = { 
  children: React.ReactNode; 
  style?: any;
};

export default function GlassCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(226, 55, 68, 0.12)',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
});
