import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { BUILD_INFO } from '../constants/buildInfo';

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
  isCheckingUpdate: boolean;
  isBannerDismissed: boolean;
  currentBuildId: string;
  latestBuildId: string | null;
  lastCheckTime: number | null;
}

// Global state held across the app lifecycle
const CLIENT_BUILD_ID = String(BUILD_INFO.buildId || '1.0.0');
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let currentBuildId: string = CLIENT_BUILD_ID;
let latestBuildId: string | null = CLIENT_BUILD_ID;
let isUpdateAvailable = false;
let isCheckingUpdate = false;
let isBannerDismissed = false;
let lastCheckTime: number | null = null;
let refreshing = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('[PWA] Listener notify error:', e);
    }
  });
}

/**
 * Robust detection of whether the application is already installed
 * and running in standalone display mode across iOS, Android, and Desktop.
 */
export function checkIsInstalled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
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

    // 6. User installed flag stored in browser
    if (window.localStorage && window.localStorage.getItem('ayyanar_crm_pwa_installed') === 'true') {
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

/**
 * Dismiss / Snooze update notification banner for the current session or a period
 */
export function dismissUpdateBanner(snoozeMinutes: number = 15): void {
  isBannerDismissed = true;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
      window.sessionStorage.setItem('ayyanar_pwa_update_snooze_until', snoozeUntil.toString());
    }
  } catch (_) {}
  notifyListeners();
}

/**
 * Proactively checks server for version updates via version.json and service worker.
 * Checks service worker update, compares running buildId against deployed version.json.
 */
