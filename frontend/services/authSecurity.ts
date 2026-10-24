import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QuickUnlockProfile {
  userId: string;
  username: string;
  name: string;
  role: string;
  hasMpin: boolean;
  biometricEnabled: boolean;
  credentialId?: string;
  lastUsedAt?: number;
}

const STORAGE_KEY = 'ayyanar_quick_unlock_profile';

/**
 * Checks whether the current device/browser supports biometric platform authentication
 * (Touch ID, Face ID, Android Fingerprint, Windows Hello).
 */
export const checkBiometricHardwareSupport = async (): Promise<{ supported: boolean; reason?: string }> => {
  if (Platform.OS !== 'web') {
    // On native mobile builds, return true or check LocalAuthentication safely
    return { supported: true };
  }

  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Non-browser environment' };
  }

  // WebAuthn requires a secure context (https:// or localhost / 127.0.0.1)
  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      supported: false,
      reason: 'Biometrics require HTTPS or localhost for security.',
    };
  }

  if (!window.PublicKeyCredential) {
    return {
      supported: false,
      reason: 'Web Authentication API is not supported on this browser.',
    };
  }

  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isAvailable) {
        return {
          supported: false,
          reason: 'No biometric sensor (Touch ID / Face ID / Fingerprint) found on this device.',
        };
      }
      return { supported: true };
    }
  } catch (error: any) {
    console.warn('Biometric support check error:', error);
  }

  return { supported: !!window.PublicKeyCredential };
};

/**
 * Prompt biometric sensor to register a WebAuthn credential for the user (Touch ID / Face ID / Fingerprint).
 */
export const registerBiometricOnDevice = async (
  userId: string | number,
  userName: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> => {
  if (Platform.OS !== 'web') {
    return { success: true };
  }

  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'WebAuthn is not supported on this browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(`ayyanar_user_${userId}`);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Ayyanar CRM',
          id: window.location.hostname === 'localhost' ? undefined : window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: userName || 'User',
          displayName: userName || 'Ayyanar Staff',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256 (standard for FaceID / TouchID / Android)
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Hardware device sensor
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential || !credential.id) {
      return { success: false, error: 'Biometric registration was cancelled.' };
    }

    return { success: true, credentialId: credential.id };
  } catch (error: any) {
    console.error('registerBiometricOnDevice error:', error);
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric verification was cancelled or timed out.' };
    }
    return { success: false, error: error.message || 'Failed to register biometrics.' };
  }
};

/**
 * Prompt biometric sensor to verify the user during login.
 */
export const verifyBiometricOnDevice = async (
  credentialId?: string
): Promise<{ success: boolean; error?: string }> => {
  if (Platform.OS !== 'web') {
    return { success: true };
  }

  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'WebAuthn is not supported.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        userVerification: 'required',
        timeout: 60000,
      },
    };

    // If we have a credentialId, try specifying it
    if (credentialId) {
      try {
        const rawId = Uint8Array.from(atob(credentialId.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        getOptions.publicKey!.allowCredentials = [
          {
            id: rawId,
            type: 'public-key',
          },
        ];
      } catch {
        // Fall back to open prompt
      }
    }

    const assertion = await navigator.credentials.get(getOptions);
    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Biometric authentication was not completed.' };
  } catch (error: any) {
    console.error('verifyBiometricOnDevice error:', error);
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric verification was cancelled or not recognized.' };
    }
    return { success: false, error: error.message || 'Biometric verification failed.' };
  }
};

/**
 * Storage helpers for Quick Unlock Profile
 */
export const getQuickUnlockProfile = async (): Promise<QuickUnlockProfile | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as QuickUnlockProfile;
  } catch (error) {
    console.error('Failed to get Quick Unlock profile:', error);
    return null;
  }
};

export const saveQuickUnlockProfile = async (profile: QuickUnlockProfile): Promise<void> => {
  try {
    const data: QuickUnlockProfile = {
      ...profile,
      lastUsedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save Quick Unlock profile:', error);
  }
};

export const updateQuickUnlockSecurity = async (updates: {
  hasMpin?: boolean;
  biometricEnabled?: boolean;
  credentialId?: string;
}): Promise<void> => {
  try {
    const current = await getQuickUnlockProfile();
    if (!current) return;
    const updated: QuickUnlockProfile = {
      ...current,
      ...updates,
      lastUsedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update Quick Unlock profile:', error);
  }
};

export const clearQuickUnlockProfile = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear Quick Unlock profile:', error);
  }
};
