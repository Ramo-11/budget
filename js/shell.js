(function () {
    const NAV = [
        { id: 'home', href: 'index.html', label: 'Home', icon: 'home' },
        { id: 'transactions', href: 'transactions.html', label: 'Transactions', icon: 'list' },
        { id: 'budgets', href: 'budgets.html', label: 'Budgets', icon: 'wallet' },
        { id: 'insights', href: 'analytics.html', label: 'Insights', icon: 'chart' },
        { id: 'settings', href: 'settings.html', label: 'Settings', icon: 'settings' },
    ];
    const PAGE_TITLES = { about: 'Help and about' };
    const SETTINGS_SECTIONS = [
        ['categories', 'Categories'],
        ['rules', 'Auto-sort rules'],
        ['accounts', 'Accounts'],
        ['import', 'Import preferences'],
        ['security', 'Privacy and security'],
        ['backup', 'Backup and restore'],
        ['appearance', 'Appearance and currency'],
        ['data', 'Data'],
    ];

    const BRAND_MARK = '<svg class="app-brand-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--brand-solid)"/><path d="M10.5 22a4.5 4.5 0 0 1-.7-8.95 6 6 0 0 1 11.6 1.2A3.9 3.9 0 0 1 21 22Z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
    const modKey = isMac ? 'Cmd' : 'Ctrl';
    const root = () => document.getElementById('appShell');
    const page = () => document.body.getAttribute('data-page') || '';
    const icon = (n, s) => (window.UI ? window.UI.icon(n, s) : '');
    const esc = (t) => (window.UI ? window.UI.esc(t) : String(t));

    let customTitle = null;
    let paletteState = null;

    function pageLabel() {
        const found = NAV.find((n) => n.id === page());
        return customTitle || (found ? found.label : PAGE_TITLES[page()] || 'Sahab Budget');
    }

    function activeAccount() {
        try {
            return typeof getAccountById === 'function' ? getAccountById(getActiveAccountId()) : null;
        } catch (e) { return null; }
    }

    function sampleActive() {
        try { return typeof isSampleAccount === 'function' && isSampleAccount(); } catch (e) { return false; }
    }

    function accountButton() {
        const acc = activeAccount();
        const name = acc ? acc.name : 'My Budget';
        const idx = acc ? acc.colorIndex : 1;
        return '<button type="button" class="account-switcher" data-shell="accounts" aria-haspopup="menu" aria-expanded="false" aria-label="Account: ' + esc(name) + '. Switch account">' +
            '<span class="cat-dot" style="--cat:var(--cat-' + Number(idx || 1) + ')"></span>' +
            '<span class="account-switcher-name">' + esc(name) + '</span>' + icon('chevron-down', 16) + '</button>';
    }

    function navLinks(cls, withIcon) {
        return NAV.filter((n) => withIcon || n.id !== 'settings').map((n) => {
            const cur = n.id === page() ? ' aria-current="page"' : '';
            return '<a class="' + cls + '" href="' + n.href + '"' + cur + '>' + (withIcon ? icon(n.icon, 22) : '') + '<span>' + n.label + '</span></a>';
        }).join('');
    }

    function render() {
        const el = root();
        if (!el) return;
        const settingsCur = page() === 'settings' ? ' aria-current="page"' : '';
        const banner = sampleActive()
            ? '<div class="sample-banner" role="status"><div class="sample-banner-inner"><span class="sample-banner-text">You are looking at sample data. Your own budgets are untouched.</span>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-shell="exit-sample">Exit sample data</button></div></div>'
            : '';
        el.innerHTML =
            '<a class="skip-link" href="#main">Skip to main content</a>' +
            banner +
            '<header class="app-header"><div class="app-header-inner">' +
            '<a class="app-brand" href="index.html">' + BRAND_MARK + '<span>Sahab Budget</span></a>' +
            '<nav class="app-nav" aria-label="Main">' + navLinks('app-nav-link', false) + '</nav>' +
            '<div class="app-header-actions">' + accountButton() +
            '<button type="button" class="search-trigger" data-shell="palette" aria-label="Search and commands" aria-keyshortcuts="Control+K Meta+K">' + icon('search', 18) + '<span>Search</span><span class="kbd">' + modKey + ' K</span></button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-shell="import">' + icon('upload', 16) + '<span>Import</span></button>' +
            '<a class="btn btn-ghost btn-icon btn-sm" href="settings.html" aria-label="Settings"' + settingsCur + '>' + icon('settings', 20) + '</a>' +
            '</div></div></header>' +
            '<div class="mobile-topbar" id="shellTopbar"><div class="mobile-topbar-lead"><a class="mobile-brand" href="index.html">' + BRAND_MARK.replace('app-brand-mark', 'mobile-brand-mark') + '<span>Budget</span></a><div class="mobile-topbar-title" id="shellMobileTitle" aria-hidden="true">' + esc(pageLabel()) + '</div></div>' +
            accountButton() +
            '<button type="button" class="btn btn-primary btn-sm" data-shell="import">' + icon('upload', 16) + '<span>Import</span></button></div>' +
            '<nav class="tabbar" aria-label="Main">' + navLinks('tabbar-link', true) + '</nav>';
    }

    function goImport() {
        if (typeof window.openImport === 'function') window.openImport();
        else if (window.UI) window.UI.toast('Import is not available on this page.', { type: 'info' });
    }

    function openAccountMenu(btn) {
        if (!window.UI || typeof getAccounts !== 'function') return;
        const activeId = getActiveAccountId();
        const items = getAccounts().map((a) => ({
            label: a.name,
            swatch: 'var(--cat-' + Number(a.colorIndex || 1) + ')',
            checked: a.id === activeId,
            onClick: () => {
                if (a.id === activeId) return;
                setActiveAccount(a.id);
                window.location.reload();
            },
        }));
        items.push({ separator: true });
        items.push({ label: 'New account', icon: 'plus', onClick: () => { if (typeof window.openCreateAccount === 'function') window.openCreateAccount(); } });
        items.push({ label: 'Manage accounts', icon: 'settings', onClick: () => { if (typeof window.openManageAccounts === 'function') window.openManageAccounts(); } });
        window.UI.menu(btn, items);
    }

    function onShellClick(e) {
        const t = e.target.closest('[data-shell]');
        if (!t) return;
        const act = t.getAttribute('data-shell');
        if (act === 'accounts') openAccountMenu(t);
        else if (act === 'palette') openPalette();
        else if (act === 'import') goImport();
        else if (act === 'exit-sample' && typeof window.exitSampleMode === 'function') window.exitSampleMode();
    }

    function go(href) { window.location.href = href; }

    function commands() {
        const list = [];
        const add = (group, label, iconName, run, keywords, hint) => list.push({ group, label, icon: iconName, run, keywords: keywords || '', hint });
        add('Go to', 'Home', 'home', () => go('index.html'), 'dashboard overview', ['g', 'h']);
        add('Go to', 'Transactions', 'list', () => go('transactions.html'), 'spending activity', ['g', 't']);
        add('Go to', 'Budgets', 'wallet', () => go('budgets.html'), 'goals savings', ['g', 'b']);
        add('Go to', 'Insights', 'chart', () => go('analytics.html'), 'analytics trends charts', ['g', 'i']);
        add('Go to', 'Settings', 'settings', () => go('settings.html'), 'preferences', ['g', 's']);
        add('Go to', 'Help and about', 'help', () => go('about.html'), 'guide support privacy');
        SETTINGS_SECTIONS.forEach(([id, label]) => add('Settings', label, 'settings', () => go('settings.html#' + id), 'settings'));
        add('Actions', 'Import transactions', 'upload', goImport, 'csv bank file upload', ['i']);
        add('Actions', 'Add transaction', 'plus', () => {
            if (typeof window.openAddTransaction === 'function') window.openAddTransaction();
            else go('transactions.html');
        }, 'cash expense income new', ['n']);
        add('Actions', 'Review transactions that need a category', 'tag', () => {
            const key = window.Store && window.Store.latestMonthKey ? window.Store.latestMonthKey() : null;
            if (typeof window.openReviewFlow === 'function') window.openReviewFlow({ monthKey: key });
            else go('transactions.html?view=review');
        }, 'uncategorized review sort');
        add('Actions', 'Open trash', 'trash', () => go('transactions.html?view=trash'), 'deleted restore');
        add('Account', 'Manage accounts', 'users', () => { if (typeof window.openManageAccounts === 'function') window.openManageAccounts(); }, 'rename delete');
        add('Account', 'New account', 'plus', () => { if (typeof window.openCreateAccount === 'function') window.openCreateAccount(); }, 'create');
        if (typeof getAccounts === 'function') {
            const activeId = getActiveAccountId();
            getAccounts().filter((a) => a.id !== activeId).forEach((a) => add('Account', 'Switch to ' + a.name, 'swap', () => { setActiveAccount(a.id); window.location.reload(); }, 'account'));
        }
        const dark = typeof getResolvedTheme === 'function' && getResolvedTheme() === 'dark';
        add('Appearance', dark ? 'Switch to light theme' : 'Switch to dark theme', dark ? 'sun' : 'moon', () => { if (typeof toggleTheme === 'function') toggleTheme(); }, 'toggle theme dark light appearance');
        add('Appearance', 'Use system theme', 'monitor', () => { if (typeof setThemePreference === 'function') setThemePreference('system'); }, 'theme auto');
        const hidden = typeof getHideAmounts === 'function' && getHideAmounts();
        add('Appearance', hidden ? 'Show amounts' : 'Hide amounts', hidden ? 'eye' : 'eye-off', () => { if (typeof setHideAmounts === 'function') setHideAmounts(!hidden); }, 'privacy blur money');
        add('Privacy', 'App lock settings', 'lock', () => { if (typeof window.openAppLockSettings === 'function') window.openAppLockSettings(); }, 'pin security');
        add('Help', 'Keyboard shortcuts', 'keyboard', openShortcuts, 'keys help');
        return list;
    }

    function score(query, text) {
        const q = query.toLowerCase();
        const t = text.toLowerCase();
        if (t === q) return 1000;
        if (t.startsWith(q)) return 900 - t.length;
        const at = t.indexOf(q);
        if (at >= 0) return (t[at - 1] === ' ' ? 800 : 700) - at;
        let qi = 0;
        let last = -2;
        let s = 0;
        for (let i = 0; i < t.length && qi < q.length; i++) {
            if (t[i] === q[qi]) {
                s += i === last + 1 ? 6 : 2;
                if (i === 0 || t[i - 1] === ' ') s += 5;
                last = i;
                qi++;
            }
        }
        return qi === q.length ? s : -1;
    }

    function filterCommands(all, query) {
        const q = query.trim();
        if (!q) return all.filter((c) => c.group !== 'Settings' || false);
        const out = [];
        all.forEach((c) => {
            const s = Math.max(score(q, c.label), score(q, c.label + ' ' + c.keywords) - 50);
            if (s >= 0) out.push({ c, s });
        });
        out.sort((a, b) => b.s - a.s);
        const res = out.map((x) => x.c);
        res.push({
            group: 'Search',
            label: 'Search transactions for "' + q + '"',
            icon: 'search',
            run: () => go('transactions.html?q=' + encodeURIComponent(q)),
            keywords: '',
        });
        return res;
    }

    function openPalette() {
        if (paletteState) return;
        if (document.getElementById('appLockScreen')) return;
        const opener = document.activeElement;
        const all = commands();
        const overlay = document.createElement('div');
        overlay.className = 'palette-overlay';
        overlay.innerHTML =
            '<div class="palette" role="dialog" aria-modal="true" aria-label="Search and commands">' +
            '<div class="palette-search">' + icon('search', 20) +
            '<input class="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="paletteList" aria-autocomplete="list" aria-label="Search pages and actions" placeholder="Search pages and actions" autocomplete="off" spellcheck="false">' +
            '</div><div class="palette-list" id="paletteList" role="listbox" aria-label="Results"></div>' +
            '<div class="palette-footer"><span><span class="kbd">Up</span><span class="kbd">Down</span> to move</span><span><span class="kbd">Enter</span> to open</span><span><span class="kbd">Esc</span> to close</span></div></div>';
        document.body.appendChild(overlay);
        document.documentElement.classList.add('sheet-open');
        const input = overlay.querySelector('.palette-input');
        const listEl = overlay.querySelector('.palette-list');
        let results = [];
        let sel = 0;

        function draw() {
            results = filterCommands(all, input.value);
            if (sel >= results.length) sel = Math.max(0, results.length - 1);
            if (!results.length) {
                listEl.innerHTML = '<div class="palette-empty">Nothing matches. Try another word.</div>';
                input.removeAttribute('aria-activedescendant');
                return;
            }
            let html = '';
            let group = null;
            results.forEach((r, i) => {
                if (r.group !== group) {
                    group = r.group;
                    html += '<div class="palette-group" role="presentation">' + esc(group) + '</div>';
                }
                const hint = r.hint ? '<span class="palette-item-hint">' + r.hint.map((k) => '<span class="kbd">' + esc(k) + '</span>').join('') + '</span>' : '';
                html += '<button type="button" class="palette-item" role="option" id="pal-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel ? 'true' : 'false') + '" tabindex="-1">' +
                    icon(r.icon, 18) + '<span class="palette-item-label">' + esc(r.label) + '</span>' + hint + '</button>';
            });
            listEl.innerHTML = html;
            input.setAttribute('aria-activedescendant', 'pal-' + sel);
            const cur = listEl.querySelector('#pal-' + sel);
            if (cur) cur.scrollIntoView({ block: 'nearest' });
        }

        function mark() {
            listEl.querySelectorAll('.palette-item').forEach((n) => n.setAttribute('aria-selected', n.dataset.i === String(sel) ? 'true' : 'false'));
            input.setAttribute('aria-activedescendant', 'pal-' + sel);
            const cur = listEl.querySelector('#pal-' + sel);
            if (cur) cur.scrollIntoView({ block: 'nearest' });
        }

        function close(restore) {
            if (!paletteState) return;
            paletteState = null;
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            document.documentElement.classList.remove('sheet-open');
            if (restore !== false && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
        }

        function run(i) {
            const r = results[i];
            if (!r) return;
            close(false);
            setTimeout(() => { try { r.run(); } catch (e) { console.error(e); } }, 0);
        }

        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { sel = (sel + 1) % results.length; mark(); } }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { sel = (sel - 1 + results.length) % results.length; mark(); } }
            else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
            else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
        }

        input.addEventListener('input', () => { sel = 0; draw(); });
        listEl.addEventListener('click', (e) => {
            const b = e.target.closest('.palette-item');
            if (b) run(Number(b.dataset.i));
        });
        listEl.addEventListener('mousemove', (e) => {
            const b = e.target.closest('.palette-item');
            if (b && Number(b.dataset.i) !== sel) { sel = Number(b.dataset.i); mark(); }
        });
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey, true);
        paletteState = { close };
        draw();
        input.focus();
    }

    function openShortcuts() {
        if (!window.UI) return;
        const rows = [
            ['Open search and commands', [modKey, 'K']],
            ['Search (alternative)', ['/']],
            ['Go to Home', ['g', 'h']],
            ['Go to Transactions', ['g', 't']],
            ['Go to Budgets', ['g', 'b']],
            ['Go to Insights', ['g', 'i']],
            ['Go to Settings', ['g', 's']],
            ['Add a transaction', ['n']],
            ['Import transactions', ['i']],
            ['Show this list', ['?']],
        ];
        const body = document.createElement('div');
        body.className = 'shortcut-list';
        body.innerHTML = rows.map(([label, keys]) =>
            '<div class="shortcut-row"><span>' + esc(label) + '</span><span class="shortcut-keys">' +
            keys.map((k) => '<span class="kbd">' + esc(k) + '</span>').join('') + '</span></div>').join('');
        window.UI.sheet({ title: 'Keyboard shortcuts', body, size: 'sm', actions: [{ label: 'Done', variant: 'primary' }] });
    }

    let gPending = null;
    function isTyping(t) {
        if (!t) return false;
        const tag = t.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    }

    function onKeydown(e) {
        if (e.defaultPrevented) return;
        const key = e.key;
        if ((e.metaKey || e.ctrlKey) && !e.altKey && key.toLowerCase() === 'k') {
            if (document.getElementById('appLockScreen')) return;
            e.preventDefault();
            if (paletteState) paletteState.close();
            else openPalette();
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (isTyping(e.target) || paletteState) return;
        if (document.querySelector('.sheet-overlay, .modal.show, .app-modal-overlay, #appLockScreen')) return;
        if (gPending) {
            clearTimeout(gPending);
            gPending = null;
            const map = { h: 'index.html', t: 'transactions.html', b: 'budgets.html', i: 'analytics.html', s: 'settings.html' };
            if (map[key]) { e.preventDefault(); go(map[key]); }
            return;
        }
        if (key === 'g') { gPending = setTimeout(() => { gPending = null; }, 1000); return; }
        if (key === '/') { e.preventDefault(); openPalette(); }
        else if (key === '?') { e.preventDefault(); openShortcuts(); }
        else if (key === 'n') {
            e.preventDefault();
            if (typeof window.openAddTransaction === 'function') window.openAddTransaction();
        } else if (key === 'i') {
            e.preventDefault();
            goImport();
        }
    }

    function setTitle(text) {
        customTitle = text ? String(text) : null;
        const n = document.getElementById('shellMobileTitle');
        if (n) n.textContent = pageLabel();
    }

    let titleObserver = null;
    function watchHeading() {
        if (titleObserver) { titleObserver.disconnect(); titleObserver = null; }
        const bar = document.getElementById('shellTopbar');
        const h1 = document.querySelector('main h1');
        if (!bar) return;
        const setShown = (on) => {
            bar.classList.toggle('show-title', on);
            const t = document.getElementById('shellMobileTitle');
            if (t) t.setAttribute('aria-hidden', on ? 'false' : 'true');
        };
        setShown(false);
        if (!h1 || !('IntersectionObserver' in window)) return;
        const barH = bar.offsetHeight || 52;
        titleObserver = new IntersectionObserver((entries) => {
            const e = entries[entries.length - 1];
            setShown(!e.isIntersecting && e.boundingClientRect.bottom < barH + 4);
        }, { rootMargin: '-' + barH + 'px 0px 0px 0px', threshold: 0 });
        titleObserver.observe(h1);
    }

    function refresh() {
        render();
        watchHeading();
    }

    function init() {
        if (!root()) {
            const r = document.createElement('div');
            r.id = 'appShell';
            document.body.insertBefore(r, document.body.firstChild);
        }
        render();
        root().addEventListener('click', onShellClick);
        watchHeading();
        window.addEventListener('load', watchHeading);
        setTimeout(watchHeading, 600);
    }

    document.addEventListener('keydown', onKeydown);
    window.openCommandPalette = openPalette;
    window.Shell = { setTitle, refresh };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
