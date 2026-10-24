import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/Theme';
import LogoutButton from '../../components/LogoutButton';
import InstallAppButton from '../../components/InstallAppButton';
import AppBackground from '../components/AppBackground';
import { api as authService } from '../../services/api';
import {
  checkBiometricHardwareSupport,
  registerBiometricOnDevice,
  saveQuickUnlockProfile,
  updateQuickUnlockSecurity,
  getQuickUnlockProfile,
} from '../../services/authSecurity';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('Staff');
  const [username, setUsername] = useState('');

  // Security state
  const [hasMpin, setHasMpin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricReason, setBiometricReason] = useState<string | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [togglingBiometric, setTogglingBiometric] = useState(false);

  // MPIN Setup Modal state
  const [showMpinModal, setShowMpinModal] = useState(false);
  const [mpinStep, setMpinStep] = useState<1 | 2>(1); // 1 = Enter new PIN, 2 = Confirm PIN
  const [firstMpin, setFirstMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [mpinError, setMpinError] = useState<string | null>(null);
  const [savingMpin, setSavingMpin] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userId');
      const storedName = await AsyncStorage.getItem('userName');
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedUsername = await AsyncStorage.getItem('userUsername');

      if (storedId) setUserId(storedId);
      if (storedName) setUserName(storedName);
      if (storedRole) setUserRole(storedRole);
      if (storedUsername) setUsername(storedUsername);

      // Check device biometric support
      const bioCheck = await checkBiometricHardwareSupport();
      setBiometricSupported(bioCheck.supported);
      if (!bioCheck.supported && bioCheck.reason) {
        setBiometricReason(bioCheck.reason);
      }

      // Check security settings from backend if userId available
      if (storedId) {
        setLoadingSecurity(true);
        try {
          const res = await authService.getSecurityStatus(storedId);
          if (res.success) {
            setHasMpin(res.hasMpin);
            setBiometricEnabled(res.biometricEnabled);

            // Sync with Quick Unlock local storage
            await updateQuickUnlockSecurity({
              hasMpin: res.hasMpin,
              biometricEnabled: res.biometricEnabled,
            });
          }
        } catch (err) {
          console.log('Non-fatal: could not fetch security settings:', err);
        } finally {
          setLoadingSecurity(false);
        }
      }
    } catch (error) {
      console.error('Failed to load profile user data:', error);
    }
  };

  // --- MPIN Management ---
  const handleOpenMpinModal = () => {
    setMpinStep(1);
    setFirstMpin('');
    setConfirmMpin('');
    setMpinError(null);
    setShowMpinModal(true);
  };

  const handleKeyPress = (num: string) => {
    setMpinError(null);
    if (mpinStep === 1) {
      if (firstMpin.length < 4) {
        const next = firstMpin + num;
        setFirstMpin(next);
        if (next.length === 4) {
          // Transition smoothly to confirm step
          setTimeout(() => {
            setMpinStep(2);
          }, 250);
        }
      }
    } else {
      if (confirmMpin.length < 4) {
        const next = confirmMpin + num;
        setConfirmMpin(next);
        if (next.length === 4) {
          // Validate & save
          if (next !== firstMpin) {
            setMpinError('PINs do not match. Please re-enter.');
            setTimeout(() => {
              setConfirmMpin('');
            }, 600);
          } else {
            submitNewMpin(next);
          }
        }
      }
    }
  };

  const handleDeletePress = () => {
    setMpinError(null);
    if (mpinStep === 1) {
      setFirstMpin((prev) => prev.slice(0, -1));
    } else {
      if (confirmMpin.length > 0) {
        setConfirmMpin((prev) => prev.slice(0, -1));
      } else {
        // Go back to step 1
        setMpinStep(1);
        setFirstMpin('');
      }
    }
  };

  const submitNewMpin = async (pinToSave: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please re-login.');
      return;
    }

    setSavingMpin(true);
    try {
      const res = await authService.setMpin(userId, pinToSave);
      if (res.success) {
        setHasMpin(true);
        setShowMpinModal(false);

        // Update local quick unlock cache
        await saveQuickUnlockProfile({
          userId,
          username: username || '',
          name: userName,
          role: userRole,
          hasMpin: true,
          biometricEnabled,
        });

        Alert.alert('Success', 'Your 4-digit MPIN has been configured! You can now use it to log in quickly on this web app and PWA.');
      } else {
        setMpinError(res.message || 'Failed to save MPIN.');
      }
    } catch (error: any) {
      setMpinError(error.message || 'Network error saving MPIN.');
    } finally {
      setSavingMpin(false);
    }
  };

  const handleRemoveMpin = () => {
    Alert.alert(
      'Remove MPIN',
      'Are you sure you want to remove your 4-digit MPIN? You will need to log in with your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            try {
              const res = await authService.removeMpin(userId);
              if (res.success) {
                setHasMpin(false);
                await updateQuickUnlockSecurity({ hasMpin: false });
                Alert.alert('Removed', 'MPIN has been disabled.');
              } else {
                Alert.alert('Error', res.message || 'Failed to remove MPIN.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove MPIN.');
            }
          },
        },
      ]
    );
  };

  // --- Biometric Management ---
  const handleToggleBiometric = async (value: boolean) => {
    if (!userId) return;

    if (value) {
      // User is enabling biometrics: test hardware prompt first
      setTogglingBiometric(true);
      try {
        const regResult = await registerBiometricOnDevice(userId, userName);
        if (!regResult.success) {
          Alert.alert('Biometric Setup', regResult.error || 'Biometric authentication was cancelled or not recognized.');
          setTogglingBiometric(false);
          return;
        }

        // Successfully enrolled locally, save on backend
        const res = await authService.setBiometric(userId, true);
        if (res.success) {
          setBiometricEnabled(true);
          await saveQuickUnlockProfile({
            userId,
            username: username || '',
            name: userName,
            role: userRole,
            hasMpin,
            biometricEnabled: true,
            credentialId: regResult.credentialId,
          });
          Alert.alert('Biometrics Enabled', 'Touch ID / Face ID / Fingerprint unlock is now active for this account on this device!');
        } else {
          Alert.alert('Error', res.message || 'Failed to enable biometrics on server.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to enable biometrics.');
      } finally {
        setTogglingBiometric(false);
      }
    } else {
      // User is disabling biometrics
      setTogglingBiometric(true);
      try {
        const res = await authService.setBiometric(userId, false);
        if (res.success) {
          setBiometricEnabled(false);
          await updateQuickUnlockSecurity({ biometricEnabled: false });
          Alert.alert('Biometrics Disabled', 'Biometric login has been turned off.');
        } else {
          Alert.alert('Error', res.message || 'Failed to disable biometrics.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to disable biometrics.');
      } finally {
        setTogglingBiometric(false);
      }
    }
  };

  const activePin = mpinStep === 1 ? firstMpin : confirmMpin;

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Profile Card */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={50} color={COLORS.white} />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.userRole}>{userRole}</Text>
          </View>
          {username ? <Text style={styles.userUsername}>@{username}</Text> : null}
        </View>

        {/* SECURITY & QUICK LOGIN SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="security" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Security & Quick Login</Text>
            {loadingSecurity && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
          </View>
          <Text style={styles.sectionSubtitle}>
            Configure fast login with 4-digit MPIN and biometric Face ID / Fingerprint on this device and PWA.
          </Text>

          {/* MPIN Setting Card */}
          <View style={styles.securityCard}>
            <View style={styles.securityCardHeader}>
              <View style={[styles.iconBubble, { backgroundColor: 'rgba(226, 26, 18, 0.12)' }]}>
                <MaterialIcons name="pin" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.cardTitle}>4-Digit MPIN</Text>
                  <View style={[styles.statusPill, hasMpin ? styles.statusPillActive : styles.statusPillInactive]}>
                    <MaterialIcons
                      name={hasMpin ? 'check-circle' : 'remove-circle-outline'}
                      size={12}
                      color={hasMpin ? '#166534' : '#92400e'}
                    />
                    <Text style={[styles.statusText, hasMpin ? styles.statusTextActive : styles.statusTextInactive]}>
                      {hasMpin ? 'Active' : 'Not Set'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {hasMpin
                    ? '4-digit MPIN is active. You can log in using just this PIN.'
                    : 'Set a 4-digit PIN for instant access without entering password.'}
                </Text>
              </View>
            </View>

            <View style={styles.cardActionRow}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, hasMpin && styles.secondaryActionBtn]}
                onPress={handleOpenMpinModal}
                activeOpacity={0.8}
              >
                <MaterialIcons name={hasMpin ? 'edit' : 'add'} size={18} color={hasMpin ? COLORS.primary : COLORS.white} />
                <Text style={[styles.primaryActionText, hasMpin && styles.secondaryActionText]}>
                  {hasMpin ? 'Change MPIN' : 'Set Up 4-Digit MPIN'}
                </Text>
              </TouchableOpacity>

              {hasMpin && (
                <TouchableOpacity style={styles.dangerActionBtn} onPress={handleRemoveMpin} activeOpacity={0.8}>
                  <MaterialIcons name="delete-outline" size={18} color="#b91c1c" />
                  <Text style={styles.dangerActionText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Biometrics Setting Card */}
          <View style={styles.securityCard}>
            <View style={styles.securityCardHeader}>
              <View style={[styles.iconBubble, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                <MaterialIcons name="fingerprint" size={26} color="#2563eb" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.cardTitle}>Biometric Unlock</Text>
                  {togglingBiometric ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Switch
                      value={biometricEnabled}
                      onValueChange={handleToggleBiometric}
                      disabled={!biometricSupported}
                      trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                      thumbColor={biometricEnabled ? '#2563eb' : '#cbd5e1'}
                    />
                  )}
                </View>
                <Text style={styles.cardSubtitle}>
                  {biometricSupported
                    ? 'Log in with Face ID, Touch ID, or Android Fingerprint on Web build and PWA.'
                    : (biometricReason || 'Biometrics not supported on this device/browser.')}
                </Text>
              </View>
            </View>

            <View style={styles.biometricFooter}>
              <MaterialIcons
                name={biometricSupported ? 'verified-user' : 'info-outline'}
                size={14}
                color={biometricSupported ? '#16a34a' : '#64748b'}
              />
              <Text style={styles.biometricFooterText}>
                {biometricSupported
                  ? 'Hardware sensor available & ready for biometric auth'
                  : 'WebAuthn platform sensor unavailable on this device'}
              </Text>
            </View>
          </View>
        </View>

        {/* ACCOUNT SETTINGS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="person-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="lock-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Change Password</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="notifications-none" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Notifications</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* SUPPORT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="help-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>Help Center</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="info-outline" size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>About Ayyanar CRM</Text>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* PWA Application */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PWA Application</Text>
          <InstallAppButton variant="menu" />
        </View>

        <View style={styles.logoutButton}>
          <LogoutButton variant="menu" />
        </View>

        <Text style={styles.versionText}>Ayyanar Construction CRM · v1.2 (MPIN & Biometrics)</Text>
      </ScrollView>

      {/* MPIN SETUP MODAL */}
      <Modal visible={showMpinModal} transparent animationType="fade" onRequestClose={() => setShowMpinModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <MaterialIcons name="lock" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>{hasMpin ? 'Change 4-Digit MPIN' : 'Set 4-Digit MPIN'}</Text>
              <Text style={styles.modalSubtitle}>
                {mpinStep === 1
                  ? 'Enter a 4-digit PIN for quick login on this app'
                  : 'Confirm your 4-digit PIN'}
              </Text>
            </View>

            {/* Step indicator */}
            <View style={styles.stepIndicatorRow}>
              <View style={[styles.stepDot, mpinStep === 1 && styles.stepDotActive]}>
                <Text style={[styles.stepNum, mpinStep === 1 && styles.stepNumActive]}>1</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepDot, mpinStep === 2 && styles.stepDotActive]}>
                <Text style={[styles.stepNum, mpinStep === 2 && styles.stepNumActive]}>2</Text>
              </View>
            </View>

            {/* PIN Dots Display */}
            <View style={styles.pinDotsContainer}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < activePin.length;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      filled && styles.pinDotFilled,
                      mpinError ? styles.pinDotError : null,
                    ]}
                  />
                );
              })}
            </View>

            {mpinError && <Text style={styles.pinErrorMessage}>{mpinError}</Text>}

            {savingMpin ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 12, color: COLORS.text, fontWeight: '600' }}>Saving MPIN...</Text>
              </View>
            ) : (
              /* Numeric Keypad */
              <View style={styles.keypadContainer}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['', '0', 'del'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((item, cIdx) => {
                      if (item === '') {
                        return <View key={cIdx} style={styles.keypadKeyEmpty} />;
                      }
                      if (item === 'del') {
                        return (
                          <TouchableOpacity
                            key={cIdx}
                            style={styles.keypadKey}
                            onPress={handleDeletePress}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons name="backspace" size={22} color={COLORS.text} />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={cIdx}
                          style={styles.keypadKey}
                          onPress={() => handleKeyPress(item)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.keypadKeyText}>{item}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowMpinModal(false)}
              disabled={savingMpin}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    elevation: 6,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  roleBadge: {
    backgroundColor: 'rgba(226, 26, 18, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  userRole: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userUsername: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  securityCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  securityCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillActive: {
    backgroundColor: '#dcfce7',
  },
  statusPillInactive: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextInactive: {
    color: '#92400e',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.25)',
  },
  secondaryActionText: {
    color: COLORS.primary,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
  },
  dangerActionText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  biometricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  biometricFooterText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '500',
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
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
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

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(226, 26, 18, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  stepNumActive: {
    color: COLORS.white,
  },
  stepLine: {
    width: 36,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 6,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pinDotError: {
    borderColor: '#ef4444',
    backgroundColor: '#fecaca',
  },
  pinErrorMessage: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  keypadContainer: {
    width: '100%',
    marginTop: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  keypadKey: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keypadKeyEmpty: {
    width: 60,
    height: 60,
  },
  keypadKeyText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCancelBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
