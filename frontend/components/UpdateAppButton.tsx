import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePWA } from '../services/pwa';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

export interface UpdateAppButtonProps {
  variant?: 'header' | 'menu' | 'solid' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export default function UpdateAppButton({
  variant = 'header',
  style,
}: UpdateAppButtonProps) {
  const {
    isSupported,
    isUpdateAvailable,
    isCheckingUpdate,
    applyUpdate,
    checkForUpdate,
    forceAppUpdate,
  } = usePWA();

  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Updates are only applicable on web/PWA runtime
  if (!isSupported) {
    return null;
  }

  const handlePress = async () => {
    if (isUpdateAvailable) {
      applyUpdate();
      return;
    }

    setChecking(true);
    setFeedback(null);
    try {
      const result = await checkForUpdate(true);
      if (result.hasUpdate) {
        applyUpdate();
      } else {
        setFeedback('Up to date');
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (e) {
      console.warn('[UpdateAppButton] Check failed:', e);
      setFeedback('Error checking');
      setTimeout(() => setFeedback(null), 2500);
    } finally {
      setChecking(false);
    }
  };

  const handleForceReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirm = window.confirm(
        'Force reload and clear all cached files to get the latest version?'
      );
      if (confirm) {
        forceAppUpdate();
      }
    } else {
      Alert.alert(
        'Force Update',
        'Clear cached app files and reload now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reload Now', style: 'destructive', onPress: () => forceAppUpdate() },
        ]
      );
    }
  };

  // -------------------------------------------------------------
  // 1. HEADER VARIANT
  // -------------------------------------------------------------
  if (variant === 'header') {
    if (isUpdateAvailable) {
      return (
        <TouchableOpacity
          onPress={applyUpdate}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.headerUpdateButton, style]}
          accessibilityLabel="Update App"
        >
          <View style={styles.pulseDot} />
          <MaterialIcons name="system-update" size={15} color="#FFFFFF" />
          <Text style={styles.headerUpdateText}>Update</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleForceReload}
        disabled={checking || isCheckingUpdate}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.headerSyncButton, style]}
        accessibilityLabel="Check for updates or force refresh"
      >
        {checking || isCheckingUpdate ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : feedback ? (
          <Text style={styles.headerFeedbackText}>{feedback}</Text>
        ) : (
          <MaterialIcons name="refresh" size={19} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    );
  }

  // -------------------------------------------------------------
  // 2. MENU VARIANT (e.g. Profile Screen)
  // -------------------------------------------------------------
  if (variant === 'menu') {
    return (
      <View style={[styles.menuWrapper, style]}>
        <TouchableOpacity
          onPress={handlePress}
          disabled={checking || isCheckingUpdate}
          activeOpacity={0.7}
          style={styles.menuItem}
        >
          <View
            style={[
              styles.menuIconContainer,
              isUpdateAvailable && { backgroundColor: 'rgba(226, 55, 68, 0.16)' },
            ]}
          >
            <MaterialIcons
              name={isUpdateAvailable ? 'system-update' : 'sync'}
              size={24}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.menuTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuTitle}>
                {isUpdateAvailable ? 'Update Available!' : 'Check for Updates'}
              </Text>
              {isUpdateAvailable && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
            </View>
            <Text style={styles.menuSubtitle}>
              {isUpdateAvailable
                ? 'Tap to reload and apply latest features immediately'
                : feedback
                ? `Status: ${feedback}`
                : 'Fast-check server for the latest code changes'}
            </Text>
          </View>

          {checking || isCheckingUpdate ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : isUpdateAvailable ? (
            <View style={styles.updateNowBtn}>
              <Text style={styles.updateNowText}>Update</Text>
            </View>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          )}
        </TouchableOpacity>

        {/* Force Reload & Clear Cache Button */}
        <TouchableOpacity
          onPress={handleForceReload}
          activeOpacity={0.7}
          style={styles.forceReloadRow}
        >
          <MaterialIcons name="cleaning-services" size={16} color={COLORS.textLight} />
          <Text style={styles.forceReloadText}>
            Troubleshooting? Tap to Force Clear Browser Cache & Reload
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------
  // 3. SOLID VARIANT (e.g. Login Screen)
  // -------------------------------------------------------------
  return (
    <View style={[styles.solidWrapper, style]}>
      {isUpdateAvailable ? (
        <TouchableOpacity
          onPress={applyUpdate}
          activeOpacity={0.85}
          style={styles.solidUpdateButton}
        >
          <MaterialIcons name="system-update" size={18} color="#FFFFFF" />
          <Text style={styles.solidUpdateText}>New Version Available · Tap to Update Now</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handlePress}
          disabled={checking || isCheckingUpdate}
          activeOpacity={0.7}
          style={styles.solidSyncButton}
        >
          {checking || isCheckingUpdate ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
          ) : (
            <MaterialIcons name="refresh" size={16} color={COLORS.textLight} style={{ marginRight: 6 }} />
          )}
          <Text style={styles.solidSyncText}>
            {feedback || 'Check for Latest Updates & Refresh'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header styles
  headerUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerUpdateText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  headerSyncButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  headerFeedbackText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
  },

  // Menu styles
  menuWrapper: {
    marginBottom: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(226, 55, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  updateNowBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  updateNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  forceReloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  forceReloadText: {
    fontSize: 11.5,
    color: COLORS.textLight,
    textDecorationLine: 'underline',
  },

  // Solid styles
  solidWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  solidUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    elevation: 4,
  },
  solidUpdateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  solidSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
  },
  solidSyncText: {
    color: COLORS.textLight,
    fontSize: 12.5,
    fontWeight: '600',
  },
});
