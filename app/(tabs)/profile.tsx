import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/Theme';
import LogoutButton from '../../components/LogoutButton';
import AppBackground from '../components/AppBackground';

export default function ProfileScreen() {
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('Staff');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const name = await AsyncStorage.getItem('userName');
        const role = await AsyncStorage.getItem('userRole');
        if (name) setUserName(name);
        if (role) setUserRole(role);
      } catch (error) {
        console.error('Failed to load profile user data:', error);
      }
    };
    loadUserData();
  }, []);

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={50} color={COLORS.white} />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userRole}>{userRole}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="edit" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="lock" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Change Password</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="notifications" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Notifications</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="help-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Help Center</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="info-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>About App</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoutButton}>
          <LogoutButton variant="menu" />
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.glassBg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    elevation: 6,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userRole: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: '600',
  },
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: SPACING.md,
    fontWeight: '700',
  },
  logoutButton: {
    margin: SPACING.xl,
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: 12,
    marginBottom: SPACING.xl,
    fontWeight: '600',
  },
});
