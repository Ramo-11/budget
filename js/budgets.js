(function () {
    const MONTH_KEY = 'sahabBudget_budgetsMonth';
    const SORT_KEY = 'sahabBudget_budgetsSort';
    const PALETTE = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-9', 'cat-11', 'cat-14', 'cat-15', 'cat-16'];

    let monthKey = null;
    let sort = 'used';
    let stepper = null;

    const esc = (t) => (typeof UI !== 'undefined' && UI.esc ? UI.esc(t) : escapeHtml(String(t == null ? '' : t)));
    const money = (n, o) => `<span class="money num">${esc(Store.money(n, Object.assign({ cents: 'auto' }, o || {})))}</span>`;
    const moneyText = (n) => Store.money(n, { cents: 'auto' });
    const icon = (name, size) => (typeof UI !== 'undefined' && UI.icon ? UI.icon(name, size) : '');
    const toast = (m, type) => {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(m, { type: type || 'success' });
        else if (typeof showNotification === 'function') showNotification(m, type || 'success');
    };
    const $ = (sel, root) => (root || document).querySelector(sel);

    function safeGet(k) {
        try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; }
    }
    function safeSet(k, v, local) {
        try { (local ? localStorage : sessionStorage).setItem(k, v); } catch (e) { void e; }
    }

    function monthChoices() {
        const cur = Store.currentMonthKey();
        const set = new Set(Store.monthKeys().concat([cur, Store.shiftMonth(cur, 1)]));
        if (monthKey) set.add(monthKey);
        return Array.from(set).sort().reverse();
    }

    function initialMonth() {
        const q = new URLSearchParams(location.search).get('month');
        if (q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q)) return q;
        const s = safeGet(MONTH_KEY);
        if (s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
        const cur = Store.currentMonthKey();
        const latest = Store.latestMonthKey();
        if (latest && latest < cur && !Store.transactions({ monthKey: cur }).length && !Object.keys(Store.budgetsFor(cur)).length) return latest;
        return cur;
    }

    function parseAmount(text) {
        const n = parseFloat(String(text || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    }

    function friendly(n) {
        if (n <= 0) return 0;
        const step = n < 50 ? 5 : n < 1000 ? 10 : 50;
        return Math.ceil(n / step) * step;
    }

    function spendCats() {
        return Store.categories().filter((c) => !c.isExcluded);
    }

    function rowsData() {
        const sum = Store.summary(monthKey);
        return spendCats().map((c) => {
            const spent = sum.byCategory[c.name] || 0;
            const b = Store.budget(monthKey, c.name);
            return {
                name: c.name,
                spent: spent,
                amount: b.amount,
                carry: b.carry,
                effective: b.effective,
                left: b.effective - spent,
                ratio: b.effective > 0 ? spent / b.effective : 0,
                over: b.effective > 0 && spent > b.effective + 0.005,
            };
        });
    }

    function sortRows(list) {
        const l = list.slice();
        if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'over') l.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));
        else l.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
        return l;
    }

    function rowHtml(r) {
        const chip = typeof UI !== 'undefined' && UI.chip ? UI.chip(r.name) : '';
        let sub;
        let trail;
        let bar = '';
        if (r.effective > 0) {
            sub = `${money(r.spent)} of ${money(r.effective)}`;
            if (r.carry > 0) sub += ` <span class="bg-carry">(includes ${money(r.carry)} carried over)</span>`;
            bar = typeof UI !== 'undefined' && UI.progress ? UI.progress(r.ratio, { tone: 'auto', label: `${r.name} budget used` }) : '';
            trail = r.over
                ? `<span class="bg-left is-over">${money(-r.left, {})}</span><span class="bg-left-sub">over by</span>`
                : `<span class="bg-left">${money(r.left)}</span><span class="bg-left-sub">left</span>`;
        } else {
            const avg = Store.averageSpend(r.name, 3);
            if (r.spent > 0) sub = `${money(r.spent)} spent this month`;
            else if (avg > 0) sub = `About ${money(avg)} a month`;
            else sub = 'Nothing spent yet';
            trail = `<span class="btn btn-secondary btn-sm">Set budget</span>`;
        }
        return `<li><button type="button" class="bg-row" data-cat="${esc(r.name)}" aria-label="Edit ${esc(r.name)} budget">
            <span>${chip}</span>
            <span class="bg-row-main"><span class="bg-row-title">${esc(r.name)}</span><span class="bg-row-sub">${sub}</span>${bar}</span>
            <span class="bg-row-trail">${trail}</span></button></li>`;
    }

    function daysInfo() {
        if (monthKey !== Store.currentMonthKey()) return null;
        const now = new Date();
        const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return { left: total - now.getDate() + 1 };
    }

    function summaryHtml(rows) {
        const budgeted = rows.filter((r) => r.effective > 0);
        const total = budgeted.reduce((s, r) => s + r.effective, 0);
        const budgetedSpent = budgeted.reduce((s, r) => s + r.spent, 0);
        const spent = Store.summary(monthKey).spent;
        const unbudgeted = Math.max(0, spent - budgetedSpent);
        const left = total - spent;
        const overCount = budgeted.filter((r) => r.over).length;
        if (!budgeted.length) {
            return `<section class="card bg-summary" aria-label="Budget summary"><div><div class="bg-hero-label">Planned for ${esc(Store.monthLabel(monthKey))}</div><div class="bg-hero-value">${money(0)}</div></div>
                <p class="muted">No budgets yet. Set one for each category, or let us suggest them from your recent spending.</p></section>`;
        }
        const d = daysInfo();
        const foot = [];
        if (d && spent === 0 && Store.hasData() && !Store.transactions({ monthKey: monthKey }).length) foot.push('Nothing spent yet this month');
        if (d) {
            foot.push(`${d.left} ${d.left === 1 ? 'day' : 'days'} left this month`);
            if (left > 0) foot.push(`About ${money(left / d.left)} a day to stay on track`);
        }
        if (unbudgeted > 0.005) foot.push(`Includes ${money(unbudgeted)} spent in categories without a budget`);
        foot.push(overCount ? `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over budget` : 'Nothing is over budget');
        const over = left < 0;
        return `<section class="card bg-summary" aria-label="Budget summary">
            <div class="bg-summary-top">
              <div><div class="bg-hero-label">${over ? 'Over budget by' : 'Left to spend'}</div>
              <div class="bg-hero-value ${over ? 'is-over' : ''}">${money(Math.abs(left))}</div></div>
              <div class="bg-stats">
                <div><div class="bg-hero-label">Budgeted</div><div class="bg-stat-value">${money(total)}</div></div>
                <div><div class="bg-hero-label">Spent</div><div class="bg-stat-value">${money(spent)}</div></div>
              </div>
            </div>
            ${typeof UI !== 'undefined' && UI.progress ? UI.progress(total > 0 ? spent / total : 0, { tone: 'auto', label: 'Total budget used' }) : ''}
            <div class="bg-summary-foot">${foot.map((f) => `<span>${f}</span>`).join('')}</div></section>`;
    }

    function rolloverHtml() {
        const on = window.incomeSettings && window.incomeSettings.carryUnusedBudget === true;
        return `<section class="card bg-toggle"><div class="bg-toggle-text"><label class="bg-toggle-title" for="carryToggle">Carry unused money into next month</label>
            <span class="bg-toggle-sub" id="carryHint">Whatever you do not spend in a category is added to that category next month.</span></div>
            <input type="checkbox" role="switch" class="switch" id="carryToggle" aria-describedby="carryHint" ${on ? 'checked' : ''}></section>`;
    }

    function listHtml(rows) {
        const budgeted = sortRows(rows.filter((r) => r.effective > 0));
        const none = rows.filter((r) => !(r.effective > 0)).sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
        if (sort === 'az') none.sort((a, b) => a.name.localeCompare(b.name));
        let body = '';
        if (!rows.length) {
            body = '<p class="muted">No categories yet. Add some in Settings.</p>';
        } else {
            if (budgeted.length) body += `<h3 class="bg-group-title">With a budget</h3><ul class="bg-rows">${budgeted.map(rowHtml).join('')}</ul>`;
            if (none.length) body += `<h3 class="bg-group-title">No budget</h3><ul class="bg-rows">${none.map(rowHtml).join('')}</ul>`;
        }
        const noData = !Store.hasData()
            ? `<div class="card" id="noDataCard"><p class="muted" style="margin:0 0 12px">Import your bank transactions to see how much you have spent against each budget. You can set budgets now.</p><button type="button" class="btn btn-secondary" data-act="import">Import transactions</button></div>`
            : '';
        return `${noData}<section class="card" aria-labelledby="catTitle"><div class="bg-list-head"><h2 id="catTitle">Category budgets</h2>
            <label class="bg-sort"><span>Sort by</span> <select class="select" id="sortSelect">
              <option value="used" ${sort === 'used' ? 'selected' : ''}>Most used</option>
              <option value="over" ${sort === 'over' ? 'selected' : ''}>Over budget first</option>
              <option value="az" ${sort === 'az' ? 'selected' : ''}>A to Z</option></select></label></div>${body}</section>`;
    }

    function ringSvg(progress, color) {
        const r = 30;
        const c = 2 * Math.PI * r;
        return `<svg viewBox="0 0 72 72" aria-hidden="true"><circle class="bg-ring-track" cx="36" cy="36" r="${r}" fill="none" stroke-width="8"></circle>
            <circle class="bg-ring-bar" cx="36" cy="36" r="${r}" fill="none" stroke-width="8" stroke-linecap="round" stroke="${color}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - progress)).toFixed(2)}"></circle></svg>`;
    }

    function goalColor(g) {
        return PALETTE.indexOf(g.color) !== -1 ? `var(--${g.color})` : 'var(--brand)';
    }

    function goalHtml(g) {
        const pct = Math.round(g.progress * 100);
        let plan = '';
        if (g.isComplete) plan = '<span class="bg-done">Goal reached. Well done.</span>';
        else if (g.targetDate && g.monthlyNeeded != null) {
            const when = parseLocalDate(g.targetDate).toLocaleDateString(Store.prefs().locale, { month: 'long', year: 'numeric' });
            plan = `Save ${money(g.monthlyNeeded)} a month to reach it by ${esc(when)}.`;
        } else plan = `${money(g.remaining)} to go.`;
        return `<article class="card bg-goal ${g.isComplete ? 'is-complete' : ''}" aria-label="${esc(g.name)}">
            <div class="bg-goal-top"><div class="bg-ring">${ringSvg(g.progress, goalColor(g))}<span class="bg-ring-pct">${pct}%</span></div>
            <div><div class="bg-goal-name">${esc(g.name)}</div><div class="bg-goal-sub">${money(g.saved)} of ${money(g.target)}</div></div></div>
            <div class="bg-goal-plan">${plan}</div>
            <div class="bg-goal-actions" data-goal="${esc(g.id)}">
              <button type="button" class="btn btn-secondary btn-sm" data-act="goal-add">Add money</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="goal-withdraw" ${g.saved > 0 ? '' : 'disabled'}>Withdraw</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="goal-edit">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="goal-delete">Delete</button>
            </div></article>`;
    }

    function goalsHtml() {
        const goals = Store.goals();
        if (!goals.length) {
            return `<section class="card" aria-labelledby="goalsTitle"><h2 id="goalsTitle" class="visually-hidden">Savings goals</h2>
                <div class="empty-state"><h3>Saving for something?</h3><p class="muted">Set a goal and watch it grow.</p>
                <button type="button" class="btn btn-primary" data-act="goal-new">Create a goal</button></div></section>`;
        }
        return `<section aria-labelledby="goalsTitle"><div class="bg-goals-head"><h2 id="goalsTitle">Savings goals</h2>
            <button type="button" class="btn btn-secondary btn-sm" data-act="goal-new">New goal</button></div>
            <div class="bg-goal-grid">${goals.map(goalHtml).join('')}</div></section>`;
    }

    function render() {
        const host = $('#budgetsContent');
        if (!host) return;
        const focusId = document.activeElement && document.activeElement.id;
        const rows = rowsData();
        host.innerHTML = summaryHtml(rows) + rolloverHtml() + listHtml(rows) + goalsHtml();
        host.removeAttribute('aria-busy');
        const sub = $('#budgetsSub');
        if (sub) sub.textContent = `Plan your spending for ${Store.monthLabel(monthKey)}.`;
        if (focusId) {
            const el = document.getElementById(focusId);
            if (el && host.contains(el)) el.focus();
        }
        if (stepper && stepper.set) stepper.set(monthKey);
    }

    function setMonth(key) {
        monthKey = key;
        safeSet(MONTH_KEY, key);
        render();
    }

    function snap() {
        return typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
    }

    function undoable(message, snapshot) {
        if (snapshot && typeof showUndo === 'function' && typeof restoreActiveData === 'function') {
            showUndo(message, () => restoreActiveData(snapshot), { reloadOnUndo: true });
        } else toast(message);
    }

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function lastMonthSpend(name) {
        return Store.summary(Store.shiftMonth(monthKey, -1)).byCategory[name] || 0;
    }

    function openEditor(name) {
        if (typeof UI === 'undefined' || !UI.sheet) return;
        const b = Store.budget(monthKey, name);
        const avg = Store.averageSpend(name, 3);
        const last = lastMonthSpend(name);
        const wrap = el('div', 'bg-sheet');

        const field = el('div', 'field');
        const label = el('label', null, 'Monthly budget');
        label.htmlFor = 'bgAmount';
        const input = el('input', 'input bg-amount');
        input.id = 'bgAmount';
        input.type = 'text';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.placeholder = '0';
        input.value = b.amount > 0 ? String(b.amount) : '';
        const err = el('div', 'field-error');
        err.id = 'bgAmountErr';
        err.setAttribute('role', 'alert');
        err.hidden = true;
        input.setAttribute('aria-describedby', 'bgAmountErr');
        field.append(label, input, err);
        wrap.appendChild(field);

        if (avg > 0 || last > 0) {
            const sg = el('div', 'bg-suggest');
            if (avg > 0) {
                const t = el('span');
                t.innerHTML = `Your 3 month average is ${money(avg)}`;
                sg.appendChild(t);
                const bt = el('button', 'btn btn-secondary btn-sm', 'Use average');
                bt.type = 'button';
                bt.addEventListener('click', () => { input.value = String(friendly(avg)); input.focus(); });
                sg.appendChild(bt);
            }
            if (last > 0) {
                const bt = el('button', 'btn btn-secondary btn-sm', `Use last month (${moneyText(last)})`);
                bt.type = 'button';
                bt.addEventListener('click', () => { input.value = String(Math.round(last)); input.focus(); });
                sg.appendChild(bt);
            }
            wrap.appendChild(sg);
        }

        const scope = el('fieldset', 'bg-scope');
        scope.appendChild(el('legend', null, 'Apply to'));
        [['month', 'Just this month'], ['forward', 'This month and future months'], ['all', 'Every month']].forEach(([v, t]) => {
            const l = el('label', 'bg-radio');
            const r = el('input');
            r.type = 'radio';
            r.name = 'bgScope';
            r.value = v;
            r.checked = v === 'forward';
            l.append(r, el('span', null, t));
            scope.appendChild(l);
        });
        wrap.appendChild(scope);

        const hist = el('div', 'bg-history');
        hist.appendChild(el('h3', null, 'Last 6 months'));
        for (let i = 1; i <= 6; i++) {
            const mk = Store.shiftMonth(monthKey, -i);
            const spent = Store.summary(mk).byCategory[name] || 0;
            const bud = Store.budget(mk, name).amount;
            const row = el('div', 'bg-hist-row');
            row.appendChild(el('span', null, Store.monthLabel(mk, { short: true })));
            const barBox = el('span');
            barBox.innerHTML = UI.progress ? UI.progress(bud > 0 ? spent / bud : spent > 0 ? 1 : 0, { tone: bud > 0 ? 'auto' : 'brand', label: `${Store.monthLabel(mk)} spending` }) : '';
            row.appendChild(barBox);
            const num = el('span', 'num');
            num.innerHTML = bud > 0 ? `${money(spent)} of ${money(bud)}` : `${money(spent)}, no budget`;
            row.appendChild(num);
            hist.appendChild(row);
        }
        wrap.appendChild(hist);

        const link = el('a', 'bg-link', 'View transactions');
        link.href = `transactions.html?month=${encodeURIComponent(monthKey)}&category=${encodeURIComponent(name)}`;
        wrap.appendChild(link);

        const actions = [
            {
                label: 'Save budget',
                variant: 'primary',
                closes: false,
                onClick(ctx) {
                    const v = parseAmount(input.value);
                    if (!v) {
                        err.textContent = b.amount > 0 ? 'Enter an amount, or choose Remove budget.' : 'Enter how much you plan to spend.';
                        err.hidden = false;
                        input.setAttribute('aria-invalid', 'true');
                        input.focus();
                        return;
                    }
                    const sc = scope.querySelector('input:checked').value;
                    Store.setBudget(name, v, { monthKey: monthKey, scope: sc });
                    ctx.close();
                    toast(`${name} budget saved`);
                },
            },
        ];
        if (b.amount > 0) {
            actions.push({
                label: 'Remove budget',
                variant: 'danger',
                closes: false,
                onClick(ctx) {
                    const sc = scope.querySelector('input:checked').value;
                    const s = snap();
                    Store.setBudget(name, 0, { monthKey: monthKey, scope: sc });
                    ctx.close();
                    undoable(`${name} budget removed`, s);
                },
            });
        }
        actions.push({ label: 'Cancel', variant: 'ghost' });
        UI.sheet({ title: `${name} budget`, subtitle: Store.monthLabel(monthKey), body: wrap, actions: actions, size: 'md', initialFocus: '#bgAmount' });
    }

    function openSetup() {
        if (typeof UI === 'undefined' || !UI.sheet) return;
        const proposals = spendCats()
            .map((c) => {
                const avg = Store.averageSpend(c.name, 3);
                return { name: c.name, avg: avg, value: friendly(avg), has: Store.budget(monthKey, c.name).amount > 0 };
            })
            .filter((p) => p.value > 0);

        const wrap = el('div', 'bg-sheet');
        if (!proposals.length) {
            wrap.appendChild(el('p', 'muted', 'There is not enough spending history to suggest budgets yet. Import a few months of transactions, or set budgets one at a time.'));
            UI.sheet({
                title: 'Set up budgets for me',
                body: wrap,
                size: 'md',
                actions: [
                    { label: 'Import transactions', variant: 'primary', onClick() { if (typeof window.openImport === 'function') window.openImport(); } },
                    { label: 'Close', variant: 'ghost' },
                ],
            });
            return;
        }
        wrap.appendChild(el('p', 'muted', 'Based on your average spending over the last 3 months, rounded up. Change any amount or untick what you do not want to budget.'));
        const list = el('div', 'bg-setup-list');
        const rows = proposals.map((p, i) => {
            const row = el('div', 'bg-setup-row');
            const cw = el('div', 'bg-setup-check');
            const cb = el('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.id = `bgs-c-${i}`;
            cb.setAttribute('aria-label', `Include ${p.name}`);
            cw.appendChild(cb);
            const nm = el('label', 'bg-setup-name');
            nm.htmlFor = `bgs-i-${i}`;
            nm.innerHTML = (UI.chip ? UI.chip(p.name) : '') + `<span class="bg-setup-text"><span class="bg-row-title">${esc(p.name)}</span>${p.has ? `<span class="bg-carry">Now ${money(Store.budget(monthKey, p.name).amount)}</span>` : ''}</span>`;
            const inp = el('input', 'input');
            inp.id = `bgs-i-${i}`;
            inp.type = 'text';
            inp.inputMode = 'decimal';
            inp.value = String(p.value);
            inp.setAttribute('aria-label', `${p.name} monthly budget`);
            row.append(cw, nm, inp);
            list.appendChild(row);
            return { p, cb, inp };
        });
        wrap.appendChild(list);
        const total = el('div', 'bg-setup-total');
        const tl = el('span', null, 'Total per month');
        const tv = el('span', 'money num');
        total.append(tl, tv);
        wrap.appendChild(total);
        const err = el('div', 'field-error');
        err.setAttribute('role', 'alert');
        err.hidden = true;
        wrap.appendChild(err);
        const upd = () => {
            tv.textContent = moneyText(rows.reduce((s, r) => s + (r.cb.checked ? parseAmount(r.inp.value) : 0), 0));
        };
        wrap.addEventListener('input', upd);
        wrap.addEventListener('change', upd);
        upd();

        UI.sheet({
            title: 'Set up budgets for me',
            subtitle: 'Applies to this month and future months',
            body: wrap,
            size: 'lg',
            actions: [
                {
                    label: 'Apply budgets',
                    variant: 'primary',
                    closes: false,
                    onClick(ctx) {
                        const chosen = rows.filter((r) => r.cb.checked && parseAmount(r.inp.value) > 0);
                        if (!chosen.length) {
                            err.textContent = 'Pick at least one category with an amount.';
                            err.hidden = false;
                            return;
                        }
                        const s = snap();
                        chosen.forEach((r) => Store.setBudget(r.p.name, parseAmount(r.inp.value), { monthKey: monthKey, scope: 'forward' }));
                        ctx.close();
                        undoable(`${chosen.length} ${chosen.length === 1 ? 'budget' : 'budgets'} set`, s);
                    },
                },
                { label: 'Cancel', variant: 'ghost' },
            ],
        });
    }

    async function copyFromLast() {
        const prev = Store.shiftMonth(monthKey, -1);
        const source = spendCats().filter((c) => Store.budget(prev, c.name).amount > 0);
        if (!source.length) {
            toast(`No budgets were set for ${Store.monthLabel(prev)}.`, 'info');
            return;
        }
        let ok = true;
        if (typeof UI !== 'undefined' && UI.confirm) {
            ok = await UI.confirm({
                title: `Copy budgets from ${Store.monthLabel(prev)}?`,
                message: `${source.length} ${source.length === 1 ? 'budget' : 'budgets'} will be copied into ${Store.monthLabel(monthKey)}. Matching categories are replaced.`,
                confirmLabel: 'Copy budgets',
            });
        }
        if (!ok) return;
        const s = snap();
        source.forEach((c) => Store.setBudget(c.name, Store.budget(prev, c.name).amount, { monthKey: monthKey, scope: 'month' }));
        undoable('Budgets copied', s);
    }

    function colorField(selected) {
        const box = el('div', 'bg-palette');
        box.setAttribute('role', 'radiogroup');
        box.setAttribute('aria-label', 'Goal color');
        PALETTE.forEach((c, i) => {
            const l = el('label', 'bg-swatch');
            const r = el('input');
            r.type = 'radio';
            r.name = 'bgColor';
            r.value = c;
            r.checked = selected ? selected === c : i === 4;
            r.setAttribute('aria-label', `Color ${i + 1}`);
            const dot = el('span');
            dot.style.background = `var(--${c})`;
            l.append(r, dot);
            box.appendChild(l);
        });
        return box;
    }

    function addField(parent, labelText, input, id) {
        const f = el('div', 'field');
        const l = el('label', null, labelText);
        l.htmlFor = id;
        input.id = id;
        f.append(l, input);
        parent.appendChild(f);
        return f;
    }

    function openGoalSheet(goal) {
        if (typeof UI === 'undefined' || !UI.sheet) return;
        const wrap = el('div', 'bg-sheet');
        const name = el('input', 'input');
        name.type = 'text';
        name.maxLength = 60;
        name.value = goal ? goal.name : '';
        name.placeholder = 'Emergency fund, trip, new laptop';
        addField(wrap, 'Goal name', name, 'bgGoalName');
        const target = el('input', 'input');
        target.type = 'text';
        target.inputMode = 'decimal';
        target.value = goal ? String(goal.target) : '';
        target.placeholder = '0';
        addField(wrap, 'How much do you want to save?', target, 'bgGoalTarget');
        const date = el('input', 'input');
        date.type = 'date';
        date.min = Store.isoDate(new Date());
        date.value = goal && goal.targetDate ? goal.targetDate : '';
        const df = addField(wrap, 'Target date (optional)', date, 'bgGoalDate');
        df.appendChild(el('div', 'hint muted', 'We will tell you how much to save each month.'));
        const cf = el('div', 'field');
        cf.appendChild(el('span', null, 'Color'));
        cf.appendChild(colorField(goal ? goal.color : null));
        wrap.appendChild(cf);
        const err = el('div', 'field-error');
        err.setAttribute('role', 'alert');
        err.hidden = true;
        wrap.appendChild(err);

        UI.sheet({
            title: goal ? 'Edit goal' : 'New savings goal',
            body: wrap,
            size: 'md',
            initialFocus: '#bgGoalName',
            actions: [
                {
                    label: goal ? 'Save changes' : 'Create goal',
                    variant: 'primary',
                    closes: false,
                    onClick(ctx) {
                        const res = Store.saveGoal({
                            id: goal ? goal.id : undefined,
                            name: name.value,
                            target: parseAmount(target.value),
                            targetDate: date.value || null,
                            color: wrap.querySelector('input[name="bgColor"]:checked').value,
                        });
                        if (!res.ok) {
                            err.textContent = res.error;
                            err.hidden = false;
                            return;
                        }
                        ctx.close();
                        toast(goal ? 'Goal updated' : 'Goal created');
                    },
                },
                { label: 'Cancel', variant: 'ghost' },
            ],
        });
    }

    function openMoneySheet(goal, withdraw) {
        if (typeof UI === 'undefined' || !UI.sheet) return;
        const wrap = el('div', 'bg-sheet');
        const amt = el('input', 'input bg-amount');
        amt.type = 'text';
        amt.inputMode = 'decimal';
        amt.placeholder = '0';
        addField(wrap, withdraw ? 'Amount to take out' : 'Amount to add', amt, 'bgGoalAmt');
        wrap.appendChild(el('p', 'muted', withdraw ? `${moneyText(goal.saved)} saved so far.` : `${moneyText(goal.remaining)} to go.`));
        const err = el('div', 'field-error');
        err.setAttribute('role', 'alert');
        err.hidden = true;
        wrap.appendChild(err);
        UI.sheet({
            title: withdraw ? `Withdraw from ${goal.name}` : `Add to ${goal.name}`,
            body: wrap,
            size: 'sm',
            initialFocus: '#bgGoalAmt',
            actions: [
                {
                    label: withdraw ? 'Withdraw' : 'Add money',
                    variant: 'primary',
                    closes: false,
                    onClick(ctx) {
                        const v = parseAmount(amt.value);
                        if (!v) {
                            err.textContent = 'Enter an amount.';
                            err.hidden = false;
                            return;
                        }
                        if (withdraw && v > goal.saved + 0.005) {
                            err.textContent = `You only have ${moneyText(goal.saved)} saved in this goal.`;
                            err.hidden = false;
                            return;
                        }
                        const res = Store.contributeToGoal(goal.id, withdraw ? -v : v, withdraw ? 'Withdrawal' : '');
                        if (!res.ok) {
                            err.textContent = res.error;
                            err.hidden = false;
                            return;
                        }
                        ctx.close();
                        toast(withdraw ? 'Money withdrawn' : 'Money added');
                    },
                },
                { label: 'Cancel', variant: 'ghost' },
            ],
        });
    }

    async function deleteGoal(goal) {
        let ok = true;
        if (typeof UI !== 'undefined' && UI.confirm) {
            ok = await UI.confirm({
                title: `Delete "${goal.name}"?`,
                message: 'The goal and its saved amounts will be removed. You can undo this right after.',
                confirmLabel: 'Delete goal',
                danger: true,
            });
        }
        if (!ok) return;
        const s = snap();
        Store.deleteGoal(goal.id);
        undoable('Goal deleted', s);
    }

    function onClick(e) {
        const row = e.target.closest('.bg-row');
        if (row) {
            openEditor(row.dataset.cat);
            return;
        }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'import') {
            if (typeof window.openImport === 'function') window.openImport();
            return;
        }
        if (act === 'goal-new') {
            openGoalSheet(null);
            return;
        }
        const holder = btn.closest('[data-goal]');
        const goal = holder ? Store.goals().find((g) => g.id === holder.dataset.goal) : null;
        if (!goal) return;
        if (act === 'goal-add') openMoneySheet(goal, false);
        else if (act === 'goal-withdraw') openMoneySheet(goal, true);
        else if (act === 'goal-edit') openGoalSheet(goal);
        else if (act === 'goal-delete') deleteGoal(goal);
    }

    function onChangeEvt(e) {
        if (e.target.id === 'carryToggle') {
            window.incomeSettings = window.incomeSettings || {};
            window.incomeSettings.carryUnusedBudget = e.target.checked;
            Store.persist('budget');
            toast(e.target.checked ? 'Unused money will carry into next month' : 'Carry over is off');
        } else if (e.target.id === 'sortSelect') {
            sort = e.target.value;
            safeSet(SORT_KEY, sort, true);
            render();
        }
    }

    function openMore() {
        const anchor = $('#moreBtn');
        const items = [
            { label: 'Copy budgets from last month', icon: 'copy', onClick: copyFromLast },
            { label: 'Set up budgets for me', icon: 'refresh', onClick: openSetup },
            { label: 'Import transactions', icon: 'upload', onClick() { if (typeof window.openImport === 'function') window.openImport(); } },
        ];
        if (typeof UI !== 'undefined' && UI.menu) UI.menu(anchor, items);
    }

    document.addEventListener('DOMContentLoaded', () => {
        Store.init();
        monthKey = initialMonth();
        try {
            const s = localStorage.getItem(SORT_KEY);
            if (s === 'used' || s === 'over' || s === 'az') sort = s;
        } catch (e) { void e; }
        const icon = $('#moreBtn');
        if (icon && typeof UI !== 'undefined' && UI.icon) icon.innerHTML = UI.icon('more', 20);
        if (typeof UI !== 'undefined' && UI.monthStepper) {
            stepper = UI.monthStepper($('#monthStepper'), { value: monthKey, keys: monthChoices(), allowFuture: true, onChange: setMonth });
        }
        const host = $('#budgetsContent');
        host.addEventListener('click', onClick);
        host.addEventListener('change', onChangeEvt);
        $('#setupBtn').addEventListener('click', openSetup);
        $('#moreBtn').addEventListener('click', openMore);
        render();
        Store.onChange(() => render());
    });
})();
