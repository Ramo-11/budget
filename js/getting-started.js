(function () {
    const SAMPLE_FLAG = 'sahabBudget_sampleMode';
    const TOUR_SEEN = 'sahabBudget_welcomeSeen';
    const TOUR_PENDING = 'sahabBudget_tourPending';
    const TOAST_FLAG = 'sahabBudget_sampleToast';

    function store(fn) {
        try {
            return fn();
        } catch (e) {
            return null;
        }
    }

    function toast(message, type) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { type: type || 'info' });
        else if (typeof showNotification === 'function') showNotification(message, type || 'info');
    }

    function h(tag, attrs, children) {
        const el = document.createElement(tag);
        Object.entries(attrs || {}).forEach(([k, v]) => {
            if (v == null || v === false) return;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        });
        [].concat(children || []).forEach((c) => {
            if (c == null || c === false) return;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return el;
    }

    function icon(name, size) {
        return typeof UI !== 'undefined' && UI.icon ? UI.icon(name, size || 24) : '';
    }

    function isSampleMode() {
        const flag = store(() => localStorage.getItem(SAMPLE_FLAG)) === 'true';
        const onSample = typeof window.isSampleAccount !== 'function' || window.isSampleAccount();
        return flag && onSample;
    }

    function shiftSampleToToday(data) {
        const keys = (data.monthlyData || []).map((e) => e[0]).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
        if (!keys.length) return data;
        const last = keys[keys.length - 1].split('-').map(Number);
        const now = new Date();
        const delta = (now.getFullYear() - last[0]) * 12 + (now.getMonth() + 1 - last[1]);
        if (!delta) return data;
        const shiftKey = (key) => {
            const [y, m] = key.split('-').map(Number);
            const d = new Date(y, m - 1 + delta, 1);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        };
        const shiftDate = (value) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
            if (!m) return value;
            const nk = shiftKey(m[1] + '-' + m[2]).split('-').map(Number);
            const dim = new Date(nk[0], nk[1], 0).getDate();
            return nk[0] + '-' + String(nk[1]).padStart(2, '0') + '-' + String(Math.min(Number(m[3]), dim)).padStart(2, '0');
        };
        const remap = (obj) => {
            const out = {};
            Object.keys(obj || {}).forEach((k) => { out[/^\d{4}-\d{2}$/.test(k) ? shiftKey(k) : k] = obj[k]; });
            return out;
        };
        const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const monthlyData = data.monthlyData.map(([key, md]) => {
            const nk = shiftKey(key);
            const [y, m] = nk.split('-').map(Number);
            return [nk, Object.assign({}, md, {
                monthName: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                transactions: (md.transactions || [])
                    .map((t) => Object.assign({}, t, { 'Transaction Date': shiftDate(t['Transaction Date']) }))
                    .filter((t) => String(t['Transaction Date']) <= today),
            })];
        });
        return Object.assign({}, data, { monthlyData: monthlyData, budgets: remap(data.budgets), transactionOverrides: remap(data.transactionOverrides) });
    }

    async function loadSampleData() {
        try {
            const response = await fetch('sample_data.json');
            if (!response.ok) throw new Error('The sample file could not be loaded.');
            const data = shiftSampleToToday(await response.json());
            if (!data || !data.version || !data.monthlyData) throw new Error('The sample file is not valid.');
            const payload = {
                monthlyData: data.monthlyData,
                categoryConfig: data.categoryConfig || {},
                budgets: data.budgets || {},
                transactionOverrides: data.transactionOverrides || {},
                unifiedRules: data.unifiedRules || []
            };
            if (data.incomeSettings) payload.incomeSettings = data.incomeSettings;
            if (typeof beginSampleMode !== 'function') throw new Error('Sample mode is not available.');
            beginSampleMode(payload);
            store(() => sessionStorage.setItem(TOAST_FLAG, '1'));
            window.location.href = 'index.html';
        } catch (error) {
            console.error(error);
            toast('We could not load the sample data. ' + (error.message || ''), 'error');
        }
    }

    function exitSampleMode() {
        if (!isSampleMode()) {
            toast('You are not looking at sample data.', 'info');
            return;
        }
        if (typeof endSampleMode === 'function') endSampleMode();
        window.location.href = 'index.html';
    }

    function showHelp() {
        if (typeof UI === 'undefined' || !UI.sheet) {
            window.location.href = 'about.html';
            return null;
        }
        const body = h('div', { class: 'help-sheet' }, [
            h('p', { class: 'help-lead', text: 'Sahab Budget turns your bank files into a clear picture of where your money goes. Everything stays in this browser.' }),
            h('ol', { class: 'help-steps' }, [
                h('li', {}, [h('strong', { text: 'Import. ' }), 'Download a CSV from your bank and drop it here.']),
                h('li', {}, [h('strong', { text: 'Check categories. ' }), 'We sort what we can. Fix the rest and we remember.']),
                h('li', {}, [h('strong', { text: 'Set budgets. ' }), 'Pick a monthly amount per category and watch your progress.'])
            ]),
            h('p', { class: 'help-hint' }, ['Press ', h('kbd', { class: 'kbd', text: '?' }), ' anywhere to see keyboard shortcuts.'])
        ]);
        return UI.sheet({
            title: 'Help',
            subtitle: 'The short version.',
            body,
            size: 'sm',
            actions: [
                { label: 'Try sample data', variant: 'ghost', onClick: () => loadSampleData() },
                { label: 'Help and about', variant: 'secondary', onClick: () => { window.location.href = 'about.html'; }, closes: false },
                { label: 'Done', variant: 'primary' }
            ]
        });
    }

    const TOUR_CARDS = [
        { icon: 'upload', title: 'Import your bank file', text: 'Download a CSV from your bank and drop it anywhere in the app. It is read on this device and never uploaded.' },
        { icon: 'tag', title: 'We sort it for you, and you can teach it', text: 'Purchases land in categories on their own. Change one and choose to do the same for that store next time.' },
        { icon: 'target', title: 'Set budgets and goals', text: 'Pick a monthly amount for each category and set savings goals. You will see how you are doing at a glance.' }
    ];

    function startWelcomeTour() {
        if (typeof UI === 'undefined' || !UI.sheet) return null;
        store(() => localStorage.removeItem(TOUR_PENDING));
        store(() => localStorage.setItem(TOUR_SEEN, '1'));
        let index = 0;
        let ctx = null;
        const card = h('div', { class: 'tour-card' });
        const dots = h('div', { class: 'tour-dots', role: 'group' });
        const footer = h('div', { class: 'tour-footer' });
        const body = h('div', { class: 'tour' }, [card, dots, footer]);

        function draw() {
            const c = TOUR_CARDS[index];
            card.textContent = '';
            card.appendChild(h('span', { class: 'tour-icon', html: icon(c.icon, 32), 'aria-hidden': 'true' }));
            card.appendChild(h('h3', { class: 'tour-title', text: c.title }));
            card.appendChild(h('p', { class: 'tour-text', text: c.text }));
            dots.textContent = '';
            dots.setAttribute('aria-label', 'Step ' + (index + 1) + ' of ' + TOUR_CARDS.length);
            TOUR_CARDS.forEach((_, i) => dots.appendChild(h('span', { class: 'tour-dot' + (i === index ? ' is-active' : ''), 'aria-hidden': 'true' })));
            footer.textContent = '';
            const last = index === TOUR_CARDS.length - 1;
            if (index > 0) footer.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', text: 'Back', onclick: () => { index--; draw(); } }));
            else footer.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', text: 'Skip', onclick: () => ctx.close() }));
            const next = h('button', { type: 'button', class: 'btn btn-primary', text: last ? 'Get started' : 'Next', onclick: () => { if (last) ctx.close(); else { index++; draw(); } } });
            footer.appendChild(next);
            next.focus();
        }

        ctx = UI.sheet({ title: 'Welcome to Sahab Budget', subtitle: 'Three quick things to know.', body, size: 'sm', actions: [] });
        draw();
        return ctx;
    }

    function maybeStartWelcomeTour() {
        if (document.body.getAttribute('data-page') !== 'home') return;
        if (isSampleMode()) return;
        if (store(() => localStorage.getItem(TOUR_SEEN))) return;
        if (!store(() => localStorage.getItem(TOUR_PENDING))) return;
        if (typeof Store !== 'undefined' && Store.hasData && !Store.hasData()) return;
        startWelcomeTour();
    }

    function markTourPending() {
        if (store(() => localStorage.getItem(TOUR_SEEN))) return;
        store(() => localStorage.setItem(TOUR_PENDING, '1'));
    }

    document.addEventListener('DOMContentLoaded', () => {
        const flagSet = store(() => localStorage.getItem(SAMPLE_FLAG)) === 'true';
        if (flagSet && !isSampleMode()) store(() => localStorage.removeItem(SAMPLE_FLAG));
        if (store(() => sessionStorage.getItem(TOAST_FLAG))) {
            store(() => sessionStorage.removeItem(TOAST_FLAG));
            setTimeout(() => toast('Sample data loaded. Look around, then exit sample mode whenever you like.', 'success'), 300);
        }
        setTimeout(maybeStartWelcomeTour, 600);
    });

    window.loadSampleData = loadSampleData;
    window.exitSampleMode = exitSampleMode;
    window.isSampleMode = isSampleMode;
    window.showHelp = showHelp;
    window.startWelcomeTour = startWelcomeTour;
    window.maybeStartWelcomeTour = maybeStartWelcomeTour;
    window.markWelcomeTourPending = markTourPending;
})();
