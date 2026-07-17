// js/accounts.js - Multiple fully-separate budget accounts (workspaces).
// Each account has its own transactions, categories, rules, budgets and
// income settings, stored under sahabBudget_data__<accountId>. Legacy single
// blob (sahabBudget_data) is migrated into the first account on first run.
// Must load BEFORE core.js/rules.js/analytics.js/settings.js.

(function () {
    const ACCOUNTS_KEY = 'sahabBudget_accounts';
    const ACTIVE_KEY = 'sahabBudget_activeAccount';
    const DATA_PREFIX = 'sahabBudget_data__';
    const LEGACY_KEY = 'sahabBudget_data';

    function readJSON(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch (e) { return fallback; }
    }
    function writeJSON(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ }
    }
    function genId() {
        return 'acct_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
    }

    function getAccounts() { return readJSON(ACCOUNTS_KEY, []); }
    function saveAccounts(list) { writeJSON(ACCOUNTS_KEY, list); }
    function dataKeyFor(id) { return DATA_PREFIX + id; }

    function ensureInit() {
        let accounts = getAccounts();
        let active = localStorage.getItem(ACTIVE_KEY);
        if (!accounts.length) {
            const id = genId();
            accounts = [{ id, name: 'My Budget', colorIndex: 1, createdAt: new Date().toISOString() }];
            saveAccounts(accounts);
            const legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy != null) {
                try { localStorage.setItem(dataKeyFor(id), legacy); } catch (e) { /* quota */ }
            }
            active = id;
            try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) { /* ignore */ }
            return id;
        }
        if (!active || !accounts.some((a) => a.id === active)) {
            active = accounts[0].id;
            try { localStorage.setItem(ACTIVE_KEY, active); } catch (e) { /* ignore */ }
        }
        return active;
    }

    function getActiveAccountId() { return ensureInit(); }
    function getActiveDataKey() { return dataKeyFor(ensureInit()); }
    function getAccountById(id) { return getAccounts().find((a) => a.id === id) || null; }

    function setActiveAccount(id) {
        if (!getAccounts().some((a) => a.id === id)) return;
        try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) { /* ignore */ }
    }

    function createAccount(name, opts) {
        opts = opts || {};
        const accounts = getAccounts();
        const id = genId();
        const colorIndex = (accounts.length % 16) + 1;
        accounts.push({
            id,
            name: (name || 'New Account').trim().slice(0, 40) || 'New Account',
            colorIndex,
            createdAt: new Date().toISOString(),
        });
        saveAccounts(accounts);

        const seed = {};
        if (opts.copyFrom) {
            const src = readJSON(dataKeyFor(opts.copyFrom), {});
            if (opts.copyCategories && src.categoryConfig) seed.categoryConfig = src.categoryConfig;
            if (opts.copyRules && Array.isArray(src.unifiedRules)) seed.unifiedRules = src.unifiedRules;
            if (opts.copyBudgets && src.budgets) seed.budgets = src.budgets;
            if (src.incomeSettings) seed.incomeSettings = src.incomeSettings;
        }
        writeJSON(dataKeyFor(id), seed);
        return id;
    }

    function renameAccount(id, name) {
        const accounts = getAccounts();
        const target = accounts.find((a) => a.id === id);
        if (target) {
            const clean = (name || '').trim().slice(0, 40);
            if (clean) { target.name = clean; saveAccounts(accounts); }
        }
    }

    function deleteAccount(id) {
        let accounts = getAccounts();
        if (accounts.length <= 1) return false;
        accounts = accounts.filter((a) => a.id !== id);
        saveAccounts(accounts);
        try { localStorage.removeItem(dataKeyFor(id)); } catch (e) { /* ignore */ }
        if (localStorage.getItem(ACTIVE_KEY) === id) {
            try { localStorage.setItem(ACTIVE_KEY, accounts[0].id); } catch (e) { /* ignore */ }
        }
        return true;
    }

    /* ---- Sample mode uses a dedicated throwaway account so real accounts are
       never touched (fixes the old data-loss bug). ---- */
    const SAMPLE_ID = 'acct__sample';
    const PRE_SAMPLE_KEY = 'sahabBudget_preSampleAccount';

    function beginSampleMode(payload) {
        let accounts = getAccounts();
        if (localStorage.getItem('sahabBudget_sampleMode') !== 'true') {
            const cur = localStorage.getItem(ACTIVE_KEY);
            if (cur && cur !== SAMPLE_ID) {
                try { localStorage.setItem(PRE_SAMPLE_KEY, cur); } catch (e) { /* ignore */ }
            }
        }
        if (!accounts.some((a) => a.id === SAMPLE_ID)) {
            accounts.push({ id: SAMPLE_ID, name: 'Sample Data', colorIndex: 14, createdAt: new Date().toISOString(), sample: true });
            saveAccounts(accounts);
        }
        writeJSON(dataKeyFor(SAMPLE_ID), payload || {});
        try { localStorage.setItem(ACTIVE_KEY, SAMPLE_ID); } catch (e) { /* ignore */ }
        try { localStorage.setItem('sahabBudget_sampleMode', 'true'); } catch (e) { /* ignore */ }
    }

    function endSampleMode() {
        const accounts = getAccounts().filter((a) => a.id !== SAMPLE_ID);
        saveAccounts(accounts);
        try { localStorage.removeItem(dataKeyFor(SAMPLE_ID)); } catch (e) { /* ignore */ }
        try { localStorage.removeItem('sahabBudget_sampleMode'); } catch (e) { /* ignore */ }
        const prev = localStorage.getItem(PRE_SAMPLE_KEY);
        try { localStorage.removeItem(PRE_SAMPLE_KEY); } catch (e) { /* ignore */ }
        const target = (prev && accounts.some((a) => a.id === prev)) ? prev
            : (accounts[0] ? accounts[0].id : null);
        if (target) { try { localStorage.setItem(ACTIVE_KEY, target); } catch (e) { /* ignore */ } }
        else { ensureInit(); }
    }

    // Public API
    window.getAccounts = getAccounts;
    window.getActiveAccountId = getActiveAccountId;
    window.getActiveDataKey = getActiveDataKey;
    window.getAccountById = getAccountById;
    window.setActiveAccount = setActiveAccount;
    window.createAccount = createAccount;
    window.renameAccount = renameAccount;
    window.deleteAccount = deleteAccount;
    window.beginSampleMode = beginSampleMode;
    window.endSampleMode = endSampleMode;
    window.isSampleAccount = function (id) { return (id || getActiveAccountId()) === SAMPLE_ID; };

    // Initialize immediately so getActiveDataKey() is valid before core.js loads.
    ensureInit();

    /* ============================ Switcher UI ============================ */

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function dot(colorIndex) {
        const d = el('span', 'cat-dot');
        d.style.setProperty('--cat', 'var(--cat-' + (colorIndex || 1) + ')');
        return d;
    }

    function switchTo(id) {
        if (id === getActiveAccountId()) { closeMenu(); return; }
        setActiveAccount(id);
        window.location.reload();
    }

    let menuOpen = false;
    function closeMenu() {
        const menu = document.getElementById('accountMenu');
        if (menu) menu.classList.remove('open');
        const sw = document.getElementById('accountSwitcher');
        if (sw) sw.setAttribute('aria-expanded', 'false');
        menuOpen = false;
    }
    function openMenu() {
        buildMenu();
        const menu = document.getElementById('accountMenu');
        if (menu) menu.classList.add('open');
        const sw = document.getElementById('accountSwitcher');
        if (sw) sw.setAttribute('aria-expanded', 'true');
        menuOpen = true;
    }

    function buildMenu() {
        const menu = document.getElementById('accountMenu');
        if (!menu) return;
        menu.innerHTML = '';
        const activeId = getActiveAccountId();
        const list = el('div', 'account-menu-list');
        getAccounts().forEach((acc) => {
            const item = el('button', 'account-menu-item' + (acc.id === activeId ? ' active' : ''));
            item.type = 'button';
            item.appendChild(dot(acc.colorIndex));
            item.appendChild(el('span', 'account-menu-name', acc.name));
            if (acc.id === activeId) {
                const chk = document.createElement('span');
                chk.className = 'account-menu-check';
                chk.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                item.appendChild(chk);
            }
            item.addEventListener('click', () => switchTo(acc.id));
            list.appendChild(item);
        });
        menu.appendChild(list);

        const footer = el('div', 'account-menu-footer');
        const addBtn = el('button', 'account-menu-action');
        addBtn.type = 'button';
        addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>New account</span>';
        addBtn.addEventListener('click', () => { closeMenu(); openCreateModal(); });
        footer.appendChild(addBtn);

        const manageBtn = el('button', 'account-menu-action');
        manageBtn.type = 'button';
        manageBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg><span>Manage accounts</span>';
        manageBtn.addEventListener('click', () => { closeMenu(); openManageModal(); });
        footer.appendChild(manageBtn);

        menu.appendChild(footer);
    }

    function injectSwitcher() {
        const brand = document.querySelector('.header-brand');
        if (!brand || document.getElementById('accountSwitcher')) return;

        const wrap = el('div', 'account-switcher-wrap');

        const btn = el('button', 'account-switcher');
        btn.id = 'accountSwitcher';
        btn.type = 'button';
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');

        const active = getAccountById(getActiveAccountId());
        btn.appendChild(dot(active ? active.colorIndex : 1));
        btn.appendChild(el('span', 'account-switcher-name', active ? active.name : 'My Budget'));
        const caret = document.createElement('span');
        caret.className = 'account-switcher-caret';
        caret.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        btn.appendChild(caret);
        btn.addEventListener('click', (e) => { e.stopPropagation(); menuOpen ? closeMenu() : openMenu(); });

        const menu = el('div', 'account-menu');
        menu.id = 'accountMenu';
        menu.addEventListener('click', (e) => e.stopPropagation());

        wrap.appendChild(btn);
        wrap.appendChild(menu);
        brand.appendChild(wrap);

        document.addEventListener('click', () => { if (menuOpen) closeMenu(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });
    }

    /* ---- Lightweight modal helper (self-contained, themed) ---- */
    function buildModal(title) {
        const overlay = el('div', 'app-modal-overlay');
        const modal = el('div', 'app-modal');
        const header = el('div', 'app-modal-header');
        header.appendChild(el('h2', 'app-modal-title', title));
        const close = el('button', 'app-modal-close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        header.appendChild(close);
        modal.appendChild(header);
        const body = el('div', 'app-modal-body');
        modal.appendChild(body);
        overlay.appendChild(modal);

        function destroy() { overlay.remove(); }
        close.addEventListener('click', destroy);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) destroy(); });
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { destroy(); document.removeEventListener('keydown', onKey); }
        });
        return { overlay, body, destroy };
    }

    function openCreateModal() {
        const accounts = getAccounts();
        const { overlay, body, destroy } = buildModal('New account');

        const field = el('div', 'app-field');
        field.appendChild(el('label', 'app-label', 'Account name'));
        const input = document.createElement('input');
        input.className = 'app-input';
        input.type = 'text';
        input.placeholder = 'e.g. Chase Credit Card';
        input.maxLength = 40;
        field.appendChild(input);
        body.appendChild(field);

        let copyControls = null;
        if (accounts.length) {
            const copyWrap = el('div', 'app-field');
            const copyToggleLabel = el('label', 'app-check');
            const copyToggle = document.createElement('input');
            copyToggle.type = 'checkbox';
            copyToggleLabel.appendChild(copyToggle);
            copyToggleLabel.appendChild(el('span', null, 'Copy setup from an existing account'));
            copyWrap.appendChild(copyToggleLabel);

            const details = el('div', 'app-copy-details');
            details.style.display = 'none';

            const srcField = el('div', 'app-field');
            srcField.appendChild(el('label', 'app-label', 'Copy from'));
            const select = document.createElement('select');
            select.className = 'app-input';
            accounts.forEach((a) => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.name;
                select.appendChild(opt);
            });
            select.value = getActiveAccountId();
            srcField.appendChild(select);
            details.appendChild(srcField);

            const opts = [
                ['cats', 'Categories', true],
                ['rules', 'Auto-categorization rules', true],
                ['budgets', 'Budgets', false],
            ];
            const checks = {};
            opts.forEach(([key, label, def]) => {
                const l = el('label', 'app-check');
                const c = document.createElement('input');
                c.type = 'checkbox';
                c.checked = def;
                checks[key] = c;
                l.appendChild(c);
                l.appendChild(el('span', null, label));
                details.appendChild(l);
            });
            details.appendChild(el('p', 'app-hint', 'Transactions are never copied. Each account keeps its own transactions.'));

            copyToggle.addEventListener('change', () => {
                details.style.display = copyToggle.checked ? 'block' : 'none';
            });
            copyWrap.appendChild(details);
            body.appendChild(copyWrap);
            copyControls = { copyToggle, select, checks };
        }

        const actions = el('div', 'app-modal-actions');
        const cancel = el('button', 'btn btn-secondary', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', destroy);
        const create = el('button', 'btn btn-primary', 'Create account');
        create.type = 'button';
        create.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) { input.focus(); input.classList.add('app-input-error'); return; }
            const opts = {};
            if (copyControls && copyControls.copyToggle.checked) {
                opts.copyFrom = copyControls.select.value;
                opts.copyCategories = copyControls.checks.cats.checked;
                opts.copyRules = copyControls.checks.rules.checked;
                opts.copyBudgets = copyControls.checks.budgets.checked;
            }
            const id = createAccount(name, opts);
            setActiveAccount(id);
            window.location.reload();
        });
        actions.appendChild(cancel);
        actions.appendChild(create);
        body.appendChild(actions);

        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 50);
    }

    function openManageModal() {
        const { overlay, body, destroy } = buildModal('Manage accounts');
        const activeId = getActiveAccountId();

        function render() {
            body.innerHTML = '';
            const list = el('div', 'app-account-list');
            const accounts = getAccounts();
            accounts.forEach((acc) => {
                const row = el('div', 'app-account-row');
                row.appendChild(dot(acc.colorIndex));
                const nameInput = document.createElement('input');
                nameInput.className = 'app-input app-account-name';
                nameInput.value = acc.name;
                nameInput.maxLength = 40;
                nameInput.addEventListener('change', () => {
                    renameAccount(acc.id, nameInput.value);
                    const sw = document.querySelector('#accountSwitcher .account-switcher-name');
                    if (acc.id === activeId && sw) sw.textContent = nameInput.value.trim().slice(0, 40) || acc.name;
                });
                row.appendChild(nameInput);

                if (acc.id === activeId) {
                    row.appendChild(el('span', 'app-account-badge', 'Active'));
                }

                const del = el('button', 'app-icon-btn danger');
                del.type = 'button';
                del.setAttribute('aria-label', 'Delete account');
                del.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
                if (accounts.length <= 1) {
                    del.disabled = true;
                    del.title = 'You must keep at least one account';
                }
                del.addEventListener('click', () => {
                    const confirmRow = row.querySelector('.app-confirm');
                    if (confirmRow) return;
                    const c = el('div', 'app-confirm');
                    c.appendChild(el('span', null, 'Delete "' + acc.name + '" and all its data?'));
                    const yes = el('button', 'btn btn-danger btn-sm', 'Delete');
                    yes.type = 'button';
                    yes.addEventListener('click', () => {
                        const wasActive = acc.id === activeId;
                        deleteAccount(acc.id);
                        if (wasActive) { window.location.reload(); return; }
                        render();
                    });
                    const no = el('button', 'btn btn-secondary btn-sm', 'Cancel');
                    no.type = 'button';
                    no.addEventListener('click', () => c.remove());
                    c.appendChild(yes);
                    c.appendChild(no);
                    row.appendChild(c);
                });
                row.appendChild(del);
                list.appendChild(row);
            });
            body.appendChild(list);

            const actions = el('div', 'app-modal-actions');
            const addBtn = el('button', 'btn btn-secondary', 'New account');
            addBtn.type = 'button';
            addBtn.addEventListener('click', () => { destroy(); openCreateModal(); });
            const done = el('button', 'btn btn-primary', 'Done');
            done.type = 'button';
            done.addEventListener('click', destroy);
            actions.appendChild(addBtn);
            actions.appendChild(done);
            body.appendChild(actions);
        }
        render();
        document.body.appendChild(overlay);
    }

    window.openCreateAccountModal = openCreateModal;
    window.openManageAccountsModal = openManageModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSwitcher);
    } else {
        injectSwitcher();
    }
})();