export async function checkForUpdate(force = false): Promise<{
  hasUpdate: boolean;
  message: string;
}> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { hasUpdate: false, message: 'Updates only apply to web / PWA runtime.' };
  }

  const now = Date.now();
  // Throttle automatic background checks to once every 15 seconds unless forced
  if (!force && lastCheckTime && now - lastCheckTime < 15000) {
    return {
      hasUpdate: isUpdateAvailable,
      message: isUpdateAvailable ? 'Update available!' : 'Recently checked.',
    };
  }

  if (force) {
    isCheckingUpdate = true;
    notifyListeners();
  }
  lastCheckTime = now;

  let updateFound = false;

  try {
    // 1. Trigger Service Worker update check
    if ('serviceWorker' in navigator) {
      try {
        const reg =
          swRegistration ||
          (await navigator.serviceWorker.getRegistration()) ||
          (window as any).__pwaRegistration;

        if (reg) {
          swRegistration = reg;

          // Check if there's already a waiting worker
          if (reg.waiting) {
            waitingWorker = reg.waiting;
            updateFound = true;
            isUpdateAvailable = true;
          }

          // Request browser to check if sw.js on server has byte changes
          await reg.update();

          if (reg.waiting) {
            waitingWorker = reg.waiting;
            updateFound = true;
            isUpdateAvailable = true;
          }
        }
      } catch (swErr) {
        console.warn('[PWA] Service worker update check notice:', swErr);
      }
    }

    // 2. Fetch deployed version.json bypassing all browser & proxy caches
    try {
      const res = await fetch(`/version.json?nocache=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const serverBuildId = data?.buildId ? String(data.buildId) : null;
        latestBuildId = serverBuildId;

        if (serverBuildId && serverBuildId !== CLIENT_BUILD_ID) {
          console.log(
            '[PWA] New deployment detected! Server build:',
            serverBuildId,
            'Current client build:',
            CLIENT_BUILD_ID
          );
          updateFound = true;
          isUpdateAvailable = true;

          // Check if banner snooze expired
          try {
            const snoozeStr = window.sessionStorage?.getItem('ayyanar_pwa_update_snooze_until');
            if (snoozeStr) {
              const snoozeUntil = parseInt(snoozeStr, 10);
              if (Date.now() > snoozeUntil) {
                isBannerDismissed = false;
              }
            }
          } catch (_) {}

          // Proactively tell the service worker registration to download new assets
          if (swRegistration) {
            swRegistration.update().catch(() => {});
          }
        }
      }
    } catch (verErr) {
      console.warn('[PWA] version.json check error:', verErr);
    }

    if (updateFound || isUpdateAvailable) {
      notifyListeners();
      return { hasUpdate: true, message: 'New update is available!' };
    }

    return { hasUpdate: false, message: 'Application is running the latest version.' };
  } finally {
    if (force) {
      isCheckingUpdate = false;
      notifyListeners();
    }
  }
}

/**
 * Applies the waiting service worker update and reloads the application exactly once.
 * Protected against infinite reload loops.
 */
export function applyPWAUpdate(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  if (refreshing) {
    console.log('[PWA] Update already in progress...');
    return;
  }

  console.log('[PWA] Applying application update...');

  // Set safety latch in sessionStorage to prevent infinite reload loops
  try {
    const lastReloadStr = window.sessionStorage?.getItem('ayyanar_pwa_updating_at');
    if (lastReloadStr) {
      const lastReload = parseInt(lastReloadStr, 10);
      if (Date.now() - lastReload < 5000) {
        console.warn('[PWA] Prevented rapid consecutive reload loop.');
        return;
      }
    }
    window.sessionStorage?.setItem('ayyanar_pwa_updating_at', Date.now().toString());
  } catch (_) {}

  // 1. If we have a waiting worker, command it to skipWaiting
  if (waitingWorker) {
    console.log('[PWA] Posting SKIP_WAITING to waiting worker');
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Fallback safety: If controllerchange does not fire within 2.5s, force reload
    setTimeout(() => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    }, 2500);
    return;
  }

  // 2. If swRegistration has a waiting worker that wasn't assigned yet
  if (swRegistration && swRegistration.waiting) {
    console.log('[PWA] Posting SKIP_WAITING to swRegistration.waiting');
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    }, 2500);
    return;
  }

  // 3. If version mismatch was detected but no waiting worker exists, hard reload
  forceAppUpdate();
}

/**
 * Force clear all web caches (CacheStorage, service workers) and hard reload the page.
 * Guarantees that any browser-level caching is immediately discarded.
 */
export async function forceAppUpdate(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  if (refreshing) return;
  refreshing = true;

  console.log('[PWA] Force clearing caches and updating app...');

  try {
    // 1. Tell all service workers to clear cache & skip waiting
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.active) reg.active.postMessage({ type: 'CLEAR_CACHE' });
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // 2. Clear browser CacheStorage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ayyanar-crm-'))
          .map((name) => caches.delete(name))
      );
    }
  } catch (err) {
    console.warn('[PWA] Error clearing cache during force update:', err);
  }

  // 3. Force page reload with cache busting query parameter
  const targetUrl = new URL(window.location.href);
  targetUrl.searchParams.set('reload', Date.now().toString());
  window.location.replace(targetUrl.toString());
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

// ============================================================================
// BROWSER INITIALIZATION LIFECYCLE
// ============================================================================
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Check if banner snooze is still active
  try {
    const snoozeStr = window.sessionStorage?.getItem('ayyanar_pwa_update_snooze_until');
    if (snoozeStr) {
      const snoozeUntil = parseInt(snoozeStr, 10);
      if (Date.now() < snoozeUntil) {
        isBannerDismissed = true;
      }
    }
  } catch (_) {}

  // Check if we just reloaded from an update
  try {
    const updateTimeStr = window.sessionStorage?.getItem('ayyanar_pwa_updating_at');
    if (updateTimeStr) {
      const updateTime = parseInt(updateTimeStr, 10);
      if (Date.now() - updateTime < 10000) {
        console.log('[PWA] Successfully updated to build:', CLIENT_BUILD_ID);
        window.sessionStorage?.removeItem('ayyanar_pwa_updating_at');
        window.sessionStorage?.removeItem('ayyanar_pwa_update_snooze_until');
      }
    }
  } catch (_) {}

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

  // Handle early waiting worker captured by index.html
  if ((window as any).__pwaWaitingWorker) {
    waitingWorker = (window as any).__pwaWaitingWorker;
    isUpdateAvailable = true;
    notifyListeners();
  }

  // Listen for custom event from index.html if update becomes ready
  window.addEventListener('pwa-update-ready', () => {
    if ((window as any).__pwaWaitingWorker) {
      waitingWorker = (window as any).__pwaWaitingWorker;
      isUpdateAvailable = true;
      notifyListeners();
    }
  });

  // Register and monitor Service Worker updates safely
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        swRegistration = registration;

        // If there's an active waiting worker on launch
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          isUpdateAvailable = true;
          notifyListeners();
        }

        // Detect new workers being installed
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[PWA] New update installed and waiting!');
                waitingWorker = newWorker;
                isUpdateAvailable = true;
                notifyListeners();
              }
            }
          });
        });

        // Trigger immediate check on launch
        checkForUpdate(false);
      })
      .catch((err) => console.warn('[PWA] Service worker ready notice:', err));

    // Listen for controllerchange after skipWaiting
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New controller active');
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // Proactive Event-Driven Update Checks:
  // 1. Check whenever the user returns to the app tab from another tab or app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate(false);
    }
  });

  // 2. Poll every 5 minutes (300,000 ms) while application remains open
  setInterval(() => {
    if (navigator.onLine) {
      checkForUpdate(false);
    }
  }, 300000);
}

/**
 * React hook to observe PWA installation, updates, and triggering controls
 */
export function usePWA(): PWAState & {
  promptInstall: typeof promptInstall;
  applyUpdate: typeof applyPWAUpdate;
  checkForUpdate: typeof checkForUpdate;
  forceAppUpdate: typeof forceAppUpdate;
  dismissUpdateBanner: typeof dismissUpdateBanner;
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
  const isInstallable = !isInstalled && (hasPrompt || isIOS);

  return {
    isSupported: Platform.OS === 'web' && typeof window !== 'undefined',
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isStandalone: isInstalled,
    isUpdateAvailable: isUpdateAvailable || !!waitingWorker,
    isCheckingUpdate,
    isBannerDismissed,
    currentBuildId,
    latestBuildId,
    lastCheckTime,
    promptInstall,
    applyUpdate: applyPWAUpdate,
    checkForUpdate,
    forceAppUpdate,
    dismissUpdateBanner,
  };
}
