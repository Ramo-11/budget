(function () {
    const DEFAULT_CATEGORY_CONFIG = JSON.parse(JSON.stringify(categoryConfig));
    const NEVER_RENAME = ['Others', 'Income'];
    const SECTIONS = [
        { id: 'categories', group: 'Your budget', title: 'Categories', desc: 'Groups for your spending and the words that sort it', icon: 'tag' },
        { id: 'rules', group: 'Your budget', title: 'Auto-sort rules', desc: 'Sort or remove transactions by their description', icon: 'refresh' },
        { id: 'accounts', group: 'Your budget', title: 'Accounts', desc: 'Keep separate budgets, like personal and business', icon: 'users' },
        { id: 'import', group: 'Bringing money in', title: 'Import', desc: 'Bank files, income words and saved formats', icon: 'upload' },
        { id: 'security', group: 'Safety', title: 'Privacy and security', desc: 'App lock and hiding amounts', icon: 'lock' },
        { id: 'backup', group: 'Safety', title: 'Backup and restore', desc: 'Save a copy of your data or bring one back', icon: 'shield' },
        { id: 'appearance', group: 'Preferences', title: 'Appearance', desc: 'Light or dark, currency and week start', icon: 'sun' },
        { id: 'data', group: 'Preferences', title: 'Data', desc: 'Export to a spreadsheet or start over', icon: 'file' },
        { id: 'help', group: 'Preferences', title: 'Help and about', desc: 'Guides, the welcome tour and version', icon: 'help' },
    ];
    const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'HKD', 'SGD', 'INR', 'PKR', 'BDT', 'LKR', 'MYR', 'IDR', 'PHP', 'THB', 'VND', 'KRW', 'EGP', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'ILS', 'TRY', 'MAD', 'TND', 'DZD', 'NGN', 'KES', 'ZAR', 'GHS', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'UAH'];
    const MATCH_TYPES = [
        { value: 'contains', label: 'contains', sentence: 'contains' },
        { value: 'startsWith', label: 'starts with', sentence: 'starts with' },
        { value: 'endsWith', label: 'ends with', sentence: 'ends with' },
        { value: 'exact', label: 'is exactly', sentence: 'is exactly' },
        { value: 'regex', label: 'matches a pattern (advanced)', sentence: 'matches the pattern' },
    ];
    const BANK_KEY = 'sahabBudget_bankMappings';

    let activeId = 'categories';
    let lockWatcher = null;

    function h(tag, attrs) {
        const n = document.createElement(tag);
        const a = attrs || {};
        Object.keys(a).forEach((k) => {
            const v = a[k];
            if (v == null || v === false) return;
            if (k === 'class') n.className = v;
            else if (k === 'text') n.textContent = v;
            else if (k === 'html') n.innerHTML = v;
            else if (k === 'on') Object.keys(v).forEach((ev) => n.addEventListener(ev, v[ev]));
            else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') n[k] = v;
            else n.setAttribute(k, v === true ? '' : v);
        });
        for (let i = 2; i < arguments.length; i++) append(n, arguments[i]);
        return n;
    }

    function append(parent, kid) {
        if (kid == null || kid === false) return;
        if (Array.isArray(kid)) kid.forEach((k) => append(parent, k));
        else if (typeof kid === 'string') parent.appendChild(document.createTextNode(kid));
        else parent.appendChild(kid);
    }

    function icon(name, size) {
        if (typeof UI !== 'undefined' && UI.icon) return UI.icon(name, size || 18);
        return '';
    }

    function iconNode(name, size) {
        return h('span', { class: 'settings-icon', 'aria-hidden': 'true', html: icon(name, size) });
    }

    function say(message, type) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { type: type || 'success' });
        else if (typeof showNotification === 'function') showNotification(message, type || 'success');
    }

    function plural(n, one, many) {
        return n.toLocaleString() + ' ' + (n === 1 ? one : many);
    }

    function snapshot() {
        return typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
    }

    function offerUndo(message, snap) {
        if (typeof showUndo === 'function' && snap && typeof restoreActiveData === 'function') {
            showUndo(message, () => restoreActiveData(snap));
        } else {
            say(message);
        }
    }

    function persist(reason) {
        if (typeof Store !== 'undefined') Store.persist(reason);
        else if (typeof saveData === 'function') saveData();
    }

    function errorLine(id) {
        return h('p', { class: 'field-error', id: id, hidden: true, role: 'alert' });
    }

    function setError(input, errEl, text) {
        errEl.textContent = text || '';
        errEl.hidden = !text;
        if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false');
    }

    function field(label, control, opts) {
        const o = opts || {};
        const id = control.id || 'f' + Math.random().toString(36).slice(2, 8);
        control.id = id;
        const err = errorLine(id + '-err');
        control.setAttribute('aria-describedby', (o.hint ? id + '-hint ' : '') + id + '-err');
        const node = h('div', { class: 'field' }, h('label', { for: id, text: label }), control, o.hint ? h('p', { class: 'muted settings-hint', id: id + '-hint', text: o.hint }) : null, err);
        return { node: node, control: control, error: (t) => setError(control, err, t) };
    }

    function switchRow(opts) {
        const input = h('input', { class: 'switch', type: 'checkbox', role: 'switch', checked: !!opts.checked, disabled: !!opts.disabled, 'data-key': opts.key || null });
        const text = h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: opts.title }), opts.sub ? h('span', { class: 'settings-row-sub', text: opts.sub }) : null);
        const row = h('label', { class: 'settings-row settings-row-switch' }, text, input);
        if (opts.onChange) input.addEventListener('change', () => opts.onChange(input.checked, input));
        return { node: row, input: input };
    }

    function group(title, rows, opts) {
        const o = opts || {};
        return h('div', { class: 'settings-group' }, title ? h('h3', { class: 'settings-group-title', text: title }) : null, o.intro ? h('p', { class: 'muted settings-group-intro', text: o.intro }) : null, h('div', { class: 'settings-list' }, rows), o.footer ? h('p', { class: 'muted settings-group-footer', text: o.footer }) : null);
    }

    function badge(text, cls) {
        return h('span', { class: 'badge' + (cls ? ' ' + cls : ''), text: text });
    }

    function tokenInput(opts) {
        let values = (opts.values || []).slice();
        const list = h('ul', { class: 'token-list', role: 'list' });
        const input = h('input', { class: 'token-field', type: 'text', placeholder: opts.placeholder || 'Type a word and press Enter', 'aria-label': opts.label, autocomplete: 'off', spellcheck: 'false', maxlength: '80' });
        const wrap = h('div', { class: 'token-input' }, list, input);
        const hint = h('p', { class: 'muted settings-hint token-hint', 'aria-live': 'polite' });
        const node = h('div', { class: 'token-wrap' }, wrap, hint);

        function paint() {
            list.textContent = '';
            values.forEach((v) => {
                const remove = h('button', { class: 'token-remove', type: 'button', 'aria-label': 'Remove ' + v, html: icon('x', 14) });
                remove.addEventListener('click', () => {
                    values = values.filter((x) => x !== v);
                    paint();
                    if (opts.onChange) opts.onChange(values.slice());
                    input.focus();
                });
                list.appendChild(h('li', { class: 'token' }, h('span', { text: v }), remove));
            });
            if (opts.hintFor) hint.textContent = opts.hintFor(values) || '';
        }

        function add(raw) {
            const parts = String(raw).split(',');
            let changed = false;
            parts.forEach((part) => {
                let t = part.trim().replace(/\s+/g, ' ');
                if (!t) return;
                if (opts.upper !== false) t = t.toUpperCase();
                if (t.length > 80 || values.length >= (opts.max || 200) || values.includes(t)) return;
                values.push(t);
                changed = true;
            });
            input.value = '';
            if (changed) {
                paint();
                if (opts.onChange) opts.onChange(values.slice());
            }
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add(input.value);
            } else if (e.key === 'Backspace' && !input.value && values.length) {
                values.pop();
                paint();
                if (opts.onChange) opts.onChange(values.slice());
            }
        });
        input.addEventListener('blur', () => {
            if (input.value.trim()) add(input.value);
        });
        input.addEventListener('paste', (e) => {
            const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
            if (text.includes(',') || text.includes('\n')) {
                e.preventDefault();
                add(text.replace(/\n/g, ','));
            }
        });
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap) input.focus();
        });
        paint();
        return { node: node, input: input, flush: () => add(input.value), get: () => values.slice() };
    }

    function categoryNames() {
        return Store.categories({ includeIncome: true }).map((c) => c.name);
    }

    function categoryCounts() {
        const counts = {};
        Store.allTransactions().forEach((t) => {
            counts[t.category] = (counts[t.category] || 0) + 1;
        });
        return counts;
    }

    function chipHtml(name, size) {
        return typeof UI !== 'undefined' && UI.chip ? UI.chip(name, { size: size }) : '';
    }

    function dropCategoryReferences(name, snap) {
        void snap;
        let moved = 0;
        Store.allTransactions().forEach((t) => {
            if (t.category !== name) return;
            if (!window.transactionOverrides) window.transactionOverrides = {};
            if (!window.transactionOverrides[t.monthKey]) window.transactionOverrides[t.monthKey] = {};
            window.transactionOverrides[t.monthKey][t.id] = 'Others';
            moved++;
        });
        Object.keys(window.transactionOverrides || {}).forEach((mk) => {
            const month = window.transactionOverrides[mk];
            Object.keys(month).forEach((id) => {
                if (month[id] === name) month[id] = 'Others';
            });
        });
        const before = (window.unifiedRules || []).length;
        window.unifiedRules = (window.unifiedRules || []).filter((r) => !(r.type === 'categorize' && r.action === name));
        const rulesRemoved = before - window.unifiedRules.length;
        Object.keys(budgets || {}).forEach((mk) => {
            if (budgets[mk] && name in budgets[mk]) delete budgets[mk][name];
        });
        Object.keys(window.merchantRules || {}).forEach((k) => {
            if (window.merchantRules[k] === name) delete window.merchantRules[k];
        });
        return { moved: moved, rulesRemoved: rulesRemoved };
    }

    function renameCategoryEverywhere(oldName, newName) {
        const rebuilt = {};
        Object.keys(categoryConfig).forEach((k) => {
            rebuilt[k === oldName ? newName : k] = categoryConfig[k];
        });
        categoryConfig = rebuilt;
        Object.keys(window.transactionOverrides || {}).forEach((mk) => {
            const month = window.transactionOverrides[mk];
            Object.keys(month).forEach((id) => {
                if (month[id] === oldName) month[id] = newName;
            });
        });
        (window.unifiedRules || []).forEach((r) => {
            if (r.type === 'categorize' && r.action === oldName) {
                r.action = newName;
                if (r.isAutomatic) r.name = String(r.name || '').split(oldName).join(newName);
            }
        });
        Object.keys(budgets || {}).forEach((mk) => {
            if (budgets[mk] && oldName in budgets[mk]) {
                budgets[mk][newName] = budgets[mk][oldName];
                delete budgets[mk][oldName];
            }
        });
        Object.keys(window.merchantRules || {}).forEach((k) => {
            if (window.merchantRules[k] === oldName) window.merchantRules[k] = newName;
        });
    }

    function validateCategoryName(raw, original) {
        const name = String(raw || '').trim().replace(/\s+/g, ' ');
        if (!name) return { error: 'Give the category a name.' };
        if (name.length > 40) return { error: 'Use 40 characters or fewer.' };
        if (['__proto__', 'constructor', 'prototype'].includes(name)) return { error: 'Choose a different name.' };
        const clash = Object.keys(categoryConfig).find((k) => k.toLowerCase() === name.toLowerCase() && k !== original);
        if (clash) return { error: 'You already have a category called "' + clash + '".' };
        return { name: name };
    }

    function openCategoryEditor(name) {
        const isNew = !name;
        if (!isNew && !categoryConfig[name]) {
            say('That category no longer exists.', 'error');
            return null;
        }
        const protectedName = !isNew && NEVER_RENAME.includes(name);
        const isOthers = name === 'Others';
        const cfg = isNew ? { keywords: [] } : categoryConfig[name];
        const counts = isNew ? {} : categoryCounts();
        const txCount = counts[name] || 0;

        const body = h('div', { class: 'stack' });
        const nameInput = h('input', { class: 'input', type: 'text', value: isNew ? '' : name, maxlength: '40', autocomplete: 'off', disabled: protectedName });
        const nameField = field('Name', nameInput, protectedName ? { hint: isOthers ? 'Others holds anything that is not sorted yet. It cannot be renamed or deleted.' : 'Income is used when you import deposits, so it keeps its name.' } : null);
        body.appendChild(nameField.node);

        let words = null;
        let incomeSw = null;
        let hideSw = null;

        if (!isOthers) {
            const conflictHint = (values) => {
                const notes = [];
                values.forEach((w) => {
                    const other = Object.keys(categoryConfig).find((k) => k !== name && (categoryConfig[k].keywords || []).some((x) => String(x).toUpperCase() === w));
                    if (other) notes.push('"' + w + '" is also in ' + other + '. The one listed first wins.');
                });
                return notes.slice(0, 2).join(' ');
            };
            words = tokenInput({ values: (cfg.keywords || []).map((k) => String(k).toUpperCase()), label: 'Words to match', placeholder: 'Type a word, like STARBUCKS, and press Enter', hintFor: conflictHint, onChange: () => {} });
            body.appendChild(h('div', { class: 'field' }, h('span', { class: 'settings-label', text: 'Words to match' }), words.node, h('p', { class: 'muted settings-hint', text: 'When a transaction description contains one of these words, it is sorted here. Capital letters do not matter.' })));

            incomeSw = switchRow({ title: 'Counts as income', sub: 'Money in this category is added to your income instead of your spending.', checked: cfg._isIncome === true || name === 'Income', disabled: name === 'Income' });
            hideSw = switchRow({ title: 'Hide from totals', sub: 'Left out of spending, income and budgets. Good for transfers between your own accounts or things you track but do not count.', checked: cfg._isExcluded === true });
            incomeSw.input.addEventListener('change', () => {
                if (incomeSw.input.checked) hideSw.input.checked = false;
            });
            hideSw.input.addEventListener('change', () => {
                if (hideSw.input.checked && !incomeSw.input.disabled) incomeSw.input.checked = false;
            });
            body.appendChild(h('div', { class: 'settings-list' }, incomeSw.node, hideSw.node));
        }

        const canDelete = !isNew && !protectedName;
        if (canDelete) body.appendChild(h('p', { class: 'muted settings-hint', text: txCount ? plural(txCount, 'transaction', 'transactions') + ' will move to Others if you delete this category.' : 'No transactions use this category.' }));

        const actions = [];
        if (canDelete) actions.push({ label: 'Delete category', variant: 'danger', closes: false, onClick: () => confirmDeleteCategory() });
        actions.push({ label: isOthers ? 'Close' : 'Cancel', variant: 'ghost' });
        if (!isOthers) {
            actions.push({
                label: isNew ? 'Add category' : 'Save',
                variant: 'primary',
                closes: false,
                onClick: (ctx) => {
                    nameField.error(null);
                    const checked = validateCategoryName(nameInput.value, isNew ? null : name);
                    if (checked.error) {
                        nameField.error(checked.error);
                        nameInput.focus();
                        return;
                    }
                    words.flush();
                    const keywords = words.get();
                    const next = {};
                    next.keywords = keywords;
                    next.icon = cfg.icon || '';
                    const isIncome = incomeSw.input.checked;
                    const isHidden = hideSw.input.checked;
                    if (isIncome) next._isIncome = true;
                    if (isHidden && !isIncome) next._isExcluded = true;
                    if (isNew) {
                        const rebuilt = {};
                        Object.keys(categoryConfig).forEach((k) => {
                            if (k === 'Others') rebuilt[checked.name] = next;
                            rebuilt[k] = categoryConfig[k];
                        });
                        if (!rebuilt[checked.name]) rebuilt[checked.name] = next;
                        categoryConfig = rebuilt;
                    } else {
                        if (!protectedName && checked.name !== name) renameCategoryEverywhere(name, checked.name);
                        const key = protectedName ? name : checked.name;
                        categoryConfig[key] = Object.assign({}, categoryConfig[key], next);
                        if (!isIncome) delete categoryConfig[key]._isIncome;
                        if (!(isHidden && !isIncome)) delete categoryConfig[key]._isExcluded;
                        if (name === 'Income') categoryConfig[key]._isIncome = true;
                    }
                    persist('categories');
                    ctx.close();
                    say(isNew ? 'Category added' : 'Category saved');
                },
            });
        }

        const ctx = UI.sheet({ title: isNew ? 'New category' : isOthers ? 'Others' : name, body: body, size: 'md', actions: actions, initialFocus: isNew ? 'input' : null });

        async function confirmDeleteCategory() {
            const rulesTo = (window.unifiedRules || []).filter((r) => r.type === 'categorize' && r.action === name).length;
            const ok = await UI.confirm({
                title: 'Delete ' + name + '?',
                message: (txCount ? plural(txCount, 'transaction', 'transactions') + ' will move to Others. ' : '') + (rulesTo ? plural(rulesTo, 'auto-sort rule', 'auto-sort rules') + ' that send things here will be removed. ' : '') + 'You can undo right after.',
                confirmLabel: 'Delete category',
                danger: true,
            });
            if (!ok) return;
            const snap = snapshot();
            dropCategoryReferences(name);
            delete categoryConfig[name];
            persist('categories');
            ctx.close();
            offerUndo('Deleted ' + name, snap);
        }
        return ctx;
    }

    window.openCategoryEditor = openCategoryEditor;

    function renderCategories(box) {
        const counts = categoryCounts();
        const cats = Store.categories({ includeIncome: true });
        const rows = cats.map((c) => {
            const n = counts[c.name] || 0;
            const badges = h('span', { class: 'settings-badges' }, c.isIncome ? badge('Counts as income', 'badge-success') : null, c.isExcluded ? badge('Hidden from totals') : null);
            const main = h(
                'button',
                { class: 'settings-row-main', type: 'button', 'data-key': 'cat-' + c.name, 'aria-label': 'Edit ' + c.name },
                h('span', { class: 'settings-chip', 'aria-hidden': 'true', html: chipHtml(c.name, 36) }),
                h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: c.name }), h('span', { class: 'settings-row-sub', text: plural(n, 'transaction', 'transactions') + ((c.keywords || []).length ? ', ' + plural(c.keywords.length, 'word', 'words') + ' to match' : '') })),
                badges,
                h('span', { class: 'settings-chevron', 'aria-hidden': 'true', html: icon('chevron-right', 16) })
            );
            main.addEventListener('click', () => openCategoryEditor(c.name));
            return h('div', { class: 'settings-row' }, main);
        });
        box.appendChild(
            h(
                'div',
                { class: 'settings-actions' },
                h('button', { class: 'btn btn-primary', type: 'button', text: 'Add category', on: { click: () => openCategoryEditor(null) } }),
                h('button', { class: 'btn btn-ghost', type: 'button', text: 'Learn more store names', on: { click: learnStoreNames } }),
                h('a', { class: 'btn btn-ghost', href: 'budgets.html', text: 'Set monthly budgets' })
            )
        );
        box.appendChild(group(null, rows, { footer: 'Budget amounts live on the Budgets page.' }));
    }

    function ruleSentence(rule) {
        const m = MATCH_TYPES.find((t) => t.value === rule.matchType) || MATCH_TYPES[0];
        return 'If it ' + m.sentence + ' ' + rule.pattern;
    }

    function ruleDisplayName(rule) {
        const m = MATCH_TYPES.find((t) => t.value === rule.matchType) || MATCH_TYPES[0];
        return 'If it ' + m.sentence + ' ' + rule.pattern + ' -> ' + (rule.type === 'delete' ? 'Remove it' : rule.action);
    }

    function renderRules(box) {
        const rules = (window.unifiedRules || []).slice().reverse();
        box.appendChild(h('p', { class: 'muted settings-intro', text: "When a transaction's description contains these words, sort it automatically." }));
        const bar = h(
            'div',
            { class: 'settings-actions' },
            h('button', { class: 'btn btn-primary', type: 'button', text: 'Add rule', on: { click: () => openRuleEditor(null) } }),
            h('button', { class: 'btn btn-secondary', type: 'button', text: 'Apply rules to existing transactions', on: { click: applyRulesNow } })
        );
        box.appendChild(bar);

        if (!rules.length) {
            box.appendChild(UI.emptyNode({ icon: 'refresh', title: 'No rules yet', text: 'Rules appear when you sort a transaction and choose to do the same for similar ones. You can also add your own.', action: { label: 'Add rule', onClick: () => openRuleEditor(null) } }));
            return;
        }

        const listHost = h('div');
        let query = '';
        function paintList() {
            listHost.textContent = '';
            const q = query.trim().toLowerCase();
            const shown = rules.filter((r) => !q || ruleDisplayName(r).toLowerCase().includes(q));
            if (!shown.length) {
                listHost.appendChild(h('p', { class: 'muted settings-empty-line', text: 'No rules match "' + query + '".' }));
                return;
            }
            const rows = shown.map((rule) => {
                const on = rule.active !== false;
                const sw = h('input', { class: 'switch', type: 'checkbox', role: 'switch', checked: on, 'aria-label': 'Rule on: ' + ruleDisplayName(rule), 'data-key': 'rule-sw-' + rule.id });
                sw.addEventListener('change', () => {
                    rule.active = sw.checked;
                    persist('rules');
                });
                const target = rule.type === 'delete' ? h('span', { class: 'settings-rule-target', text: 'Remove it' }) : h('span', { class: 'settings-rule-target' }, h('span', { class: 'settings-chip settings-chip-sm', 'aria-hidden': 'true', html: chipHtml(rule.action, 24) }), h('span', { text: rule.action }));
                const m = MATCH_TYPES.find((t) => t.value === rule.matchType) || MATCH_TYPES[0];
                const sentence = h('span', { class: 'settings-rule-sentence' }, 'If it ' + m.sentence + ' ', h('strong', { text: rule.pattern }), ' -> ', target);
                const tags = [];
                if (rule.isAutomatic) tags.push('Learned from your changes');
                if (!on) tags.push('Off');
                const text = h('button', { class: 'settings-row-text settings-row-textbtn', type: 'button', 'aria-label': 'Edit rule: ' + ruleDisplayName(rule), on: { click: () => openRuleEditor(rule.id) } }, sentence, tags.length ? h('span', { class: 'settings-row-sub', text: tags.join(', ') }) : null);
                const edit = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Edit', 'aria-label': 'Edit rule: ' + ruleDisplayName(rule), 'data-key': 'rule-edit-' + rule.id, on: { click: () => openRuleEditor(rule.id) } });
                return h('div', { class: 'settings-row settings-row-rule' + (on ? '' : ' is-off') }, sw, text, h('span', { class: 'settings-row-trail' }, edit));
            });
            listHost.appendChild(group(null, rows));
        }
        if (rules.length > 8) {
            const search = h('input', { class: 'input', type: 'search', placeholder: 'Search rules', 'aria-label': 'Search rules', 'data-key': 'rule-search' });
            search.addEventListener('input', () => {
                query = search.value;
                paintList();
            });
            box.appendChild(h('div', { class: 'settings-search' }, search));
        }
        box.appendChild(listHost);
        paintList();
    }

    async function deleteRule(id) {
        const rule = (window.unifiedRules || []).find((r) => r.id === id);
        if (!rule) return;
        const ok = await UI.confirm({ title: 'Delete this rule?', message: ruleDisplayName(rule), confirmLabel: 'Delete rule', danger: true });
        if (!ok) return;
        const snap = snapshot();
        window.unifiedRules = window.unifiedRules.filter((r) => r.id !== id);
        persist('rules');
        offerUndo('Rule deleted', snap);
    }

    function autoRuleName(pattern, type, action) {
        return pattern + ' -> ' + (type === 'delete' ? 'Remove' : action);
    }

    function openRuleEditor(id, prefill) {
        const existing = id ? (window.unifiedRules || []).find((r) => r.id === id) : null;
        const base = existing || Object.assign({ type: 'categorize', matchType: 'contains', pattern: '', action: '', name: '' }, prefill || {});
        const names = categoryNames();
        const body = h('div', { class: 'stack' });

        const matchSel = h('select', { class: 'select', 'aria-label': 'How to match' }, MATCH_TYPES.map((t) => h('option', { value: t.value, text: t.label, selected: base.matchType === t.value })));
        const patternInput = h('input', { class: 'input', type: 'text', value: base.pattern || '', maxlength: '200', autocomplete: 'off', spellcheck: 'false', placeholder: 'STARBUCKS' });
        const patternField = field('Text to look for', patternInput);
        const advancedHint = h('p', { class: 'muted settings-hint', hidden: base.matchType !== 'regex', text: 'Advanced: a pattern like ^STAR.*COFFEE$. Most rules do not need this.' });
        body.appendChild(h('div', { class: 'settings-sentence' }, h('span', { class: 'settings-sentence-label', text: 'When the description' }), matchSel));
        body.appendChild(patternField.node);
        body.appendChild(advancedHint);

        const typeSel = h(
            'select',
            { class: 'select', 'aria-label': 'What to do' },
            h('option', { value: 'categorize', text: 'move it to a category', selected: base.type !== 'delete' }),
            h('option', { value: 'delete', text: 'remove it', selected: base.type === 'delete' })
        );
        const catSel = h('select', { class: 'select', 'aria-label': 'Category' }, names.map((n) => h('option', { value: n, text: n, selected: n === base.action })));
        if (!base.action && names.length) catSel.value = names.includes('Others') ? names[0] : names[0];
        const catField = field('Category', catSel);
        catField.node.hidden = base.type === 'delete';
        body.appendChild(h('div', { class: 'settings-sentence' }, h('span', { class: 'settings-sentence-label', text: 'Then' }), typeSel));
        body.appendChild(catField.node);

        const preview = h('div', { class: 'settings-preview', 'aria-live': 'polite' });
        body.appendChild(preview);

        const nameInput = h('input', { class: 'input', type: 'text', value: existing && existing.name && existing.name !== autoRuleName(existing.pattern, existing.type, existing.action) ? existing.name : '', maxlength: '80', autocomplete: 'off', placeholder: 'Optional, we will name it for you' });
        body.appendChild(field('Name (optional)', nameInput).node);

        function currentRule() {
            return { pattern: patternInput.value.trim(), matchType: matchSel.value, type: typeSel.value, action: catSel.value };
        }

        function validate() {
            const r = currentRule();
            if (!r.pattern) return 'Type the text to look for.';
            if (r.pattern.length > 200) return 'Use 200 characters or fewer.';
            if (r.matchType === 'regex' && !getSafeRuleRegex(r.pattern.toUpperCase())) return 'That pattern is not valid or is too complex. Try something simpler.';
            if (r.type === 'categorize' && !r.action) return 'Choose a category.';
            return null;
        }

        function refreshPreview() {
            preview.textContent = '';
            const r = currentRule();
            if (!r.pattern) {
                preview.appendChild(h('p', { class: 'muted', text: 'Type some text to see which of your transactions it would match.' }));
                return;
            }
            const problem = r.matchType === 'regex' && !getSafeRuleRegex(r.pattern.toUpperCase()) ? 'That pattern is not valid or is too complex.' : null;
            if (problem) {
                preview.appendChild(h('p', { class: 'muted', text: problem }));
                return;
            }
            const all = Store.allTransactions();
            const hits = [];
            let count = 0;
            for (let i = 0; i < all.length; i++) {
                if (ruleMatchesDescription(r, all[i].description)) {
                    count++;
                    if (hits.length < 3) hits.push(all[i]);
                }
            }
            preview.appendChild(h('p', { class: 'settings-preview-title', text: 'Matches ' + count.toLocaleString() + ' of your ' + all.length.toLocaleString() + ' transactions' }));
            if (hits.length) {
                preview.appendChild(h('ul', { class: 'settings-preview-list' }, hits.map((t) => h('li', { class: 'muted', text: t.description }))));
            }
        }
        const refreshSoon = UI.debounce(refreshPreview, 150);

        matchSel.addEventListener('change', () => {
            advancedHint.hidden = matchSel.value !== 'regex';
            refreshPreview();
        });
        patternInput.addEventListener('input', () => {
            patternField.error(null);
            refreshSoon();
        });
        typeSel.addEventListener('change', () => {
            catField.node.hidden = typeSel.value === 'delete';
        });
        refreshPreview();

        const ruleActions = [];
        if (existing) {
            ruleActions.push({ label: 'Delete rule', variant: 'danger', closes: false, onClick: (c) => { c.close(); deleteRule(existing.id); } });
        }
        ruleActions.push({ label: 'Cancel', variant: 'ghost' });
        const ctx = UI.sheet({
            title: existing ? 'Edit rule' : 'New rule',
            body: body,
            size: 'md',
            initialFocus: existing ? null : 'input',
            actions: ruleActions.concat([
                {
                    label: existing ? 'Save' : 'Add rule',
                    variant: 'primary',
                    closes: false,
                    onClick: (c) => {
                        const problem = validate();
                        if (problem) {
                            patternField.error(problem);
                            patternInput.focus();
                            return;
                        }
                        const r = currentRule();
                        const pattern = r.pattern.toUpperCase();
                        const name = nameInput.value.trim() || autoRuleName(pattern, r.type, r.action);
                        const data = { name: name, type: r.type, pattern: pattern, matchType: r.matchType, action: r.type === 'categorize' ? r.action : null };
                        if (!Array.isArray(window.unifiedRules)) window.unifiedRules = [];
                        if (existing) {
                            Object.assign(existing, data, { updatedAt: new Date().toISOString() });
                        } else {
                            window.unifiedRules.push(Object.assign({ id: generateRuleId(), description: '', isAutomatic: false, active: true, createdAt: new Date().toISOString() }, data));
                        }
                        persist('rules');
                        c.close();
                        say(existing ? 'Rule saved' : 'Rule added');
                    },
                },
            ]),
        });
        return ctx;
    }

    window.openRuleEditor = openRuleEditor;

    async function applyRulesNow() {
        const active = (window.unifiedRules || []).filter((r) => r.active !== false);
        if (!active.length) {
            say('Turn on at least one rule first.', 'info');
            return;
        }
        const dry = applyRulesToExistingTransactions({ dryRun: true });
        if (!dry.matched) {
            say('Nothing to change. Your transactions already follow your rules.', 'info');
            return;
        }
        const parts = [];
        if (dry.moved) parts.push(plural(dry.moved, 'transaction', 'transactions') + ' you sorted by hand will follow your rules instead');
        if (dry.removed) parts.push(plural(dry.removed, 'transaction', 'transactions') + ' will be removed');
        const ok = await UI.confirm({ title: 'Apply rules now?', message: parts.join(', and ') + '. You can undo right after.', confirmLabel: 'Apply rules' });
        if (!ok) return;
        const snap = snapshot();
        const res = applyRulesToExistingTransactions({});
        persist('rules');
        const msg = [];
        if (res.moved) msg.push(res.moved + ' re-sorted');
        if (res.removed) msg.push(res.removed + ' removed');
        offerUndo('Rules applied: ' + (msg.join(', ') || 'no changes'), snap);
    }

    function renderAccounts(box) {
        box.appendChild(h('p', { class: 'muted settings-intro', text: 'An account is a separate budget with its own transactions, categories and rules, for example one for personal and one for business.' }));
        let accounts = [];
        try {
            accounts = typeof getAccounts === 'function' ? getAccounts() : [];
        } catch (e) {
            accounts = [];
        }
        const activeAccount = typeof getActiveAccountId === 'function' ? getActiveAccountId() : null;
        box.appendChild(
            h(
                'div',
                { class: 'settings-actions' },
                h('button', { class: 'btn btn-primary', type: 'button', text: 'Add account', on: { click: () => (typeof window.openCreateAccount === 'function' ? window.openCreateAccount() : say('Accounts are not available right now.', 'error')) } }),
                h('button', { class: 'btn btn-secondary', type: 'button', text: 'Manage accounts', on: { click: () => (typeof window.openManageAccounts === 'function' ? window.openManageAccounts() : say('Accounts are not available right now.', 'error')) } })
            )
        );
        const rows = accounts.map((a) => {
            const current = a.id === activeAccount;
            const action = current
                ? badge('Current', 'badge-success')
                : h('button', {
                      class: 'btn btn-secondary btn-sm',
                      type: 'button',
                      text: 'Switch',
                      'aria-label': 'Switch to ' + a.name,
                      'data-key': 'acct-' + a.id,
                      on: {
                          click: () => {
                              setActiveAccount(a.id);
                              window.location.reload();
                          },
                      },
                  });
            return h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: a.name }), h('span', { class: 'settings-row-sub', text: current ? 'You are looking at this budget' : 'Tap Switch to open it' })), h('span', { class: 'settings-row-trail' }, action));
        });
        if (rows.length) box.appendChild(group(null, rows));
        else box.appendChild(UI.emptyNode({ icon: 'users', title: 'No accounts found', text: 'Add an account to get started.' }));
    }

    function readBankFormats() {
        try {
            const raw = JSON.parse(localStorage.getItem(BANK_KEY) || '{}');
            if (!raw || typeof raw !== 'object') return {};
            return raw;
        } catch (e) {
            return {};
        }
    }

    function forgetBankFormat(id) {
        const formats = readBankFormats();
        delete formats[id];
        try {
            localStorage.setItem(BANK_KEY, JSON.stringify(formats));
        } catch (e) {
            say('Could not update saved formats.', 'error');
            return;
        }
        if (window.savedBankMappings) delete window.savedBankMappings[id];
        say('Format forgotten');
        renderActive();
    }

    function findIncomeInExisting() {
        const patterns = (window.incomeSettings && window.incomeSettings.incomePatterns) || [];
        const snap = snapshot();
        let moved = 0;
        monthlyData.forEach((monthData, monthKey) => {
            monthData.transactions.forEach((t) => {
                const desc = String(t.Description || t.description || '').toUpperCase();
                if (!patterns.some((p) => desc.includes(p))) return;
                if (window.transactionOverrides && window.transactionOverrides[monthKey] && window.transactionOverrides[monthKey][t._id] === 'Income') return;
                if (!window.transactionOverrides) window.transactionOverrides = {};
                if (!window.transactionOverrides[monthKey]) window.transactionOverrides[monthKey] = {};
                window.transactionOverrides[monthKey][t._id] = 'Income';
                t._isIncome = true;
                moved++;
            });
        });
        if (!moved) {
            say('No more income found in your transactions.', 'info');
            return;
        }
        if (!categoryConfig.Income) categoryConfig.Income = { keywords: [], icon: '', _isIncome: true };
        persist('income');
        offerUndo(plural(moved, 'transaction', 'transactions') + ' marked as income', snap);
    }

    function renderImport(box) {
        box.appendChild(
            h(
                'div',
                { class: 'settings-actions' },
                h('button', { class: 'btn btn-primary', type: 'button', text: 'Import a bank file', on: { click: () => (typeof window.openImport === 'function' ? window.openImport() : say('Import is not available right now.', 'error')) } })
            )
        );
        if (!window.incomeSettings) window.incomeSettings = { trackIncome: true, incomePatterns: [] };
        const trackSw = switchRow({
            title: 'Track income',
            sub: 'Deposits that match the words below are counted as income, not spending. Applies to files you import from now on.',
            checked: window.incomeSettings.trackIncome === true,
            key: 'track-income',
            onChange: (on) => {
                window.incomeSettings.trackIncome = on;
                if (on && !categoryConfig.Income) categoryConfig.Income = { keywords: [], icon: '', _isIncome: true };
                persist('income');
            },
        });
        box.appendChild(group('Income', [trackSw.node]));

        const words = tokenInput({
            values: window.incomeSettings.incomePatterns || [],
            label: 'Income words',
            placeholder: 'Type a word, like PAYROLL, and press Enter',
            onChange: (values) => {
                window.incomeSettings.incomePatterns = values;
                persist('income');
            },
        });
        box.appendChild(
            h(
                'div',
                { class: 'settings-group' },
                h('h3', { class: 'settings-group-title', text: 'Income words' }),
                h('p', { class: 'muted settings-group-intro', text: 'If a bank description contains one of these words, the deposit is treated as income.' }),
                h('div', { class: 'settings-card' }, words.node, h('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Find income in my existing transactions', on: { click: () => findIncomeInExisting() } }))
            )
        );

        const formats = readBankFormats();
        const ids = Object.keys(formats).filter((k) => formats[k] && typeof formats[k] === 'object');
        const formatRows = ids.map((id) => {
            const f = formats[id];
            const cols = Array.isArray(f.headers) ? f.headers.length : 0;
            return h(
                'div',
                { class: 'settings-row' },
                h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: String(f.bankName || 'Saved format') }), h('span', { class: 'settings-row-sub', text: cols ? 'Remembered for files with these ' + cols + ' columns' : 'Remembered column choices' })),
                h('span', { class: 'settings-row-trail' }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Forget', 'aria-label': 'Forget ' + String(f.bankName || 'saved format'), 'data-key': 'fmt-' + id, on: { click: () => forgetBankFormat(id) } }))
            );
        });
        box.appendChild(
            group('Saved bank formats', formatRows.length ? formatRows : [h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Nothing saved yet' }), h('span', { class: 'settings-row-sub', text: 'When you tell the app which columns hold the date, description and amount, it remembers them for next time.' })))], {
                footer: 'Forgetting a format only means you will be asked about the columns again next time.',
            })
        );

        box.appendChild(
            group('Skipped automatically', [
                h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Credit card payments' }), h('span', { class: 'settings-row-sub', text: 'Lines that say PAYMENT THANK YOU are skipped when you import, so a card payment is not counted on top of the purchases it covers.' }))),
            ])
        );
    }

    function lockEnabled() {
        return typeof window.appLockEnabled === 'function' ? !!window.appLockEnabled() : false;
    }

    function readHideAmounts() {
        if (typeof window.getHideAmounts === 'function') return !!window.getHideAmounts();
        return Store.prefs().hideAmounts;
    }

    function writeHideAmounts(on) {
        if (typeof window.setHideAmounts === 'function') {
            window.setHideAmounts(on);
            return;
        }
        try {
            localStorage.setItem('sahabBudget_hideAmounts', JSON.stringify(on));
        } catch (e) {
            void e;
        }
        document.documentElement.classList.toggle('hide-amounts', on);
        Store.setPrefs({ hideAmounts: on });
    }

    function renderSecurity(box) {
        const statusText = h('span', { class: 'settings-row-sub', text: lockEnabled() ? 'On. A PIN is needed to open the app.' : 'Off. Anyone with this device can open the app.' });
        const manage = h('button', {
            class: 'btn btn-secondary btn-sm',
            type: 'button',
            text: lockEnabled() ? 'Manage' : 'Set up',
            'data-key': 'app-lock',
            on: {
                click: () => {
                    if (typeof window.openAppLockSettings !== 'function') {
                        say('App lock is not available right now.', 'error');
                        return;
                    }
                    window.openAppLockSettings();
                    const startedAs = lockEnabled();
                    if (lockWatcher) clearInterval(lockWatcher);
                    let ticks = 0;
                    lockWatcher = setInterval(() => {
                        ticks++;
                        if (lockEnabled() !== startedAs || ticks > 240) {
                            clearInterval(lockWatcher);
                            lockWatcher = null;
                            if (activeId === 'security') renderActive();
                        }
                    }, 500);
                },
            },
        });
        const lockRow = h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'App lock' }), statusText), h('span', { class: 'settings-row-trail' }, manage));
        const hideSw = switchRow({
            title: 'Hide amounts',
            sub: 'Blurs every amount on screen so nobody can read it over your shoulder.',
            checked: readHideAmounts(),
            key: 'hide-amounts',
            onChange: (on) => writeHideAmounts(on),
        });
        box.appendChild(group(null, [lockRow, hideSw.node]));
        box.appendChild(
            h(
                'div',
                { class: 'settings-card settings-note' },
                h('h3', { class: 'settings-group-title', text: 'Your data stays here' }),
                h('p', { text: 'Everything you add lives on this device, inside this browser. Nothing is sent to a server, and there are no accounts to sign in to.' }),
                h('p', { class: 'muted', text: 'That also means clearing your browser data erases your budget. Download a backup now and then to stay safe.' })
            )
        );
    }

    function renderBackup(box) {
        const last = Backup.describeLastBackup();
        const status = h(
            'div',
            { class: 'settings-card settings-backup-status' + (last.stale ? ' is-stale' : '') },
            h('p', { class: 'settings-backup-line', text: last.text }),
            h('p', { class: 'muted', text: last.never ? 'Save a copy so a cleared browser never costs you your history.' : last.stale ? 'It has been a while. A fresh backup takes a few seconds.' : 'You are covered. Back up again after big changes.' })
        );
        box.appendChild(status);
        box.appendChild(
            h(
                'div',
                { class: 'settings-actions' },
                h('button', { class: 'btn btn-primary', type: 'button', text: 'Download backup', on: { click: () => Backup.openDownload(() => renderActive()) } }),
                h('button', { class: 'btn btn-secondary', type: 'button', text: 'Restore from backup', on: { click: () => Backup.openRestore() } })
            )
        );
        box.appendChild(
            group(
                'Good to know',
                [
                    h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'What is saved' }), h('span', { class: 'settings-row-sub', text: 'The current account only: transactions, categories, rules, budgets, goals, notes and settings.' }))),
                    h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Password protection' }), h('span', { class: 'settings-row-sub', text: 'Optional. Protected backups cannot be opened without the password, and we cannot recover it for you.' }))),
                    h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Restoring' }), h('span', { class: 'settings-row-sub', text: 'You choose to replace everything or merge. Either way you can undo right after.' }))),
                ]
            )
        );
    }

    function currencyLabel(code) {
        let name = '';
        try {
            name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || '';
        } catch (e) {
            name = '';
        }
        return name && name !== code ? name + ' (' + code + ')' : code;
    }

    function renderAppearance(box) {
        const prefs = Store.prefs();
        const segHost = h('div', { class: 'settings-segment' });
        const themeRow = h('div', { class: 'settings-row settings-row-stack' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', id: 'themeLabel', text: 'Theme' }), h('span', { class: 'settings-row-sub', text: 'System follows your device and switches at night.' })), segHost);

        const sorted = Array.from(new Set([prefs.currency].concat(CURRENCIES))).sort((a, b) => currencyLabel(a).localeCompare(currencyLabel(b)));
        const currencySel = h('select', { class: 'select', 'aria-labelledby': 'currencyLabel', 'data-key': 'currency' }, sorted.map((c) => h('option', { value: c, text: currencyLabel(c), selected: c === prefs.currency })));
        currencySel.addEventListener('change', () => {
            Store.setPrefs({ currency: currencySel.value });
            say('Currency updated');
        });
        const currencyRow = h('div', { class: 'settings-row settings-row-stack' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', id: 'currencyLabel', text: 'Currency' }), h('span', { class: 'settings-row-sub', text: 'Only changes how amounts look. It does not convert anything.' })), currencySel, h('p', { class: 'settings-currency-preview muted' }, 'Preview: ', h('span', { class: 'money num', text: Store.money(-1234.56) }), '  ', h('span', { class: 'money num', text: Store.money(25000) })));

        const weekSel = h('select', { class: 'select', 'aria-labelledby': 'weekLabel', 'data-key': 'week-start' }, h('option', { value: '0', text: 'Sunday', selected: prefs.weekStartsOn === 0 }), h('option', { value: '1', text: 'Monday', selected: prefs.weekStartsOn === 1 }));
        weekSel.addEventListener('change', () => {
            Store.setPrefs({ weekStartsOn: Number(weekSel.value) === 1 ? 1 : 0 });
            say('First day of the week updated');
        });
        const weekRow = h('div', { class: 'settings-row settings-row-stack' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', id: 'weekLabel', text: 'First day of the week' }), h('span', { class: 'settings-row-sub', text: 'Used when weeks are shown in calendars and charts.' })), weekSel);

        box.appendChild(group(null, [themeRow, currencyRow, weekRow]));
        const current = typeof window.getThemePreference === 'function' ? window.getThemePreference() : 'system';
        UI.segmented(segHost, {
            options: [
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
            ],
            value: current,
            ariaLabel: 'Theme',
            onChange: (v) => {
                if (typeof window.setThemePreference === 'function') window.setThemePreference(v);
            },
        });
    }

    function storageUsage() {
        try {
            const raw = localStorage.getItem(getActiveDataKey()) || '';
            const mb = raw.length / (1024 * 1024);
            return mb < 0.1 ? 'Under 0.1 MB' : mb.toFixed(1) + ' MB';
        } catch (e) {
            return 'Unknown';
        }
    }

    function renderData(box) {
        const keys = Store.monthKeys();
        const monthSel = h('select', { class: 'select', 'aria-labelledby': 'exportLabel', 'data-key': 'export-month' }, h('option', { value: 'all', text: 'All months' }), keys.map((k) => h('option', { value: k, text: Store.monthLabel(k) })));
        const err = errorLine('exportErr');
        const exportBtn = h('button', {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            text: 'Export CSV',
            on: {
                click: () => {
                    setError(monthSel, err, null);
                    const res = exportTransactionsCSV(monthSel.value);
                    if (!res.ok) setError(monthSel, err, res.error);
                    else say('Exported ' + plural(res.count, 'transaction', 'transactions'));
                },
            },
        });
        const exportRow = h('div', { class: 'settings-row settings-row-stack' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', id: 'exportLabel', text: 'Export transactions' }), h('span', { class: 'settings-row-sub', text: 'A spreadsheet file with date, merchant, description, amount, category and note.' })), h('div', { class: 'settings-inline' }, monthSel, exportBtn), err);
        box.appendChild(group('Take your data with you', [exportRow]));

        const resetRow = h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Reset categories to defaults' }), h('span', { class: 'settings-row-sub', text: 'Brings back the original categories and words. Categories you made are removed and their transactions move to Others.' })), h('span', { class: 'settings-row-trail' }, h('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Reset', on: { click: resetCategories } })));
        const deleteRow = h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Delete all data in this account' }), h('span', { class: 'settings-row-sub', text: 'Removes every transaction, category, rule, budget and goal in this account.' })), h('span', { class: 'settings-row-trail' }, h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Delete all data', on: { click: deleteAllData } })));
        box.appendChild(group('Start over', [resetRow, deleteRow], { footer: 'Both can be undone right after you do them.' }));
        box.appendChild(h('p', { class: 'muted settings-hint', text: 'Space used by this account: ' + storageUsage() }));
    }

    async function learnStoreNames() {
        if (typeof mergeDefaultCategoryWords !== 'function') return;
        const ok = await UI.confirm({ title: 'Learn more store names?', message: 'We add the latest common store and brand names to your categories, and any missing standard categories like Travel or Utilities. Your own words and categories stay as they are. Transactions that still need a category may get sorted.', confirmLabel: 'Add store names' });
        if (!ok) return;
        const snap = snapshot();
        const result = mergeDefaultCategoryWords();
        if (!result.addedWords && !result.addedCategories) {
            UI.toast('Your categories already know every store name we have.', { type: 'info' });
            return;
        }
        persist('categories');
        const parts = [];
        if (result.addedWords) parts.push(result.addedWords + (result.addedWords === 1 ? ' store name' : ' store names'));
        if (result.addedCategories) parts.push(result.addedCategories + (result.addedCategories === 1 ? ' category' : ' categories'));
        offerUndo('Added ' + parts.join(' and '), snap);
    }

    async function resetCategories() {
        const ok = await UI.confirm({ title: 'Reset categories?', message: 'The original categories and words come back. Categories you made are removed, and their transactions move to Others. You can undo right after.', confirmLabel: 'Reset categories', danger: true });
        if (!ok) return;
        const snap = snapshot();
        const defaults = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_CONFIG));
        Object.keys(categoryConfig).forEach((name) => {
            if (!(name in defaults)) {
                dropCategoryReferences(name);
            }
        });
        categoryConfig = defaults;
        persist('categories');
        offerUndo('Categories reset', snap);
    }

    function deleteAllData() {
        const body = h('div', { class: 'stack' });
        body.appendChild(h('p', { text: 'This removes every transaction, category, rule, budget and goal in this account. Other accounts are not touched.' }));
        const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'DELETE' });
        const f = field('Type DELETE to confirm', input);
        body.appendChild(f.node);
        UI.sheet({
            title: 'Delete all data?',
            body: body,
            size: 'sm',
            initialFocus: 'input',
            actions: [
                { label: 'Cancel', variant: 'ghost' },
                {
                    label: 'Delete all data',
                    variant: 'danger-solid',
                    closes: false,
                    onClick: (ctx) => {
                        if (input.value.trim() !== 'DELETE') {
                            f.error('Type the word DELETE in capital letters.');
                            input.focus();
                            return;
                        }
                        const snap = snapshot();
                        try {
                            localStorage.removeItem(getActiveDataKey());
                        } catch (e) {
                            ctx.setError('Could not delete the data. Nothing was changed.');
                            return;
                        }
                        if (snap && typeof showUndoAfterReload === 'function') showUndoAfterReload('All data deleted', snap);
                        ctx.close();
                        window.location.reload();
                    },
                },
            ],
        });
    }

    function renderHelp(box) {
        const rows = [
            h('div', { class: 'settings-row' }, h('a', { class: 'settings-row-main', href: 'about.html' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'How Sahab Budget works' }), h('span', { class: 'settings-row-sub', text: 'A short guide to importing, sorting and budgeting.' })), h('span', { class: 'settings-chevron', 'aria-hidden': 'true', html: icon('chevron-right', 16) }))),
        ];
        const tour = window.startWelcomeTour;
        if (typeof tour === 'function') {
            rows.push(h('div', { class: 'settings-row' }, h('button', { class: 'settings-row-main', type: 'button', on: { click: () => tour() } }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Replay the welcome tour' }), h('span', { class: 'settings-row-sub', text: 'See the quick introduction again.' })), h('span', { class: 'settings-chevron', 'aria-hidden': 'true', html: icon('chevron-right', 16) }))));
        }
        box.appendChild(group(null, rows));
        box.appendChild(
            group('About', [
                h('div', { class: 'settings-row' }, h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: 'Sahab Budget' }), h('span', { class: 'settings-row-sub', text: 'Version 2.0. A private budget tracker that keeps everything on your device.' }))),
            ])
        );
    }

    const RENDERERS = {
        categories: renderCategories,
        rules: renderRules,
        accounts: renderAccounts,
        import: renderImport,
        security: renderSecurity,
        backup: renderBackup,
        appearance: renderAppearance,
        data: renderData,
        help: renderHelp,
    };

    function sectionById(id) {
        return SECTIONS.find((s) => s.id === id) || null;
    }

    function renderNav() {
        const nav = document.getElementById('settingsNav');
        nav.textContent = '';
        const groups = [];
        SECTIONS.forEach((s) => {
            let g = groups.find((x) => x.name === s.group);
            if (!g) {
                g = { name: s.group, items: [] };
                groups.push(g);
            }
            g.items.push(s);
        });
        groups.forEach((g) => {
            const items = g.items.map((s) =>
                h(
                    'a',
                    { class: 'settings-nav-item', href: '#' + s.id, 'data-section': s.id, 'aria-current': s.id === activeId ? 'true' : null },
                    iconNode(s.icon, 20),
                    h('span', { class: 'settings-row-text' }, h('span', { class: 'settings-row-title', text: s.title }), h('span', { class: 'settings-row-sub settings-nav-desc', text: s.desc })),
                    h('span', { class: 'settings-chevron', 'aria-hidden': 'true', html: icon('chevron-right', 16) })
                )
            );
            nav.appendChild(h('div', { class: 'settings-nav-group' }, h('p', { class: 'settings-nav-heading', text: g.name }), h('div', { class: 'settings-nav-list' }, items)));
        });
    }

    function renderActive(moveFocus) {
        const content = document.getElementById('settingsContent');
        const section = sectionById(activeId);
        if (!content || !section) return;
        const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
        const box = h('section', { class: 'settings-section', 'aria-labelledby': 'sectionTitle' });
        const back = h('a', { class: 'settings-back', href: '#', 'aria-label': 'Back to all settings' }, h('span', { 'aria-hidden': 'true', html: icon('chevron-left', 16) }), 'Settings');
        back.addEventListener('click', (e) => {
            e.preventDefault();
            history.pushState(null, '', window.location.pathname + window.location.search);
            route();
        });
        const title = h('h2', { class: 'settings-section-title', id: 'sectionTitle', tabindex: '-1', text: section.title });
        box.appendChild(back);
        box.appendChild(h('div', { class: 'settings-section-head' }, title, h('p', { class: 'muted', text: section.desc })));
        const body = h('div', { class: 'settings-section-body' });
        box.appendChild(body);
        try {
            RENDERERS[section.id](body);
        } catch (e) {
            console.error(e);
            body.textContent = '';
            body.appendChild(UI.emptyNode({ icon: 'alert', title: 'This section did not load', text: 'Refresh the page and try again. Your data is safe.', action: { label: 'Refresh', onClick: () => window.location.reload() } }));
        }
        content.textContent = '';
        content.appendChild(box);
        if (moveFocus) title.focus({ preventScroll: true });
        else if (focused) {
            const again = content.querySelector('[data-key="' + (window.CSS && CSS.escape ? CSS.escape(focused) : focused) + '"]');
            if (again) again.focus({ preventScroll: true });
        }
    }

    function route() {
        const hash = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
        const valid = sectionById(hash);
        const layout = document.getElementById('settingsLayout');
        activeId = valid ? valid.id : activeId;
        if (!valid && !sectionById(activeId)) activeId = 'categories';
        if (!valid) activeId = 'categories';
        layout.dataset.view = valid ? 'detail' : 'index';
        document.querySelectorAll('.settings-nav-item').forEach((a) => {
            if (a.dataset.section === activeId && (valid || window.matchMedia('(min-width: 900px)').matches)) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
        if (typeof Shell !== 'undefined' && Shell.setTitle) Shell.setTitle(valid ? valid.title : 'Settings');
        document.title = (valid ? valid.title + ' | Settings' : 'Settings') + ' | Sahab Budget';
        renderActive(!!valid);
        if (valid) window.scrollTo(0, 0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        Store.init();
        renderNav();
        route();
        window.addEventListener('hashchange', route);
        Store.onChange(() => renderActive());
    });
})();
