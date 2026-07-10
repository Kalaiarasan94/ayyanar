import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/Theme';
import AppBackground from '../components/AppBackground';

const GRID_SPACING = SPACING.lg;
// The web shell caps the app at 1180px on desktop
const MAX_CONTENT_WIDTH = 1180;

export default function ActionsScreen() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  // Responsive grid: 2 cards per row on phones, 4 on desktop/laptop
  const containerWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const columns = width >= 900 ? 4 : 2;
  const cardWidth = (containerWidth - GRID_SPACING * (columns + 1)) / columns;

  useEffect(() => {
    AsyncStorage.getItem('userRole').then(setRole);
  }, []);

  const allActions = [
    {
      title: 'Material Bill',
      subtitle: 'Upload site bills',
      icon: 'receipt-long',
      route: '/upload-bill',
      color: COLORS.primary,
      roles: ['Admin', 'Supervisor', 'Site Engineer'],
    },
    {
      title: 'Attendance',
      subtitle: 'Daily staff count',
      icon: 'how-to-reg',
      route: '/attendance',
      color: COLORS.success,
      roles: ['Admin', 'Supervisor', 'Site Engineer'],
    },
    {
      title: 'Supervisor Clock-In',
      subtitle: 'Selfie & Site Check-in',
      icon: 'add-a-photo',
      route: '/supervisor-attendance',
      color: COLORS.accent,
      roles: ['Admin', 'Supervisor', 'Site Engineer'],
    },
    {
      title: 'Daily Expense',
      subtitle: 'Petty cash log',
      icon: 'payments',
      route: '/cash-expense',
      color: COLORS.warning,
      roles: ['Admin', 'Accounts'],
    },
    {
      title: 'Trip Record',
      subtitle: 'Daily driver trip log',
      icon: 'local-shipping',
      route: '/driver',
      color: COLORS.secondary,
      roles: ['Admin', 'Driver'],
    },
  ];

  const filteredActions = allActions.filter(action => 
    role === 'Admin' || (role && action.roles.includes(role))
  );

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Action Center</Text>
          <Text style={styles.subtitle}>Tasks for {role || 'User'}</Text>
        </View>

        <View style={styles.grid}>
          {filteredActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.card, { width: cardWidth }]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: action.color + '15' }]}>
                <MaterialIcons name={action.icon as any} size={32} color={action.color} />
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {role === 'Admin' && (
          <View style={styles.adminSection}>
            <Text style={styles.adminTitle}>Administration</Text>
            <TouchableOpacity 
              style={styles.adminButton}
              onPress={() => router.push('/admin-panel')}
            >
              <MaterialIcons name="admin-panel-settings" size={24} color={COLORS.white} />
              <Text style={styles.adminButtonText}>Open Admin Control Panel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  header: {
    padding: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.lg,
    gap: GRID_SPACING,
  },
  card: {
    backgroundColor: COLORS.glassBg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  adminSection: {
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  adminButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 6,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  adminButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
