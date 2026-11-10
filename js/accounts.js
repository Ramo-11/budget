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
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { void e; }
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
                try { localStorage.setItem(dataKeyFor(id), legacy); } catch (e) { void e; }
            }
            active = id;
            try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) { void e; }
            return id;
        }
        if (!active || !accounts.some((a) => a.id === active)) {
            active = accounts[0].id;
            try { localStorage.setItem(ACTIVE_KEY, active); } catch (e) { void e; }
        }
        return active;
    }

    function getActiveAccountId() { return ensureInit(); }
    function getActiveDataKey() { return dataKeyFor(ensureInit()); }
    function getAccountById(id) { return getAccounts().find((a) => a.id === id) || null; }

    function setActiveAccount(id) {
        if (!getAccounts().some((a) => a.id === id)) return;
        try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) { void e; }
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
        try { localStorage.removeItem(dataKeyFor(id)); } catch (e) { void e; }
        if (localStorage.getItem(ACTIVE_KEY) === id) {
            try { localStorage.setItem(ACTIVE_KEY, accounts[0].id); } catch (e) { void e; }
        }
        return true;
    }
    const SAMPLE_ID = 'acct__sample';
    const PRE_SAMPLE_KEY = 'sahabBudget_preSampleAccount';

    function beginSampleMode(payload) {
        let accounts = getAccounts();
        if (localStorage.getItem('sahabBudget_sampleMode') !== 'true') {
            const cur = localStorage.getItem(ACTIVE_KEY);
            if (cur && cur !== SAMPLE_ID) {
                try { localStorage.setItem(PRE_SAMPLE_KEY, cur); } catch (e) { void e; }
            }
        }
        if (!accounts.some((a) => a.id === SAMPLE_ID)) {
            accounts.push({ id: SAMPLE_ID, name: 'Sample Data', colorIndex: 14, createdAt: new Date().toISOString(), sample: true });
            saveAccounts(accounts);
        }
        writeJSON(dataKeyFor(SAMPLE_ID), payload || {});
        try { localStorage.setItem(ACTIVE_KEY, SAMPLE_ID); } catch (e) { void e; }
        try { localStorage.setItem('sahabBudget_sampleMode', 'true'); } catch (e) { void e; }
    }

    function endSampleMode() {
        const accounts = getAccounts().filter((a) => a.id !== SAMPLE_ID);
        saveAccounts(accounts);
        try { localStorage.removeItem(dataKeyFor(SAMPLE_ID)); } catch (e) { void e; }
        try { localStorage.removeItem('sahabBudget_sampleMode'); } catch (e) { void e; }
        const prev = localStorage.getItem(PRE_SAMPLE_KEY);
        try { localStorage.removeItem(PRE_SAMPLE_KEY); } catch (e) { void e; }
        const target = (prev && accounts.some((a) => a.id === prev)) ? prev
            : (accounts[0] ? accounts[0].id : null);
        if (target) { try { localStorage.setItem(ACTIVE_KEY, target); } catch (e) { void e; } }
        else { ensureInit(); }
    }
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
    ensureInit();

    const PENDING_UNDO_KEY = 'sahabBudget_pendingAccountUndo';

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

    function notify(message, options) {
        if (window.UI) window.UI.toast(message, options);
    }

    function userAccounts() {
        return getAccounts().filter((a) => !a.sample);
    }

    function openCreateAccount() {
        const accounts = userAccounts();
        const form = el('form', 'stack');
        form.noValidate = true;

        const nameField = el('div', 'field');
        const nameLabel = el('label', null, 'Account name');
        nameLabel.htmlFor = 'newAccountName';
        const nameInput = el('input', 'input');
        nameInput.id = 'newAccountName';
        nameInput.type = 'text';
        nameInput.maxLength = 40;
        nameInput.placeholder = 'For example, Joint checking';
        nameInput.autocomplete = 'off';
        const nameError = el('div', 'field-error');
        nameError.setAttribute('role', 'alert');
        nameField.append(nameLabel, nameInput, nameError);
        form.appendChild(nameField);

        let copySelect = null;
        const checks = {};
        if (accounts.length) {
            const copyField = el('div', 'field');
            const copyLabel = el('label', null, 'Copy setup from');
            copyLabel.htmlFor = 'newAccountCopy';
            copySelect = el('select', 'select');
            copySelect.id = 'newAccountCopy';
            const none = el('option', null, 'Start fresh');
            none.value = '';
            copySelect.appendChild(none);
            accounts.forEach((a) => {
                const opt = el('option', null, a.name);
                opt.value = a.id;
                copySelect.appendChild(opt);
            });
            copyField.append(copyLabel, copySelect, el('div', 'field-hint', 'Transactions are never copied. Each account keeps its own.'));
            form.appendChild(copyField);

            const group = el('div', 'account-form-copy');
            group.hidden = true;
            [['cats', 'Categories', true], ['rules', 'Auto-sort rules', true], ['budgets', 'Budgets', false]].forEach(([key, text, def]) => {
                const l = el('label', 'check');
                const c = document.createElement('input');
                c.type = 'checkbox';
                c.checked = def;
                checks[key] = c;
                l.append(c, el('span', null, text));
                group.appendChild(l);
            });
            form.appendChild(group);
            copySelect.addEventListener('change', () => { group.hidden = !copySelect.value; });
        }

        function submit(ctx) {
            const name = nameInput.value.trim();
            if (!name) {
                nameError.textContent = 'Give the account a name.';
                nameInput.setAttribute('aria-invalid', 'true');
                nameInput.focus();
                return false;
            }
            const opts = {};
            if (copySelect && copySelect.value) {
                opts.copyFrom = copySelect.value;
                opts.copyCategories = checks.cats.checked;
                opts.copyRules = checks.rules.checked;
                opts.copyBudgets = checks.budgets.checked;
            }
            const id = createAccount(name, opts);
            setActiveAccount(id);
            ctx.setBusy(true);
            window.location.reload();
            return false;
        }

        nameInput.addEventListener('input', () => {
            nameError.textContent = '';
            nameInput.removeAttribute('aria-invalid');
        });

        const ctx = window.UI.sheet({
            title: 'New account',
            subtitle: 'Each account keeps its own transactions, budgets and rules.',
            body: form,
            size: 'sm',
            initialFocus: '#newAccountName',
            actions: [
                { label: 'Cancel', variant: 'secondary' },
                { label: 'Create account', variant: 'primary', closes: false, onClick: submit },
            ],
        });
        form.addEventListener('submit', (e) => { e.preventDefault(); submit(ctx); });
    }

    function stashUndo(entry, index, raw, wasActive) {
        try {
            sessionStorage.setItem(PENDING_UNDO_KEY, JSON.stringify({ entry, index, raw, wasActive }));
        } catch (e) { void e; }
    }

    function restoreAccount(entry, index, raw, wasActive) {
        const list = getAccounts().filter((a) => a.id !== entry.id);
        list.splice(Math.min(Math.max(index, 0), list.length), 0, entry);
        saveAccounts(list);
        if (raw != null) { try { localStorage.setItem(dataKeyFor(entry.id), raw); } catch (e) { void e; } }
        if (wasActive) setActiveAccount(entry.id);
    }

    async function removeAccountFlow(acc, ctx, rerender) {
        const typed = await window.UI.prompt({
            title: 'Delete "' + acc.name + '"?',
            label: 'This removes all of its transactions, budgets and rules. Type the account name to confirm.',
            placeholder: acc.name,
            confirmLabel: 'Delete account',
            validate: (v) => (v.trim().toLowerCase() === acc.name.trim().toLowerCase() ? null : 'The name does not match.'),
        });
        if (typed == null) return;
        const all = getAccounts();
        const index = all.findIndex((a) => a.id === acc.id);
        const raw = localStorage.getItem(dataKeyFor(acc.id));
        const wasActive = acc.id === getActiveAccountId();
        if (!deleteAccount(acc.id)) {
            notify('You need to keep at least one account.', { type: 'error' });
            return;
        }
        if (wasActive) {
            stashUndo(acc, index, raw, true);
            window.location.reload();
            return;
        }
        rerender();
        notify('Deleted ' + acc.name, {
            type: 'info',
            action: {
                label: 'Undo',
                onClick: () => {
                    restoreAccount(acc, index, raw, false);
                    rerender();
                    notify('Restored ' + acc.name);
                },
            },
        });
    }

    function openManageAccounts() {
        const body = el('div', 'stack');
        let ctx = null;

        function render() {
            body.innerHTML = '';
            const activeId = getActiveAccountId();
            const accounts = userAccounts();
            const list = el('div', 'list');
            accounts.forEach((acc) => {
                const row = el('div', 'list-row list-row-plain');
                const main = el('div', 'account-row-main');
                main.appendChild(dot(acc.colorIndex));
                main.appendChild(el('span', 'account-row-name', acc.name));
                if (acc.id === activeId) main.appendChild(el('span', 'badge badge-brand', 'Active'));
                row.appendChild(main);

                const actions = el('div', 'account-row-actions');
                if (acc.id !== activeId) {
                    const sw = el('button', 'btn btn-ghost btn-sm', 'Switch');
                    sw.type = 'button';
                    sw.addEventListener('click', () => { setActiveAccount(acc.id); window.location.reload(); });
                    actions.appendChild(sw);
                }
                const rn = el('button', 'btn btn-ghost btn-sm', 'Rename');
                rn.type = 'button';
                rn.setAttribute('aria-label', 'Rename ' + acc.name);
                rn.addEventListener('click', async () => {
                    const v = await window.UI.prompt({
                        title: 'Rename account',
                        label: 'Account name',
                        value: acc.name,
                        confirmLabel: 'Save',
                        validate: (x) => (x.trim() ? null : 'Give the account a name.'),
                    });
                    if (v == null) return;
                    renameAccount(acc.id, v);
                    render();
                    if (window.Shell) window.Shell.refresh();
                });
                actions.appendChild(rn);
                const del = el('button', 'btn btn-ghost btn-sm', 'Delete');
                del.type = 'button';
                del.setAttribute('aria-label', 'Delete ' + acc.name);
                if (accounts.length <= 1) {
                    del.disabled = true;
                    del.title = 'Keep at least one account';
                }
                del.addEventListener('click', () => removeAccountFlow(acc, ctx, () => { render(); if (window.Shell) window.Shell.refresh(); }));
                actions.appendChild(del);
                row.appendChild(actions);
                list.appendChild(row);
            });
            body.appendChild(list);
        }
        render();

        ctx = window.UI.sheet({
            title: 'Accounts',
            subtitle: 'Switch, rename or delete your budgets.',
            body,
            actions: [
                { label: 'New account', variant: 'secondary', onClick: () => { setTimeout(openCreateAccount, 200); } },
                { label: 'Done', variant: 'primary' },
            ],
        });
    }

    window.openCreateAccount = openCreateAccount;
    window.openManageAccounts = openManageAccounts;

    (function checkPendingAccountUndo() {
        let raw = null;
        try { raw = sessionStorage.getItem(PENDING_UNDO_KEY); } catch (e) { return; }
        if (!raw) return;
        try { sessionStorage.removeItem(PENDING_UNDO_KEY); } catch (e) { void e; }
        let data;
        try { data = JSON.parse(raw); } catch (e) { return; }
        if (!data || !data.entry) return;
        window.addEventListener('load', () => {
            notify('Deleted ' + data.entry.name, {
                type: 'info',
                ms: 9000,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        restoreAccount(data.entry, data.index, data.raw, data.wasActive);
                        window.location.reload();
                    },
                },
            });
        });
    })();
})();
