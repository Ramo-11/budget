// js/undo.js - Global undo for destructive actions.
// Usage: capture a snapshot, perform the action, then call:
//   showUndo('Category deleted', () => { ...restore from snapshot... });
// A snackbar appears with an Undo button for a few seconds. If the user clicks
// Undo, the restore callback runs. Provides a generic snapshot helper for the
// active account's data payload so callers can restore easily.

(function () {
    let currentTimer = null;

    function removeExisting() {
        const existing = document.getElementById('undoSnackbar');
        if (existing) existing.remove();
        if (currentTimer) { clearTimeout(currentTimer); currentTimer = null; }
    }

    // Snapshot / restore the ENTIRE active-account payload. Cheap and bulletproof
    // for destructive actions (delete category, clear transactions, restore backup).
    window.snapshotActiveData = function () {
        try {
            const key = getActiveDataKey();
            return { key: key, value: localStorage.getItem(key) };
        } catch (e) { return null; }
    };

    window.restoreActiveData = function (snapshot) {
        if (!snapshot || !snapshot.key) return false;
        try {
            if (snapshot.value == null) localStorage.removeItem(snapshot.key);
            else localStorage.setItem(snapshot.key, snapshot.value);
            return true;
        } catch (e) { return false; }
    };

    // For destructive actions that reload the page: stash a snapshot, reload,
    // and the snackbar reappears after load offering Undo (which restores +
    // reloads). Skips silently if the snapshot is too large for sessionStorage.
    window.showUndoAfterReload = function (message, snapshot) {
        try {
            const payload = JSON.stringify({ message: message, snapshot: snapshot });
            if (payload.length > 3_000_000) return false; // too big to stash safely
            sessionStorage.setItem('sahabBudget_pendingUndo', payload);
            return true;
        } catch (e) { return false; }
    };

    (function checkPendingUndo() {
        let raw;
        try { raw = sessionStorage.getItem('sahabBudget_pendingUndo'); } catch (e) { return; }
        if (!raw) return;
        try { sessionStorage.removeItem('sahabBudget_pendingUndo'); } catch (e) { /* ignore */ }
        let data;
        try { data = JSON.parse(raw); } catch (e) { return; }
        const show = () => window.showUndo(data.message, () => window.restoreActiveData(data.snapshot), { reloadOnUndo: true, ms: 9000 });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
        else show();
    })();

    // Show an undo snackbar. onUndo runs if the user clicks Undo within `ms`.
    // options: { ms=6000, reloadOnUndo=true }
    window.showUndo = function (message, onUndo, options) {
        const opts = options || {};
        const ms = opts.ms || 6000;
        removeExisting();

        const bar = document.createElement('div');
        bar.id = 'undoSnackbar';
        bar.className = 'undo-snackbar';
        bar.setAttribute('role', 'status');

        const text = document.createElement('span');
        text.className = 'undo-snackbar-text';
        text.textContent = message;
        bar.appendChild(text);

        const btn = document.createElement('button');
        btn.className = 'undo-snackbar-btn';
        btn.type = 'button';
        btn.textContent = 'Undo';
        btn.addEventListener('click', () => {
            removeExisting();
            try { if (typeof onUndo === 'function') onUndo(); } catch (e) { /* ignore */ }
            if (opts.reloadOnUndo !== false) window.location.reload();
        });
        bar.appendChild(btn);

        const close = document.createElement('button');
        close.className = 'undo-snackbar-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Dismiss');
        close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        close.addEventListener('click', removeExisting);
        bar.appendChild(close);

        document.body.appendChild(bar);
        requestAnimationFrame(() => bar.classList.add('visible'));
        currentTimer = setTimeout(removeExisting, ms);
    };
})();
