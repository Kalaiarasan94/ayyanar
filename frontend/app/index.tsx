import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from './components/ScreenWrapper';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import { api as authService } from '../services/api';

// The welcome splash should only appear on app launch — never again after logout.
let welcomeAlreadyShown = false;

const shouldSkipWelcome = () => {
  if (welcomeAlreadyShown) return true;
  // On web, logout does a full page reload, so the module flag resets — use sessionStorage instead
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('welcomeShown') === '1';
  }
  return false;
};

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!shouldSkipWelcome());

  useEffect(() => {
    if (!showWelcome) return;
    const welcomeTimer = setTimeout(() => {
      welcomeAlreadyShown = true;
      if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('welcomeShown', '1');
      }
      setShowWelcome(false);
    }, 3000);
    return () => clearTimeout(welcomeTimer);
  }, []);

  useEffect(() => {
    if (showWelcome) return;
    const checkUserSession = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        const storedName = await AsyncStorage.getItem('userName');
        const storedUserId = await AsyncStorage.getItem('userId');
        console.log('LoginScreen checkUserSession read values:', { storedRole, storedName, storedUserId });

        if (storedRole && storedUserId) {
          console.log('LoginScreen checkUserSession: session found, auto-redirecting...');
          if (storedRole === 'Driver') {
            router.replace({
              pathname: '/driver',
              params: { name: storedName || '', userId: storedUserId },
            });
          } else if (storedRole === 'Accounts') {
            router.replace('/accounts-ledger');
          } else if (storedRole === 'Owner') {
            router.replace('/owner-accounts');
          } else if (storedRole === 'TotalAccounts') {
            router.replace('/total-accounts');
          } else if (storedRole === 'Admin') {
            router.replace('/(tabs)/admin');
          } else {
            router.replace('/(tabs)/home');
          }
        }
      } catch (error) {
        console.error('Error reading user session:', error);
      }
    };
    checkUserSession();
  }, [showWelcome]);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      console.log('Calling authService.login with', username, password);
      const response = await authService.login(username, password);
      console.log('authService.login response:', response);
      setLoading(false);
      
      if (response.success) {
        const { role, name, id } = response.user;
        
        // Store user info for role-based UI
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        
        // Redirect based on role
        if (role === 'Driver') {
          router.replace({ pathname: '/driver', params: { name, userId: id.toString() } });
        } else if (role === 'Accounts') {
          router.replace('/accounts-ledger');
        } else if (role === 'Owner') {
          router.replace('/owner-accounts');
        } else if (role === 'TotalAccounts') {
          router.replace('/total-accounts');
        } else if (role === 'Admin') {
          router.replace('/(tabs)/admin');
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials.');
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error', error.response?.data?.message || 'Failed to connect to server.');
    }
  };

  if (showWelcome) {
    return (
      <View style={styles.welcomeScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.welcomeLogoPanel}>
          <Image source={require('../assets/ayyanar-logo.jpg')} style={styles.welcomeLogo} resizeMode="contain" />
        </View>
        <Text style={styles.welcomeText}>Construction CRM</Text>
        <View style={styles.welcomeAccent} />
      </View>
    );
  }

  return (<ScreenWrapper>
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/ayyanar-logo.jpg')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Construction CRM</Text>
          <Text style={styles.subtitle}>Infra Engineering Operations</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>USERNAME</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person" size={20} color={COLORS.textLight} />
            <TextInput 
              style={styles.input}
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color={COLORS.textLight} />
            <TextInput 
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Authenticating...' : 'LOGIN TO DASHBOARD'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.credentialBox}>
          <Text style={styles.credentialTitle}>Quick Access (Demo):</Text>
          <View style={styles.chipRow}>
            {['admin', 'accounts', 'super', 'driver', 'owner', 'totacc'].map((user) => (
              <TouchableOpacity
                key={user}
                style={styles.chip}
                onPress={() => {
                  setUsername(user);
                  const passwords: Record<string, string> = {
                    admin: 'admin123',
                    accounts: 'acc123',
                    super: 'super123',
                    driver: 'driver123',
                    owner: 'owner123',
                    totacc: 'totacc123',
                  };
                  setPassword(passwords[user]);
                }}
              >
                <Text style={styles.chipText}>{user}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    width: '100%',
    maxWidth: 320,
    height: 86,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    paddingHorizontal: SPACING.md,
  },
  logo: {
    width: '100%',
    height: 58,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    letterSpacing: 0,
    fontWeight: '600',
  },
  form: {
    backgroundColor: COLORS.glassBg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    marginLeft: 4,
    letterSpacing: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    elevation: 6,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  credentialBox: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
  },
  credentialTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  welcomeScreen: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  welcomeLogoPanel: {
    width: '100%',
    maxWidth: 380,
    height: 128,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
    paddingHorizontal: SPACING.lg,
  },
  welcomeLogo: {
    width: '100%',
    height: 86,
  },
  welcomeText: {
    marginTop: SPACING.lg,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  welcomeAccent: {
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: SPACING.md,
  },
});
