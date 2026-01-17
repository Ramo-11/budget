// js/sync.js - Cross-tab data synchronization

const SYNC_CHANNEL_NAME = 'sahabBudget_sync';
let syncChannel = null;

// Message types
const SYNC_EVENTS = {
    CATEGORY_ADDED: 'category_added',
    CATEGORY_DELETED: 'category_deleted',
    CATEGORY_UPDATED: 'category_updated',
    DATA_CHANGED: 'data_changed',
    BUDGET_UPDATED: 'budget_updated',
};

// Initialize sync channel
function initializeSyncChannel() {
    if ('BroadcastChannel' in window) {
        syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        syncChannel.onmessage = handleSyncMessage;
    } else {
        // Fallback for older browsers - use storage event
        window.addEventListener('storage', handleStorageEvent);
    }
}

// Broadcast a sync event
function broadcastSync(eventType, payload = {}) {
    const message = {
        type: eventType,
        payload: payload,
        timestamp: Date.now(),
        source: window.location.pathname,
    };

    if (syncChannel) {
        syncChannel.postMessage(message);
    } else {
        // Fallback: use localStorage with timestamp to force event
        localStorage.setItem('sahabBudget_sync_event', JSON.stringify(message));
    }
}

// Handle incoming sync messages
function handleSyncMessage(event) {
    const { type, payload, source } = event.data;

    // Don't process messages from the same page
    const currentPath = window.location.pathname;
    if (source === currentPath) {
        return;
    }

    // Reload data from localStorage
    if (typeof loadSavedData === 'function') {
        loadSavedData();
    }

    // Refresh views based on current page
    refreshCurrentView(type, payload);
}

// Handle storage event fallback
function handleStorageEvent(event) {
    if (event.key === 'sahabBudget_sync_event' && event.newValue) {
        try {
            const message = JSON.parse(event.newValue);
            handleSyncMessage({ data: message });
        } catch (e) {
            // Ignore parse errors
        }
    }
}

// Refresh the current view based on page
function refreshCurrentView(eventType, payload) {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';

    switch (currentPage) {
        case 'index.html':
        case '':
            refreshDashboard();
            break;
        case 'analytics.html':
            refreshAnalytics();
            break;
        case 'settings.html':
            refreshSettings();
            break;
    }

    // Show notification about the change
    if (typeof showNotification === 'function') {
        if (eventType === SYNC_EVENTS.CATEGORY_ADDED && payload.name) {
            showNotification(`Category "${payload.name}" was added`, 'info');
        } else if (eventType === SYNC_EVENTS.CATEGORY_DELETED && payload.name) {
            showNotification(`Category "${payload.name}" was removed`, 'info');
        } else if (eventType === SYNC_EVENTS.CATEGORY_UPDATED) {
            showNotification('Categories updated', 'info');
        }
    }
}

// Dashboard refresh
function refreshDashboard() {
    if (typeof currentMonth !== 'undefined' && currentMonth) {
        if (typeof switchToMonth === 'function') {
            switchToMonth(currentMonth);
        }
    }
}

// Analytics refresh
function refreshAnalytics() {
    if (typeof loadDataFromStorage === 'function') {
        loadDataFromStorage();
    }
    // Refresh the current active view
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (tabName && typeof switchView === 'function') {
            switchView(tabName);
        }
    } else if (typeof loadOverviewView === 'function') {
        loadOverviewView();
    }
}

// Settings refresh
function refreshSettings() {
    if (typeof currentMonth !== 'undefined' && currentMonth) {
        if (typeof switchSettingsMonth === 'function') {
            switchSettingsMonth(currentMonth);
        }
    }
    if (typeof updateBudgetView === 'function' && typeof analyzeTransactions === 'function') {
        const monthData = monthlyData?.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSyncChannel);
} else {
    initializeSyncChannel();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (syncChannel) {
        syncChannel.close();
    }
});
