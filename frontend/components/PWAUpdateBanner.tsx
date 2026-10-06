import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePWA } from '../services/pwa';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

export default function PWAUpdateBanner() {
  const { isUpdateAvailable, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (Platform.OS !== 'web' || !isUpdateAvailable || dismissed) {
    return null;
  }

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentWrap}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="system-update" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>New version available</Text>
          <Text style={styles.subtitle}>Update now to load the latest features</Text>
        </View>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={applyUpdate}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.updateButtonText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    maxWidth: 520,
    width: '100%',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(226, 55, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.textLight,
    marginTop: 1,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.lg,
    marginLeft: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  dismissButton: {
    padding: 6,
    marginLeft: 4,
  },
});
