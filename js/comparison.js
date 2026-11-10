window.isSpendingCategory = function (category) {
    const config = (typeof categoryConfig !== 'undefined' && categoryConfig[category]) || {};
    return config._isExcluded !== true && config._isIncome !== true && category !== 'Income';
};

window.computeSpendingSummary = function (transactions) {
    const analyzer = analyzeTransactions(transactions);
    const byCategory = {};
    let total = 0;
    let count = 0;
    Object.entries(analyzer.categoryDetails).forEach(([category, items]) => {
        if (!window.isSpendingCategory(category)) return;
        let categoryTotal = 0;
        items.forEach((item) => {
            if (item.isIncome) return;
            categoryTotal += item.isRefund ? -item.amount : item.amount;
            count += 1;
        });
        if (categoryTotal < 0) categoryTotal = 0;
        byCategory[category] = categoryTotal;
        total += categoryTotal;
    });
    return { analyzer: analyzer, byCategory: byCategory, total: total, count: count };
};

(function () {
    const cmp = { a: null, b: null };
    let reviewKey = null;

    function kit() {
        return window.Insights.kit;
    }

    function defaultKeys() {
        const keys = Store.monthKeys();
        const cur = Store.currentMonthKey();
        const a = keys.indexOf(cur) !== -1 ? cur : keys[0];
        const prev = Store.shiftMonth(a, -1);
        const b = keys.indexOf(prev) !== -1 ? prev : keys[1] || keys[0];
        return { a: a, b: b, keys: keys };
    }

    function monthOptions(keys, selected) {
        const k = kit();
        return keys.map((key) => '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + k.esc(Store.monthLabel(key)) + '</option>').join('');
    }

    function renderCompare(el) {
        const k = kit();
        const d = defaultKeys();
        if (d.keys.length < 2) {
            el.innerHTML = '<section class="card ins-card">' + k.emptyBlock('You need two months to compare', 'Import another month of transactions and you can see what changed, category by category.') + '</section>';
            return;
        }
        if (!cmp.a || d.keys.indexOf(cmp.a) === -1) cmp.a = d.a;
        if (!cmp.b || d.keys.indexOf(cmp.b) === -1) cmp.b = d.b;

        const sa = Store.summary(cmp.a);
        const sb = Store.summary(cmp.b);
        const names = Array.from(new Set(Object.keys(sa.byCategory).concat(Object.keys(sb.byCategory))));
        const rows = names.map((n) => ({ name: n, a: sa.byCategory[n] || 0, b: sb.byCategory[n] || 0 })).map((r) => Object.assign(r, { diff: r.a - r.b })).filter((r) => Math.abs(r.diff) >= 0.005);
        const more = rows.filter((r) => r.diff > 0).sort((x, y) => y.diff - x.diff);
        const less = rows.filter((r) => r.diff < 0).sort((x, y) => x.diff - y.diff);
        const maxDiff = rows.reduce((mx, r) => Math.max(mx, Math.abs(r.diff)), 1);
        const total = sa.spent - sb.spent;
        const la = Store.monthLabel(cmp.a);
        const lb = Store.monthLabel(cmp.b);

        let summary;
        if (cmp.a === cmp.b) summary = 'Pick two different months to see what changed.';
        else if (Math.abs(total) < 0.005) summary = 'You spent the same in ' + k.esc(la) + ' as in ' + k.esc(lb) + '.';
        else summary = 'You spent ' + k.m(Math.abs(total)) + (total > 0 ? ' more' : ' less') + ' in ' + k.esc(la) + ' than in ' + k.esc(lb) + '.';

        const group = (title, list, tone) => {
            if (!list.length) return '';
            return '<section class="card ins-card" aria-label="' + k.esc(title) + '"><div class="card-header"><h2 class="card-title">' + k.esc(title) + '</h2></div><ul class="ins-list">' + list.map((r) => {
                const w = Math.max(3, (Math.abs(r.diff) / maxDiff) * 100).toFixed(1);
                return '<li><a class="ins-row ins-compare-row" href="' + k.esc(k.txLink({ category: r.name, month: cmp.a })) + '">' + k.chip(r.name) +
                    '<span class="ins-row-main"><span class="ins-row-title">' + k.esc(r.name) + '</span>' +
                    '<span class="ins-bar ins-bar-' + tone + '" aria-hidden="true"><span style="width:' + w + '%"></span></span>' +
                    '<span class="ins-row-sub">' + k.m(r.b) + ' in ' + k.esc(Store.monthLabel(cmp.b, { short: true })) + ', ' + k.m(r.a) + ' in ' + k.esc(Store.monthLabel(cmp.a, { short: true })) + '</span></span>' +
                    '<span class="ins-row-trail">' + k.m(r.diff, { sign: true }) + '</span></a></li>';
            }).join('') + '</ul></section>';
        };

        el.innerHTML = '<section class="card ins-card" aria-labelledby="insCmpTitle"><div class="card-header"><h2 class="card-title" id="insCmpTitle">Compare two months</h2></div>' +
            '<div class="ins-cmp-pick"><div class="field"><label for="insCmpA">This month</label><select id="insCmpA" class="select">' + monthOptions(d.keys, cmp.a) + '</select></div>' +
            '<div class="field"><label for="insCmpB">Compared with</label><select id="insCmpB" class="select">' + monthOptions(d.keys, cmp.b) + '</select></div></div>' +
            '<p class="ins-cmp-summary" aria-live="polite">' + summary + '</p>' +
            '<div class="ins-cmp-totals"><div><span class="stat-label">' + k.esc(la) + '</span><span class="ins-cmp-num">' + k.m(sa.spent) + '</span></div><div><span class="stat-label">' + k.esc(lb) + '</span><span class="ins-cmp-num">' + k.m(sb.spent) + '</span></div></div></section>' +
            (rows.length ? group('Spent more', more, 'up') + group('Spent less', less, 'down') : '<section class="card ins-card">' + k.emptyBlock('No differences', 'These months have the same spending in every category.') + '</section>');

        const onSelect = () => {
            cmp.a = el.querySelector('#insCmpA').value;
            cmp.b = el.querySelector('#insCmpB').value;
            k.rerender();
            const again = el.querySelector('#insCmpA');
            if (again) again.focus();
        };
        el.querySelector('#insCmpA').addEventListener('change', onSelect);
        el.querySelector('#insCmpB').addEventListener('change', onSelect);
    }

    function recap(key, s, prev, biggest, subsMonthly) {
        const k = kit();
        const label = k.esc(Store.monthLabel(key, { monthOnly: true }));
        let text = 'In ' + label + ' you spent ' + k.m(s.spent);
        if (s.income > 0) {
            text += ' and earned ' + k.m(s.income);
            const net = s.income - s.spent;
            text += net >= 0 ? ', so you kept ' + k.m(net) + ' (' + k.pct(net / s.income) + ').' : ', so you were ' + k.m(-net) + ' over.';
        } else {
            text += '.';
        }
        if (prev && prev.spent > 0) {
            const info = k.changeInfo(s.spent, prev.spent);
            const pl = k.esc(Store.monthLabel(Store.shiftMonth(key, -1), { monthOnly: true }));
            if (info.dir === 'same') text += ' That is about the same as ' + pl + '.';
            else text += ' That is ' + k.pct(Math.abs(info.ratio)) + (info.diff > 0 ? ' more' : ' less') + ' than ' + pl + '.';
        }
        if (biggest) text += ' Your biggest purchase was ' + k.m(biggest.spend) + ' at ' + k.esc(biggest.merchant) + '.';
        if (subsMonthly > 0) text += ' Repeating charges add up to about ' + k.m(subsMonthly) + ' a month.';
        return text;
    }

    function renderReview(el) {
        const k = kit();
        const keys = Store.monthKeys();
        if (!keys.length) {
            el.innerHTML = '';
            return;
        }
        if (!reviewKey || keys.indexOf(reviewKey) === -1) {
            const cur = Store.currentMonthKey();
            reviewKey = keys.indexOf(cur) !== -1 ? cur : keys[0];
        }
        const key = reviewKey;
        const s = Store.summary(key);
        const prevKey = Store.shiftMonth(key, -1);
        const prev = keys.indexOf(prevKey) !== -1 ? Store.summary(prevKey) : null;
        const txs = Store.transactions({ monthKey: key }).filter((t) => t.spend > 0 && !t.isIncome && !t.isExcluded);
        const biggest = txs.slice().sort((a, b) => b.spend - a.spend).slice(0, 5);
        const cats = Object.keys(s.byCategory).filter((n) => s.byCategory[n] > 0).sort((a, b) => s.byCategory[b] - s.byCategory[a]).slice(0, 5);
        const budgets = Store.budgetsFor(key);
        const budgetNames = Object.keys(budgets);
        const subsMonthly = typeof detectRecurring === 'function' ? recurringMonthlyTotal(detectRecurring()) : 0;
        const net = s.income - s.spent;

        let html = '<div class="ins-review-bar no-print"><div id="insReviewStepper"></div><button type="button" class="btn btn-primary" id="insPrint">Print or save as PDF</button></div>';
        html += '<article class="ins-review" aria-labelledby="insReviewTitle">' +
            '<header class="ins-review-head"><p class="ins-review-kicker">Month in review</p><h2 id="insReviewTitle" class="ins-review-title">' + k.esc(Store.monthLabel(key)) + '</h2></header>' +
            '<p class="ins-review-recap">' + recap(key, s, prev, biggest[0], subsMonthly) + '</p>' +
            '<div class="ins-review-stats">' +
            '<div><span class="stat-label">Spent</span><span class="ins-review-num">' + k.m(s.spent) + '</span></div>' +
            '<div><span class="stat-label">Income</span><span class="ins-review-num">' + k.m(s.income) + '</span></div>' +
            '<div><span class="stat-label">' + (net >= 0 ? 'Saved' : 'Overspent') + '</span><span class="ins-review-num">' + k.m(Math.abs(net)) + '</span></div></div>';

        html += '<section class="ins-review-block" aria-labelledby="insRevCats"><h3 id="insRevCats">Where it went</h3>';
        html += cats.length ? '<ul class="ins-review-list">' + cats.map((n) => {
            const share = s.spent > 0 ? s.byCategory[n] / s.spent : 0;
            return '<li><span class="ins-review-name">' + k.esc(n) + '</span><span class="ins-bar" aria-hidden="true"><span style="width:' + Math.max(2, share * 100).toFixed(1) + '%;background:' + k.esc(k.catColorVar(n)) + '"></span></span><span class="ins-review-val">' + k.m(s.byCategory[n]) + ' <span class="muted">' + k.pct(share) + '</span></span></li>';
        }).join('') + '</ul>' : '<p class="muted">No spending this month.</p>';
        html += '</section>';

        html += '<section class="ins-review-block" aria-labelledby="insRevBig"><h3 id="insRevBig">Biggest purchases</h3>';
        html += biggest.length ? '<ul class="ins-review-list ins-review-plain">' + biggest.map((t) => '<li><span class="ins-review-name">' + k.esc(t.merchant) + '</span><span class="muted ins-review-date">' + k.esc(k.fmtDate(t.date)) + '</span><span class="ins-review-val">' + k.m(t.spend) + '</span></li>').join('') + '</ul>' : '<p class="muted">No purchases this month.</p>';
        html += '</section>';

        if (budgetNames.length) {
            const rows = budgetNames.map((n) => ({ name: n, spent: s.byCategory[n] || 0, limit: budgets[n].effective })).sort((a, b) => b.spent / b.limit - a.spent / a.limit);
            const within = rows.filter((r) => r.spent <= r.limit).length;
            html += '<section class="ins-review-block" aria-labelledby="insRevBud"><h3 id="insRevBud">Budgets</h3><p>You stayed within ' + within + ' of ' + rows.length + (rows.length === 1 ? ' budget.' : ' budgets.') + '</p><ul class="ins-review-list ins-review-plain">' +
                rows.map((r) => '<li><span class="ins-review-name">' + k.esc(r.name) + '</span><span class="muted ins-review-date">' + (r.spent <= r.limit ? 'Within budget' : 'Over by ' + k.esc(k.money(r.spent - r.limit))) + '</span><span class="ins-review-val">' + k.m(r.spent) + ' <span class="muted">of ' + k.m(r.limit) + '</span></span></li>').join('') + '</ul></section>';
        }

        if (subsMonthly > 0) {
            html += '<section class="ins-review-block" aria-labelledby="insRevSub"><h3 id="insRevSub">Repeating charges</h3><p>About ' + k.m(subsMonthly) + ' a month, or ' + k.m(subsMonthly * 12) + ' a year.</p></section>';
        }
        html += '<footer class="ins-review-foot">Made with Sahab Budget</footer></article>';
        el.innerHTML = html;

        const host = el.querySelector('#insReviewStepper');
        if (typeof UI !== 'undefined' && typeof UI.monthStepper === 'function') {
            UI.monthStepper(host, {
                value: key,
                keys: keys,
                onChange: (v) => {
                    reviewKey = v;
                    k.rerender();
                },
            });
        } else {
            host.innerHTML = '<label class="visually-hidden" for="insRevSel">Month</label><select id="insRevSel" class="select">' + monthOptions(keys, key) + '</select>';
            host.querySelector('select').addEventListener('change', (e) => {
                reviewKey = e.target.value;
                k.rerender();
            });
        }
        el.querySelector('#insPrint').addEventListener('click', () => window.print());
    }

    window.Insights.register('compare', renderCompare);
    window.Insights.register('review', renderReview);
})();
