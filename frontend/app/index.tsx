import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from './components/ScreenWrapper';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import { api as authService } from '../services/api';
import InstallAppButton from '../components/InstallAppButton';

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
  const [showPassword, setShowPassword] = useState(false);

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
        console.log('LoginScreen: checking user session...');
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
        console.log('Error reading user session (non-fatal):', error);
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
      // Trim invisible spaces that mobile keyboards add after autocomplete
      const response = await authService.login(username.trim(), password.trim());
      console.log('authService.login response:', response);
      setLoading(false);
      
      if (response.success) {
        const { role, name, id } = response.user;
        
        // Store user info for role-based UI
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        await AsyncStorage.setItem('userUsername', response.user.username || '');
        
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
        Alert.alert('Login Failed', 'Incorrect username or password.');
      }
    } catch (error: any) {
      setLoading(false);
      const errMsg = error.response?.status === 401
        ? 'Incorrect username or password.'
        : (error.response?.data?.message || 'Failed to connect to server.');
      Alert.alert('Login Failed', errMsg);
    }
  };

  const [focusedInput, setFocusedInput] = useState<'username' | 'password' | null>(null);

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

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        enabled={Platform.OS !== 'web'}
      >
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.loginColumn}>
            
            {/* Header / Brand Area */}
            <View style={styles.header}>
              <View style={styles.logoCard}>
                <Image source={require('../assets/ayyanar-logo.jpg')} style={styles.logo} resizeMode="contain" />
              </View>
              
              <View style={styles.portalBadge}>
                <View style={styles.portalDot} />
                <Text style={styles.portalBadgeText}>ENTERPRISE PORTAL</Text>
              </View>

              <Text style={styles.title}>Construction CRM</Text>
              <Text style={styles.subtitle}>Infra Operations & Management Suite</Text>
            </View>

            {/* Login Form Card */}
            <View style={styles.formCard}>
              <Text style={styles.cardHeading}>Sign In</Text>
              <Text style={styles.cardSubheading}>Access your field operations dashboard</Text>

              {/* Username Field */}
              <Text style={styles.inputLabel}>USERNAME</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'username' && styles.inputWrapperFocused
              ]}>
                <View style={[styles.inputIconContainer, focusedInput === 'username' && styles.inputIconContainerFocused]}>
                  <MaterialIcons 
                    name="person-outline" 
                    size={20} 
                    color={focusedInput === 'username' ? COLORS.primary : COLORS.textLight} 
                  />
                </View>
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your username"
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setFocusedInput('username')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#A89496"
                />
              </View>

              {/* Password Field with Eye Toggle Icon */}
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'password' && styles.inputWrapperFocused
              ]}>
                <View style={[styles.inputIconContainer, focusedInput === 'password' && styles.inputIconContainerFocused]}>
                  <MaterialIcons 
                    name="lock-outline" 
                    size={20} 
                    color={focusedInput === 'password' ? COLORS.primary : COLORS.textLight} 
                  />
                </View>
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#A89496"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(prev => !prev)} 
                  style={styles.eyeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility" : "visibility-off"} 
                    size={22} 
                    color={showPassword ? COLORS.primary : COLORS.textLight} 
                  />
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity 
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <MaterialIcons 
                  name={loading ? "hourglass-empty" : "login"} 
                  size={20} 
                  color="#FFFFFF" 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.loginButtonText}>
                  {loading ? 'Authenticating…' : 'SIGN IN TO DASHBOARD'}
                </Text>
              </TouchableOpacity>

              {/* Install PWA Button if available */}
              <View style={{ marginTop: SPACING.md }}>
                <InstallAppButton variant="solid" />
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footerNote}>
              <MaterialIcons name="security" size={14} color={COLORS.textLight} style={{ marginRight: 4 }} />
              <Text style={styles.footerText}>Secure Ayyanar Infra System · Authorized Access Only</Text>
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
    paddingVertical: SPACING.xl,
  },
  // Centered login column on desktop web; full-width on mobile
  loginColumn: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoCard: {
    width: '100%',
    maxWidth: 290,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 55, 68, 0.14)',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    paddingHorizontal: SPACING.md,
  },
  logo: {
    width: '100%',
    height: 52,
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE9E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F4C6C8',
  },
  portalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },
  portalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#26191A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 3,
    fontWeight: '600',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.lg,
    borderRadius: 22,
    elevation: 6,
    shadowColor: '#26191A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226, 55, 68, 0.12)',
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#26191A',
    marginBottom: 2,
  },
  cardSubheading: {
    fontSize: 12.5,
    color: COLORS.textLight,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#26191A',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE6E7',
    marginBottom: SPACING.md,
    paddingHorizontal: 6,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  inputIconContainerFocused: {
    backgroundColor: '#FCE9E9',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#26191A',
    fontWeight: '500',
  },
  eyeButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14.5,
    letterSpacing: 0.6,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: 11.5,
    color: COLORS.textLight,
    fontWeight: '600',
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
