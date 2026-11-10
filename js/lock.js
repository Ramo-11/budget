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
        window.dispatchEvent(new CustomEvent('app-lock-changed'));
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
        window.dispatchEvent(new CustomEvent('app-lock-changed'));
    }

    function isUnlocked() {
        try { return sessionStorage.getItem(SESSION_KEY) === 'true'; } catch (e) { return false; }
    }

    function icon(name, size) {
        return typeof window.getIcon === 'function' ? window.getIcon(name, size) : '';
    }

    function setBackgroundInert(on) {
        ['appShell', 'main'].forEach((id) => {
            const n = document.getElementById(id);
            if (!n) return;
            if (on) { n.setAttribute('inert', ''); n.setAttribute('aria-hidden', 'true'); }
            else { n.removeAttribute('inert'); n.removeAttribute('aria-hidden'); }
        });
    }

    function showLockScreen() {
        if (document.getElementById('appLockScreen')) return;
        const overlay = document.createElement('div');
        overlay.id = 'appLockScreen';
        overlay.className = 'app-lock-screen';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'appLockTitle');
        overlay.innerHTML =
            '<form class="app-lock-card" id="appLockForm" novalidate>' +
            '<div class="app-lock-badge">' + icon('lock', 28) + '</div>' +
            '<h1 id="appLockTitle">Enter your PIN</h1>' +
            '<p>Sahab Budget is locked on this device.</p>' +
            '<div class="app-lock-form">' +
            '<div class="app-lock-input-wrap">' +
            '<input id="appLockInput" class="input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="12" aria-label="PIN" aria-describedby="appLockError" />' +
            '<button type="button" class="btn btn-ghost btn-icon btn-sm app-lock-eye" aria-label="Show PIN" aria-pressed="false">' + icon('eye', 18) + '</button>' +
            '</div>' +
            '<div id="appLockError" class="app-lock-error" role="alert"></div>' +
            '<button id="appLockSubmit" class="btn btn-primary btn-lg btn-block" type="submit">Unlock</button>' +
            '</div></form>';
        document.body.appendChild(overlay);
        document.documentElement.style.overflow = 'hidden';
        setBackgroundInert(true);

        const card = overlay.querySelector('.app-lock-card');
        const input = overlay.querySelector('#appLockInput');
        const err = overlay.querySelector('#appLockError');
        const eye = overlay.querySelector('.app-lock-eye');
        eye.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            eye.setAttribute('aria-label', show ? 'Hide PIN' : 'Show PIN');
            eye.setAttribute('aria-pressed', show ? 'true' : 'false');
            eye.innerHTML = icon(show ? 'eye-off' : 'eye', 18);
            input.focus();
        });
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '');
            err.textContent = '';
            input.removeAttribute('aria-invalid');
        });
        card.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!input.value) {
                err.textContent = 'Enter your PIN to continue.';
                input.focus();
                return;
            }
            let ok = false;
            try { ok = await verifyPin(input.value); } catch (x) { ok = false; }
            if (ok) {
                sessionStorage.setItem(SESSION_KEY, 'true');
                document.documentElement.style.overflow = '';
                setBackgroundInert(false);
                overlay.remove();
                window.dispatchEvent(new CustomEvent('budget:unlocked'));
            } else {
                err.textContent = 'That PIN is not right. Try again.';
                input.setAttribute('aria-invalid', 'true');
                input.value = '';
                input.focus();
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
            }
        });
        setTimeout(() => input.focus(), 60);
    }

    function maybeLock() {
        if (hasPin() && !isUnlocked()) showLockScreen();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeLock);
    else maybeLock();

    window.openAppLockSettings = function () {
        if (!window.UI) return;
        const enabled = hasPin();
        const body = document.createElement('form');
        body.className = 'stack';
        body.noValidate = true;

        function field(id, label, hint) {
            const f = document.createElement('div');
            f.className = 'field';
            const l = document.createElement('label');
            l.htmlFor = id;
            l.textContent = label;
            const i = document.createElement('input');
            i.id = id;
            i.className = 'input';
            i.type = 'password';
            i.inputMode = 'numeric';
            i.maxLength = 12;
            i.autocomplete = 'off';
            f.append(l, i);
            if (hint) {
                const h = document.createElement('div');
                h.className = 'field-hint';
                h.textContent = hint;
                f.appendChild(h);
            }
            body.appendChild(f);
            return i;
        }

        const intro = document.createElement('p');
        intro.className = 'muted text-sm';
        intro.textContent = enabled
            ? 'App lock is on. A PIN is needed to open the app in a new session.'
            : 'Ask for a PIN when you open Sahab Budget on this device. The PIN is stored only as a one way hash.';
        body.appendChild(intro);

        let first;
        let second = null;
        if (enabled) first = field('lkCur', 'Current PIN', 'Enter it to turn the lock off.');
        else {
            first = field('lkNew', 'New PIN', '4 to 12 digits.');
            second = field('lkConfirm', 'Confirm PIN');
        }
        const err = document.createElement('div');
        err.className = 'field-error';
        err.setAttribute('role', 'alert');
        body.appendChild(err);

        async function submit(ctx) {
            err.textContent = '';
            if (enabled) {
                if (!(await verifyPin(first.value))) { err.textContent = 'That PIN is not right.'; first.focus(); return false; }
                clearPin();
                window.UI.toast('App lock turned off', { type: 'info' });
                return true;
            }
            if (!/^\d{4,12}$/.test(first.value)) { err.textContent = 'Use 4 to 12 digits.'; first.focus(); return false; }
            if (first.value !== second.value) { err.textContent = 'The two PINs do not match.'; second.focus(); return false; }
            await setPin(first.value);
            window.UI.toast('App lock turned on');
            return true;
        }

        window.UI.sheet({
            title: 'App lock',
            body,
            size: 'sm',
            initialFocus: enabled ? '#lkCur' : '#lkNew',
            onClose: () => { window.dispatchEvent(new CustomEvent('budget:lockchanged')); },
            actions: [
                { label: 'Cancel', variant: 'secondary' },
                { label: enabled ? 'Turn off lock' : 'Turn on lock', variant: enabled ? 'danger-solid' : 'primary', onClick: submit },
            ],
        });
        body.addEventListener('submit', (e) => e.preventDefault());
    };
})();
