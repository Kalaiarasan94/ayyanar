import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAState {
  isSupported: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isUpdateAvailable: boolean;
}

// Global state held across the lifecycle
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Robust detection of whether the application is already installed
 * and running in standalone display mode across iOS, Android, and Desktop.
 */
export function checkIsInstalled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false; // Native Android / iOS APK/IPA is its own native runtime
  }

  try {
    // 1. Standard Web display-mode standalone
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // 2. Window Controls Overlay (desktop PWA)
    if (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) {
      return true;
    }

    // 3. Minimal UI display-mode
    if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) {
      return true;
    }

    // 4. iOS Safari standalone mode
    if ((window.navigator as any)?.standalone === true) {
      return true;
    }

    // 5. Android Trusted Web Activity / WebAPK referrer
    if (document.referrer && document.referrer.startsWith('android-app://')) {
      return true;
    }

    // 6. User installed in this browser session
    if (window.localStorage && window.localStorage.getItem('ayyanar_crm_pwa_installed') === 'true') {
      // Re-verify if still in browser tab or standalone
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[PWA] Error checking install status:', e);
  }

  return false;
}

/**
 * Detects iOS device (iPhone, iPad, iPod)
 */
export function checkIsIOS(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(ua);
  const isIPadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

/**
 * Detects Android device
 */
export function checkIsAndroid(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return /android/i.test(window.navigator.userAgent);
}

// Initialize browser listeners once
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Capture Chromium PWA install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Native beforeinstallprompt captured');
    notifyListeners();
  });

  // Handle native app installed event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed');
    deferredPrompt = null;
    try {
      window.localStorage.setItem('ayyanar_crm_pwa_installed', 'true');
    } catch (_) {}
    notifyListeners();
  });

  // Watch for display-mode standalone changes
  if (window.matchMedia) {
    try {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', () => notifyListeners());
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(() => notifyListeners());
      }
    } catch (_) {}
  }

  // Register and monitor Service Worker updates safely
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        // If there's an active waiting worker on launch
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          notifyListeners();
        }

        // Detect new workers being installed
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New update available in background');
              waitingWorker = newWorker;
              notifyListeners();
            }
          });
        });
      })
      .catch((err) => console.warn('[PWA] Service worker ready error:', err));

    // Listen for controllerchange after skipWaiting
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

/**
 * Triggers the browser install prompt or returns instructions flag
 */
export async function promptInstall(): Promise<{
  outcome: 'accepted' | 'dismissed' | 'ios_instructions' | 'unsupported';
}> {
  if (checkIsInstalled()) {
    return { outcome: 'accepted' };
  }

  // 1. Native Chromium prompt available
  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        try {
          window.localStorage.setItem('ayyanar_crm_pwa_installed', 'true');
        } catch (_) {}
        deferredPrompt = null;
        notifyListeners();
        return { outcome: 'accepted' };
      }
      return { outcome: 'dismissed' };
    } catch (err) {
      console.error('[PWA] Error triggering install prompt:', err);
    }
  }

  // 2. iOS Safari (requires manual Add to Home Screen)
  if (checkIsIOS()) {
    return { outcome: 'ios_instructions' };
  }

  return { outcome: 'unsupported' };
}

/**
 * Applies the waiting service worker update and reloads the application
 */
export function applyPWAUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * React hook to observe PWA installation and update states
 */
export function usePWA(): PWAState & {
  promptInstall: typeof promptInstall;
  applyUpdate: typeof applyPWAUpdate;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const isInstalled = checkIsInstalled();
  const isIOS = checkIsIOS();
  const isAndroid = checkIsAndroid();
  const hasPrompt = !!deferredPrompt;

  // Available to install if either native prompt is ready OR on iOS when not installed
  const isInstallable = !isInstalled && (hasPrompt || isIOS);

  return {
    isSupported: Platform.OS === 'web' && typeof window !== 'undefined',
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isStandalone: isInstalled,
    isUpdateAvailable: !!waitingWorker,
    promptInstall,
    applyUpdate: applyPWAUpdate,
  };
}
