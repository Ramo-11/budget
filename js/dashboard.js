(function () {
    const MONTH_KEY = 'sahabBudget_homeMonth';
    let chart = null;
    let selected = null;
    let stepper = null;

    const esc = (s) => (window.UI && UI.esc ? UI.esc(s) : escapeHtml(String(s == null ? '' : s)));
    const icon = (name, size) => (window.UI && UI.icon ? UI.icon(name, size || 20) : '');
    const money = (n, o) => `<span class="money">${esc(Store.money(n, o))}</span>`;
    const root = () => document.getElementById('homeRoot');

    function readStored() {
        try { return sessionStorage.getItem(MONTH_KEY); } catch (e) { return null; }
    }
    function writeStored(v) {
        try { sessionStorage.setItem(MONTH_KEY, v); } catch (e) { void e; }
    }

    function pickMonth(keys) {
        if (selected && keys.includes(selected)) return selected;
        const stored = readStored();
        if (stored && keys.includes(stored)) return stored;
        const cur = Store.currentMonthKey();
        return keys.includes(cur) ? cur : keys[0];
    }

    function greeting() {
        const h = new Date().getHours();
        return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    }

    function daysIn(monthKey) {
        const d = Store.monthDate(monthKey);
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    function cssColor(value) {
        const m = /var\((--[^),\s]+)/.exec(value || '');
        if (!m) return value;
        return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || value;
    }
    function token(name, fallback) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function dueWords(days) {
        if (days <= 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        return `in ${days} days`;
    }

    function previousComparison(monthKey, keys, spent) {
        const prev = Store.shiftMonth(monthKey, -1);
        if (!keys.includes(prev)) return null;
        const isCurrent = monthKey === Store.currentMonthKey();
        let prevSpent;
        if (isCurrent) {
            const day = new Date().getDate();
            prevSpent = Math.max(0, Store.transactions({ monthKey: prev }).reduce((s, t) => (t.date.getDate() <= day ? s + t.spend : s), 0));
        } else {
            prevSpent = Store.summary(prev).spent;
        }
        if (prevSpent <= 0) return null;
        const pct = Math.round(((spent - prevSpent) / prevSpent) * 100);
        const name = Store.monthLabel(prev, { monthOnly: true });
        const suffix = isCurrent ? ' at this point' : '';
        if (pct === 0) return { cls: '', arrow: 'arrow-down', text: `About the same as ${name}${suffix}` };
        if (pct < 0) return { cls: 'is-good', arrow: 'arrow-down', text: `${Math.abs(pct)}% less than ${name}${suffix}` };
        return { cls: 'is-warn', arrow: 'arrow-up', text: `${pct}% more than ${name}${suffix}` };
    }

    function heroHtml(monthKey, sum, trend) {
        const isCurrent = monthKey === Store.currentMonthKey();
        const trendHtml = trend ? `<span class="trend ${trend.cls}">${icon(trend.arrow, 16)}<span>${esc(trend.text)}</span></span>` : '<span></span>';
        if (sum.budgetTotal > 0) {
            const over = sum.budgetLeft < 0;
            const frac = Math.min(1, Math.max(0, sum.spent / sum.budgetTotal));
            let pace = '';
            if (!over && isCurrent) {
                const daysLeft = Math.max(1, daysIn(monthKey) - new Date().getDate() + 1);
                pace = `About ${money(sum.budgetLeft / daysLeft, { cents: false })} a day for the next ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
            }
            return `<section class="card hero" aria-labelledby="heroLabel">
                <h2 class="hero-label" id="heroLabel">${over ? 'Over budget' : 'Left to spend'}</h2>
                <p class="hero-value ${over ? 'is-over' : ''}">${money(Math.abs(sum.budgetLeft), { cents: false })}</p>
                <p class="hero-sub">of ${money(sum.budgetTotal, { cents: false })} budget, ${money(sum.spent, { cents: false })} spent</p>
                ${UI.progress(frac, { tone: 'auto', label: 'Share of budget spent' })}
                ${pace ? `<p class="hero-pace">${pace}</p>` : ''}
                <div class="hero-foot">${trendHtml}<a class="text-link" href="budgets.html?month=${esc(monthKey)}">Edit budgets</a></div>
            </section>`;
        }
        return `<section class="card hero" aria-labelledby="heroLabel">
            <h2 class="hero-label" id="heroLabel">${isCurrent ? 'Spent this month' : `Spent in ${esc(Store.monthLabel(monthKey, { monthOnly: true }))}`}</h2>
            <p class="hero-value">${money(sum.spent, { cents: false })}</p>
            <p class="hero-sub">Set a budget to see how much you have left to spend.</p>
            <div class="hero-foot">${trendHtml}<a class="text-link" href="budgets.html?month=${esc(monthKey)}">Set a budget</a></div>
        </section>`;
    }

    function flowHtml(sum) {
        const max = Math.max(sum.income, sum.spent, 1);
        const hasIncome = sum.income > 0;
        let note = '';
        if (hasIncome) {
            const rate = sum.savingsRate == null ? 0 : Math.round(sum.savingsRate * 100);
            note = sum.net >= 0
                ? `You kept ${rate}% of what came in.`
                : `You spent ${money(Math.abs(sum.net), { cents: false })} more than came in.`;
        } else {
            note = 'No income found this month. Mark a deposit as income in Transactions to see savings.';
        }
        const incomeBlock = hasIncome ? `<div class="stat"><span class="stat-label">Money in</span><span class="stat-value amount-in">${money(sum.income, { cents: false })}</span></div>` : '';
        const netBlock = hasIncome ? `<div class="stat"><span class="stat-label">${sum.net >= 0 ? 'Saved' : 'Overspent'}</span><span class="stat-value">${money(Math.abs(sum.net), { cents: false })}</span></div>` : '';
        const incomeBar = hasIncome ? `<div class="flow-bar" role="img" aria-label="Money in compared with spending"><span class="fill-income" style="width:${(sum.income / max) * 100}%"></span></div>` : '';
        return `<section class="card flow" aria-labelledby="flowTitle">
            <h2 class="card-title" id="flowTitle">Money in and out</h2>
            <div class="flow-numbers">
                ${incomeBlock}
                <div class="stat"><span class="stat-label">Spent</span><span class="stat-value">${money(sum.spent, { cents: false })}</span></div>
                ${netBlock}
            </div>
            <div class="flow-bars">${incomeBar}<div class="flow-bar"><span class="fill-spent" style="width:${(sum.spent / max) * 100}%"></span></div></div>
            <p class="flow-note">${note}</p>
        </section>`;
    }

    function attentionHtml(monthKey, sum) {
        const items = [];
        if (sum.needsReview > 0) {
            const n = sum.needsReview;
            items.push(`<button type="button" class="attention-item" data-action="review"><span class="att-main"><span class="att-icon">${icon('tag', 20)}</span><span>${n} ${n === 1 ? 'transaction needs' : 'transactions need'} a category</span></span><span class="att-go">${icon('chevron-right', 18)}</span></button>`);
        }
        const budgets = Store.budgetsFor(monthKey);
        const over = Object.keys(budgets).filter((c) => (sum.byCategory[c] || 0) > budgets[c].effective + 0.005).length;
        if (over > 0) {
            items.push(`<a class="attention-item" href="budgets.html?month=${esc(monthKey)}"><span class="att-main"><span class="att-icon">${icon('alert', 20)}</span><span>${over} ${over === 1 ? 'category is' : 'categories are'} over budget</span></span><span class="att-go">${icon('chevron-right', 18)}</span></a>`);
        }
        const soon = Store.upcomingBills({ days: 7 });
        if (soon.length) {
            const first = soon[0];
            const text = soon.length === 1
                ? `${esc(first.name)} is due ${esc(dueWords(first.daysAway).toLowerCase())}`
                : `${soon.length} bills are due this week`;
            items.push(`<a class="attention-item" href="analytics.html?tab=subscriptions"><span class="att-main"><span class="att-icon">${icon('calendar', 20)}</span><span>${text}</span></span><span class="att-go">${icon('chevron-right', 18)}</span></a>`);
        }
        if (!items.length) return '';
        return `<section class="attention" aria-label="Needs your attention">${items.join('')}</section>`;
    }

    function categoriesHtml(monthKey, sum) {
        const entries = Object.keys(sum.byCategory).map((k) => [k, sum.byCategory[k]]).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return '';
        const top = entries.slice(0, 6);
        const budgets = Store.budgetsFor(monthKey);
        const rows = top.map(([name, amount]) => {
            const share = sum.spent > 0 ? Math.round((amount / sum.spent) * 100) : 0;
            const b = budgets[name];
            const meter = b ? `<div class="row-meter">${UI.progress(Math.min(1, amount / b.effective), { tone: 'auto', label: `${name} budget used` })}</div>` : '';
            const sub = b ? `${share}% of spending, ${money(b.effective, { cents: false })} budget` : `${share}% of spending`;
            return `<a class="list-row" href="transactions.html?month=${esc(monthKey)}&amp;category=${encodeURIComponent(name)}">
                ${UI.chip(name)}
                <span class="list-row-main"><span class="list-row-title">${esc(name)}</span><span class="list-row-sub">${sub}</span>${meter}</span>
                <span class="list-row-trail">${money(amount, { cents: false })}</span></a>`;
        }).join('');
        return `<section class="card card-flush" aria-labelledby="catTitle">
            <div class="home-card-head"><h2 class="card-title" id="catTitle">Where your money went</h2></div>
            <div class="cat-chart"><canvas id="catChart" role="img" aria-label="Spending by category"></canvas><div class="cat-chart-center" aria-hidden="true"><strong class="money">${esc(Store.money(sum.spent, { cents: false }))}</strong><span>spent</span></div></div>
            <div class="list home-list">${rows}</div>
            <div class="home-card-foot"><a class="text-link" href="analytics.html?tab=categories">See all categories</a></div>
        </section>`;
    }

    function billsHtml() {
        const bills = Store.upcomingBills({ days: 30 }).slice(0, 5);
        if (!bills.length) return '';
        const rows = bills.map((b) => `<a class="list-row" href="analytics.html?tab=subscriptions">
            ${UI.chip(b.category || 'Others')}
            <span class="list-row-main"><span class="list-row-title">${esc(b.name)}</span><span class="list-row-sub">${esc(dueWords(b.daysAway))}</span></span>
            <span class="list-row-trail">${money(b.amount, { cents: false })}</span></a>`).join('');
        return `<section class="card card-flush" aria-labelledby="billsTitle">
            <div class="home-card-head"><h2 class="card-title" id="billsTitle">Coming up</h2></div>
            <div class="list home-list">${rows}</div>
            <div class="home-card-foot"><a class="text-link" href="analytics.html?tab=subscriptions">See all bills</a></div>
        </section>`;
    }

    function recentHtml(monthKey) {
        const list = Store.transactions({ monthKey }).slice(0, 6);
        if (!list.length) return '';
        const rows = list.map((t) => {
            const dateText = UI.formatDate(t.date, { style: 'short' });
            const catText = t.needsReview ? 'Needs a category' : t.category;
            const sub = `${esc(dateText)}, ${esc(catText)}${t.isRefund ? ', Refund' : ''}`;
            const amount = t.isIncome || t.isRefund
                ? `<span class="amount-in">${money(t.absAmount, { sign: true })}</span>`
                : money(t.absAmount);
            return `<button type="button" class="list-row" data-action="tx" data-id="${esc(t.id)}">
                ${UI.chip(t.category)}
                <span class="list-row-main"><span class="list-row-title">${esc(t.merchant)}</span><span class="list-row-sub">${sub}</span></span>
                <span class="list-row-trail">${amount}</span></button>`;
        }).join('');
        return `<section class="card card-flush" aria-labelledby="recentTitle">
            <div class="home-card-head"><h2 class="card-title" id="recentTitle">Recent transactions</h2></div>
            <div class="list home-list">${rows}</div>
            <div class="home-card-foot"><a class="text-link" href="transactions.html?month=${esc(monthKey)}">See all</a></div>
        </section>`;
    }

    function insightCards(monthKey, keys, sum) {
        const cards = [];
        const prev = Store.shiftMonth(monthKey, -1);
        if (keys.includes(prev)) {
            const prevSum = Store.summary(prev);
            let best = null;
            Object.keys(sum.byCategory).forEach((c) => {
                const now = sum.byCategory[c] || 0;
                const before = prevSum.byCategory[c] || 0;
                const diff = now - before;
                if (before > 0 && Math.abs(diff) >= 20 && Math.abs(diff) / before >= 0.2 && (!best || Math.abs(diff) > Math.abs(best.diff))) best = { c, diff, before };
            });
            if (best) {
                const pct = Math.round((Math.abs(best.diff) / best.before) * 100);
                const word = best.diff > 0 ? 'more' : 'less';
                cards.push({ icon: best.diff > 0 ? 'arrow-up' : 'arrow-down', title: `${best.c} is ${pct}% ${word} than ${Store.monthLabel(prev, { monthOnly: true })}`, text: `${Store.money(Math.abs(best.diff), { cents: false })} ${word} than last month.` });
            }
        }
        const buys = Store.transactions({ monthKey }).filter((t) => t.spend > 0);
        if (buys.length) {
            const big = buys.reduce((a, b) => (b.spend > a.spend ? b : a));
            cards.push({ icon: 'wallet', title: `Biggest purchase: ${Store.money(big.spend, { cents: false })}`, text: `${big.merchant} on ${UI.formatDate(big.date, { style: 'short' })}.` });
            const isCurrent = monthKey === Store.currentMonthKey();
            const span = isCurrent ? new Date().getDate() : daysIn(monthKey);
            const spendDays = new Set(buys.filter((t) => t.date.getDate() <= span).map((t) => t.dateKey));
            const free = span - spendDays.size;
            if (free >= 3) {
                cards.push({ icon: 'sun', title: `${free} no-spend days`, text: `You did not spend anything on ${free} of ${span} ${isCurrent ? 'days so far' : 'days'}.` });
            }
        }
        return cards.slice(0, 3);
    }

    function insightsHtml(monthKey, keys, sum) {
        const cards = insightCards(monthKey, keys, sum);
        if (!cards.length) return '';
        return `<section aria-labelledby="insTitle"><h2 class="section-title" id="insTitle">Worth knowing</h2><div class="insights-grid">${cards.map((c) => `<div class="insight"><span class="insight-icon">${icon(c.icon, 20)}</span><div><h3 class="insight-title">${esc(c.title)}</h3><p class="insight-text">${esc(c.text)}</p></div></div>`).join('')}</div></section>`;
    }

    function welcomeNode() {
        const wrap = document.createElement('div');
        wrap.className = 'welcome';
        wrap.innerHTML = `
            <div class="welcome-hero">
                <h1>See where your money goes.</h1>
                <p>Your data never leaves this device.</p>
            </div>
            <div class="welcome-actions">
                <button type="button" class="btn btn-primary btn-lg" data-action="import">Import a bank file</button>
                <div class="welcome-quiet">
                    <button type="button" class="btn btn-ghost" data-action="sample">Try with sample data</button>
                    <button type="button" class="btn btn-ghost" data-action="add">Add a transaction by hand</button>
                </div>
            </div>
            <section aria-labelledby="howTitle">
                <h2 class="section-title" id="howTitle">How it works</h2>
                <ol class="steps">
                    <li><span class="step-num" aria-hidden="true">1</span><span>Download a CSV from your bank</span></li>
                    <li><span class="step-num" aria-hidden="true">2</span><span>Import it here</span></li>
                    <li><span class="step-num" aria-hidden="true">3</span><span>See your month</span></li>
                </ol>
            </section>
            <p class="welcome-privacy">${icon('shield', 18)}<span>No account, no upload. Everything stays in this browser.</span></p>`;
        return wrap;
    }

    function destroyChart() {
        if (chart) { chart.destroy(); chart = null; }
    }

    function drawChart(sum) {
        const canvas = document.getElementById('catChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const entries = Object.keys(sum.byCategory).map((k) => [k, sum.byCategory[k]]).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
        const top = entries.slice(0, 6);
        const rest = entries.slice(6).reduce((s, e) => s + e[1], 0);
        const labels = top.map((e) => e[0]);
        const data = top.map((e) => e[1]);
        const colors = top.map((e) => cssColor(getCategoryColorVar(e[0])));
        if (rest > 0) {
            labels.push('Everything else');
            data.push(rest);
            colors.push(token('--text-muted', '#888'));
        }
        const surface = token('--surface', '#fff');
        chart = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: surface, borderWidth: 2 }] },
            options: {
                cutout: '70%',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `${c.label}: ${Store.money(c.parsed, { cents: false })}` } },
                },
            },
        });
    }

    function render() {
        const el = root();
        if (!el) return;
        destroyChart();
        const keys = Store.monthKeys();
        el.removeAttribute('aria-busy');

        if (!keys.length) {
            el.replaceChildren(welcomeNode());
            if (window.Shell && Shell.setTitle) Shell.setTitle('Home');
            return;
        }

        const monthKey = pickMonth(keys);
        selected = monthKey;
        const sum = Store.summary(monthKey);
        const trend = previousComparison(monthKey, keys, sum.spent);

        let body;
        if (sum.count === 0) {
            body = '<div id="homeEmpty"></div>';
        } else {
            const attention = attentionHtml(monthKey, sum);
            const topLeft = [heroHtml(monthKey, sum, trend), flowHtml(sum), attention].filter(Boolean).join('');
            const topRight = categoriesHtml(monthKey, sum);
            const lowLeft = recentHtml(monthKey);
            const lowRight = [billsHtml(), insightsHtml(monthKey, keys, sum)].filter(Boolean).join('');
            const grid = (a, b) => (a || b) ? `<div class="home-grid"><div class="home-col">${a}</div><div class="home-col">${b}</div></div>` : '';
            body = grid(topLeft, topRight) + grid(lowLeft, lowRight);
        }

        el.innerHTML = `<div class="home">
            <div class="home-top">
                <div><p class="home-greeting">${esc(greeting())}</p><h1 class="visually-hidden">Home</h1></div>
                <div id="homeStepper"></div>
            </div>
            ${body}
        </div>`;

        const stepEl = document.getElementById('homeStepper');
        if (window.UI && UI.monthStepper) {
            stepper = UI.monthStepper(stepEl, {
                value: monthKey,
                keys,
                onChange: (k) => {
                    selected = k;
                    writeStored(k);
                    render();
                },
            });
        } else {
            stepEl.textContent = Store.monthLabel(monthKey);
        }

        const emptyHost = document.getElementById('homeEmpty');
        if (emptyHost) {
            const node = UI.emptyNode({
                icon: 'calendar',
                title: `Nothing in ${Store.monthLabel(monthKey)} yet`,
                text: 'Import a bank file or add a transaction to see this month.',
                action: { label: 'Import a bank file', onClick: () => { if (typeof window.openImport === 'function') window.openImport(); } },
                secondary: { label: 'Add a transaction', onClick: () => { if (typeof window.openAddTransaction === 'function') window.openAddTransaction(); } },
            });
            emptyHost.replaceWith(node);
        } else {
            drawChart(sum);
        }
    }

    function onClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target || !root().contains(target)) return;
        const action = target.getAttribute('data-action');
        if (action === 'import' && typeof window.openImport === 'function') window.openImport();
        else if (action === 'sample' && typeof window.loadSampleData === 'function') window.loadSampleData();
        else if (action === 'add' && typeof window.openAddTransaction === 'function') window.openAddTransaction();
        else if (action === 'review' && typeof window.openReviewFlow === 'function') window.openReviewFlow({ monthKey: selected });
        else if (action === 'tx' && typeof window.openTransactionSheet === 'function') window.openTransactionSheet(target.getAttribute('data-id'));
    }

    document.addEventListener('DOMContentLoaded', () => {
        Store.init();
        render();
        Store.onChange(() => render());
        root().addEventListener('click', onClick);
        new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
})();
