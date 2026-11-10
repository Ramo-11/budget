const SYNC_CHANNEL_NAME = 'sahabBudget_sync';
const SYNC_FALLBACK_KEY = 'sahabBudget_sync_event';
let syncChannel = null;

function initializeSyncChannel() {
    if ('BroadcastChannel' in window) {
        syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        syncChannel.onmessage = handleSyncMessage;
    } else {
        window.addEventListener('storage', handleStorageEvent);
    }
}

function broadcastSync(eventType, payload = {}) {
    const message = {
        type: eventType,
        payload: payload,
        timestamp: Date.now(),
        source: window.location.pathname,
        account: (typeof getActiveAccountId === 'function') ? getActiveAccountId() : null,
    };
    if (syncChannel) {
        syncChannel.postMessage(message);
    } else {
        try { localStorage.setItem(SYNC_FALLBACK_KEY, JSON.stringify(message)); } catch (e) { void e; }
    }
}

function handleSyncMessage(event) {
    const data = event && event.data;
    if (!data) return;
    const activeAccount = (typeof getActiveAccountId === 'function') ? getActiveAccountId() : null;
    if (data.account && activeAccount && data.account !== activeAccount) return;
    if (window.Store && typeof window.Store.reload === 'function') {
        window.Store.reload();
    } else if (typeof loadSavedData === 'function') {
        loadSavedData();
    }
}

function handleStorageEvent(event) {
    if (event.key === SYNC_FALLBACK_KEY && event.newValue) {
        try { handleSyncMessage({ data: JSON.parse(event.newValue) }); } catch (e) { void e; }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSyncChannel);
} else {
    initializeSyncChannel();
}

window.addEventListener('beforeunload', () => {
    if (syncChannel) syncChannel.close();
});
