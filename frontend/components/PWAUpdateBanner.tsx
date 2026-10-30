import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePWA } from '../services/pwa';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

export default function PWAUpdateBanner() {
  const { isUpdateAvailable, isBannerDismissed, isUpdating, applyUpdate, dismissUpdateBanner } = usePWA();
  const [updating, setUpdating] = useState(false);

  const isBusy = updating || isUpdating;

  if (Platform.OS !== 'web' || !isUpdateAvailable || isBannerDismissed) {
    return null;
  }

  const handleUpdateNow = () => {
    setUpdating(true);
    applyUpdate();
  };

  const handleLater = () => {
    dismissUpdateBanner(15); // Snooze for 15 minutes
  };

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentWrap}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="system-update" size={24} color={COLORS.primary} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            A new version of Ayyanar CRM is ready. Apply update to load the latest features.
          </Text>
        </View>

        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.laterButton}
            onPress={handleLater}
            disabled={isBusy}
            activeOpacity={0.7}
            accessibilityLabel="Update Later"
          >
            <Text style={styles.laterButtonText}>Later</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdateNow}
            disabled={isBusy}
            activeOpacity={0.8}
            accessibilityLabel="Update Now"
          >
            {isBusy ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.updateButtonText}>Updating...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.updateButtonText}>Update Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 99999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  contentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    maxWidth: 620,
    width: '100%',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(203, 32, 45, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 180,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
    lineHeight: 16,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  laterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  laterButtonText: {
    color: COLORS.textLight,
    fontSize: 12.5,
    fontWeight: '700',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
