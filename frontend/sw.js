/**
 * INNO's Stationery — Service Worker
 * ---------------------------------------------------------------
 * Purpose:
 *   1. Makes the site installable ("Add to Home Screen" / browser
 *      "Install app" prompt) — required by Chrome/Android for the
 *      install prompt to appear at all.
 *   2. Caches the static "app shell" (CSS/JS/icons) so the site
 *      loads instantly on repeat visits and still opens if the
 *      connection briefly drops.
 *
 * IMPORTANT: API calls (/backend/api/...) are NEVER cached here —
 * product prices, stock, and order status must always come from
 * the network, never a stale cache.
 * ---------------------------------------------------------------
 */

const CACHE_NAME = 'inno-stationery-v2';

// Core files needed to render the shell of the site while offline.
// Paths are relative to this file's location (frontend/sw.js).
// CSS/JS include the same ?v= query used in the HTML — bump both together
// whenever those files change, so the service worker never serves a stale copy.
const APP_SHELL = [
    './index.html',
    './css/style.css?v=7',
    './js/core.js?v=7',
    './js/main.js?v=7',
    './manifest.json',
    './assets/placeholder.svg',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never touch API requests — always go straight to the network.
    if (url.pathname.includes('/backend/api/')) {
        return;
    }

    // Only handle GET requests for same-origin static assets.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Navigations (HTML pages): network-first, falling back to cache, then to the cached homepage.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    return res;
                })
                .catch(() =>
                    caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // Static assets (css/js/images): cache-first, updating the cache in the background.
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request).then((res) => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || networkFetch;
        })
    );
});
