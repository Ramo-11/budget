// js/lock.js - Optional app lock (PIN).
// The PIN is never stored in plaintext: we store a SHA-256 hash of (salt + PIN).
// When a PIN is set, a full-screen lock overlay is shown before the app is
// usable. Unlocking is remembered for the browser session (re-locks on a fresh
// session/tab-close). This protects the financial data on a shared device; it
// is a privacy gate, not hardened cryptographic protection.

(function () {
    const HASH_KEY = 'sahabBudget_pinHash';
    const SALT_KEY = 'sahabBudget_pinSalt';
    const SESSION_KEY = 'sahabBudget_unlocked';

    function hasPin() {
        try { return !!localStorage.getItem(HASH_KEY); } catch (e) { return false; }
    }
    window.appLockEnabled = hasPin;

    async function sha256(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    function randomSalt() {
        const a = new Uint8Array(16);
        crypto.getRandomValues(a);
        return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    async function setPin(pin) {
        const salt = randomSalt();
        const hash = await sha256(salt + pin);
        localStorage.setItem(SALT_KEY, salt);
        localStorage.setItem(HASH_KEY, hash);
        sessionStorage.setItem(SESSION_KEY, 'true');
    }

    async function verifyPin(pin) {
        const salt = localStorage.getItem(SALT_KEY) || '';
        const hash = await sha256(salt + pin);
        return hash === localStorage.getItem(HASH_KEY);
    }

    function clearPin() {
        localStorage.removeItem(HASH_KEY);
        localStorage.removeItem(SALT_KEY);
        sessionStorage.removeItem(SESSION_KEY);
    }

    function isUnlocked() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    /* ---- Lock overlay shown before the app is usable ---- */
    function showLockScreen() {
        if (document.getElementById('appLockScreen')) return;
        const overlay = document.createElement('div');
        overlay.id = 'appLockScreen';
        overlay.className = 'app-lock-screen';
        overlay.innerHTML =
            '<div class="app-lock-card">' +
            '<div class="app-lock-badge"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>' +
            '<h2>Enter your PIN</h2>' +
            '<div class="app-lock-input-wrap">' +
            '<input id="appLockInput" class="app-input" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN" />' +
            '<button type="button" class="app-lock-eye" aria-label="Show PIN"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>' +
            '</div>' +
            '<div id="appLockError" class="app-lock-error"></div>' +
            '<button id="appLockSubmit" class="btn btn-primary btn-lg" type="button">Unlock</button>' +
            '</div>';
        document.body.appendChild(overlay);
        document.documentElement.style.overflow = 'hidden';

        const input = overlay.querySelector('#appLockInput');
        const err = overlay.querySelector('#appLockError');
        const eye = overlay.querySelector('.app-lock-eye');
        eye.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
            input.focus();
        });
        async function attempt() {
            const ok = await verifyPin(input.value);
            if (ok) {
                sessionStorage.setItem(SESSION_KEY, 'true');
                document.documentElement.style.overflow = '';
                overlay.remove();
            } else {
                err.textContent = 'Incorrect PIN';
                input.value = '';
                input.focus();
                overlay.querySelector('.app-lock-card').classList.remove('shake');
                void overlay.offsetWidth;
                overlay.querySelector('.app-lock-card').classList.add('shake');
            }
        }
        overlay.querySelector('#appLockSubmit').addEventListener('click', attempt);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
        setTimeout(() => input.focus(), 60);
    }

    // Gate the app as early as possible when a PIN exists and this session
    // hasn't unlocked yet.
    function maybeLock() {
        if (hasPin() && !isUnlocked()) showLockScreen();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', maybeLock);
    } else {
        maybeLock();
    }

    /* ---- Settings modal (self-contained; opened from Settings) ---- */
    window.openAppLockSettings = function () {
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';
        const enabled = hasPin();
        overlay.innerHTML =
            '<div class="app-modal"><div class="app-modal-header">' +
            '<h2 class="app-modal-title">App lock</h2>' +
            '<button class="app-modal-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
            '</div><div class="app-modal-body" id="appLockBody"></div></div>';
        const close = () => { overlay.remove(); };
        overlay.querySelector('.app-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        const body = overlay.querySelector('#appLockBody');

        function renderEnable() {
            body.innerHTML =
                '<p class="app-hint" style="margin-bottom:14px">Require a PIN to open Sahab Budget on this device. Your PIN is stored only as a one-way hash.</p>' +
                '<div class="app-field"><label class="app-label">New PIN (4 to 12 digits)</label><input id="lkNew" class="app-input" type="password" inputmode="numeric" maxlength="12"></div>' +
                '<div class="app-field"><label class="app-label">Confirm PIN</label><input id="lkConfirm" class="app-input" type="password" inputmode="numeric" maxlength="12"></div>' +
                '<div id="lkErr" class="app-lock-error"></div>' +
                '<div class="app-modal-actions"><button class="btn btn-secondary" type="button" id="lkCancel">Cancel</button><button class="btn btn-primary" type="button" id="lkSave">Turn on lock</button></div>';
            body.querySelector('#lkCancel').addEventListener('click', close);
            body.querySelector('#lkSave').addEventListener('click', async () => {
                const a = body.querySelector('#lkNew').value;
                const b = body.querySelector('#lkConfirm').value;
                const err = body.querySelector('#lkErr');
                if (!/^\d{4,12}$/.test(a)) { err.textContent = 'PIN must be 4 to 12 digits'; return; }
                if (a !== b) { err.textContent = 'PINs do not match'; return; }
                await setPin(a);
                close();
                if (typeof showNotification === 'function') showNotification('App lock enabled', 'success');
            });
        }

        function renderDisable() {
            body.innerHTML =
                '<p class="app-hint" style="margin-bottom:14px">App lock is on. A PIN is required to open the app in a new session.</p>' +
                '<div class="app-field"><label class="app-label">Enter current PIN to turn off</label><input id="lkCur" class="app-input" type="password" inputmode="numeric" maxlength="12"></div>' +
                '<div id="lkErr" class="app-lock-error"></div>' +
                '<div class="app-modal-actions"><button class="btn btn-secondary" type="button" id="lkCancel">Cancel</button><button class="btn btn-danger" type="button" id="lkOff">Turn off lock</button></div>';
            body.querySelector('#lkCancel').addEventListener('click', close);
            body.querySelector('#lkOff').addEventListener('click', async () => {
                const cur = body.querySelector('#lkCur').value;
                const err = body.querySelector('#lkErr');
                if (!(await verifyPin(cur))) { err.textContent = 'Incorrect PIN'; return; }
                clearPin();
                close();
                if (typeof showNotification === 'function') showNotification('App lock disabled', 'info');
            });
        }

        if (enabled) renderDisable(); else renderEnable();
        document.body.appendChild(overlay);
    };
})();
