// sw.js - Service worker for offline support.
// Strategy: precache the app shell on install; at runtime use
// stale-while-revalidate for same-origin GETs so the app works fully offline
// and updates in the background. Bump CACHE_VERSION to force a refresh.

const CACHE_VERSION = 'sahab-budget-v4';
const SHELL = [
    'about.html',
    'analytics.html',
    'budgets.html',
    'index.html',
    'settings.html',
    'transactions.html',
    'manifest.webmanifest',
    'fonts/inter-latin.woff2',
    'fonts/inter-latin-ext.woff2',
    'js/vendor/chart.min.js',
    'js/vendor/papaparse.min.js',
    'css/about.css',
    'css/analytics.css',
    'css/base.css',
    'css/budgets.css',
    'css/dashboard.css',
    'css/fonts.css',
    'css/getting-started.css',
    'css/import.css',
    'css/modals.css',
    'css/settings.css',
    'css/theme.css',
    'css/transactions.css',
    'css/tx-sheet.css',
    'js/accounts.js',
    'js/analytics.js',
    'js/backup.js',
    'js/budgets.js',
    'js/columnMapping.js',
    'js/comparison.js',
    'js/core.js',
    'js/dashboard.js',
    'js/daterange.js',
    'js/getting-started.js',
    'js/icons.js',
    'js/import.js',
    'js/importer.js',
    'js/insights-ui.js',
    'js/lock.js',
    'js/pwa.js',
    'js/recurring.js',
    'js/rules.js',
    'js/settings.js',
    'js/shell.js',
    'js/store.js',
    'js/sync.js',
    'js/theme.js',
    'js/transactions.js',
    'js/transfers.js',
    'js/tx-sheet.js',
    'js/ui.js',
    'js/undo.js',
    'js/utils.js',
    'images/logo.png',
    'images/icon-192.png',
    'images/icon-512.png',
    'images/apple-touch-icon.png',
    'sample_data.json',
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
