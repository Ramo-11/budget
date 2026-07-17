// js/pwa.js - Registers the service worker for offline/installable use.
// Registered last so it never blocks first paint.
(function () {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline unavailable */ });
    });
})();
