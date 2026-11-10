(function () {
    const PAGE_SIZE = 200;
    const VIEWS = ['all', 'spending', 'income', 'review', 'trash'];
    const SORTS = [
        ['newest', 'Newest first'],
        ['oldest', 'Oldest first'],
        ['largest', 'Largest first'],
        ['smallest', 'Smallest first'],
    ];

    const state = {
        month: 'all',
        category: '',
        view: 'all',
        q: '',
        sort: 'newest',
        selecting: false,
        selected: new Set(),
        limit: PAGE_SIZE,
    };

    const refs = {};
    let stepper = null;
    let stepperKeys = '';
    let observer = null;
    let booted = false;

    function esc(s) {
        return UI.esc(s);
    }

    function icon(name, size) {
        return UI.icon(name, size || 18);
    }

    function money(n) {
        return Store.money(n);
    }

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text != null) e.textContent = text;
        return e;
    }

    function moneyHtml(n, extra) {
        return '<span class="money' + (extra ? ' ' + extra : '') + '">' + esc(n) + '</span>';
    }

    function readUrl() {
        const p = new URLSearchParams(window.location.search);
        state.q = (p.get('q') || '').slice(0, 120);
        state.category = p.get('category') || '';
        const v = p.get('view') || 'all';
        state.view = VIEWS.includes(v) ? v : 'all';
        const m = p.get('month');
        if (m === 'all' || /^\d{4}-\d{2}$/.test(m || '')) state.month = m;
        else if (state.q || p.get('id')) state.month = 'all';
        else state.month = Store.latestMonthKey() || 'all';
        const s = p.get('sort');
        if (SORTS.some((x) => x[0] === s)) state.sort = s;
        return p.get('id');
    }

    function syncUrl() {
        const p = new URLSearchParams();
        p.set('month', state.month);
        if (state.category) p.set('category', state.category);
        if (state.view !== 'all') p.set('view', state.view);
        if (state.q) p.set('q', state.q);
        if (state.sort !== 'newest') p.set('sort', state.sort);
        try {
            history.replaceState(null, '', window.location.pathname + '?' + p.toString());
        } catch (e) { void e; }
    }

    function monthTxs() {
        const f = {};
        if (state.month !== 'all') f.monthKey = state.month;
        if (state.category) f.category = state.category;
        return Store.transactions(f);
    }

    function matchesQuery(t, q, qnum) {
        if (t.merchant.toLowerCase().includes(q) || String(t.description || '').toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q)) || t.category.toLowerCase().includes(q)) return true;
        if (qnum) return t.absAmount.toFixed(2).includes(qnum);
        return false;
    }

    function applyQuery(list) {
        const q = state.q.trim().toLowerCase();
        if (!q) return list;
        const stripped = q.replace(/[$,\s]/g, '');
        const qnum = /^\d+(\.\d{0,2})?$/.test(stripped) ? stripped : '';
        return list.filter((t) => matchesQuery(t, q, qnum));
    }

    function applyView(list) {
        if (state.view === 'spending') return list.filter((t) => !t.isIncome);
        if (state.view === 'income') return list.filter((t) => t.isIncome);
        if (state.view === 'review') return list.filter((t) => t.needsReview);
        return list;
    }

    function applySort(list) {
        if (state.sort === 'oldest') return list.slice().reverse();
        if (state.sort === 'largest') return list.slice().sort((a, b) => b.absAmount - a.absAmount);
        if (state.sort === 'smallest') return list.slice().sort((a, b) => a.absAmount - b.absAmount);
        return list;
    }

    function dayLabel(t) {
        const d = t.date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((today - day) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        const opts = { weekday: 'long', month: 'short', day: 'numeric' };
        if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
        return d.toLocaleDateString(Store.prefs().locale, opts);
    }

    function shortDate(t) {
        if (!t.date || isNaN(t.date)) return '';
        return t.date.toLocaleDateString(Store.prefs().locale, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function rowHtml(t, showDate) {
        const positive = t.isIncome || t.isRefund;
        const subParts = [];
        if (t.needsReview) subParts.push('<span class="tx-needs">Needs a category</span>');
        else subParts.push('<span>' + esc(t.category) + '</span>');
        if (showDate) subParts.push('<span>' + esc(shortDate(t)) + '</span>');
        if (t.note) subParts.push('<span class="tx-note-flag" role="img" aria-label="Has a note">' + icon('note', 14) + '</span>');
        if (t.isManual) subParts.push('<span class="badge">Manual</span>');
        if (t.isRefund) subParts.push('<span class="badge">Refund</span>');
        if (t.isExcluded) subParts.push('<span class="badge">Hidden from totals</span>');
        const label = t.merchant + ', ' + money(t.absAmount) + (positive ? ' received' : '');
        return '<button type="button" class="tx-row-btn" data-id="' + esc(t.id) + '" aria-label="' + esc(label) + '">' +
            UI.chip(t.category, { size: 40 }) +
            '<span class="tx-main"><span class="tx-title">' + esc(t.merchant) + '</span><span class="tx-sub">' + subParts.join('') + '</span></span>' +
            moneyHtml((positive ? '+' : '') + money(t.absAmount), 'tx-amt num' + (positive ? ' tx-positive' : '')) +
            '</button>';
    }

    function makeRow(t, showDate) {
        const row = el('div', 'tx-row');
        row.dataset.id = t.id;
        let html = '';
        if (state.selecting) {
            html += '<label class="tx-check"><input type="checkbox" data-select="' + esc(t.id) + '" aria-label="' + esc('Select ' + t.merchant) + '"' + (state.selected.has(t.id) ? ' checked' : '') + ' /></label>';
        }
        html += rowHtml(t, showDate);
        row.innerHTML = html;
        if (state.selected.has(t.id)) row.classList.add('is-selected');
        return row;
    }

    function dayTotals(items) {
        const totals = {};
        items.forEach((t) => {
            if (t.isTransfer) return;
            if (t.isExcluded) return;
            const d = totals[t.dateKey] || (totals[t.dateKey] = { spent: 0, income: 0 });
            if (t.isIncome) d.income += t.absAmount;
            else d.spent += t.spend;
        });
        return totals;
    }

    function dayTotalText(d) {
        const parts = [];
        if (d && d.spent > 0.004) parts.push(moneyHtml(money(d.spent)) + ' spent');
        if (d && d.income > 0.004) parts.push(moneyHtml('+' + money(d.income)) + ' in');
        return parts.join(', ');
    }

    function summaryHtml(items) {
        let spent = 0;
        let income = 0;
        items.forEach((t) => {
            if (t.isTransfer || t.isExcluded) return;
            if (t.isIncome) income += t.absAmount;
            else spent += t.spend;
        });
        spent = Math.max(0, spent);
        const parts = [items.length + (items.length === 1 ? ' transaction' : ' transactions')];
        if (spent > 0) parts.push(moneyHtml(money(spent)) + ' spent');
        if (income > 0) parts.push(moneyHtml(money(income)) + ' income');
        return parts.join(', ');
    }

    function pruneSelection(all) {
        const ids = new Set(all.map((t) => t.id));
        Array.from(state.selected).forEach((id) => {
            if (!ids.has(id)) state.selected.delete(id);
        });
    }

    function trashCount() {
        return (window.deletedTransactions || []).length;
    }

    function reasonText(reason) {
        const r = String(reason || '');
        if (r.indexOf('rule:') === 0) return 'Removed by an auto-sort rule for "' + r.slice(5) + '"';
        if (r === 'manual' || !r) return 'Deleted by you';
        return 'Removed automatically';
    }

    function deletedDate(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleDateString(Store.prefs().locale, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function buildShell() {
        const root = document.getElementById('txRoot');
        root.textContent = '';

        const toolbar = el('div', 'tx-toolbar');
        const searchWrap = el('div', 'tx-search');
        searchWrap.innerHTML = icon('search', 18);
        const search = el('input', 'input');
        search.type = 'search';
        search.id = 'txSearch';
        search.placeholder = 'Search name, note, or amount';
        search.setAttribute('aria-label', 'Search transactions');
        search.autocomplete = 'off';
        search.value = state.q;
        searchWrap.appendChild(search);
        toolbar.appendChild(searchWrap);

        const filters = el('div', 'tx-filters');
        const monthGroup = el('div', 'tx-month');
        const modeWrap = el('div', 'tx-mode');
        modeWrap.setAttribute('role', 'group');
        modeWrap.setAttribute('aria-label', 'Time range');
        const byMonth = el('button', 'tx-mode-btn', 'Month');
        byMonth.type = 'button';
        const allTime = el('button', 'tx-mode-btn', 'All time');
        allTime.type = 'button';
        modeWrap.appendChild(byMonth);
        modeWrap.appendChild(allTime);
        const stepHost = el('div', 'tx-stepper');
        monthGroup.appendChild(modeWrap);
        monthGroup.appendChild(stepHost);
        filters.appendChild(monthGroup);

        const catBtn = el('button', 'btn btn-secondary tx-filter-btn');
        catBtn.type = 'button';
        catBtn.setAttribute('aria-haspopup', 'menu');
        const sortBtn = el('button', 'btn btn-secondary tx-filter-btn');
        sortBtn.type = 'button';
        sortBtn.setAttribute('aria-haspopup', 'menu');
        filters.appendChild(catBtn);
        filters.appendChild(sortBtn);
        toolbar.appendChild(filters);
        root.appendChild(toolbar);

        const types = el('div', 'tx-types');
        types.setAttribute('role', 'group');
        types.setAttribute('aria-label', 'Show');
        root.appendChild(types);

        const active = el('div', 'tx-active');
        root.appendChild(active);

        const summary = el('p', 'tx-summary muted');
        summary.setAttribute('aria-live', 'polite');
        root.appendChild(summary);

        const list = el('div', 'tx-list');
        list.id = 'txList';
        root.appendChild(list);

        const bulk = el('div', 'tx-bulk');
        bulk.hidden = true;
        bulk.setAttribute('role', 'region');
        bulk.setAttribute('aria-label', 'Selected transactions');
        bulk.setAttribute('data-bottom-bar', '');
        root.appendChild(bulk);

        Object.assign(refs, { root, search, stepHost, byMonth, allTime, catBtn, sortBtn, types, active, summary, list, bulk, monthGroup });

        const onSearch = (UI.debounce || ((fn) => fn))(() => {
            state.q = search.value.trim();
            state.limit = PAGE_SIZE;
            syncUrl();
            render();
        }, 200);
        search.addEventListener('input', onSearch);
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && search.value) {
                search.value = '';
                onSearch();
            }
        });

        byMonth.addEventListener('click', () => {
            if (state.month === 'all') setMonth(Store.latestMonthKey() || Store.currentMonthKey());
        });
        allTime.addEventListener('click', () => setMonth('all'));

        catBtn.addEventListener('click', () => {
            const items = [{ label: 'All categories', onClick: () => setCategory('') }, { separator: true }];
            Store.categories({ includeIncome: true }).forEach((c) => {
                items.push({ label: c.name, onClick: () => setCategory(c.name) });
            });
            UI.menu(catBtn, items);
        });
        sortBtn.addEventListener('click', () => {
            UI.menu(sortBtn, SORTS.map((s) => ({
                label: s[1] + (state.sort === s[0] ? ' (selected)' : ''),
                onClick: () => {
                    state.sort = s[0];
                    state.limit = PAGE_SIZE;
                    syncUrl();
                    render();
                },
            })));
        });

        types.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-view]');
            if (!b) return;
            setView(b.dataset.view);
        });
        active.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-clear]');
            if (!b) return;
            const k = b.dataset.clear;
            if (k === 'category') state.category = '';
            else if (k === 'q') {
                state.q = '';
                search.value = '';
            } else if (k === 'view') state.view = 'all';
            else if (k === 'all') {
                state.category = '';
                state.q = '';
                state.view = 'all';
                search.value = '';
            }
            state.limit = PAGE_SIZE;
            syncUrl();
            render();
        });

        list.addEventListener('click', onListClick);
        list.addEventListener('change', (e) => {
            const cb = e.target.closest('input[data-select]');
            if (cb) toggleSelect(cb.dataset.select, cb.checked);
        });

        bulk.addEventListener('click', onBulkClick);

        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (en.isIntersecting) {
                        observer.unobserve(en.target);
                        en.target.click();
                    }
                });
            }, { rootMargin: '600px' });
        }
    }

    function setMonth(key) {
        state.month = key;
        state.limit = PAGE_SIZE;
        syncUrl();
        render();
    }

    function setCategory(name) {
        state.category = name;
        state.limit = PAGE_SIZE;
        syncUrl();
        render();
    }

    function setView(v) {
        state.view = v;
        state.limit = PAGE_SIZE;
        if (v === 'trash') exitSelect(false);
        syncUrl();
        render(true);
    }

    function renderMonthControl() {
        const keys = Store.monthKeys();
        const isAll = state.month === 'all';
        refs.byMonth.setAttribute('aria-pressed', String(!isAll));
        refs.allTime.setAttribute('aria-pressed', String(isAll));
        refs.stepHost.hidden = isAll;
        refs.monthGroup.hidden = state.view === 'trash';
        if (isAll) return;
        const sig = keys.join(',');
        if (typeof UI.monthStepper === 'function') {
            if (!stepper || sig !== stepperKeys) {
                refs.stepHost.textContent = '';
                stepper = UI.monthStepper(refs.stepHost, {
                    value: state.month,
                    keys: keys,
                    onChange: (k) => setMonth(k),
                });
                stepperKeys = sig;
            } else {
                stepper.set(state.month);
            }
        } else {
            refs.stepHost.textContent = '';
            const sel = el('select', 'select');
            sel.setAttribute('aria-label', 'Month');
            const opts = keys.indexOf(state.month) === -1 ? [state.month].concat(keys) : keys;
            opts.forEach((k) => {
                const o = el('option', null, Store.monthLabel(k));
                o.value = k;
                o.selected = k === state.month;
                sel.appendChild(o);
            });
            sel.addEventListener('change', () => setMonth(sel.value));
            refs.stepHost.appendChild(sel);
        }
    }

    function renderTypes(scope) {
        const reviewCount = scope.filter((t) => t.needsReview).length;
        const defs = [
            ['all', 'All'],
            ['spending', 'Spending'],
            ['income', 'Income'],
            ['review', 'Needs a category' + (reviewCount ? ' (' + reviewCount + ')' : '')],
            ['trash', 'Trash (' + trashCount() + ')'],
        ];
        refs.types.innerHTML = defs.map((d) => '<button type="button" class="tx-type" data-view="' + d[0] + '" aria-pressed="' + (state.view === d[0]) + '">' + esc(d[1]) + '</button>').join('');
    }

    function renderActive() {
        const chips = [];
        if (state.category) chips.push(['category', 'Category: ' + state.category]);
        if (state.q) chips.push(['q', 'Search: ' + state.q]);
        if (state.view !== 'all' && state.view !== 'trash') chips.push(['view', { spending: 'Spending only', income: 'Income only', review: 'Needs a category' }[state.view]]);
        refs.active.hidden = chips.length === 0;
        let html = chips.map((c) => '<span class="tx-fchip"><span>' + esc(c[1]) + '</span><button type="button" data-clear="' + c[0] + '" aria-label="' + esc('Remove filter: ' + c[1]) + '">' + icon('x', 14) + '</button></span>').join('');
        if (chips.length) html += '<button type="button" class="tx-clear" data-clear="all">Clear filters</button>';
        refs.active.innerHTML = html;
        refs.catBtn.innerHTML = icon('filter', 16) + '<span>' + esc(state.category || 'All categories') + '</span>';
        refs.sortBtn.innerHTML = icon('sort', 16) + '<span>' + esc(SORTS.find((s) => s[0] === state.sort)[1]) + '</span>';
        refs.catBtn.setAttribute('aria-label', 'Category filter: ' + (state.category || 'all categories'));
        refs.sortBtn.setAttribute('aria-label', 'Sort: ' + SORTS.find((s) => s[0] === state.sort)[1]);
    }

    function clearAndRender() {
        state.category = '';
        state.q = '';
        state.view = 'all';
        refs.search.value = '';
        syncUrl();
        render();
    }

    function emptyBlock(opts) {
        const wrap = el('div', 'tx-empty');
        if (typeof UI.emptyNode === 'function') wrap.appendChild(UI.emptyNode(opts));
        else {
            wrap.appendChild(el('h2', null, opts.title));
            wrap.appendChild(el('p', 'muted', opts.text));
        }
        return wrap;
    }

    function renderTrash() {
        refs.list.textContent = '';
        let items = Store.trash().slice().sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
        const q = state.q.trim().toLowerCase();
        if (q) items = items.filter((i) => i.tx.merchant.toLowerCase().includes(q) || String(i.tx.description).toLowerCase().includes(q));
        refs.summary.textContent = items.length + (items.length === 1 ? ' deleted transaction' : ' deleted transactions');
        if (!items.length) {
            refs.list.appendChild(emptyBlock({
                icon: 'trash',
                title: q ? 'Nothing in Trash matches' : 'Trash is empty',
                text: q ? 'Try a different search.' : 'Deleted transactions wait here until you remove them for good.',
                action: q ? { label: 'Clear filters', onClick: clearAndRender } : undefined,
            }));
            return;
        }
        const head = el('div', 'tx-trash-head');
        head.appendChild(el('p', 'subtle', 'Deleted items stay here until you delete them forever.'));
        const empty = el('button', 'btn btn-secondary btn-sm', 'Empty trash');
        empty.type = 'button';
        empty.dataset.action = 'empty-trash';
        head.appendChild(empty);
        refs.list.appendChild(head);
        const group = el('div', 'tx-group');
        items.slice(0, state.limit).forEach((i) => {
            const t = i.tx;
            const row = el('div', 'tx-row tx-trash-row');
            row.innerHTML = '<div class="tx-row-static">' + UI.chip(t.category, { size: 40 }) +
                '<span class="tx-main"><span class="tx-title">' + esc(t.merchant) + '</span><span class="tx-sub"><span>' + esc(shortDate(t)) + '</span><span>' + esc('Deleted ' + deletedDate(i.deletedAt) + '. ' + reasonText(i.reason)) + '</span></span></span>' +
                moneyHtml(money(t.absAmount), 'tx-amt num') + '</div>' +
                '<div class="tx-trash-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="restore" data-index="' + i.index + '" aria-label="' + esc('Restore ' + t.merchant) + '">Restore</button>' +
                '<button type="button" class="btn btn-ghost btn-sm tx-danger-text" data-action="purge" data-index="' + i.index + '" aria-label="' + esc('Delete ' + t.merchant + ' forever') + '">Delete forever</button></div>';
            group.appendChild(row);
        });
        const tcard = el('div', 'tx-card');
        tcard.appendChild(group);
        refs.list.appendChild(tcard);
        if (items.length > state.limit) appendMore(items.length - state.limit);
    }

    function appendMore(left) {
        const more = el('button', 'btn btn-secondary tx-more', 'Show more (' + left + ' left)');
        more.type = 'button';
        more.dataset.action = 'more';
        refs.list.appendChild(more);
        if (observer) observer.observe(more);
    }

    function renderList(items) {
        refs.list.textContent = '';
        if (!items.length) return;
        const dated = state.sort === 'newest' || state.sort === 'oldest';
        const visible = items.slice(0, state.limit);
        const card = el('div', 'tx-card');
        if (!dated) {
            const group = el('div', 'tx-group');
            visible.forEach((t) => group.appendChild(makeRow(t, true)));
            card.appendChild(group);
            refs.list.appendChild(card);
        } else {
            const totals = dayTotals(items);
            let group = null;
            let key = null;
            visible.forEach((t) => {
                if (t.dateKey !== key) {
                    key = t.dateKey;
                    group = el('section', 'tx-group');
                    const h = el('h2', 'tx-day');
                    h.innerHTML = '<span>' + esc(dayLabel(t)) + '</span>' + '<span class="tx-day-total num">' + dayTotalText(totals[key]) + '</span>';
                    group.appendChild(h);
                    card.appendChild(group);
                }
                group.appendChild(makeRow(t, false));
            });
            refs.list.appendChild(card);
        }
        if (items.length > visible.length) appendMore(items.length - visible.length);
    }

    function renderBulk(items) {
        refs.bulk.hidden = !state.selecting;
        document.body.classList.toggle('tx-selecting', state.selecting);
        const sb = document.getElementById('txSelectBtn');
        sb.setAttribute('aria-pressed', String(state.selecting));
        sb.textContent = state.selecting ? 'Cancel' : 'Select';
        sb.hidden = state.view === 'trash';
        if (!state.selecting) return;
        const n = state.selected.size;
        const allSelected = items.length > 0 && items.every((t) => state.selected.has(t.id));
        refs.bulk.innerHTML = '<span class="tx-bulk-count" aria-live="polite">' + n + ' selected</span>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-bulk="all">' + (allSelected ? 'Select none' : 'Select all (' + items.length + ')') + '</button>' +
            '<span class="tx-bulk-spacer"></span>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-bulk="category"' + (n ? '' : ' disabled') + '>Change category</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-bulk="delete"' + (n ? '' : ' disabled') + '>Delete</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-bulk="cancel">Cancel</button>';
    }

    let currentItems = [];

    function render(resetScroll) {
        if (!refs.root) return;
        const y = window.scrollY;
        const all = Store.allTransactions();
        pruneSelection(all);
        const hasAny = Store.hasData();
        renderMonthControl();
        const scope = monthTxs();
        renderTypes(scope);
        renderActive();

        if (state.view === 'trash') {
            currentItems = [];
            renderTrash();
            renderBulk([]);
        } else if (!hasAny) {
            currentItems = [];
            refs.summary.textContent = '';
            refs.list.textContent = '';
            refs.list.appendChild(emptyBlock({
                icon: 'list',
                title: 'No transactions yet',
                text: 'Import a bank file to see everything in one place, or add a cash purchase by hand.',
                action: { label: 'Import', onClick: () => { if (typeof window.openImport === 'function') window.openImport(); } },
                secondary: { label: 'Add transaction', onClick: () => openAdd() },
            }));
            renderBulk([]);
        } else {
            const items = applySort(applyQuery(applyView(scope)));
            currentItems = items;
            refs.summary.innerHTML = summaryHtml(items);
            if (!items.length) {
                refs.list.textContent = '';
                const filtered = state.q || state.category || state.view !== 'all';
                refs.list.appendChild(emptyBlock({
                    icon: 'search',
                    title: filtered ? 'No transactions match' : 'No transactions in ' + (state.month === 'all' ? 'this view' : Store.monthLabel(state.month)),
                    text: filtered ? 'Try a different search, or clear your filters.' : 'Pick another month, or add one by hand.',
                    action: filtered ? { label: 'Clear filters', onClick: clearAndRender } : { label: 'Show all time', onClick: () => setMonth('all') },
                    secondary: filtered ? undefined : { label: 'Add transaction', onClick: () => openAdd() },
                }));
            } else {
                renderList(items);
                if (state.view === 'review') {
                    const rb = el('button', 'btn btn-primary tx-review-btn', 'Sort them one by one');
                    rb.type = 'button';
                    rb.dataset.action = 'review';
                    refs.list.insertBefore(rb, refs.list.firstChild);
                }
            }
            renderBulk(items);
        }
        if (resetScroll === true) window.scrollTo(0, 0);
        else window.scrollTo(0, y);
    }

    function openAdd() {
        if (typeof window.openAddTransaction === 'function') window.openAddTransaction();
    }

    function openTx(id) {
        if (typeof window.openTransactionSheet === 'function') window.openTransactionSheet(id);
    }

    function toggleSelect(id, on) {
        const want = on === undefined ? !state.selected.has(id) : on;
        if (want) state.selected.add(id);
        else state.selected.delete(id);
        const row = refs.list.querySelector('.tx-row[data-id="' + CSS.escape(id) + '"]');
        if (row) {
            row.classList.toggle('is-selected', want);
            const cb = row.querySelector('input[data-select]');
            if (cb) cb.checked = want;
        }
        renderBulk(currentItems);
    }

    function enterSelect() {
        state.selecting = true;
        render();
    }

    function exitSelect(doRender) {
        state.selecting = false;
        state.selected.clear();
        if (doRender !== false) render();
    }

    function onListClick(e) {
        const act = e.target.closest('[data-action]');
        if (act) return onAction(act);
        const btn = e.target.closest('.tx-row-btn');
        if (!btn) return;
        if (state.selecting) toggleSelect(btn.dataset.id);
        else openTx(btn.dataset.id);
    }

    function onAction(b) {
        const a = b.dataset.action;
        if (a === 'review') {
            if (typeof window.openReviewFlow === 'function') window.openReviewFlow({ monthKey: state.month === 'all' ? undefined : state.month });
        } else if (a === 'more') {
            state.limit += PAGE_SIZE;
            render();
        } else if (a === 'restore') {
            const n = Store.restoreFromTrash([Number(b.dataset.index)]);
            if (n) UI.toast('Restored. It is back in your transactions.', { type: 'success' });
        } else if (a === 'purge') {
            UI.confirm({ title: 'Delete forever?', message: 'This transaction will be gone for good and cannot be restored.', confirmLabel: 'Delete forever', danger: true }).then((ok) => {
                if (ok) {
                    Store.purgeFromTrash([Number(b.dataset.index)]);
                    UI.toast('Deleted forever.', { type: 'success' });
                }
            });
        } else if (a === 'empty-trash') {
            const n = trashCount();
            UI.confirm({ title: 'Empty Trash?', message: n + (n === 1 ? ' transaction' : ' transactions') + ' will be deleted forever. This cannot be undone.', confirmLabel: 'Empty Trash', danger: true }).then((ok) => {
                if (ok) {
                    Store.emptyTrash();
                    UI.toast('Trash is empty.', { type: 'success' });
                }
            });
        }
    }

    function withUndo(message, fn) {
        if (typeof window.txWithUndo === 'function') return window.txWithUndo(message, fn);
        const r = fn();
        UI.toast(typeof message === 'function' ? message(r) : message, { type: 'success' });
        return r;
    }

    function bulkMove(txs, name, rule) {
        let changed = 0;
        let moved = null;
        muted = true;
        try {
            withUndo((r) => (rule ? 'Moved ' + r + ' ' + txs[0].merchant + ' transactions to ' + name : 'Moved ' + txs.length + ' transactions to ' + name), () => {
                if (rule) {
                    changed = Store.setCategory(txs[0].id, name, { applyToSimilar: true }).changed;
                } else if (typeof Store.setCategories === 'function') {
                    changed = Store.setCategories(txs.map((t) => t.id), name);
                } else {
                    txs.forEach((t) => { changed += Store.setCategory(t.id, name).changed; });
                }
                moved = changed;
                return changed;
            });
        } finally {
            muted = false;
        }
        exitSelect();
        return moved;
    }

    function bulkCategory() {
        const txs = Array.from(state.selected).map((id) => Store.transaction(id)).filter(Boolean);
        if (!txs.length) return;
        openCategoryPicker({
            title: 'Move ' + txs.length + (txs.length === 1 ? ' transaction' : ' transactions'),
            onPick: (name) => {
                const same = new Set(txs.map((t) => t.merchant)).size === 1 && txs.length > 0;
                const body = el('div', 'tx-bulk-confirm');
                body.appendChild(el('p', null, 'Move ' + txs.length + (txs.length === 1 ? ' transaction' : ' transactions') + ' to ' + name + '.'));
                let box = null;
                if (same) {
                    const label = el('label', 'txs-check');
                    box = el('input');
                    box.type = 'checkbox';
                    box.checked = true;
                    label.appendChild(box);
                    label.appendChild(el('span', null, 'Always sort ' + txs[0].merchant + ' into ' + name));
                    body.appendChild(label);
                }
                UI.sheet({
                    title: 'Change category',
                    body: body,
                    size: 'sm',
                    actions: [
                        { label: 'Cancel', variant: 'ghost' },
                        { label: 'Move', variant: 'primary', onClick: () => { bulkMove(txs, name, !!(box && box.checked)); } },
                    ],
                });
            },
        });
    }

    function bulkDelete() {
        const ids = Array.from(state.selected);
        if (!ids.length) return;
        UI.confirm({
            title: 'Delete ' + ids.length + (ids.length === 1 ? ' transaction?' : ' transactions?'),
            message: 'They move to Trash. You can restore them from there.',
            confirmLabel: 'Delete',
            danger: true,
        }).then((ok) => {
            if (!ok) return;
            Store.deleteTransactions(ids, {});
            exitSelect();
        });
    }

    function onBulkClick(e) {
        const b = e.target.closest('button[data-bulk]');
        if (!b) return;
        const k = b.dataset.bulk;
        if (k === 'cancel') exitSelect();
        else if (k === 'all') {
            const everyone = currentItems.length > 0 && currentItems.every((t) => state.selected.has(t.id));
            if (everyone) state.selected.clear();
            else currentItems.forEach((t) => state.selected.add(t.id));
            render();
        } else if (k === 'category') bulkCategory();
        else if (k === 'delete') bulkDelete();
    }

    function dialogOpen() {
        return !!document.querySelector('[aria-modal="true"]');
    }

    function onKeydown(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
        if (e.key === 'Escape') {
            if (!dialogOpen() && state.selecting) {
                exitSelect();
            }
            return;
        }
        if (typing || dialogOpen()) return;
        const rows = Array.from(refs.list.querySelectorAll('.tx-row-btn'));
        if (!rows.length) return;
        const i = rows.indexOf(document.activeElement);
        if (e.key === 'j') {
            e.preventDefault();
            rows[Math.min(i + 1, rows.length - 1)].focus();
        } else if (e.key === 'k') {
            e.preventDefault();
            rows[i <= 0 ? 0 : i - 1].focus();
        } else if (e.key === 'x' && i >= 0) {
            e.preventDefault();
            const id = rows[i].dataset.id;
            if (!state.selecting) {
                state.selected.add(id);
                enterSelect();
                const again = refs.list.querySelector('.tx-row-btn[data-id="' + CSS.escape(id) + '"]');
                if (again) again.focus();
            } else {
                toggleSelect(id);
            }
        }
    }

    let muted = false;

    function boot() {
        if (booted) return;
        booted = true;
        Store.init();
        const deepId = readUrl();
        buildShell();
        document.getElementById('txAddBtn').addEventListener('click', openAdd);
        document.getElementById('txSelectBtn').addEventListener('click', () => {
            if (state.selecting) exitSelect();
            else enterSelect();
        });
        document.addEventListener('keydown', onKeydown);
        render(true);
        Store.onChange(() => {
            if (!muted) render();
        });
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) {
                Store.reload();
                render();
            }
        });

        if (deepId) {
            if (Store.transaction(deepId)) openTx(deepId);
            const p = new URLSearchParams(window.location.search);
            p.delete('id');
            try {
                history.replaceState(null, '', window.location.pathname + '?' + p.toString());
            } catch (e) { void e; }
        }
        if (state.view === 'review' && typeof window.openReviewFlow === 'function' && !deepId) {
            const has = Store.transactions(state.month === 'all' ? {} : { monthKey: state.month }).some((t) => t.needsReview);
            if (has) window.openReviewFlow({ monthKey: state.month === 'all' ? undefined : state.month });
        }
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
