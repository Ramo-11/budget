(function () {
    const CADENCES = [
        ['weekly', 'Every week'],
        ['every two weeks', 'Every two weeks'],
        ['monthly', 'Every month'],
        ['every three months', 'Every three months'],
        ['every six months', 'Every six months'],
        ['yearly', 'Every year'],
    ];

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text != null) e.textContent = text;
        return e;
    }

    function esc(s) {
        return UI.esc(s);
    }

    function field(id, label, control, hint) {
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

    function showError(control, message) {
        const err = document.getElementById(control.id + 'Error');
        if (!err) return;
        err.textContent = message || '';
        err.hidden = !message;
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
    }

    function parseAmount(value) {
        const n = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    }

    function matchSummary(pattern) {
        const needle = typeof normalizeMatchText === 'function' ? normalizeMatchText(pattern) : String(pattern || '').toUpperCase();
        if (!needle) return null;
        let count = 0;
        let last = null;
        Store.allTransactions().forEach((t) => {
            if (t.isIncome || t.isTransfer) return;
            const hay = typeof normalizeMatchText === 'function' ? normalizeMatchText(t.description) : String(t.description || '').toUpperCase();
            if (!hay.includes(needle)) return;
            count++;
            if (t.date && !isNaN(t.date) && (!last || t.date > last.date)) last = t;
        });
        return { count: count, last: last };
    }

    function openMembershipSheet(prefill) {
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        const p = prefill || {};
        const editing = !!p.id;
        let category = p.category || 'Subscriptions';
        let ctx = null;

        const form = el('form', 'mem-form');
        form.noValidate = true;

        const name = el('input', 'input');
        name.id = 'memName';
        name.maxLength = 80;
        name.autocomplete = 'off';
        name.placeholder = 'For example, Streaming service';
        name.value = p.name || '';
        form.appendChild(field('memName', 'Name', name));

        const amount = el('input', 'input num');
        amount.id = 'memAmount';
        amount.inputMode = 'decimal';
        amount.autocomplete = 'off';
        amount.placeholder = '0.00';
        if (p.amount) amount.value = Number(p.amount).toFixed(2);
        form.appendChild(field('memAmount', 'Amount', amount));

        const cadence = el('select', 'select');
        cadence.id = 'memCadence';
        CADENCES.forEach((c) => {
            const o = el('option', null, c[1]);
            o.value = c[0];
            cadence.appendChild(o);
        });
        cadence.value = CADENCES.some((c) => c[0] === p.cadence) ? p.cadence : 'monthly';
        form.appendChild(field('memCadence', 'How often', cadence));

        const next = el('input', 'input');
        next.id = 'memNext';
        next.type = 'date';
        next.value = p.nextDate || '';
        form.appendChild(field('memNext', 'Next charge date (optional)', next));

        const catField = el('div', 'field');
        const catLabel = el('span', 'mem-label', 'Category');
        catLabel.id = 'memCatLabel';
        const catBtn = el('button', 'btn btn-secondary mem-cat');
        catBtn.type = 'button';
        catBtn.setAttribute('aria-labelledby', 'memCatLabel memCatValue');
        catField.appendChild(catLabel);
        catField.appendChild(catBtn);
        form.appendChild(catField);
        function refreshCat() {
            catBtn.innerHTML = UI.chip(category, { size: 28 }) + '<span id="memCatValue">' + esc(category) + '</span>';
        }
        refreshCat();
        catBtn.addEventListener('click', () => {
            if (typeof window.openCategoryPicker !== 'function') return;
            window.openCategoryPicker({
                current: category,
                onPick: (n) => {
                    category = n;
                    refreshCat();
                },
            });
        });

        const pattern = el('input', 'input');
        pattern.id = 'memPattern';
        pattern.maxLength = 80;
        pattern.autocomplete = 'off';
        pattern.value = p.pattern || '';
        const patField = field('memPattern', 'Match charges that contain', pattern);
        const live = el('p', 'mem-live muted');
        live.setAttribute('aria-live', 'polite');
        patField.insertBefore(live, patField.querySelector('.field-error'));
        patField.insertBefore(el('p', 'field-hint subtle', 'Charges that match are linked to this membership, so the app learns its real amount and timing.'), live);
        form.appendChild(patField);

        function refreshLive() {
            const s = matchSummary(pattern.value);
            if (!s) {
                live.textContent = 'Add a word from the bank description to link charges.';
            } else if (!s.count) {
                live.textContent = 'No charges match yet. It will start matching on your next import.';
            } else {
                const when = s.last ? s.last.date.toLocaleDateString(Store.prefs().locale, { month: 'short', day: 'numeric' }) : '';
                live.textContent = 'Matches ' + s.count + (s.count === 1 ? ' charge' : ' charges') + (s.last ? ', last one ' + when + ' for ' + Store.money(s.last.absAmount) : '');
            }
        }
        refreshLive();
        pattern.addEventListener('input', refreshLive);

        function save() {
            const nm = name.value.trim();
            const amt = parseAmount(amount.value);
            showError(name, nm ? '' : 'Give it a name.');
            showError(amount, amt > 0 ? '' : 'Enter how much it costs.');
            if (!nm || amt <= 0) {
                (nm ? amount : name).focus();
                return false;
            }
            const res = Store.saveSubscription({
                id: p.id,
                name: nm,
                amount: amt,
                cadence: cadence.value,
                nextDate: next.value || null,
                category: category,
                pattern: pattern.value,
                replacesKey: p.replacesKey,
            });
            if (!res.ok) {
                showError(name, res.error || 'Could not save. Please try again.');
                return false;
            }
            UI.toast('Membership saved', { type: 'success' });
            return true;
        }

        function stopTracking() {
            const item = Store.subscriptions().find((s) => s.manual && s.id === p.id);
            const saved = item
                ? { name: item.label, amount: item.avgAmount, cadence: item.cadence, nextDate: item.nextDate && item.nextDate.getTime ? Store.isoDate(item.nextDate) : item.nextDate || null, category: item.category, pattern: item.pattern }
                : { name: p.name, amount: p.amount, cadence: p.cadence, nextDate: p.nextDate || null, category: p.category, pattern: p.pattern };
            Store.deleteSubscription(p.id);
            UI.toast('Stopped tracking ' + (saved.name || 'membership'), {
                type: 'info',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        Store.saveSubscription(saved);
                    },
                },
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (save() && ctx) ctx.close();
        });

        const actions = [];
        if (editing) actions.push({ label: 'Stop tracking', variant: 'danger', onClick: stopTracking });
        actions.push({ label: 'Cancel', variant: 'ghost' });
        actions.push({ label: 'Save', variant: 'primary', closes: false, onClick: () => (save() ? ctx.close() : false) });

        ctx = UI.sheet({
            title: p.title || (editing ? 'Edit membership' : 'Add membership'),
            body: form,
            size: 'md',
            initialFocus: '#memName',
            actions: actions,
        });
        return ctx;
    }

    window.openMembershipSheet = openMembershipSheet;
})();
