// Ayyanar Construction CRM — Production PWA Service Worker
// Automatically versioned on each build to eliminate browser caching issues.

const BUILD_ID = '1793257032848';
const CACHE_PREFIX = 'ayyanar-crm-';
const CACHE_NAME = CACHE_PREFIX + 'shell-v' + BUILD_ID;

// Precache static assets that define the core PWA shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

// ---------------------------------------------------------------------------
// 1. Install Phase
// Cache the core shell assets.
// CRITICAL: DO NOT call self.skipWaiting() here!
// The new service worker will install in the background and remain in the
// 'installed' (waiting) state until the user clicks "Update Now" or all tabs close.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new worker version:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res.ok) {
                return cache.put(url, res);
              }
            })
            .catch((err) => console.warn('[SW] Precache skipped for:', url, err))
        )
      );
    })
  );
});

// ---------------------------------------------------------------------------
// 2. Activate Phase
// Clean up older application caches owned by this app, leaving unrelated origin data intact.
// Claim clients so the new worker takes control smoothly.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new worker version:', CACHE_NAME);

  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            // Only delete obsolete caches belonging to this specific CRM application
            if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
              console.log('[SW] Purging outdated application cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// 3. Message Phase
// Receives instructions from the running web application (e.g. Update Now clicked)
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Triggered when user confirms the update notification: "Update Now"
  if (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting') {
    console.log('[SW] SKIP_WAITING signal received, taking over immediately');
    self.skipWaiting();
  }

  // Triggered when user requests a hard cache clear & reset
  if (event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] CLEAR_CACHE signal received, clearing application caches');
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            return caches.delete(key);
          })
        );
      })
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
  }
});

// ---------------------------------------------------------------------------
// 4. Fetch Phase
// Smart caching strategy tailored for SPA + Content Hashing
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. ABSOLUTE BYPASS FOR SENSITIVE DATA, APIs, SERVICE WORKER, AND VERSION RESOURCE
  // Never cache backend database records, customer info, or version checks
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/api/') ||
    url.hostname === 'apkayyanar.nexoraapp.in' ||
    url.port === '5000' ||
    url.pathname === '/version.json' ||
    url.pathname === '/sw.js' ||
    url.searchParams.has('nocache') ||
    url.searchParams.has('reload') ||
    url.searchParams.has('refresh') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    request.headers.has('Authorization')
  ) {
    return; // Pass through directly to native network
  }

  // 2. SPA NAVIGATION REQUESTS (HTML documents)
  // Network-First: Always fetch the latest HTML from server so new asset hashes are discovered.
  // Falls back to cached offline app shell only when network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cachedNavigate = await caches.match(request);
          if (cachedNavigate) return cachedNavigate;
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return caches.match('/');
        })
    );
    return;
  }

  // 3. CONTENT-HASHED STATIC ASSETS (_expo bundles, chunks, fonts)
  // Cache-First with network fallback: Hashed assets have immutable unique URLs per build.
  if (url.pathname.startsWith('/_expo/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. OTHER STATIC ASSETS (icons, manifests, static media)
  // Stale-While-Revalidate: Serve from cache immediately for fast render, revalidate in background.
  const isStatic =
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|png|jpg|jpeg|svg|ico|ttf|woff|woff2|json)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. DEFAULT: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
