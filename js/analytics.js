(function () {
    const TABS = [
        { value: 'overview', label: 'Overview' },
        { value: 'cashflow', label: 'Cashflow' },
        { value: 'trends', label: 'Trends' },
        { value: 'categories', label: 'Categories' },
        { value: 'merchants', label: 'Merchants' },
        { value: 'subscriptions', label: 'Subscriptions' },
        { value: 'compare', label: 'Compare' },
        { value: 'review', label: 'Month in review' },
    ];
    const PERIOD_TABS = ['overview', 'cashflow', 'trends', 'categories', 'merchants'];
    const STORE_KEY = 'sahabBudget_insightsPeriod';

    const state = {
        tab: 'overview',
        period: '3m',
        custom: null,
        trendCats: null,
        merchantSort: 'spend',
        printing: false,
    };
    const charts = {};
    let panel = null;
    let tabsControl = null;
    let periodSeg = null;
    let renderToken = 0;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function money(n, o) {
        return Store.money(n, o);
    }

    function m(n, o) {
        return '<span class="money num">' + esc(money(n, o)) + '</span>';
    }

    function tok(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function cssColor(v) {
        const mt = /var\((--[\w-]+)\)/.exec(v || '');
        return mt ? tok(mt[1]) : v || tok('--cat-16');
    }

    function catColorVar(name) {
        return typeof getCategoryColorVar === 'function' ? getCategoryColorVar(name) : 'var(--cat-16)';
    }

    function catColor(name) {
        return cssColor(catColorVar(name));
    }

    function chip(name, size) {
        return typeof UI !== 'undefined' && typeof UI.chip === 'function' ? UI.chip(name, { size: size || 'sm' }) : '';
    }

    function icon(name, size) {
        return typeof UI !== 'undefined' && typeof UI.icon === 'function' ? UI.icon(name, size || 20) : '';
    }

    function pct(n) {
        return Math.round(n * 100) + '%';
    }

    function amountsHidden() {
        return Store.prefs().hideAmounts || document.documentElement.classList.contains('hide-amounts');
    }

    function fmtDate(d, withYear) {
        const o = { month: 'short', day: 'numeric' };
        if (withYear) o.year = 'numeric';
        return d.toLocaleDateString(Store.prefs().locale, o);
    }

    function monthShort(key) {
        return Store.monthLabel(key, { short: true });
    }

    function emptyBlock(title, text) {
        return '<div class="ins-empty"><p class="ins-empty-title">' + esc(title) + '</p><p class="muted">' + esc(text) + '</p></div>';
    }

    function changeInfo(cur, prev) {
        const diff = cur - prev;
        if (prev <= 0.5) return { dir: cur > 0.5 ? 'new' : 'same', diff: diff, ratio: null };
        const ratio = diff / prev;
        if (Math.abs(ratio) < 0.03) return { dir: 'same', diff: diff, ratio: ratio };
        return { dir: diff > 0 ? 'up' : 'down', diff: diff, ratio: ratio };
    }

    function changeBadge(info) {
        if (info.dir === 'up') return '<span class="badge badge-warning">Up ' + pct(Math.abs(info.ratio)) + '</span>';
        if (info.dir === 'down') return '<span class="badge badge-success">Down ' + pct(Math.abs(info.ratio)) + '</span>';
        if (info.dir === 'new') return '<span class="badge">New</span>';
        return '<span class="badge">About the same</span>';
    }

    function aggregate(txs, months) {
        const out = { spent: 0, income: 0, count: 0, byCategory: {}, byMonth: {}, merchants: new Map(), biggest: null, spendByDay: {} };
        (months || []).forEach((mk) => {
            out.byMonth[mk] = { spent: 0, income: 0, count: 0, cats: {} };
        });
        txs.forEach((t) => {
            if (t.isTransfer || t.isExcluded) return;
            if (!out.byMonth[t.monthKey]) out.byMonth[t.monthKey] = { spent: 0, income: 0, count: 0, cats: {} };
            const bm = out.byMonth[t.monthKey];
            out.count++;
            bm.count++;
            if (t.isIncome) {
                out.income += t.absAmount;
                bm.income += t.absAmount;
                return;
            }
            out.byCategory[t.category] = (out.byCategory[t.category] || 0) + t.spend;
            bm.cats[t.category] = (bm.cats[t.category] || 0) + t.spend;
            bm.spent += t.spend;
            out.spent += t.spend;
            if (t.spend > 0) {
                out.spendByDay[t.dateKey] = (out.spendByDay[t.dateKey] || 0) + t.spend;
                let mer = out.merchants.get(t.merchant);
                if (!mer) {
                    mer = { name: t.merchant, total: 0, count: 0, cats: {}, last: t.date };
                    out.merchants.set(t.merchant, mer);
                }
                mer.total += t.spend;
                mer.count++;
                mer.cats[t.category] = (mer.cats[t.category] || 0) + t.spend;
                if (t.date > mer.last) mer.last = t.date;
                if (!out.biggest || t.spend > out.biggest.spend) out.biggest = t;
            }
        });
        Object.keys(out.byCategory).forEach((k) => {
            if (out.byCategory[k] < 0) out.byCategory[k] = 0;
        });
        Object.keys(out.byMonth).forEach((k) => {
            const b = out.byMonth[k];
            if (b.spent < 0) b.spent = 0;
            Object.keys(b.cats).forEach((c) => {
                if (b.cats[c] < 0) b.cats[c] = 0;
            });
        });
        out.spent = Math.max(0, out.spent);
        out.activeMonths = Math.max(1, Object.keys(out.byMonth).filter((k) => out.byMonth[k].count > 0).length);
        return out;
    }

    function topMerchant(mer) {
        let best = null;
        Object.keys(mer.cats).forEach((c) => {
            if (!best || mer.cats[c] > mer.cats[best]) best = c;
        });
        return best || 'Others';
    }

    function buildContext() {
        const period = window.InsightsRange.resolve(state.period, state.custom);
        if (!period) return null;
        const txs = Store.transactions({ from: period.from, to: period.to });
        const cur = aggregate(txs, period.months);
        let prev = null;
        if (period.prev) {
            const p = aggregate(Store.transactions({ from: period.prev.from, to: period.prev.to }), period.prev.months);
            if (p.count > 0) prev = p;
        }
        return { p: period, txs: txs, cur: cur, prev: prev };
    }

    function destroyCharts() {
        Object.keys(charts).forEach((k) => {
            try {
                charts[k].destroy();
            } catch (e) {
                void e;
            }
            delete charts[k];
        });
    }

    function makeChart(key, canvas, config) {
        if (!canvas || typeof Chart === 'undefined') return null;
        if (charts[key]) {
            try {
                charts[key].destroy();
            } catch (e) {
                void e;
            }
        }
        charts[key] = new Chart(canvas, config);
        return charts[key];
    }

    function baseOptions(extra) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hidden = amountsHidden();
        const muted = tok('--text-muted');
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            animation: reduce ? false : { duration: 250 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tok('--surface'),
                    titleColor: tok('--text'),
                    bodyColor: tok('--text-muted'),
                    borderColor: tok('--border-color'),
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => ' ' + ctx.dataset.label + ': ' + (hidden ? 'Hidden' : money(ctx.parsed.y)),
                    },
                },
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { color: muted, font: { size: 12 }, maxRotation: 0, autoSkipPadding: 12 } },
                y: {
                    beginAtZero: true,
                    grid: { color: tok('--border-color'), drawBorder: false },
                    ticks: { color: muted, font: { size: 12 }, maxTicksLimit: 5, callback: (v) => (hidden ? '' : money(v, { compact: true, cents: false })) },
                },
            },
        };
        Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
        if (extra) {
            Object.keys(extra).forEach((k) => {
                if (k === 'plugins' || k === 'scales') return;
                options[k] = extra[k];
            });
            if (extra.scales) {
                Object.keys(extra.scales).forEach((axis) => {
                    options.scales[axis] = Object.assign({}, options.scales[axis], extra.scales[axis]);
                });
            }
        }
        return options;
    }

    function chartBox(id, label, height) {
        return '<div class="ins-chart' + (height ? ' ' + height : '') + '"><canvas id="' + id + '" role="img" aria-label="' + esc(label) + '"></canvas></div>';
    }

    function sparkline(values, color) {
        if (values.length < 2) return '';
        const max = Math.max.apply(null, values.concat([1]));
        const w = 72;
        const h = 24;
        const pts = values.map((v, i) => ((i / (values.length - 1)) * (w - 4) + 2).toFixed(1) + ',' + (h - 3 - (v / max) * (h - 6)).toFixed(1)).join(' ');
        return '<svg class="ins-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" focusable="false" style="color:' + esc(color) + '"><polyline fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/></svg>';
    }

    function txLink(params) {
        const q = Object.keys(params)
            .filter((k) => params[k])
            .map((k) => k + '=' + encodeURIComponent(params[k]))
            .join('&');
        return 'transactions.html' + (q ? '?' + q : '');
    }

    function monthParam(p) {
        return p.months.length === 1 ? p.months[0] : '';
    }

    function effectiveEnd(p) {
        const all = Store.allTransactions();
        const latest = all.length ? all[0].date : new Date();
        return latest < p.to ? latest : p.to;
    }

    function dayCounts(p) {
        const end = effectiveEnd(p);
        let weekend = 0;
        let weekday = 0;
        const d = new Date(p.from.getFullYear(), p.from.getMonth(), p.from.getDate());
        let guard = 0;
        while (d <= end && guard < 4000) {
            const g = d.getDay();
            if (g === 0 || g === 6) weekend++;
            else weekday++;
            d.setDate(d.getDate() + 1);
            guard++;
        }
        return { weekend: weekend, weekday: weekday, total: weekend + weekday };
    }

    function buildInsightCards(ctx) {
        const { p, cur, prev, txs } = ctx;
        const cards = [];

        if (prev && prev.spent > 0) {
            const names = new Set(Object.keys(cur.byCategory).concat(Object.keys(prev.byCategory)));
            let best = null;
            names.forEach((name) => {
                const a = cur.byCategory[name] || 0;
                const b = prev.byCategory[name] || 0;
                const d = a - b;
                if (Math.abs(d) < 20) return;
                if (b > 0 && Math.abs(d) / b < 0.1) return;
                if (!best || Math.abs(d) > Math.abs(best.d)) best = { name: name, a: a, b: b, d: d };
            });
            if (best) {
                const label = ctx.p.prev.label;
                const html = best.b <= 0.5
                    ? esc(best.name) + ' is new: ' + m(best.a) + ' spent, and nothing in ' + esc(label) + '.'
                    : esc(best.name) + ' spending is ' + (best.d > 0 ? 'up ' : 'down ') + pct(Math.abs(best.d) / best.b) + ': ' + m(Math.abs(best.d)) + (best.d > 0 ? ' more' : ' less') + ' than ' + esc(label) + '.';
                cards.push({ title: best.d > 0 ? 'Biggest increase' : 'Biggest drop', html: html, href: txLink({ category: best.name, month: monthParam(p) }) });
            }
        }

        if (p.id !== 'all' && typeof detectRecurring === 'function') {
            const all = Store.allTransactions();
            const dataStart = all.length ? all[all.length - 1].date : null;
            const fresh = detectRecurring().filter((r) => !r.stopped && dataStart && r.firstDate - dataStart > 35 * 86400000 && r.firstDate >= p.from && r.firstDate <= p.to);
            if (fresh.length) {
                const names = fresh.slice(0, 3).map((r) => esc(Store.merchantName(r.label))).join(', ');
                const total = fresh.reduce((s, r) => s + r.monthly, 0);
                cards.push({
                    title: fresh.length === 1 ? 'New subscription' : 'New subscriptions',
                    html: names + (fresh.length > 3 ? ' and ' + (fresh.length - 3) + ' more' : '') + ' started in this period, about ' + m(total) + ' a month.',
                    href: 'analytics.html?tab=subscriptions',
                });
            }
        }

        if (cur.biggest) {
            const b = cur.biggest;
            cards.push({
                title: 'Biggest purchase',
                html: m(b.spend) + ' at ' + esc(b.merchant) + ' on ' + esc(fmtDate(b.date)) + '.',
                href: txLink({ id: b.id, q: b.merchant }),
            });
        }

        const counts = dayCounts(p);
        if (counts.weekend >= 4 && counts.weekday >= 8 && cur.spent > 0) {
            let weekendSpend = 0;
            let weekdaySpend = 0;
            txs.forEach((t) => {
                if (t.spend <= 0 || t.isTransfer || t.isExcluded || t.isIncome) return;
                const g = t.date.getDay();
                if (g === 0 || g === 6) weekendSpend += t.spend;
                else weekdaySpend += t.spend;
            });
            const we = weekendSpend / counts.weekend;
            const wd = weekdaySpend / counts.weekday;
            if (wd > 0 && we / wd >= 1.25) {
                cards.push({ title: 'Weekends cost more', html: 'You spend about ' + m(we) + ' a day on weekends and ' + m(wd) + ' on weekdays.' });
            } else if (we > 0 && wd / we >= 1.25) {
                cards.push({ title: 'Weekdays cost more', html: 'You spend about ' + m(wd) + ' a day on weekdays and ' + m(we) + ' on weekends.' });
            } else if (we > 0 && wd > 0) {
                cards.push({ title: 'Steady all week', html: 'Weekends (' + m(we) + ' a day) and weekdays (' + m(wd) + ' a day) cost about the same.' });
            }
        }

        if (cur.income > 0) {
            const kept = cur.income - cur.spent;
            cards.push({
                title: kept >= 0 ? 'Money kept' : 'Spent more than earned',
                html: kept >= 0
                    ? 'You kept ' + m(kept) + ', which is ' + pct(kept / cur.income) + ' of your income.'
                    : 'You spent ' + m(-kept) + ' more than you earned in this period.',
            });
        }
        return cards.slice(0, 5);
    }

    function statTile(label, valueHtml, subHtml) {
        return '<div class="ins-stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + valueHtml + '</div>' + (subHtml ? '<div class="ins-stat-sub">' + subHtml + '</div>' : '') + '</div>';
    }

    function deltaText(curV, prevV, label, lowerIsBetter) {
        if (prevV == null) return '';
        const info = changeInfo(curV, prevV);
        if (info.dir === 'same') return 'About the same as ' + esc(label);
        if (info.dir === 'new') return 'Nothing in ' + esc(label);
        void lowerIsBetter;
        return pct(Math.abs(info.ratio)) + (info.diff > 0 ? ' more' : ' less') + ' than ' + esc(label);
    }

    function monthlySeries(ctx) {
        return ctx.p.months.map((k) => ({ key: k, label: monthShort(k), b: ctx.cur.byMonth[k] || { spent: 0, income: 0, count: 0, cats: {} } }));
    }

    function renderOverview(el, ctx) {
        const { p, cur, prev } = ctx;
        const net = cur.income - cur.spent;
        const avg = cur.spent / cur.activeMonths;
        const topCat = Object.keys(cur.byCategory).filter((n) => cur.byCategory[n] > 0).sort((a, b) => cur.byCategory[b] - cur.byCategory[a])[0];
        const prevLabel = p.prev ? p.prev.label : '';
        let html = '<div class="ins-stats">' +
            statTile('Spent', m(cur.spent), prev ? deltaText(cur.spent, prev.spent, prevLabel) : '') +
            (cur.income > 0
                ? statTile('Income', m(cur.income), prev ? deltaText(cur.income, prev.income, prevLabel) : '') +
                  statTile(net >= 0 ? 'Saved' : 'Spent more than you earned', m(Math.abs(net)), net >= 0 ? pct(net / cur.income) + ' of income' : 'Compared with what came in')
                : statTile('Income', '<span class="ins-stat-none">None recorded</span>', 'Mark paychecks as income in Transactions') +
                  statTile('Biggest category', topCat ? esc(topCat) : 'None yet', topCat ? m(cur.byCategory[topCat]) + ', ' + pct(cur.spent > 0 ? cur.byCategory[topCat] / cur.spent : 0) + ' of spending' : '')) +
            statTile('Average per month', m(avg), cur.activeMonths > 1 ? 'Across ' + cur.activeMonths + ' months' : 'Based on this month') +
            '</div>';

        html += '<section class="card ins-card" aria-labelledby="insTimeTitle"><div class="card-header"><h2 class="card-title" id="insTimeTitle">Spending over time</h2></div>';
        if (cur.spent > 0) {
            html += chartBox('insChartMain', 'Bar chart of spending ' + (p.months.length > 1 ? 'by month' : 'by day') + ' for ' + p.label);
        } else {
            html += emptyBlock('No spending in this period', 'Pick another period to see your spending over time.');
        }
        html += '</section>';

        const cards = buildInsightCards(ctx);
        html += '<section class="ins-section" aria-labelledby="insInsightsTitle"><h2 class="section-title" id="insInsightsTitle">What stands out</h2>';
        if (cards.length) {
            html += '<div class="ins-cards">' + cards.map((c) => {
                const body = '<span class="ins-insight-title">' + esc(c.title) + '</span><span class="ins-insight-text">' + c.html + '</span>';
                return c.href ? '<a class="ins-insight" href="' + esc(c.href) + '">' + body + '</a>' : '<div class="ins-insight">' + body + '</div>';
            }).join('') + '</div>';
        } else {
            html += '<p class="muted">Add another month of transactions and notes about your spending will show up here.</p>';
        }
        html += '</section>';

        const cats = Object.keys(cur.byCategory).filter((k) => cur.byCategory[k] > 0).sort((a, b) => cur.byCategory[b] - cur.byCategory[a]);
        const mers = Array.from(cur.merchants.values()).sort((a, b) => b.total - a.total);
        html += '<div class="ins-two">';
        html += '<section class="card ins-card" aria-labelledby="insTopCatTitle"><div class="card-header"><h2 class="card-title" id="insTopCatTitle">Top categories</h2><a class="ins-link" href="analytics.html?tab=categories">See all</a></div>';
        if (cats.length) {
            html += '<ul class="ins-list">' + cats.slice(0, 6).map((name) => {
                const v = cur.byCategory[name];
                const share = cur.spent > 0 ? v / cur.spent : 0;
                return '<li><a class="ins-row" href="' + esc(txLink({ category: name, month: monthParam(p) })) + '">' + chip(name) +
                    '<span class="ins-row-main"><span class="ins-row-title">' + esc(name) + '</span>' +
                    '<span class="ins-bar" aria-hidden="true"><span style="width:' + Math.max(2, share * 100).toFixed(1) + '%;background:' + esc(catColorVar(name)) + '"></span></span></span>' +
                    '<span class="ins-row-trail">' + m(v) + '<span class="ins-row-sub">' + pct(share) + '</span></span></a></li>';
            }).join('') + '</ul>';
        } else {
            html += emptyBlock('No categories yet', 'Spending will be grouped here.');
        }
        html += '</section>';

        html += '<section class="card ins-card" aria-labelledby="insTopMerTitle"><div class="card-header"><h2 class="card-title" id="insTopMerTitle">Top merchants</h2><a class="ins-link" href="analytics.html?tab=merchants">See all</a></div>';
        if (mers.length) {
            html += '<ul class="ins-list">' + mers.slice(0, 6).map((mer) => {
                const c = topMerchant(mer);
                return '<li><a class="ins-row" href="' + esc(txLink({ q: mer.name })) + '">' + chip(c) +
                    '<span class="ins-row-main"><span class="ins-row-title">' + esc(mer.name) + '</span><span class="ins-row-sub">' + mer.count + (mer.count === 1 ? ' purchase' : ' purchases') + '</span></span>' +
                    '<span class="ins-row-trail">' + m(mer.total) + '</span></a></li>';
            }).join('') + '</ul>';
        } else {
            html += emptyBlock('No merchants yet', 'Places you spend at will show here.');
        }
        html += '</section></div>';
        el.innerHTML = html;

        const canvas = el.querySelector('#insChartMain');
        if (!canvas) return;
        const brand = tok('--brand');
        let labels;
        let data;
        if (p.months.length > 1) {
            const series = monthlySeries(ctx);
            labels = series.map((s) => s.label);
            data = series.map((s) => Math.round(s.b.spent * 100) / 100);
        } else {
            const end = effectiveEnd(p);
            labels = [];
            data = [];
            const d = new Date(p.from.getFullYear(), p.from.getMonth(), p.from.getDate());
            while (d <= end) {
                const key = Store.isoDate(d);
                labels.push(String(d.getDate()));
                data.push(Math.round((cur.spendByDay[key] || 0) * 100) / 100);
                d.setDate(d.getDate() + 1);
            }
        }
        makeChart('main', canvas, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Spent', data: data, backgroundColor: brand, borderRadius: 6, borderSkipped: 'bottom', maxBarThickness: 36, barPercentage: 0.7, categoryPercentage: 0.8 }] },
            options: baseOptions({ plugins: {} }),
        });
    }

    function renderCashflow(el, ctx) {
        const { p, cur } = ctx;
        const series = monthlySeries(ctx);
        const hasData = cur.income > 0 || cur.spent > 0;
        let html = '<section class="card ins-card" aria-labelledby="insCashTitle"><div class="card-header"><h2 class="card-title" id="insCashTitle">Income and spending</h2>' +
            '<ul class="ins-legend"><li><span class="ins-dot" style="background:var(--success)"></span>Income</li><li><span class="ins-dot" style="background:var(--brand)"></span>Spent</li><li><span class="ins-dot ins-dot-line"></span>Left over</li></ul></div>';
        if (hasData) {
            html += chartBox('insChartCash', 'Monthly income, spending and amount left over for ' + p.label);
            const rate = cur.income > 0 ? (cur.income - cur.spent) / cur.income : null;
            html += '<p class="ins-note">' + (rate == null
                ? 'No income was recorded in this period, so there is no savings rate to show.'
                : rate >= 0
                    ? 'Over this period you kept <strong>' + pct(rate) + '</strong> of what came in.'
                    : 'Over this period you spent <strong>' + pct(-rate) + '</strong> more than what came in.') + '</p>';
            html += '<div class="ins-table-wrap"><table class="ins-table"><caption class="visually-hidden">Income, spending, left over and savings rate by month</caption><thead><tr><th scope="col">Month</th><th scope="col" class="num">Income</th><th scope="col" class="num">Spent</th><th scope="col" class="num">Left over</th><th scope="col" class="num">Saved</th></tr></thead><tbody>';
            series.forEach((s) => {
                const net = s.b.income - s.b.spent;
                html += '<tr><th scope="row">' + esc(Store.monthLabel(s.key)) + '</th><td class="num">' + m(s.b.income) + '</td><td class="num">' + m(s.b.spent) + '</td><td class="num">' + m(net, { sign: true }) + '</td><td class="num">' + (s.b.income > 0 ? pct(net / s.b.income) : 'No income') + '</td></tr>';
            });
            const totalNet = cur.income - cur.spent;
            html += '</tbody><tfoot><tr><th scope="row">Total</th><td class="num">' + m(cur.income) + '</td><td class="num">' + m(cur.spent) + '</td><td class="num">' + m(totalNet, { sign: true }) + '</td><td class="num">' + (cur.income > 0 ? pct(totalNet / cur.income) : 'No income') + '</td></tr></tfoot></table></div>';
        } else {
            html += emptyBlock('Nothing to show for this period', 'Pick another period or import more transactions.');
        }
        html += '</section>';
        el.innerHTML = html;

        const canvas = el.querySelector('#insChartCash');
        if (!canvas) return;
        const net = series.map((s) => Math.round((s.b.income - s.b.spent) * 100) / 100);
        makeChart('cash', canvas, {
            type: 'bar',
            data: {
                labels: series.map((s) => s.label),
                datasets: [
                    { type: 'bar', label: 'Income', data: series.map((s) => Math.round(s.b.income * 100) / 100), backgroundColor: tok('--success'), borderRadius: 6, maxBarThickness: 28, order: 2 },
                    { type: 'bar', label: 'Spent', data: series.map((s) => Math.round(s.b.spent * 100) / 100), backgroundColor: tok('--brand'), borderRadius: 6, maxBarThickness: 28, order: 2 },
                    { type: 'line', label: 'Left over', data: net, borderColor: tok('--text'), backgroundColor: tok('--text'), borderWidth: 2, pointRadius: 3, tension: 0.25, order: 1 },
                ],
            },
            options: baseOptions({}),
        });
    }

    function renderTrends(el, ctx) {
        const { cur } = ctx;
        const series = monthlySeries(ctx);
        const names = Object.keys(cur.byCategory).filter((k) => cur.byCategory[k] > 0).sort((a, b) => cur.byCategory[b] - cur.byCategory[a]);
        if (!names.length) {
            el.innerHTML = '<section class="card ins-card">' + emptyBlock('No spending in this period', 'Pick another period to see how categories change over time.') + '</section>';
            return;
        }
        if (!state.trendCats) state.trendCats = names.slice(0, 5);
        const selected = state.trendCats.filter((n) => names.indexOf(n) !== -1);
        let html = '<section class="card ins-card" aria-labelledby="insTrendTitle"><div class="card-header"><h2 class="card-title" id="insTrendTitle">Spending by category</h2></div>';
        html += '<div class="ins-chips" role="group" aria-label="Choose categories to show">' + names.map((n) => {
            const on = selected.indexOf(n) !== -1;
            return '<button type="button" class="chip-button ins-cat-chip" data-cat="' + esc(n) + '" aria-pressed="' + on + '"><span class="ins-dot" style="background:' + esc(catColorVar(n)) + '"></span>' + esc(n) + '</button>';
        }).join('') + '</div>';
        if (selected.length) {
            html += chartBox('insChartTrend', 'Stacked bars of monthly spending for ' + selected.join(', '), 'ins-chart-tall');
            const totals = series.map((s) => selected.reduce((sum, n) => sum + (s.b.cats[n] || 0), 0));
            const active = series.filter((s) => s.b.count > 0).length || 1;
            const avg = totals.reduce((a, b) => a + b, 0) / active;
            html += '<p class="ins-note">Average for the chosen categories: ' + m(avg) + ' a month.</p>';
            html += '<details class="ins-details"><summary>Show as a table</summary><div class="ins-table-wrap"><table class="ins-table"><caption class="visually-hidden">Monthly spending for the chosen categories</caption><thead><tr><th scope="col">Month</th>' + selected.map((n) => '<th scope="col" class="num">' + esc(n) + '</th>').join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' +
                series.map((s, i) => '<tr><th scope="row">' + esc(Store.monthLabel(s.key)) + '</th>' + selected.map((n) => '<td class="num">' + m(s.b.cats[n] || 0) + '</td>').join('') + '<td class="num">' + m(totals[i]) + '</td></tr>').join('') +
                '</tbody></table></div></details>';
        } else {
            html += emptyBlock('Choose a category', 'Tap one or more categories above to see them over time.');
        }
        html += '</section>';
        el.innerHTML = html;

        el.onclick = (e) => {
            const btn = e.target.closest('.ins-cat-chip');
            if (!btn) return;
            const n = btn.dataset.cat;
            const next = state.trendCats.slice();
            const i = next.indexOf(n);
            if (i === -1) next.push(n);
            else next.splice(i, 1);
            state.trendCats = next;
            const focus = n;
            renderPanel();
            const again = Array.from(panel.querySelectorAll('.ins-cat-chip')).find((b) => b.dataset.cat === focus);
            if (again) again.focus();
        };

        const canvas = el.querySelector('#insChartTrend');
        if (!canvas) return;
        const totals = series.map((s) => selected.reduce((sum, n) => sum + (s.b.cats[n] || 0), 0));
        const active = series.filter((s) => s.b.count > 0).length || 1;
        const avg = totals.reduce((a, b) => a + b, 0) / active;
        const datasets = selected.map((n) => ({
            type: 'bar',
            label: n,
            data: series.map((s) => Math.round((s.b.cats[n] || 0) * 100) / 100),
            backgroundColor: catColor(n),
            stack: 'spend',
            maxBarThickness: 40,
            order: 2,
        }));
        datasets.push({ type: 'line', label: 'Average', data: series.map(() => Math.round(avg * 100) / 100), borderColor: tok('--text'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
        makeChart('trend', canvas, {
            type: 'bar',
            data: { labels: series.map((s) => s.label), datasets: datasets },
            options: baseOptions({ scales: { x: { stacked: true }, y: { stacked: true } } }),
        });
    }

    function trailingContext(ctx) {
        const { p, cur } = ctx;
        if (p.months.length >= 3) return { months: p.months, agg: cur };
        const startKey = Store.shiftMonth(p.endKey, -5);
        const months = [];
        for (let i = 0; i < 6; i++) months.push(Store.shiftMonth(startKey, i));
        const from = Store.monthDate(startKey);
        const to = window.InsightsRange.endOfMonth(p.endKey);
        return { months: months, agg: aggregate(Store.transactions({ from: from, to: to }), months) };
    }

    function renderCategories(el, ctx) {
        const { p, cur, prev } = ctx;
        const names = Object.keys(cur.byCategory).filter((k) => cur.byCategory[k] > 0).sort((a, b) => cur.byCategory[b] - cur.byCategory[a]);
        if (!names.length) {
            el.innerHTML = '<section class="card ins-card">' + emptyBlock('No spending in this period', 'Pick another period to see your categories.') + '</section>';
            return;
        }
        const trail = trailingContext(ctx);
        let html = '<section class="card ins-card" aria-labelledby="insCatsTitle"><div class="card-header"><h2 class="card-title" id="insCatsTitle">All categories</h2><span class="muted ins-hint">Tap one for details</span></div><ul class="ins-list">';
        names.forEach((name) => {
            const v = cur.byCategory[name];
            const share = cur.spent > 0 ? v / cur.spent : 0;
            const info = prev ? changeInfo(v, prev.byCategory[name] || 0) : null;
            const spark = sparkline(trail.months.map((k) => (trail.agg.byMonth[k] ? trail.agg.byMonth[k].cats[name] || 0 : 0)), catColor(name));
            html += '<li><button type="button" class="ins-row ins-row-button" data-cat="' + esc(name) + '">' + chip(name) +
                '<span class="ins-row-main"><span class="ins-row-title">' + esc(name) + '</span><span class="ins-row-sub">' + pct(share) + ' of spending, ' + m(v / cur.activeMonths) + ' a month</span></span>' +
                '<span class="ins-row-spark">' + spark + '</span>' +
                '<span class="ins-row-trail">' + m(v) + (info ? changeBadge(info) : '') + '</span></button></li>';
        });
        html += '</ul></section>';
        el.innerHTML = html;

        el.onclick = (e) => {
            const btn = e.target.closest('.ins-row-button');
            if (btn) openCategorySheet(btn.dataset.cat, ctx, trail, btn);
        };
    }

    function openCategorySheet(name, ctx, trail, opener) {
        if (typeof UI === 'undefined' || typeof UI.sheet !== 'function') return;
        const { p, txs } = ctx;
        const list = txs.filter((t) => t.category === name && t.spend > 0 && !t.isTransfer && !t.isExcluded);
        const mers = new Map();
        list.forEach((t) => {
            const x = mers.get(t.merchant) || { name: t.merchant, total: 0, count: 0 };
            x.total += t.spend;
            x.count++;
            mers.set(t.merchant, x);
        });
        const top = Array.from(mers.values()).sort((a, b) => b.total - a.total).slice(0, 5);
        const total = ctx.cur.byCategory[name] || 0;
        const body = document.createElement('div');
        body.className = 'ins-sheet';
        body.innerHTML = '<p class="ins-sheet-total">' + m(total) + '<span class="muted"> in ' + esc(p.label) + '</span></p>' +
            '<h3 class="ins-sheet-h">By month</h3>' + chartBox('insChartCat', 'Monthly spending in ' + name) +
            '<h3 class="ins-sheet-h">Top merchants</h3>' +
            (top.length ? '<ul class="ins-list">' + top.map((x) => '<li><a class="ins-row" href="' + esc(txLink({ q: x.name, category: name })) + '"><span class="ins-row-main"><span class="ins-row-title">' + esc(x.name) + '</span><span class="ins-row-sub">' + x.count + (x.count === 1 ? ' purchase' : ' purchases') + '</span></span><span class="ins-row-trail">' + m(x.total) + '</span></a></li>').join('') + '</ul>' : '<p class="muted">No purchases in this category for this period.</p>') +
            '<p class="ins-sheet-link"><a class="btn btn-secondary" href="' + esc(txLink({ category: name, month: monthParam(p) })) + '">See transactions</a></p>';
        UI.sheet({
            title: name,
            subtitle: p.label,
            body: body,
            size: 'md',
            onClose: () => {
                if (charts.sheet) {
                    try {
                        charts.sheet.destroy();
                    } catch (e) {
                        void e;
                    }
                    delete charts.sheet;
                }
                if (opener && document.contains(opener)) opener.focus();
            },
            actions: [{ label: 'Close', variant: 'ghost' }],
        });
        const canvas = body.querySelector('#insChartCat');
        makeChart('sheet', canvas, {
            type: 'bar',
            data: {
                labels: trail.months.map(monthShort),
                datasets: [{ label: name, data: trail.months.map((k) => Math.round(((trail.agg.byMonth[k] && trail.agg.byMonth[k].cats[name]) || 0) * 100) / 100), backgroundColor: catColor(name), borderRadius: 6, maxBarThickness: 32 }],
            },
            options: baseOptions({}),
        });
    }

    function renderMerchants(el, ctx) {
        const { cur } = ctx;
        const all = Array.from(cur.merchants.values());
        if (!all.length) {
            el.innerHTML = '<section class="card ins-card">' + emptyBlock('No purchases in this period', 'Pick another period to see where your money goes.') + '</section>';
            return;
        }
        el.innerHTML = '<section class="card ins-card" aria-labelledby="insMerTitle"><div class="card-header"><h2 class="card-title" id="insMerTitle">Where your money goes</h2><div id="insMerSort" class="ins-sort"></div></div><div id="insMerList"></div></section>';
        const listEl = el.querySelector('#insMerList');
        const draw = () => {
            const sorted = all.slice().sort((a, b) => (state.merchantSort === 'visits' ? b.count - a.count || b.total - a.total : b.total - a.total)).slice(0, 30);
            listEl.innerHTML = '<ul class="ins-list">' + sorted.map((x) => {
                const c = topMerchant(x);
                const share = cur.spent > 0 ? x.total / cur.spent : 0;
                return '<li><a class="ins-row" href="' + esc(txLink({ q: x.name })) + '">' + chip(c) +
                    '<span class="ins-row-main"><span class="ins-row-title">' + esc(x.name) + '</span><span class="ins-row-sub">' + x.count + (x.count === 1 ? ' visit' : ' visits') + ', ' + m(x.total / x.count) + ' each, ' + pct(share) + ' of spending</span></span>' +
                    '<span class="ins-row-trail">' + m(x.total) + '</span></a></li>';
            }).join('') + '</ul>' + (all.length > 30 ? '<p class="ins-note">Showing the top 30 of ' + all.length + ' places.</p>' : '');
        };
        const sortHost = el.querySelector('#insMerSort');
        if (typeof UI !== 'undefined' && typeof UI.segmented === 'function') {
            UI.segmented(sortHost, {
                options: [{ value: 'spend', label: 'Most spent' }, { value: 'visits', label: 'Most visits' }],
                value: state.merchantSort,
                ariaLabel: 'Sort merchants',
                onChange: (v) => {
                    state.merchantSort = v;
                    draw();
                },
            });
        }
        draw();
    }

    function periodSelectHtml() {
        return window.InsightsRange.OPTIONS.map((o) => '<option value="' + o.value + '"' + (o.value === state.period ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
    }

    function saveState() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({ period: state.period, custom: state.custom }));
        } catch (e) {
            void e;
        }
    }

    function loadState() {
        try {
            const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (v && window.InsightsRange.OPTIONS.some((o) => o.value === v.period)) {
                state.period = v.period;
                state.custom = v.custom && v.custom.start && v.custom.end ? v.custom : null;
                if (state.period === 'custom' && !state.custom) state.period = '3m';
            }
        } catch (e) {
            void e;
        }
    }

    function rangeText(period) {
        const loc = Store.prefs().locale;
        const end = effectiveEnd(period);
        const start = period.from;
        const same = start.getFullYear() === end.getFullYear();
        const a = start.toLocaleDateString(loc, same ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
        const b = end.toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric' });
        return a + ' to ' + b;
    }

    function updateControls(period) {
        const wrap = document.getElementById('insPeriodWrap');
        const select = document.getElementById('insPeriod');
        const sub = document.getElementById('insSubtitle');
        const show = PERIOD_TABS.indexOf(state.tab) !== -1;
        wrap.hidden = !show;
        if (select) select.value = state.period;
        if (periodSeg && periodSeg.set) periodSeg.set(state.period);
        if (sub) sub.textContent = period && show ? rangeText(period) : 'See where your money goes and how it changes.';
    }

    function showError(el, err) {
        console.error(err);
        el.innerHTML = '';
        const box = typeof UI !== 'undefined' && typeof UI.emptyNode === 'function'
            ? UI.emptyNode({ icon: 'alert', title: 'Something went wrong', text: 'We could not draw this page. Your data is safe.', action: { label: 'Try again', onClick: () => renderPanel() } })
            : null;
        if (box) el.appendChild(box);
        else el.innerHTML = emptyBlock('Something went wrong', 'We could not draw this page. Your data is safe.');
    }

    function renderNoData() {
        const tabsWrap = document.getElementById('insTabsWrap');
        const wrap = document.getElementById('insPeriodWrap');
        if (tabsWrap) tabsWrap.hidden = true;
        if (wrap) wrap.hidden = true;
        panel.innerHTML = '';
        panel.onclick = null;
        if (typeof UI !== 'undefined' && typeof UI.emptyNode === 'function') {
            panel.appendChild(UI.emptyNode({
                icon: 'chart',
                title: 'Insights show up after your first import',
                text: 'Bring in a bank file and this page will show where your money goes, what repeats, and how months compare.',
                action: { label: 'Import transactions', onClick: () => { if (typeof window.openImport === 'function') window.openImport(); } },
                secondary: typeof window.loadSampleData === 'function' ? { label: 'Try sample data', onClick: () => window.loadSampleData() } : undefined,
            }));
        } else {
            panel.innerHTML = emptyBlock('Insights show up after your first import', 'Import a bank file to get started.');
        }
    }

    function renderPanel() {
        if (state.printing || !panel) return;
        renderToken++;
        destroyCharts();
        panel.onclick = null;
        if (!Store.hasData()) {
            renderNoData();
            return;
        }
        const tabsWrap = document.getElementById('insTabsWrap');
        if (tabsWrap) tabsWrap.hidden = false;
        const renderer = Insights.tabs[state.tab];
        try {
            if (PERIOD_TABS.indexOf(state.tab) !== -1) {
                const ctx = buildContext();
                updateControls(ctx && ctx.p);
                if (!ctx) {
                    renderNoData();
                    return;
                }
                renderer(panel, ctx);
            } else {
                updateControls(null);
                if (typeof renderer !== 'function') throw new Error('Missing tab: ' + state.tab);
                renderer(panel, null);
            }
        } catch (err) {
            showError(panel, err);
        }
    }

    function setTab(value, push) {
        if (!Insights.tabs[value]) return;
        state.tab = value;
        if (tabsControl && typeof tabsControl.set === 'function') tabsControl.set(value);
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            window.history[push ? 'pushState' : 'replaceState'](null, '', url);
        } catch (e) {
            void e;
        }
        renderPanel();
        const active = document.querySelector('#insTabs [aria-checked="true"], #insTabs [aria-selected="true"], #insTabs [aria-pressed="true"], #insTabs .is-active, #insTabs .active');
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    function buildTabs() {
        const host = document.getElementById('insTabs');
        if (typeof UI !== 'undefined' && typeof UI.segmented === 'function') {
            tabsControl = UI.segmented(host, {
                options: TABS,
                value: state.tab,
                ariaLabel: 'Insights sections',
                onChange: (v) => {
                    if (v !== state.tab) setTab(v, true);
                },
            });
            return;
        }
        host.innerHTML = TABS.map((t) => '<button type="button" class="btn btn-secondary btn-sm" data-tab="' + t.value + '" aria-pressed="' + (t.value === state.tab) + '">' + esc(t.label) + '</button>').join('');
        host.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            host.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            setTab(b.dataset.tab, true);
        });
        tabsControl = {
            set: (v) => host.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === v))),
        };
    }

    function applyPeriod(v, select) {
        if (v === 'custom') {
            window.InsightsRange.openCustomSheet({
                value: state.custom,
                onApply: (range) => {
                    state.custom = range;
                    state.period = 'custom';
                    saveState();
                    renderPanel();
                },
                onCancel: () => {
                    select.value = state.period;
                    if (periodSeg && periodSeg.set) periodSeg.set(state.period);
                },
            });
            return;
        }
        state.period = v;
        saveState();
        renderPanel();
    }

    function bindPeriod() {
        const select = document.getElementById('insPeriod');
        select.innerHTML = periodSelectHtml();
        select.addEventListener('change', () => applyPeriod(select.value, select));
        const host = document.getElementById('insPeriodSeg');
        if (host && typeof UI !== 'undefined' && typeof UI.segmented === 'function') {
            const short = { month: 'This month', '3m': '3 months', '6m': '6 months', year: 'This year', all: 'All time', custom: 'Custom' };
            periodSeg = UI.segmented(host, {
                options: window.InsightsRange.OPTIONS.map((o) => ({ value: o.value, label: short[o.value] })),
                value: state.period,
                ariaLabel: 'Period',
                onChange: (v) => {
                    if (v !== state.period || v === 'custom') applyPeriod(v, select);
                },
            });
        } else if (host) {
            host.hidden = true;
        }
    }

    function boot() {
        Store.init();
        panel = document.getElementById('insPanel');
        const params = new URLSearchParams(window.location.search);
        const wanted = params.get('tab');
        if (wanted && TABS.some((t) => t.value === wanted)) state.tab = wanted;
        loadState();
        buildTabs();
        bindPeriod();
        renderPanel();
        Store.onChange(() => renderPanel());
        window.addEventListener('popstate', () => {
            const t = new URLSearchParams(window.location.search).get('tab');
            if (t && TABS.some((x) => x.value === t) && t !== state.tab) {
                state.tab = t;
                if (tabsControl) tabsControl.set(t);
                renderPanel();
            }
        });
        new MutationObserver(() => renderPanel()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        window.addEventListener('beforeprint', () => {
            state.printing = true;
            state.printTheme = document.documentElement.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', 'light');
        });
        window.addEventListener('afterprint', () => {
            if (state.printTheme) document.documentElement.setAttribute('data-theme', state.printTheme);
            state.printTheme = null;
            setTimeout(() => {
                state.printing = false;
                renderPanel();
            }, 50);
        });
    }

    const Insights = {
        tabs: {
            overview: renderOverview,
            cashflow: renderCashflow,
            trends: renderTrends,
            categories: renderCategories,
            merchants: renderMerchants,
        },
        register: function (name, fn) {
            Insights.tabs[name] = fn;
        },
        kit: {
            esc: esc,
            m: m,
            money: money,
            tok: tok,
            catColor: catColor,
            catColorVar: catColorVar,
            chip: chip,
            icon: icon,
            pct: pct,
            fmtDate: fmtDate,
            monthShort: monthShort,
            emptyBlock: emptyBlock,
            aggregate: aggregate,
            changeInfo: changeInfo,
            changeBadge: changeBadge,
            makeChart: makeChart,
            baseOptions: baseOptions,
            chartBox: chartBox,
            txLink: txLink,
            rerender: () => renderPanel(),
            isPrinting: () => state.printing,
        },
    };
    window.Insights = Insights;

    document.addEventListener('DOMContentLoaded', boot);
})();
