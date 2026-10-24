import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from './components/ScreenWrapper';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import { api as authService } from '../services/api';
import InstallAppButton from '../components/InstallAppButton';
import {
  getQuickUnlockProfile,
  saveQuickUnlockProfile,
  verifyBiometricOnDevice,
  clearQuickUnlockProfile,
  QuickUnlockProfile,
} from '../services/authSecurity';

// The welcome splash should only appear on app launch — never again after logout.
let welcomeAlreadyShown = false;

const shouldSkipWelcome = () => {
  if (welcomeAlreadyShown) return true;
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('welcomeShown') === '1';
  }
  return false;
};

export default function LoginScreen() {
  const router = useRouter();

  // Login inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginTab, setLoginTab] = useState<'password' | 'mpin'>('password');
  const [standardMpin, setStandardMpin] = useState('');

  // Quick Unlock state
  const [quickProfile, setQuickProfile] = useState<QuickUnlockProfile | null>(null);
  const [isQuickUnlockMode, setIsQuickUnlockMode] = useState(false);
  const [quickMpin, setQuickMpin] = useState('');
  const [quickMpinError, setQuickMpinError] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // General UI state
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!shouldSkipWelcome());
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'username' | 'password' | 'mpin' | null>(null);

  const biometricAutoTriggeredRef = useRef(false);

  useEffect(() => {
    if (!showWelcome) return;
    const welcomeTimer = setTimeout(() => {
      welcomeAlreadyShown = true;
      if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('welcomeShown', '1');
      }
      setShowWelcome(false);
    }, 2800);
    return () => clearTimeout(welcomeTimer);
  }, []);

  // Helper for role redirection
  const redirectByRole = (role: string, name: string, id: string | number) => {
    const idStr = id.toString();
    if (role === 'Driver') {
      router.replace({ pathname: '/driver', params: { name: name || '', userId: idStr } });
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
  };

  // Check active session & saved Quick Unlock profile
  useEffect(() => {
    if (showWelcome) return;

    const checkSessionAndProfile = async () => {
      try {
        console.log('LoginScreen: checking user session...');
        const storedRole = await AsyncStorage.getItem('userRole');
        const storedName = await AsyncStorage.getItem('userName');
        const storedUserId = await AsyncStorage.getItem('userId');

        if (storedRole && storedUserId) {
          console.log('LoginScreen: active session found, auto-redirecting...');
          redirectByRole(storedRole, storedName || '', storedUserId);
          return;
        }

        // Check if there is a remembered profile with MPIN or Biometrics
        const saved = await getQuickUnlockProfile();
        if (saved && (saved.hasMpin || saved.biometricEnabled)) {
          setQuickProfile(saved);
          setIsQuickUnlockMode(true);
        }
      } catch (error) {
        console.log('Error reading user session (non-fatal):', error);
      }
    };

    checkSessionAndProfile();
  }, [showWelcome]);

  // Optional auto-prompt biometric once quick unlock screen renders
  useEffect(() => {
    if (isQuickUnlockMode && quickProfile?.biometricEnabled && !biometricAutoTriggeredRef.current) {
      biometricAutoTriggeredRef.current = true;
      const t = setTimeout(() => {
        handleBiometricUnlock();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isQuickUnlockMode, quickProfile]);

  // --- STANDARD LOGIN WITH PASSWORD ---
  const handlePasswordLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(username.trim(), password.trim());
      setLoading(false);

      if (response.success && response.user) {
        const { role, name, id, username: uname, hasMpin, biometricEnabled } = response.user;

        // Store active session
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        await AsyncStorage.setItem('userUsername', uname || '');

        // Remember user profile for Quick Unlock
        await saveQuickUnlockProfile({
          userId: id.toString(),
          username: uname || '',
          name,
          role,
          hasMpin: !!hasMpin,
          biometricEnabled: !!biometricEnabled,
        });

        redirectByRole(role, name, id);
      } else {
        Alert.alert('Login Failed', response.message || 'Incorrect username or password.');
      }
    } catch (error: any) {
      setLoading(false);
      const errMsg =
        error.response?.status === 401
          ? 'Incorrect username or password.'
          : error.response?.data?.message || error.message || 'Failed to connect to server.';
      Alert.alert('Login Failed', errMsg);
    }
  };

  // --- STANDARD LOGIN WITH MPIN ---
  const handleMpinLogin = async () => {
    if (!username || !standardMpin) {
      Alert.alert('Error', 'Please enter your username and 4-digit MPIN.');
      return;
    }

    if (standardMpin.length < 4) {
      Alert.alert('Error', 'MPIN must be 4 digits.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.loginWithMpin({
        username: username.trim(),
        mpin: standardMpin.trim(),
      });
      setLoading(false);

      if (response.success && response.user) {
        const { role, name, id, username: uname, hasMpin, biometricEnabled } = response.user;

        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        await AsyncStorage.setItem('userUsername', uname || '');

        await saveQuickUnlockProfile({
          userId: id.toString(),
          username: uname || '',
          name,
          role,
          hasMpin: true,
          biometricEnabled: !!biometricEnabled,
        });

        redirectByRole(role, name, id);
      } else {
        Alert.alert('MPIN Login Failed', response.message || 'Incorrect MPIN or user.');
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert('MPIN Login Failed', error.message || 'Incorrect MPIN.');
    }
  };

  // --- QUICK UNLOCK: MPIN KEYPAD ---
  const handleQuickKeypadPress = (digit: string) => {
    setQuickMpinError(null);
    if (quickMpin.length < 4) {
      const next = quickMpin + digit;
      setQuickMpin(next);
      if (next.length === 4) {
        // Auto submit on 4th digit
        submitQuickMpin(next);
      }
    }
  };

  const handleQuickKeypadDelete = () => {
    setQuickMpinError(null);
    setQuickMpin((prev) => prev.slice(0, -1));
  };

  const submitQuickMpin = async (pin: string) => {
    if (!quickProfile) return;
    setLoading(true);
    try {
      const response = await authService.loginWithMpin({
        userId: quickProfile.userId,
        mpin: pin,
      });
      setLoading(false);

      if (response.success && response.user) {
        const { role, name, id, username: uname } = response.user;
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        await AsyncStorage.setItem('userUsername', uname || '');

        redirectByRole(role, name, id);
      } else {
        setQuickMpinError(response.message || 'Incorrect MPIN. Please try again.');
        setQuickMpin('');
      }
    } catch (error: any) {
      setLoading(false);
      setQuickMpinError(error.message || 'Incorrect MPIN.');
      setQuickMpin('');
    }
  };

  // --- QUICK UNLOCK: BIOMETRIC UNLOCK ---
  const handleBiometricUnlock = async () => {
    if (!quickProfile || !quickProfile.biometricEnabled) return;
    setBiometricLoading(true);
    setQuickMpinError(null);

    try {
      const bioVerify = await verifyBiometricOnDevice(quickProfile.credentialId);
      if (!bioVerify.success) {
        setBiometricLoading(false);
        if (bioVerify.error && !bioVerify.error.includes('cancelled')) {
          setQuickMpinError(bioVerify.error);
        }
        return;
      }

      // Hardware verified! Authenticate with backend
      const response = await authService.loginWithBiometric({
        userId: quickProfile.userId,
        username: quickProfile.username,
      });
      setBiometricLoading(false);

      if (response.success && response.user) {
        const { role, name, id, username: uname } = response.user;
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userId', id.toString());
        await AsyncStorage.setItem('userUsername', uname || '');

        redirectByRole(role, name, id);
      } else {
        setQuickMpinError(response.message || 'Biometric login failed on server.');
      }
    } catch (error: any) {
      setBiometricLoading(false);
      setQuickMpinError(error.message || 'Biometric authentication failed.');
    }
  };

  const handleForgetQuickProfile = async () => {
    Alert.alert(
      'Switch Account',
      'Do you want to sign in as a different user or switch account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch User',
          onPress: async () => {
            setIsQuickUnlockMode(false);
            setQuickMpin('');
            setQuickMpinError(null);
          },
        },
        {
          text: 'Forget on this device',
          style: 'destructive',
          onPress: async () => {
            await clearQuickUnlockProfile();
            setQuickProfile(null);
            setIsQuickUnlockMode(false);
            setQuickMpin('');
          },
        },
      ]
    );
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
          keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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

            {/* ============================================================== */}
            {/* QUICK UNLOCK MODE (MPIN & BIOMETRICS FOR REMEMBERED USER)       */}
            {/* ============================================================== */}
            {isQuickUnlockMode && quickProfile ? (
              <View style={styles.formCard}>
                <View style={styles.quickUserHeader}>
                  <View style={styles.quickAvatar}>
                    <MaterialIcons name="person" size={32} color={COLORS.white} />
                  </View>
                  <Text style={styles.quickWelcomeText}>Welcome back,</Text>
                  <Text style={styles.quickUserName}>{quickProfile.name}</Text>
                  <View style={styles.quickRoleBadge}>
                    <Text style={styles.quickRoleText}>{quickProfile.role}</Text>
                  </View>
                </View>

                {/* Biometric One-Tap Button (if enabled) */}
                {quickProfile.biometricEnabled && (
                  <>
                    <TouchableOpacity
                      style={[styles.biometricUnlockBtn, biometricLoading && styles.loginButtonDisabled]}
                      onPress={handleBiometricUnlock}
                      disabled={biometricLoading || loading}
                      activeOpacity={0.8}
                    >
                      {biometricLoading ? (
                        <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />
                      ) : (
                        <MaterialIcons name="fingerprint" size={24} color={COLORS.white} style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.biometricUnlockBtnText}>
                        {biometricLoading ? 'Scanning Face / Fingerprint...' : 'Unlock with Face ID / Fingerprint'}
                      </Text>
                    </TouchableOpacity>
                    {quickMpinError && !quickProfile.hasMpin && (
                      <Text style={[styles.quickPinErrorText, { marginVertical: 8, textAlign: 'center' }]}>
                        {quickMpinError}
                      </Text>
                    )}
                  </>
                )}

                {/* Divider between biometric & MPIN if both available */}
                {quickProfile.biometricEnabled && quickProfile.hasMpin && (
                  <View style={styles.orDivider}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR ENTER 4-DIGIT MPIN</Text>
                    <View style={styles.orLine} />
                  </View>
                )}

                {/* 4-Digit MPIN Keypad Input (if enabled) */}
                {quickProfile.hasMpin && (
                  <View style={{ alignItems: 'center', marginTop: quickProfile.biometricEnabled ? 6 : 14 }}>
                    {!quickProfile.biometricEnabled && (
                      <Text style={styles.mpinHeaderInstruction}>Enter your 4-Digit MPIN</Text>
                    )}

                    {/* PIN Dots Display */}
                    <View style={styles.quickPinDotsRow}>
                      {[0, 1, 2, 3].map((idx) => {
                        const filled = idx < quickMpin.length;
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.quickPinDot,
                              filled && styles.quickPinDotFilled,
                              quickMpinError ? styles.quickPinDotError : null,
                            ]}
                          />
                        );
                      })}
                    </View>

                    {quickMpinError && <Text style={styles.quickPinErrorText}>{quickMpinError}</Text>}

                    {loading ? (
                      <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.textLight, fontWeight: '600' }}>
                          Verifying MPIN...
                        </Text>
                      </View>
                    ) : (
                      /* On-screen Keypad */
                      <View style={styles.quickKeypad}>
                        {[
                          ['1', '2', '3'],
                          ['4', '5', '6'],
                          ['7', '8', '9'],
                          ['', '0', 'del'],
                        ].map((row, rIdx) => (
                          <View key={rIdx} style={styles.quickKeypadRow}>
                            {row.map((val, cIdx) => {
                              if (val === '') {
                                return <View key={cIdx} style={styles.quickKeypadKeyEmpty} />;
                              }
                              if (val === 'del') {
                                return (
                                  <TouchableOpacity
                                    key={cIdx}
                                    style={styles.quickKeypadKey}
                                    onPress={handleQuickKeypadDelete}
                                    activeOpacity={0.6}
                                  >
                                    <MaterialIcons name="backspace" size={20} color={COLORS.text} />
                                  </TouchableOpacity>
                                );
                              }
                              return (
                                <TouchableOpacity
                                  key={cIdx}
                                  style={styles.quickKeypadKey}
                                  onPress={() => handleQuickKeypadPress(val)}
                                  activeOpacity={0.6}
                                >
                                  <Text style={styles.quickKeypadKeyText}>{val}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Quick Unlock Switch/Alternative Links */}
                <View style={styles.quickSwitchActions}>
                  <TouchableOpacity
                    style={styles.switchAccountBtn}
                    onPress={() => {
                      setIsQuickUnlockMode(false);
                      setQuickMpin('');
                    }}
                  >
                    <MaterialIcons name="lock-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.switchAccountBtnText}>Use Password Instead</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.switchAccountBtn} onPress={handleForgetQuickProfile}>
                    <MaterialIcons name="swap-horiz" size={16} color={COLORS.textLight} style={{ marginRight: 4 }} />
                    <Text style={[styles.switchAccountBtnText, { color: COLORS.textLight }]}>Switch User</Text>
                  </TouchableOpacity>
                </View>

                {/* PWA Button */}
                <View style={{ marginTop: SPACING.md }}>
                  <InstallAppButton variant="solid" />
                </View>
              </View>
            ) : (
              /* ============================================================== */
              /* STANDARD LOGIN MODE (PASSWORD OR MPIN)                         */
              /* ============================================================== */
              <View style={styles.formCard}>
                {/* Return to quick unlock button if remembered profile exists */}
                {quickProfile && (quickProfile.hasMpin || quickProfile.biometricEnabled) && (
                  <TouchableOpacity
                    style={styles.backToQuickBtn}
                    onPress={() => setIsQuickUnlockMode(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
                    <Text style={styles.backToQuickText}>
                      Quick Unlock as <Text style={{ fontWeight: '800' }}>{quickProfile.name}</Text>
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.cardHeading}>Sign In</Text>
                <Text style={styles.cardSubheading}>Access your field operations dashboard</Text>

                {/* Login Method Tabs */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity
                    style={[styles.tabButton, loginTab === 'password' && styles.tabButtonActive]}
                    onPress={() => setLoginTab('password')}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="password"
                      size={16}
                      color={loginTab === 'password' ? COLORS.primary : COLORS.textLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabButtonText, loginTab === 'password' && styles.tabButtonTextActive]}>
                      Password
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabButton, loginTab === 'mpin' && styles.tabButtonActive]}
                    onPress={() => setLoginTab('mpin')}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="pin"
                      size={16}
                      color={loginTab === 'mpin' ? COLORS.primary : COLORS.textLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabButtonText, loginTab === 'mpin' && styles.tabButtonTextActive]}>
                      4-Digit MPIN
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Username Field */}
                <Text style={styles.inputLabel}>USERNAME / PHONE</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedInput === 'username' && styles.inputWrapperFocused,
                  ]}
                >
                  <View
                    style={[
                      styles.inputIconContainer,
                      focusedInput === 'username' && styles.inputIconContainerFocused,
                    ]}
                  >
                    <MaterialIcons
                      name="person-outline"
                      size={20}
                      color={focusedInput === 'username' ? COLORS.primary : COLORS.textLight}
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter username or mobile"
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setFocusedInput('username')}
                    onBlur={() => setFocusedInput(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    placeholderTextColor="#A89496"
                  />
                </View>

                {/* PASSWORD TAB */}
                {loginTab === 'password' && (
                  <>
                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        focusedInput === 'password' && styles.inputWrapperFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.inputIconContainer,
                          focusedInput === 'password' && styles.inputIconContainerFocused,
                        ]}
                      >
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
                        autoComplete="current-password"
                        textContentType="password"
                        placeholderTextColor="#A89496"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.eyeButton}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.7}
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <MaterialIcons
                          name={showPassword ? 'visibility' : 'visibility-off'}
                          size={22}
                          color={showPassword ? COLORS.primary : COLORS.textLight}
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                      onPress={handlePasswordLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      ) : (
                        <MaterialIcons name="login" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.loginButtonText}>
                        {loading ? 'AUTHENTICATING…' : 'SIGN IN TO DASHBOARD'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* MPIN TAB */}
                {loginTab === 'mpin' && (
                  <>
                    <Text style={styles.inputLabel}>4-DIGIT MPIN</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        focusedInput === 'mpin' && styles.inputWrapperFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.inputIconContainer,
                          focusedInput === 'mpin' && styles.inputIconContainerFocused,
                        ]}
                      >
                        <MaterialIcons
                          name="pin"
                          size={20}
                          color={focusedInput === 'mpin' ? COLORS.primary : COLORS.textLight}
                        />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 4-digit MPIN"
                        value={standardMpin}
                        onChangeText={(txt) => setStandardMpin(txt.replace(/\D/g, '').slice(0, 6))}
                        onFocus={() => setFocusedInput('mpin')}
                        onBlur={() => setFocusedInput(null)}
                        keyboardType="number-pad"
                        secureTextEntry
                        maxLength={6}
                        autoComplete="off"
                        textContentType="password"
                        placeholderTextColor="#A89496"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                      onPress={handleMpinLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      ) : (
                        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.loginButtonText}>
                        {loading ? 'VERIFYING MPIN…' : 'LOG IN WITH MPIN'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Install PWA Button if available */}
                <View style={{ marginTop: SPACING.md }}>
                  <InstallAppButton variant="solid" />
                </View>
              </View>
            )}

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
    alignItems: 'center',
    padding: SPACING.md,
    paddingVertical: SPACING.lg,
    width: '100%',
  },
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
    width: '100%',
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
    marginBottom: SPACING.md,
  },

  // Tabs for password vs mpin
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },

  backToQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: SPACING.md,
    gap: 6,
  },
  backToQuickText: {
    fontSize: 12.5,
    color: COLORS.primary,
    fontWeight: '600',
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
    fontSize: 15,
    color: '#26191A',
    fontWeight: '500',
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
      } as any,
    }),
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
    fontSize: 14,
    letterSpacing: 0.6,
  },

  // --- QUICK UNLOCK STYLES ---
  quickUserHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  quickAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  quickWelcomeText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  quickUserName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  quickRoleBadge: {
    backgroundColor: 'rgba(226, 26, 18, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  quickRoleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  biometricUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    height: 52,
    borderRadius: 12,
    marginVertical: 8,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  biometricUnlockBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  orText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  mpinHeaderInstruction: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  quickPinDotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  quickPinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  quickPinDotFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickPinDotError: {
    borderColor: '#ef4444',
    backgroundColor: '#fee2e2',
  },
  quickPinErrorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  quickKeypad: {
    width: '100%',
    maxWidth: 280,
    marginTop: 4,
  },
  quickKeypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  quickKeypadKey: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickKeypadKeyEmpty: {
    width: 56,
    height: 56,
  },
  quickKeypadKeyText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  quickSwitchActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  switchAccountBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
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
