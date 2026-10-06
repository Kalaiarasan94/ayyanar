import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePWA } from '../services/pwa';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

export interface InstallAppButtonProps {
  variant?: 'header' | 'solid' | 'menu' | 'badge';
  showInstalledState?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function InstallAppButton({
  variant = 'header',
  showInstalledState = true,
  style,
}: InstallAppButtonProps) {
  const { isSupported, isInstallable, isInstalled, isIOS, promptInstall } = usePWA();
  const [loading, setLoading] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If not running in a web browser, or if install is not supported and not installed, do not render a misleading button
  if (!isSupported) {
    return null;
  }

  // If already installed and caller requested to hide installed state
  if (isInstalled && !showInstalledState) {
    return null;
  }

  // If not installed and not installable (e.g. desktop browser that doesn't support PWA install), gracefully hide
  if (!isInstalled && !isInstallable) {
    return null;
  }

  const handlePress = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    setLoading(true);
    try {
      const result = await promptInstall();
      if (result.outcome === 'ios_instructions') {
        setShowIOSModal(true);
      }
    } catch (e) {
      console.warn('[InstallAppButton] Error prompting install:', e);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Render: HEADER Variant ----------------
  if (variant === 'header') {
    if (isInstalled) {
      return (
        <View style={[styles.headerInstalledBadge, style]}>
          <MaterialIcons name="verified" size={14} color="#FFFFFF" />
          <Text style={styles.headerInstalledText}>Installed</Text>
        </View>
      );
    }

    return (
      <>
        <TouchableOpacity
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.headerInstallButton, style]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="get-app" size={16} color="#FFFFFF" />
              <Text style={styles.headerInstallText}>Install App</Text>
            </>
          )}
        </TouchableOpacity>

        {renderIOSModal()}
      </>
    );
  }

  // ---------------- Render: MENU Variant (e.g. Profile Screen) ----------------
  if (variant === 'menu') {
    return (
      <>
        <TouchableOpacity
          onPress={isInstalled ? undefined : handlePress}
          activeOpacity={isInstalled ? 1 : 0.7}
          disabled={loading}
          style={[
            styles.menuItem,
            isInstalled && styles.menuItemInstalled,
            style,
          ]}
        >
          <View
            style={[
              styles.menuIconContainer,
              isInstalled && { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
            ]}
          >
            <MaterialIcons
              name={isInstalled ? 'check-circle' : 'get-app'}
              size={24}
              color={isInstalled ? '#16A34A' : COLORS.primary}
            />
          </View>

          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>
              {isInstalled ? 'Application Installed' : 'Install Application'}
            </Text>
            <Text style={styles.menuSubtitle}>
              {isInstalled
                ? 'Running as installed Progressive Web App'
                : 'Install on your home screen for faster native access'}
            </Text>
          </View>

          {isInstalled ? (
            <View style={styles.installedPill}>
              <Text style={styles.installedPillText}>Installed</Text>
            </View>
          ) : loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
          )}
        </TouchableOpacity>

        {renderIOSModal()}
      </>
    );
  }

  // ---------------- Render: BADGE Variant ----------------
  if (variant === 'badge') {
    if (isInstalled) {
      return (
        <View style={[styles.badgeInstalled, style]}>
          <MaterialIcons name="check-circle" size={14} color="#16A34A" />
          <Text style={styles.badgeInstalledText}>Installed</Text>
        </View>
      );
    }
    return (
      <>
        <TouchableOpacity
          onPress={handlePress}
          disabled={loading}
          style={[styles.badgeInstall, style]}
        >
          <MaterialIcons name="get-app" size={14} color={COLORS.primary} />
          <Text style={styles.badgeInstallText}>Install App</Text>
        </TouchableOpacity>
        {renderIOSModal()}
      </>
    );
  }

  // ---------------- Render: SOLID / BUTTON Variant (e.g. Login Screen) ----------------
  return (
    <>
      {isInstalled ? (
        <View style={[styles.solidInstalledCard, style]}>
          <MaterialIcons name="verified" size={20} color="#16A34A" />
          <Text style={styles.solidInstalledText}>App is Installed on this Device</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.85}
          style={[styles.solidInstallButton, style]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
              <Text style={styles.solidInstallText}>Install App</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {renderIOSModal()}
    </>
  );

  // ---------------- iOS Install Instruction Modal ----------------
  function renderIOSModal() {
    return (
      <Modal
        visible={showIOSModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIOSModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="add-to-home-screen" size={28} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Install Ayyanar CRM</Text>
                <Text style={styles.modalSubtitle}>Install on your iPhone or iPad</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowIOSModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.stepsContainer}>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepTitle}>Tap the Share button</Text>
                  <Text style={styles.stepDesc}>
                    In Safari’s bottom toolbar, tap the Share icon (<MaterialIcons name="ios-share" size={14} color={COLORS.primary} />).
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepTitle}>Select “Add to Home Screen”</Text>
                  <Text style={styles.stepDesc}>
                    Scroll down through the share options and tap Add to Home Screen (<MaterialIcons name="add-box" size={14} color={COLORS.primary} />).
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepTitle}>Tap “Add” in top right</Text>
                  <Text style={styles.stepDesc}>
                    Ayyanar CRM will be added directly to your device apps!
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setShowIOSModal(false)}
            >
              <Text style={styles.modalDoneText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  // Header styles
  headerInstallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    marginRight: 6,
  },
  headerInstallText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  headerInstalledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: 6,
  },
  headerInstalledText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },

  // Solid styles
  solidInstallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  solidInstallText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  solidInstalledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  solidInstalledText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
  },

  // Menu styles
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  menuItemInstalled: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  installedPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  installedPillText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },

  // Badge styles
  badgeInstall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(226, 55, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeInstallText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  badgeInstalled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeInstalledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },

  // iOS Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(226, 55, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  stepsContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepTextWrap: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12.5,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  modalDoneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
