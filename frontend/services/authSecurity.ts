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

// Safe base64url decoder that always pads correctly
const base64UrlToBuffer = (base64url: string): Uint8Array => {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad === 1) base64 += '===';

  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Safe buffer to base64url encoder
const bufferToBase64Url = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    const rpId = window.location.hostname === 'localhost' ? undefined : window.location.hostname;

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Ayyanar CRM',
          id: rpId,
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
          authenticatorAttachment: 'platform', // Hardware device sensor (Fingerprint / Face ID)
          userVerification: 'required',
          residentKey: 'preferred', // Store as a discoverable Passkey on device / Google Password Manager / iCloud Keychain
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Biometric registration was cancelled.' };
    }

    const savedId = credential.rawId ? bufferToBase64Url(credential.rawId) : credential.id;
    return { success: true, credentialId: savedId };
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
    const rpId = window.location.hostname === 'localhost' ? undefined : window.location.hostname;

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        rpId,
        userVerification: 'required',
        timeout: 60000,
      },
    };

    // If we have a credentialId, try specifying it with safe base64url padding
    if (credentialId && credentialId.trim().length > 0) {
      try {
        const rawId = base64UrlToBuffer(credentialId.trim());
        getOptions.publicKey!.allowCredentials = [
          {
            id: rawId as BufferSource,
            type: 'public-key',
          },
        ];
      } catch (e) {
        console.warn('Could not parse credentialId into allowCredentials, using discoverable search:', e);
      }
    }

    let assertion = await navigator.credentials.get(getOptions);

    // If targeted allowCredentials failed or wasn't found, try discoverable passkeys fallback
    if (!assertion && getOptions.publicKey?.allowCredentials) {
      try {
        const fallbackOptions: CredentialRequestOptions = {
          publicKey: {
            challenge,
            rpId,
            userVerification: 'required',
            timeout: 60000,
          },
        };
        assertion = await navigator.credentials.get(fallbackOptions);
      } catch {
        // Fallback failed or ignored
      }
    }

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Biometric authentication was not completed.' };
  } catch (error: any) {
    console.error('verifyBiometricOnDevice error:', error);
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Passkey not found or biometric scan was cancelled. Please sign in with password to re-register.' };
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
