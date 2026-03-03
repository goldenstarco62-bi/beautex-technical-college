// =====================================================================
// Beautex College - Service Worker (Network-First Strategy)
// Version: 2.0 - FIXES white screen on installed PWA
// =====================================================================

const CACHE_NAME = 'beautex-cache-v2';

// On install, skip waiting immediately so new SW takes over ASAP
self.addEventListener('install', event => {
    console.log('[SW] Installing v2 - network-first strategy');
    self.skipWaiting();
});

// On activate, clear ALL old caches and take control immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// NETWORK-FIRST strategy: always try network, fall back to cache
// This ensures the app always loads the latest version
self.addEventListener('fetch', event => {
    // Skip non-GET requests and chrome-extension requests
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension')) return;

    // For API calls: never cache, always pass through
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Network succeeded — update cache and return response
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed — try cache as fallback
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    // For navigation requests with no cache, return index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
