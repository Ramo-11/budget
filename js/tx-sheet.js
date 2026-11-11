(function () {
    function esc(s) {
        if (typeof UI !== 'undefined' && UI.esc) return UI.esc(s);
        return typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function icon(name, size) {
        return typeof UI !== 'undefined' && UI.icon ? UI.icon(name, size || 18) : '';
    }

    function chip(name, size) {
        if (typeof UI !== 'undefined' && UI.chip) return UI.chip(name, { size: size || 36 });
        return typeof getCategoryIconChip === 'function' ? getCategoryIconChip(name, { size: size || 36, icon: 18 }) : '';
    }

    function money(n, opts) {
        return Store.money(n, opts);
    }

    function toast(message, type, action) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { type: type || 'success', action: action });
        else if (typeof showNotification === 'function') showNotification(message, type || 'success');
    }

    function withUndo(message, fn) {
        const snapshot = typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
        const result = fn();
        if (typeof message === 'function') message = message(result);
        if (snapshot && typeof showUndo === 'function') {
            showUndo(message, () => restoreActiveData(snapshot), { reloadOnUndo: true });
        } else {
            toast(message, 'success');
        }
        return result;
    }
    window.txWithUndo = withUndo;

    function dateText(t) {
        if (!t.date || isNaN(t.date)) return '';
        return t.date.toLocaleDateString(Store.prefs().locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    function parseAmount(value) {
        const cleaned = String(value || '').replace(/[^0-9.]/g, '');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    }

    function similarCount(t) {
        const pattern = Store.merchantPattern(t.description);
        if (!pattern) return 1;
        const up = pattern.toUpperCase();
        let n = 0;
        Store.allTransactions().forEach((x) => {
            if (String(x.description || '').toUpperCase().includes(up)) n++;
        });
        return Math.max(n, 1);
    }

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text != null) e.textContent = text;
        return e;
    }

    function fieldWrap(id, label, control, hint) {
        const f = el('div', 'field');
        const l = el('label', null, label);
        l.setAttribute('for', id);
        f.appendChild(l);
        f.appendChild(control);
        if (hint) f.appendChild(el('p', 'field-hint subtle', hint));
        const err = el('p', 'field-error');
        err.id = id + 'Error';
        err.hidden = true;
        f.appendChild(err);
        control.setAttribute('aria-describedby', err.id);
        return f;
    }

    function showFieldError(control, message) {
        const err = document.getElementById(control.id + 'Error');
        if (!err) return;
        err.textContent = message || '';
        err.hidden = !message;
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
    }

    function openCategoryPicker(options) {
        const o = options || {};
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        const cats = Store.categories({ includeIncome: true });
        const body = el('div', 'txs-picker');
        const search = el('input', 'input');
        search.type = 'search';
        search.id = 'txsPickerSearch';
        search.placeholder = 'Search categories';
        search.setAttribute('aria-label', 'Search categories');
        search.autocomplete = 'off';
        const list = el('div', 'txs-picker-list');
        list.setAttribute('role', 'list');
        const empty = el('p', 'txs-picker-empty muted', 'No category matches that. Try another word or create a new one.');
        empty.hidden = true;
        const create = el('a', 'txs-picker-create', 'Create category');
        create.href = 'settings.html#categories';
        body.appendChild(search);
        body.appendChild(list);
        body.appendChild(empty);
        body.appendChild(create);
        let ctx = null;

        function visibleButtons() {
            return Array.from(list.querySelectorAll('button:not([hidden])'));
        }

        function pick(name) {
            if (ctx) ctx.close();
            if (typeof o.onPick === 'function') o.onPick(name);
        }

        cats.forEach((c) => {
            const row = el('div');
            row.setAttribute('role', 'listitem');
            row.hidden = false;
            const b = el('button', 'txs-picker-item');
            b.type = 'button';
            b.dataset.name = c.name;
            if (c.name === o.current) b.setAttribute('aria-current', 'true');
            b.innerHTML = chip(c.name, 32) + '<span class="txs-picker-name">' + esc(c.name) + '</span>' + (c.isIncome ? '<span class="badge">Income</span>' : '') + (c.name === o.current ? icon('check', 18) : '');
            b.addEventListener('click', () => pick(c.name));
            row.appendChild(b);
            list.appendChild(row);
        });

        search.addEventListener('input', () => {
            const q = search.value.trim().toLowerCase();
            let shown = 0;
            list.querySelectorAll('[role="listitem"]').forEach((row) => {
                const name = row.firstChild.dataset.name.toLowerCase();
                const match = !q || name.includes(q);
                row.hidden = !match;
                if (match) shown++;
            });
            empty.hidden = shown > 0;
        });

        body.addEventListener('keydown', (e) => {
            const btns = visibleButtons().filter((b) => !b.closest('[hidden]'));
            if (e.key === 'Enter' && e.target === search) {
                e.preventDefault();
                if (btns[0]) pick(btns[0].dataset.name);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const i = btns.indexOf(document.activeElement);
                let next;
                if (e.key === 'ArrowDown') next = i < 0 ? btns[0] : btns[Math.min(i + 1, btns.length - 1)];
                else if (i <= 0) next = search;
                else next = btns[i - 1];
                if (next) {
                    e.preventDefault();
                    next.focus();
                }
            }
        });

        ctx = UI.sheet({
            title: o.title || 'Choose a category',
            body: body,
            size: 'md',
            initialFocus: '#txsPickerSearch',
            actions: [{ label: 'Cancel', variant: 'ghost' }],
        });
        return ctx;
    }

    function openTransactionSheet(id) {
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        const first = Store.transaction(id);
        if (!first) {
            toast('That transaction is no longer there.', 'error');
            return null;
        }
        const body = el('div', 'txs');
        const head = el('div', 'txs-head');
        const amountEl = el('p', 'txs-amount num');
        const dateEl = el('p', 'txs-date muted');
        const descEl = el('p', 'txs-desc subtle');
        head.appendChild(amountEl);
        head.appendChild(dateEl);
        head.appendChild(descEl);
        body.appendChild(head);

        const catBtn = el('button', 'txs-cat-row');
        catBtn.type = 'button';
        body.appendChild(catBtn);

        const applyWrap = el('label', 'txs-check');
        const applyBox = el('input');
        applyBox.type = 'checkbox';
        applyBox.id = 'txsApplyAll';
        const applyText = el('span');
        applyWrap.appendChild(applyBox);
        applyWrap.appendChild(applyText);
        body.appendChild(applyWrap);

        const incomeWrap = el('div', 'txs-switch-row');
        const incomeLabel = el('label', null, 'Counts as income');
        incomeLabel.setAttribute('for', 'txsIncome');
        const incomeBox = el('input', 'switch');
        incomeBox.type = 'checkbox';
        incomeBox.id = 'txsIncome';
        incomeBox.setAttribute('role', 'switch');
        incomeWrap.appendChild(incomeLabel);
        incomeWrap.appendChild(incomeBox);
        body.appendChild(incomeWrap);

        const noteArea = el('textarea', 'textarea');
        noteArea.id = 'txsNote';
        noteArea.rows = 2;
        noteArea.maxLength = 500;
        noteArea.placeholder = 'Add a note';
        body.appendChild(fieldWrap('txsNote', 'Note', noteArea));

        let manualSection = null;
        let nameInput, amountInput, dateInput, kindSelect;
        if (first.isManual) {
            manualSection = el('div', 'txs-edit');
            nameInput = el('input', 'input');
            nameInput.id = 'txsName';
            nameInput.maxLength = 140;
            amountInput = el('input', 'input');
            amountInput.id = 'txsAmountInput';
            amountInput.inputMode = 'decimal';
            dateInput = el('input', 'input');
            dateInput.id = 'txsDateInput';
            dateInput.type = 'date';
            kindSelect = el('select', 'select');
            kindSelect.id = 'txsKind';
            [['expense', 'Expense'], ['income', 'Income']].forEach((p) => {
                const op = el('option', null, p[1]);
                op.value = p[0];
                kindSelect.appendChild(op);
            });
            const det = el('details', 'txs-disclosure');
            det.appendChild(el('summary', null, 'Edit details'));
            const inner = el('div', 'txs-edit-grid');
            inner.appendChild(fieldWrap('txsName', 'Name', nameInput));
            inner.appendChild(fieldWrap('txsAmountInput', 'Amount', amountInput));
            inner.appendChild(fieldWrap('txsDateInput', 'Date', dateInput));
            inner.appendChild(fieldWrap('txsKind', 'Type', kindSelect));
            const saveBtn = el('button', 'btn btn-secondary', 'Save details');
            saveBtn.type = 'button';
            inner.appendChild(saveBtn);
            det.appendChild(inner);
            manualSection.appendChild(det);
            body.appendChild(manualSection);
            saveBtn.addEventListener('click', () => {
                const name = nameInput.value.trim();
                const amt = parseAmount(amountInput.value);
                showFieldError(nameInput, name ? '' : 'Add a name.');
                showFieldError(amountInput, amt > 0 ? '' : 'Enter an amount greater than zero.');
                showFieldError(dateInput, dateInput.value ? '' : 'Pick a date.');
                if (!name || amt <= 0 || !dateInput.value) return;
                const res = Store.editTransaction(id, { description: name, amount: amt, kind: kindSelect.value, date: dateInput.value });
                if (!res.ok) {
                    showFieldError(nameInput, res.error || 'Could not save.');
                    return;
                }
                toast('Saved your changes.', 'success');
            });
        }

        let renameInput = null;
        if (!first.isManual) {
            renameInput = el('input', 'input');
            renameInput.id = 'txsRename';
            renameInput.maxLength = 140;
            const rf = fieldWrap('txsRename', 'Name', renameInput);
            const reset = el('button', 'btn btn-ghost btn-sm', 'Reset to bank name');
            reset.type = 'button';
            rf.insertBefore(reset, rf.querySelector('.field-error'));
            body.insertBefore(rf, noteArea.closest('.field'));
            const saveName = () => {
                const t = Store.transaction(id);
                const v = renameInput.value.trim();
                if (!t || v === t.merchant) return;
                if (!v) {
                    showFieldError(renameInput, 'Add a name, or reset to the bank name.');
                    return;
                }
                showFieldError(renameInput, '');
                Store.editTransaction(id, { description: v });
            };
            renameInput.addEventListener('blur', saveName);
            renameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveName();
                }
            });
            reset.addEventListener('click', () => {
                const t = Store.transaction(id);
                if (!t) return;
                Store.editTransaction(id, { description: Store.merchantName(t.description) });
                showFieldError(renameInput, '');
                toast('Name reset to the bank name.', 'success');
            });
        }

        const memberRow = el('div', 'txs-member-row');
        body.appendChild(memberRow);

        function renderMembership(t) {
            memberRow.textContent = '';
            if (t.isIncome || t.isTransfer || typeof window.openMembershipSheet !== 'function') {
                memberRow.hidden = true;
                return;
            }
            memberRow.hidden = false;
            const owner = Store.subscriptions().find((s) => s.manual && Array.isArray(s.matchedIds) && s.matchedIds.includes(id));
            const link = el('button', 'txs-member-link');
            link.type = 'button';
            if (owner) {
                memberRow.appendChild(el('span', null, 'Part of membership ' + owner.label));
                link.textContent = 'Edit';
                link.setAttribute('aria-label', 'Edit membership ' + owner.label);
                link.addEventListener('click', () => {
                    if (ctx) ctx.close();
                    window.openMembershipSheet({ id: owner.id, name: owner.label, amount: owner.avgAmount, cadence: owner.cadence, nextDate: owner.nextDate && owner.nextDate.getTime ? Store.isoDate(owner.nextDate) : owner.nextDate || '', category: owner.category, pattern: owner.pattern });
                });
            } else {
                memberRow.appendChild(el('span', null, 'Charges like this one repeat?'));
                link.textContent = 'Mark as membership';
                link.addEventListener('click', () => {
                    const cur = Store.transaction(id);
                    if (!cur) return;
                    if (ctx) ctx.close();
                    window.openMembershipSheet({ name: cur.merchant, amount: cur.absAmount, cadence: 'monthly', category: cur.category, pattern: Store.merchantPattern(cur.description) });
                });
            }
            memberRow.appendChild(link);
        }

        const rawDet = el('details', 'txs-disclosure');
        rawDet.appendChild(el('summary', null, 'View original bank data'));
        const rawBody = el('div', 'txs-raw');
        rawDet.appendChild(rawBody);
        body.appendChild(rawDet);

        let currentCount = 1;
        let noteSaved = first.note || '';
        let lastCategory = null;
        let unsub = null;
        let ctx = null;

        function saveNote() {
            const v = noteArea.value.trim();
            if (v === noteSaved) return;
            Store.setNote(id, v);
            noteSaved = v;
        }

        function renderRaw(t) {
            rawBody.textContent = '';
            const raw = t.raw || {};
            const data = raw._rawCsvData && typeof raw._rawCsvData === 'object' ? raw._rawCsvData : null;
            const entries = data ? Object.entries(data) : Object.entries(raw).filter((p) => p[0].charAt(0) !== '_');
            if (!entries.length) {
                rawBody.appendChild(el('p', 'muted', 'No original bank data is saved for this transaction.'));
                return;
            }
            const dl = el('dl', 'txs-raw-list');
            entries.forEach((p) => {
                dl.appendChild(el('dt', null, String(p[0])));
                dl.appendChild(el('dd', null, p[1] == null || p[1] === '' ? ' ' : String(p[1])));
            });
            rawBody.appendChild(dl);
        }

        function update(initial) {
            const t = Store.transaction(id);
            if (!t) {
                if (ctx) ctx.close();
                return;
            }
            amountEl.innerHTML = '<span class="money">' + esc((t.isIncome || t.isRefund ? '+' : '') + money(t.absAmount)) + '</span>';
            amountEl.classList.toggle('txs-positive', t.isIncome || t.isRefund);
            dateEl.textContent = dateText(t) + (t.isRefund ? ' (refund)' : '') + (t.isManual ? ' (added by you)' : '');
            descEl.textContent = t.isManual ? '' : t.description;
            descEl.hidden = t.isManual || !t.description;
            catBtn.innerHTML = chip(t.category, 40) + '<span class="txs-cat-text"><span class="txs-cat-label muted">Category</span><span class="txs-cat-name">' + esc(t.needsReview ? 'Needs a category' : t.category) + '</span></span>' + icon('chevron-right', 18);
            catBtn.setAttribute('aria-label', 'Category: ' + (t.needsReview ? 'needs a category' : t.category) + '. Change category');
            const n = similarCount(t);
            if (initial || n !== currentCount) {
                currentCount = n;
                if (initial) applyBox.checked = n > 1;
            }
            applyWrap.hidden = n <= 1;
            applyText.textContent = 'Apply to all ' + n + ' ' + t.merchant + ' transactions and sort future ones the same way';
            incomeBox.checked = t.isIncome;
            if (initial || document.activeElement !== noteArea) {
                if (t.note !== noteSaved || initial) {
                    noteArea.value = t.note;
                    noteSaved = t.note;
                }
            }
            if (renameInput && (initial || document.activeElement !== renameInput)) renameInput.value = t.merchant;
            if (manualSection && (initial || !manualSection.contains(document.activeElement))) {
                nameInput.value = t.description;
                amountInput.value = t.absAmount.toFixed(2);
                dateInput.value = t.dateKey;
                kindSelect.value = t.isIncome ? 'income' : 'expense';
            }
            renderMembership(t);
            if (initial || lastCategory !== t.category) renderRaw(t);
            lastCategory = t.category;
            if (ctx && ctx.setTitle) ctx.setTitle(t.merchant);
        }

        catBtn.addEventListener('click', () => {
            const t = Store.transaction(id);
            if (!t) return;
            openCategoryPicker({
                current: t.category,
                title: 'Category for ' + t.merchant,
                onPick: (name) => {
                    const cur = Store.transaction(id);
                    if (!cur) return;
                    const all = !applyWrap.hidden && applyBox.checked;
                    withUndo((res) => (res.changed > 1 ? 'Moved ' + res.changed + ' ' + cur.merchant + ' transactions to ' + name : 'Moved ' + cur.merchant + ' to ' + name), () => Store.setCategory(id, name, { applyToSimilar: all }));
                },
            });
        });

        incomeBox.addEventListener('change', () => {
            Store.setIncome(id, incomeBox.checked);
            toast(incomeBox.checked ? 'Now counted as income.' : 'No longer counted as income.', 'success');
        });
        noteArea.addEventListener('blur', saveNote);

        function doDelete() {
            const t = Store.transaction(id);
            if (!t) return;
            UI.confirm({
                title: 'Delete this transaction?',
                message: t.merchant + ' for ' + money(t.absAmount) + ' will move to Trash. You can restore it from there.',
                confirmLabel: 'Delete',
                danger: true,
            }).then((ok) => {
                if (!ok) return;
                saveNote();
                Store.deleteTransactions([id], {});
                if (ctx) ctx.close();
            });
        }

        ctx = UI.sheet({
            title: first.merchant,
            body: body,
            size: 'md',
            onClose: () => {
                saveNote();
                if (unsub) unsub();
            },
            actions: [
                { label: 'Delete', variant: 'danger', closes: false, onClick: doDelete },
                { label: 'Done', variant: 'primary' },
            ],
        });
        update(true);
        unsub = Store.onChange(() => update(false));
        return ctx;
    }

    function openAddTransaction(prefill) {
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        const p = prefill || {};
        let kind = p.kind === 'income' ? 'income' : 'expense';
        let category = p.category || null;
        const form = el('form', 'txs-form');
        form.noValidate = true;

        const seg = el('div', 'txs-seg');
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', 'Type');
        const segBtns = {};
        [['expense', 'Expense'], ['income', 'Income']].forEach((x) => {
            const b = el('button', 'txs-seg-btn', x[1]);
            b.type = 'button';
            b.setAttribute('aria-pressed', String(kind === x[0]));
            b.addEventListener('click', () => {
                kind = x[0];
                Object.keys(segBtns).forEach((k) => segBtns[k].setAttribute('aria-pressed', String(k === kind)));
                refreshCat();
            });
            segBtns[x[0]] = b;
            seg.appendChild(b);
        });
        form.appendChild(seg);

        const amount = el('input', 'input txs-amount-input num');
        amount.id = 'txsAddAmount';
        amount.inputMode = 'decimal';
        amount.autocomplete = 'off';
        amount.placeholder = '0.00';
        if (p.amount) amount.value = String(p.amount);
        form.appendChild(fieldWrap('txsAddAmount', 'Amount', amount));

        const name = el('input', 'input');
        name.id = 'txsAddName';
        name.maxLength = 140;
        name.autocomplete = 'off';
        name.placeholder = 'For example, Farmers market';
        if (p.description) name.value = p.description;
        form.appendChild(fieldWrap('txsAddName', 'Name', name));

        const date = el('input', 'input');
        date.id = 'txsAddDate';
        date.type = 'date';
        date.value = p.date || Store.isoDate(new Date());
        form.appendChild(fieldWrap('txsAddDate', 'Date', date));

        const catField = el('div', 'field');
        const catLabel = el('span', 'txs-field-label', 'Category');
        catLabel.id = 'txsAddCatLabel';
        const catBtn = el('button', 'txs-cat-row');
        catBtn.type = 'button';
        catBtn.setAttribute('aria-labelledby', 'txsAddCatLabel txsAddCatValue');
        catField.appendChild(catLabel);
        catField.appendChild(catBtn);
        form.appendChild(catField);

        function refreshCat() {
            const shown = category || (kind === 'income' ? 'Income' : null);
            catBtn.innerHTML = (shown ? chip(shown, 36) : '') + '<span class="txs-cat-text"><span class="txs-cat-name" id="txsAddCatValue">' + esc(shown || 'Choose later (it will wait in Needs a category)') + '</span></span>' + icon('chevron-right', 18);
        }
        refreshCat();
        catBtn.addEventListener('click', () => {
            openCategoryPicker({
                current: category,
                onPick: (n) => {
                    category = n;
                    refreshCat();
                },
            });
        });

        const note = el('textarea', 'textarea');
        note.id = 'txsAddNote';
        note.rows = 2;
        note.maxLength = 500;
        if (p.note) note.value = p.note;
        form.appendChild(fieldWrap('txsAddNote', 'Note (optional)', note));

        let ctx = null;
        function submit() {
            const amt = parseAmount(amount.value);
            const nm = name.value.trim();
            showFieldError(amount, amt > 0 ? '' : 'Enter an amount greater than zero.');
            showFieldError(name, nm ? '' : 'Add a name so you can find it later.');
            showFieldError(date, date.value ? '' : 'Pick a date.');
            if (amt <= 0) return amount.focus();
            if (!nm) return name.focus();
            if (!date.value) return date.focus();
            const res = Store.addTransaction({ date: date.value, description: nm, amount: amt, kind: kind, category: category || undefined, note: note.value.trim() });
            if (!res.ok) {
                if (ctx) ctx.setError(res.error || 'Could not add this transaction.');
                return;
            }
            if (ctx) ctx.close();
            const newId = res.id;
            toast('Added ' + nm + ' for ' + money(amt), 'success', {
                label: 'View',
                onClick: () => {
                    if (document.body.dataset.page === 'transactions') openTransactionSheet(newId);
                    else window.location.href = 'transactions.html?id=' + encodeURIComponent(newId);
                },
            });
        }
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submit();
        });
        const hiddenSubmit = el('button', 'visually-hidden');
        hiddenSubmit.type = 'submit';
        hiddenSubmit.tabIndex = -1;
        hiddenSubmit.setAttribute('aria-hidden', 'true');
        form.appendChild(hiddenSubmit);

        ctx = UI.sheet({
            title: 'Add transaction',
            subtitle: 'For cash, or anything that is not in a bank file.',
            body: form,
            size: 'md',
            initialFocus: '#txsAddAmount',
            actions: [
                { label: 'Cancel', variant: 'ghost' },
                { label: 'Add', variant: 'primary', closes: false, onClick: submit },
            ],
        });
        return ctx;
    }

    function guessCategories(t) {
        const out = [];
        const word = String(Store.merchantPattern(t.description) || '').split(' ')[0];
        if (!word || word.length < 3) return out;
        const counts = {};
        Store.allTransactions().forEach((x) => {
            if (x.needsReview || x.isIncome || x.id === t.id) return;
            if (String(x.description || '').toUpperCase().includes(word.toUpperCase())) counts[x.category] = (counts[x.category] || 0) + 1;
        });
        Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 2).forEach((c) => out.push(c));
        return out;
    }

    function topCategories() {
        const counts = {};
        Store.allTransactions().forEach((x) => {
            if (x.needsReview || x.isIncome || x.isTransfer) return;
            counts[x.category] = (counts[x.category] || 0) + 1;
        });
        return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
    }

    function openReviewFlow(options) {
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        const o = options || {};
        const filter = o.monthKey ? { monthKey: o.monthKey } : {};
        const queue = Store.transactions(filter).filter((t) => t.needsReview).map((t) => t.id);
        const body = el('div', 'txs-review');
        let ctx = null;
        let index = 0;
        let assigned = 0;
        const total = queue.length;

        function nextIndex(from) {
            for (let i = from; i < queue.length; i++) {
                const t = Store.transaction(queue[i]);
                if (t && t.needsReview) return i;
            }
            return -1;
        }

        function renderDone() {
            body.textContent = '';
            const wrap = el('div', 'txs-done');
            wrap.setAttribute('role', 'status');
            wrap.appendChild(el('h3', 'txs-done-title', 'All caught up'));
            wrap.appendChild(el('p', 'muted', total === 0 ? 'Every transaction already has a category.' : assigned + (assigned === 1 ? ' transaction sorted.' : ' transactions sorted.') + ' Nice work.'));
            body.appendChild(wrap);
        }

        function renderCard() {
            const at = nextIndex(index);
            if (at === -1) return renderDone();
            index = at;
            const t = Store.transaction(queue[index]);
            body.textContent = '';
            const prog = el('div', 'txs-review-progress');
            const label = el('p', 'txs-review-count muted', (index + 1) + ' of ' + total);
            label.setAttribute('aria-live', 'polite');
            const bar = el('div', 'txs-review-bar');
            const fill = el('div', 'txs-review-fill');
            fill.style.width = Math.round(((index + 1) / total) * 100) + '%';
            bar.appendChild(fill);
            prog.appendChild(label);
            prog.appendChild(bar);
            body.appendChild(prog);

            const card = el('div', 'txs-review-card');
            card.appendChild(el('h3', 'txs-review-merchant', t.merchant));
            const amt = el('p', 'txs-review-amount num');
            amt.innerHTML = '<span class="money">' + esc(money(t.absAmount)) + '</span>';
            card.appendChild(amt);
            card.appendChild(el('p', 'muted', dateText(t)));
            if (t.description && t.description.toLowerCase() !== t.merchant.toLowerCase()) card.appendChild(el('p', 'subtle txs-review-desc', t.description));
            body.appendChild(card);

            const always = el('label', 'txs-check');
            const box = el('input');
            box.type = 'checkbox';
            box.checked = true;
            always.appendChild(box);
            always.appendChild(el('span', null, 'Always do this for ' + t.merchant));
            body.appendChild(always);

            const guesses = guessCategories(t);
            const names = [];
            guesses.concat(topCategories()).forEach((n) => {
                if (n !== 'Others' && !names.includes(n) && Store.categories({ includeIncome: true }).some((c) => c.name === n)) names.push(n);
            });
            const grid = el('div', 'txs-review-grid');
            grid.setAttribute('role', 'group');
            grid.setAttribute('aria-label', 'Suggested categories');
            names.slice(0, 8).forEach((n, i) => {
                const b = el('button', 'txs-review-pick');
                b.type = 'button';
                b.innerHTML = chip(n, 32) + '<span>' + esc(n) + '</span>' + (guesses.includes(n) ? '<span class="badge">Suggested</span>' : '');
                b.setAttribute('aria-keyshortcuts', String(i + 1));
                b.addEventListener('click', () => assign(t, n, box.checked));
                grid.appendChild(b);
            });
            body.appendChild(grid);

            const row = el('div', 'txs-review-actions');
            const more = el('button', 'btn btn-secondary', 'More categories');
            more.type = 'button';
            more.addEventListener('click', () => {
                openCategoryPicker({ title: 'Category for ' + t.merchant, onPick: (n) => assign(t, n, box.checked) });
            });
            const skip = el('button', 'btn btn-ghost', 'Skip');
            skip.type = 'button';
            skip.addEventListener('click', () => {
                index++;
                renderCard();
            });
            row.appendChild(more);
            row.appendChild(skip);
            body.appendChild(row);
            const firstBtn = grid.querySelector('button') || more;
            firstBtn.focus();
        }

        function assign(t, name, rule) {
            const res = Store.setCategory(t.id, name, { applyToSimilar: rule });
            assigned += Math.max(res.changed, 1);
            toast(res.changed > 1 ? 'Moved ' + res.changed + ' ' + t.merchant + ' transactions to ' + name : 'Moved ' + t.merchant + ' to ' + name, 'success');
            index++;
            renderCard();
        }

        body.addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= 8) {
                const btn = body.querySelectorAll('.txs-review-pick')[n - 1];
                if (btn) {
                    e.preventDefault();
                    btn.click();
                }
            }
        });

        ctx = UI.sheet({
            title: 'Sort what is left',
            subtitle: total ? 'Pick a category for each one.' : null,
            body: body,
            size: 'md',
            actions: [{ label: 'Close', variant: 'primary' }],
        });
        if (total === 0) renderDone();
        else renderCard();
        return ctx;
    }

    window.openTransactionSheet = openTransactionSheet;
    window.openAddTransaction = openAddTransaction;
    window.openCategoryPicker = openCategoryPicker;
    window.openReviewFlow = openReviewFlow;
})();
