// sw.js - Service worker for offline support.
// Strategy: precache the app shell on install; at runtime use
// stale-while-revalidate for same-origin GETs so the app works fully offline
// and updates in the background. Bump CACHE_VERSION to force a refresh.

const CACHE_VERSION = 'sahab-budget-v3';
const SHELL = [
    'index.html',
    'analytics.html',
    'settings.html',
    'about.html',
    'manifest.webmanifest',
    'css/fonts.css',
    'fonts/inter-latin.woff2',
    'fonts/inter-latin-ext.woff2',
    'js/vendor/chart.min.js',
    'js/vendor/papaparse.min.js',
    'css/theme.css',
    'css/base.css',
    'css/dashboard.css',
    'css/analytics.css',
    'css/settings.css',
    'css/modals.css',
    'css/budget-view.css',
    'css/features.css',
    'css/getting-started.css',
    'css/guide.css',
    'css/about.css',
    'js/theme.js',
    'js/icons.js',
    'js/accounts.js',
    'js/sync.js',
    'js/core.js',
    'js/rules.js',
    'js/utils.js',
    'js/columnMapping.js',
    'js/dashboard.js',
    'js/budgetView.js',
    'js/main.js',
    'js/mobile.js',
    'js/getting-started.js',
    'js/analytics.js',
    'js/settings.js',
    'js/import.js',
    'js/comparison.js',
    'js/daterange.js',
    'js/widget.js',
    'js/undo.js',
    'js/recurring.js',
    'js/transfers.js',
    'js/insights-ui.js',
    'js/lock.js',
    'js/pwa.js',
    'images/logo.png',
    'images/icon-192.png',
    'images/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            // Precache the shell. Bypass the HTTP cache ({cache:'reload'}) so a
            // version bump always fetches fresh assets from the network rather
            // than reusing possibly-stale browser-cached copies. Cache what we
            // can; ignore any that fail so install still succeeds.
            Promise.allSettled(SHELL.map((url) =>
                fetch(new Request(url, { cache: 'reload' })).then((res) => {
                    if (res && res.ok) return cache.put(url, res);
                })
            ))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // let cross-origin (CDN) pass through

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(req).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.status === 200) cache.put(req, res.clone());
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        )
    );
});
