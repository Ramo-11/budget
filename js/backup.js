(function () {
    const FORMAT = 'sahab-budget-backup';
    const PBKDF2_ITERATIONS = 600000;
    const MIN_ITERATIONS = 100000;
    const MAX_ITERATIONS = 5000000;
    const MAX_FILE_BYTES = 150 * 1024 * 1024;
    const MIN_PASSWORD = 8;

    function lastBackupKey() {
        return 'sahabBudget_lastBackupAt__' + getActiveAccountId();
    }

    function getLastBackupAt() {
        try {
            const v = Number(localStorage.getItem(lastBackupKey()));
            return Number.isFinite(v) && v > 0 ? v : null;
        } catch (e) {
            return null;
        }
    }

    function markBackupDone() {
        try {
            localStorage.setItem(lastBackupKey(), String(Date.now()));
        } catch (e) {
            void e;
        }
    }

    function describeLastBackup() {
        const at = getLastBackupAt();
        if (!at) return { text: 'No backup yet', stale: true, never: true };
        const days = Math.floor((Date.now() - at) / 86400000);
        let text;
        if (days <= 0) text = 'Last backup: today';
        else if (days === 1) text = 'Last backup: yesterday';
        else text = 'Last backup: ' + days + ' days ago';
        return { text: text, stale: days >= 30, never: false, days: days };
    }

    function bytesToBase64(bytes) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function base64ToBytes(text) {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function deriveKey(password, salt, iterations) {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptText(text, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text));
        return {
            format: FORMAT,
            version: 2,
            encrypted: true,
            kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
            cipher: 'AES-GCM-256',
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            data: bytesToBase64(new Uint8Array(cipher)),
        };
    }

    async function decryptFile(file, password) {
        const kdf = file.kdf || {};
        const iterations = Number(kdf.iterations);
        if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || !Number.isFinite(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
            throw new Error('This backup uses a protection method this app does not support.');
        }
        let salt, iv, data;
        try {
            salt = base64ToBytes(file.salt);
            iv = base64ToBytes(file.iv);
            data = base64ToBytes(file.data);
        } catch (e) {
            throw new Error('This backup file is damaged.');
        }
        if (salt.length !== 16 || iv.length !== 12 || data.length < 17) throw new Error('This backup file is damaged.');
        const key = await deriveKey(password, salt, iterations);
        let plain;
        try {
            plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
        } catch (e) {
            const err = new Error('That password is not right. Try again.');
            err.wrongPassword = true;
            throw err;
        }
        return new TextDecoder().decode(plain);
    }

    function buildBackup() {
        return {
            format: FORMAT,
            version: 2,
            encrypted: false,
            exportDate: new Date().toISOString(),
            monthlyData: Array.from(monthlyData.entries()),
            categoryConfig: categoryConfig,
            budgets: budgets,
            transactionOverrides: window.transactionOverrides || {},
            transactionIncomeOverrides: window.transactionIncomeOverrides || {},
            unifiedRules: window.unifiedRules || [],
            incomeSettings: window.incomeSettings || {},
            deletedTransactions: window.deletedTransactions || [],
            deletedFingerprints: window.deletedFingerprints || [],
            transactionNotes: window.transactionNotes || {},
            savingsGoals: window.savingsGoals || [],
            appPreferences: window.appPreferences || {},
            subscriptionPrefs: window.subscriptionPrefs || {},
        };
    }

    function accountSlug() {
        let name = 'budget';
        try {
            const a = getAccountById(getActiveAccountId());
            if (a && a.name) name = a.name;
        } catch (e) {
            void e;
        }
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'budget';
    }

    function el(tag, className, text) {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
    }

    function passwordField(label, hint) {
        const id = 'pw' + Math.random().toString(36).slice(2, 8);
        const field = el('div', 'field');
        const lab = el('label', null, label);
        lab.htmlFor = id;
        const wrap = el('div', 'backup-password');
        const input = el('input', 'input');
        input.type = 'password';
        input.id = id;
        input.autocomplete = 'off';
        input.spellcheck = false;
        const toggle = el('button', 'btn btn-ghost btn-sm', 'Show');
        toggle.type = 'button';
        toggle.setAttribute('aria-controls', id);
        toggle.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            toggle.textContent = show ? 'Hide' : 'Show';
        });
        wrap.appendChild(input);
        wrap.appendChild(toggle);
        const err = el('p', 'field-error');
        err.id = id + '-err';
        err.hidden = true;
        input.setAttribute('aria-describedby', id + '-err');
        field.appendChild(lab);
        field.appendChild(wrap);
        if (hint) field.appendChild(el('p', 'muted backup-hint', hint));
        field.appendChild(err);
        return {
            node: field,
            input: input,
            error: (text) => {
                err.textContent = text || '';
                err.hidden = !text;
                input.setAttribute('aria-invalid', text ? 'true' : 'false');
            },
        };
    }

    function toast(message, type) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { type: type || 'success' });
        else if (typeof showNotification === 'function') showNotification(message, type || 'success');
    }

    function openDownload(onDone) {
        if (typeof monthlyData === 'undefined' || (monthlyData.size === 0 && (!window.unifiedRules || !window.unifiedRules.length))) {
            toast('There is nothing to back up yet. Import a bank file first.', 'info');
            return;
        }
        const body = el('div', 'stack');
        body.appendChild(el('p', 'muted', 'Saves everything in this account to one file: transactions, categories, rules, budgets, goals, notes and settings.'));

        const row = el('label', 'backup-switch-row');
        const rowText = el('span', 'backup-switch-text');
        rowText.appendChild(el('span', 'backup-switch-title', 'Protect with a password'));
        rowText.appendChild(el('span', 'muted', 'Recommended if the file will be stored in email, cloud storage or on a shared computer.'));
        const sw = el('input', 'switch');
        sw.type = 'checkbox';
        sw.setAttribute('role', 'switch');
        row.appendChild(rowText);
        row.appendChild(sw);
        body.appendChild(row);

        const pwBox = el('div', 'stack');
        pwBox.hidden = true;
        const pw = passwordField('Password', 'At least ' + MIN_PASSWORD + ' characters. There is no way to recover a lost password.');
        const pw2 = passwordField('Repeat password');
        pwBox.appendChild(pw.node);
        pwBox.appendChild(pw2.node);
        body.appendChild(pwBox);
        sw.addEventListener('change', () => {
            pwBox.hidden = !sw.checked;
            if (sw.checked) pw.input.focus();
        });

        const ctx = UI.sheet({
            title: 'Download backup',
            body: body,
            size: 'sm',
            actions: [
                { label: 'Cancel', variant: 'ghost' },
                {
                    label: 'Download',
                    variant: 'primary',
                    closes: false,
                    onClick: async (c) => {
                        pw.error(null);
                        pw2.error(null);
                        let payload;
                        try {
                            if (sw.checked) {
                                if (pw.input.value.length < MIN_PASSWORD) {
                                    pw.error('Use at least ' + MIN_PASSWORD + ' characters.');
                                    pw.input.focus();
                                    return;
                                }
                                if (pw.input.value !== pw2.input.value) {
                                    pw2.error('The passwords do not match.');
                                    pw2.input.focus();
                                    return;
                                }
                                c.setBusy(true);
                                payload = await encryptText(JSON.stringify(buildBackup()), pw.input.value);
                            } else {
                                payload = buildBackup();
                            }
                        } catch (e) {
                            c.setBusy(false);
                            c.setError('Could not create the backup. Please try again.');
                            return;
                        }
                        const name = 'sahab-budget-' + accountSlug() + '-' + new Date().toISOString().slice(0, 10) + (sw.checked ? '-protected' : '') + '.json';
                        downloadFile(JSON.stringify(payload), name, 'application/json');
                        markBackupDone();
                        c.setBusy(false);
                        c.close();
                        toast(sw.checked ? 'Protected backup downloaded' : 'Backup downloaded');
                        if (typeof onDone === 'function') onDone();
                    },
                },
            ],
        });
        return ctx;
    }

    function askPassword(file) {
        return new Promise((resolve) => {
            const body = el('div', 'stack');
            body.appendChild(el('p', 'muted', 'This backup is protected. Enter the password you chose when you downloaded it.'));
            const pw = passwordField('Password');
            body.appendChild(pw.node);
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            const submit = async (c) => {
                pw.error(null);
                if (!pw.input.value) {
                    pw.error('Enter the password.');
                    pw.input.focus();
                    return;
                }
                c.setBusy(true);
                try {
                    const text = await decryptFile(file, pw.input.value);
                    c.setBusy(false);
                    finish(text);
                    c.close();
                } catch (e) {
                    c.setBusy(false);
                    pw.error(e.message || 'Could not open this backup.');
                    pw.input.select();
                }
            };
            const ctx = UI.sheet({
                title: 'Enter backup password',
                body: body,
                size: 'sm',
                initialFocus: 'input',
                onClose: () => finish(null),
                actions: [
                    { label: 'Cancel', variant: 'ghost' },
                    { label: 'Unlock', variant: 'primary', closes: false, onClick: submit },
                ],
            });
            pw.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submit(ctx);
                }
            });
        });
    }

    function confirmRestore(clean, info) {
        const body = el('div', 'stack');
        const when = info.exportDate && !isNaN(new Date(info.exportDate)) ? new Date(info.exportDate).toLocaleString() : 'Unknown date';
        body.appendChild(el('p', 'muted', 'Backup made ' + when));

        const stats = el('dl', 'backup-stats');
        [
            ['Months', info.months],
            ['Transactions', info.transactions],
            ['Categories', info.categories],
            ['Auto-sort rules', info.rules],
            ['Savings goals', info.goals],
        ].forEach(([label, value]) => {
            const d = el('div', 'backup-stat');
            d.appendChild(el('dt', 'muted', label));
            d.appendChild(el('dd', 'num', String(value)));
            stats.appendChild(d);
        });
        body.appendChild(stats);

        const group = el('fieldset', 'backup-choices');
        group.appendChild(el('legend', 'visually-hidden', 'How to restore'));
        const choices = [
            { value: 'replace', title: 'Replace everything', text: 'Your current data in this account is swapped for the backup.' },
            { value: 'merge', title: 'Merge with what I have', text: 'Adds what is missing and skips duplicates. Your current categories and settings win.' },
        ];
        const name = 'restoreMode' + Math.random().toString(36).slice(2, 6);
        choices.forEach((c, i) => {
            const label = el('label', 'backup-choice');
            const radio = el('input');
            radio.type = 'radio';
            radio.name = name;
            radio.value = c.value;
            radio.checked = i === 0;
            const t = el('span', 'backup-choice-text');
            t.appendChild(el('span', 'backup-switch-title', c.title));
            t.appendChild(el('span', 'muted', c.text));
            label.appendChild(radio);
            label.appendChild(t);
            group.appendChild(label);
        });
        body.appendChild(group);
        body.appendChild(el('p', 'muted', 'You can undo right after restoring.'));

        UI.sheet({
            title: 'Restore this backup?',
            body: body,
            size: 'sm',
            actions: [
                { label: 'Cancel', variant: 'ghost' },
                {
                    label: 'Restore',
                    variant: 'primary',
                    closes: false,
                    onClick: (c) => {
                        const mode = body.querySelector('input[type="radio"]:checked').value;
                        const snapshot = typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
                        try {
                            applyImportedBackup(clean, mode);
                        } catch (e) {
                            if (snapshot && typeof restoreActiveData === 'function') restoreActiveData(snapshot);
                            c.setError('Could not restore this backup. Nothing was changed.');
                            return;
                        }
                        if (snapshot && typeof showUndoAfterReload === 'function') {
                            showUndoAfterReload(mode === 'replace' ? 'Backup restored' : 'Backup merged', snapshot);
                        }
                        c.close();
                        window.location.reload();
                    },
                },
            ],
        });
    }

    function showProblem(message) {
        UI.sheet({
            title: 'Could not open this file',
            body: el('p', null, message),
            size: 'sm',
            actions: [{ label: 'OK', variant: 'primary' }],
        });
    }

    async function handleFile(file) {
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) {
            showProblem('This file is too large to be a Sahab Budget backup.');
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(await file.text());
        } catch (e) {
            showProblem('This is not a backup file. Choose a .json file made by Sahab Budget.');
            return;
        }
        if (parsed && parsed.format === FORMAT && parsed.encrypted === true) {
            const text = await askPassword(parsed);
            if (text == null) return;
            try {
                parsed = JSON.parse(text);
            } catch (e) {
                showProblem('The backup opened but its content is damaged.');
                return;
            }
        }
        let clean;
        try {
            clean = sanitizeImportedBackup(parsed);
        } catch (e) {
            showProblem(e.message || 'This file is not a Sahab Budget backup.');
            return;
        }
        confirmRestore(clean, summarizeImportedBackup(clean));
    }

    function openRestore() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => handleFile(input.files && input.files[0]));
        input.click();
    }

    window.Backup = {
        openDownload: openDownload,
        openRestore: openRestore,
        describeLastBackup: describeLastBackup,
        getLastBackupAt: getLastBackupAt,
        markBackupDone: markBackupDone,
        encryptText: encryptText,
        decryptFile: decryptFile,
    };
})();
