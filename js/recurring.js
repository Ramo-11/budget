(function () {
    const DAY = 86400000;

    function merchantKey(desc) {
        return String(desc || '')
            .toUpperCase()
            .replace(/[#*]/g, ' ')
            .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ')
            .replace(/\bX{2,}\d+\b/g, ' ')
            .replace(/\b\d{4,}\b/g, ' ')
            .replace(/\b(PMT|PAYMENT|AUTOPAY|RECURRING|POS|PURCHASE|DEBIT)\b/g, ' ')
            .replace(/[^A-Z0-9&]+/g, ' ')
            .trim()
            .split(' ')
            .slice(0, 3)
            .join(' ')
            .trim();
    }

    const GENERIC = new Set(['SUBSCRIPTION', 'MONTHLY', 'PREMIUM', 'PAYMENT', 'PLAN', 'BILL', 'MEMBERSHIP', 'ONLINE', 'THE', 'WWW', 'COM', 'INC', 'LLC', 'ANNUAL', 'YEARLY', 'SERVICE', 'SERVICES', 'FEE', 'DIGITAL', 'ZELLE', 'TO', 'FROM', 'PAYPAL', 'SQ', 'TST', 'PY', 'DD', 'SP', 'ACH', 'WEB', 'PMTS', 'CORP']);

    function brandKey(desc) {
        const tokens = merchantKey(desc).split(' ').filter(Boolean);
        const good = tokens.filter((t) => !GENERIC.has(t) && t.length >= 2 && !/^\d+$/.test(t));
        return (good[0] || tokens[0] || '').trim();
    }

    function clusterByAmount(samples) {
        const sorted = samples.slice().sort((a, b) => a.absAmount - b.absAmount);
        const clusters = [];
        sorted.forEach((t) => {
            const c = clusters[clusters.length - 1];
            if (c) {
                const avg = c.total / c.items.length;
                if (Math.abs(t.absAmount - avg) <= Math.max(2, avg * 0.15)) {
                    c.items.push(t);
                    c.total += t.absAmount;
                    return;
                }
            }
            clusters.push({ items: [t], total: t.absAmount });
        });
        return clusters.map((c) => c.items);
    }

    function titleCase(s) {
        return String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function median(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    const NEVER_RECURRING = new Set(['Travel']);
    const VARIABLE_SPEND = new Set(['Gas', 'Groceries', 'Food & Drink', 'Coffee and Tea', 'Shopping', 'Transportation', 'Parking', 'Entertainment', 'Others']);

    function cadenceFor(gapDays) {
        if (gapDays >= 5 && gapDays <= 9) return { name: 'weekly', step: 7, perYear: 52 };
        if (gapDays >= 12 && gapDays <= 16) return { name: 'every two weeks', step: 14, perYear: 26 };
        if (gapDays >= 25 && gapDays <= 38) return { name: 'monthly', step: 0, months: 1, perYear: 12 };
        if (gapDays >= 80 && gapDays <= 100) return { name: 'every three months', step: 0, months: 3, perYear: 4 };
        if (gapDays >= 170 && gapDays <= 195) return { name: 'every six months', step: 0, months: 6, perYear: 2 };
        if (gapDays >= 350 && gapDays <= 380) return { name: 'yearly', step: 0, months: 12, perYear: 1 };
        return null;
    }

    function addCadence(date, cadence) {
        if (cadence.step) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + cadence.step);
        return new Date(date.getFullYear(), date.getMonth() + cadence.months, date.getDate());
    }

    function startOfToday() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const CADENCE_BY_NAME = {
        weekly: { name: 'weekly', step: 7, perYear: 52 },
        'every two weeks': { name: 'every two weeks', step: 14, perYear: 26 },
        monthly: { name: 'monthly', step: 0, months: 1, perYear: 12 },
        'every three months': { name: 'every three months', step: 0, months: 3, perYear: 4 },
        'every six months': { name: 'every six months', step: 0, months: 6, perYear: 2 },
        yearly: { name: 'yearly', step: 0, months: 12, perYear: 1 },
    };

    function subPrefs() {
        const p = window.subscriptionPrefs || {};
        return { dismissed: new Set(Array.isArray(p.dismissed) ? p.dismissed : []), manual: Array.isArray(p.manual) ? p.manual : [] };
    }

    function matchesPattern(t, pattern) {
        if (!pattern) return false;
        const norm = typeof normalizeMatchText === 'function' ? normalizeMatchText : (v) => ' ' + String(v).toUpperCase() + ' ';
        const p = norm(pattern).trim();
        return !!p && norm(t.description).includes(p);
    }

    function manualResults(all, today) {
        return subPrefs().manual.map((m) => {
            const cadence = CADENCE_BY_NAME[m.cadence] || CADENCE_BY_NAME.monthly;
            const matches = all
                .filter((t) => !t.isIncome && t.amount < 0 && matchesPattern(t, m.pattern))
                .sort((a, b) => a.date - b.date);
            const last = matches[matches.length - 1] || null;
            let nextDate = null;
            if (m.nextDate) nextDate = parseLocalDate(m.nextDate);
            if (last && (!nextDate || nextDate <= last.date)) nextDate = addCadence(last.date, cadence);
            if (!nextDate || isNaN(nextDate)) nextDate = today;
            let guard = 0;
            while (nextDate < today && guard < 800) {
                nextDate = addCadence(nextDate, cadence);
                guard++;
            }
            const amount = Number(m.amount) || (last ? last.absAmount : 0);
            const monthly = (amount * cadence.perYear) / 12;
            return {
                key: 'manual:' + m.id,
                id: m.id,
                manual: true,
                pattern: m.pattern || '',
                label: m.name,
                category: m.category || (last ? last.category : 'Subscriptions'),
                occurrences: matches.length,
                months: Array.from(new Set(matches.map((t) => t.monthKey))).sort(),
                monthSpan: new Set(matches.map((t) => t.monthKey)).size,
                avgAmount: amount,
                lastAmount: last ? last.absAmount : amount,
                lastDate: last ? last.date : null,
                firstDate: matches.length ? matches[0].date : null,
                cadence: cadence.name,
                perYear: cadence.perYear,
                monthly: monthly,
                yearly: monthly * 12,
                nextDate: nextDate,
                stopped: false,
                matchedIds: matches.map((t) => t.id),
            };
        });
    }

    window.detectRecurring = function (options) {
        const opts = options || {};
        if (typeof Store === 'undefined' || typeof Store.allTransactions !== 'function') return [];
        const all = Store.allTransactions();
        const prefs = subPrefs();
        const manual = manualResults(all, startOfToday());
        if (!all.length) return manual;
        const claimed = new Set();
        manual.forEach((m) => m.matchedIds.forEach((id) => claimed.add(id)));

        const groups = new Map();
        all.forEach((t) => {
            if (t.isIncome || t.isTransfer || t.isExcluded || t.isRefund || t.amount >= 0) return;
            if (claimed.has(t.id)) return;
            if (NEVER_RECURRING.has(t.category)) return;
            if (isNaN(t.date)) return;
            const key = brandKey(t.description);
            if (!key || key.length < 3) return;
            if (!groups.has(key)) groups.set(key, { key: key, samples: [] });
            groups.get(key).samples.push(t);
        });

        const clustered = [];
        groups.forEach((g) => {
            const parts = clusterByAmount(g.samples);
            parts.forEach((items) => {
                const latest = items.slice().sort((a, b) => b.date - a.date)[0];
                const avgAmt = items.reduce((x, y) => x + y.absAmount, 0) / items.length;
                clustered.push({
                    key: parts.length > 1 ? g.key + ' ' + Math.round(avgAmt) : g.key,
                    samples: items,
                    label: latest.merchant || titleCase(brandKey(latest.description) || latest.description),
                });
            });
        });

        const latestData = all.reduce((max, t) => (t.date > max ? t.date : max), all[0].date);
        const today = startOfToday();
        const results = [];

        clustered.forEach((g) => {
            const samples = g.samples.slice().sort((a, b) => a.date - b.date);
            const monthsSet = new Set(samples.map((s) => s.monthKey));
            if (samples.length < (opts.minOccurrences || 2) || monthsSet.size < 2) return;

            const amounts = samples.map((s) => s.absAmount);
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const maxDev = Math.max.apply(null, amounts.map((a) => Math.abs(a - avg)));
            if (avg <= 0) return;
            const spread = maxDev / avg;
            const latestCat = samples[samples.length - 1].category;
            if (VARIABLE_SPEND.has(latestCat) && spread > 0.001) return;
            if (amounts.length > 2 && spread > 0.2) return;
            if (amounts.length === 2 && spread > 0.1) return;

            const gaps = [];
            for (let i = 1; i < samples.length; i++) {
                const gap = Math.round((samples[i].date - samples[i - 1].date) / DAY);
                if (gap > 0) gaps.push(gap);
            }
            if (!gaps.length) return;
            const mid = median(gaps);
            const cadence = cadenceFor(mid);
            if (!cadence) return;
            if (VARIABLE_SPEND.has(latestCat) && samples.length < 3) return;
            if (cadence.perYear < 12 && cadence.perYear > 1 && samples.length < 3) return;
            const regular = gaps.filter((gap) => Math.abs(gap - mid) <= Math.max(4, mid * 0.25)).length;
            if (regular / gaps.length < 0.7) return;

            const last = samples[samples.length - 1];
            const stopped = (latestData - last.date) / DAY > mid * 1.6 + 7;
            let nextDate = null;
            if (!stopped) {
                nextDate = addCadence(last.date, cadence);
                let guard = 0;
                while (nextDate < today && guard < 800) {
                    nextDate = addCadence(nextDate, cadence);
                    guard++;
                }
            }
            const monthly = (avg * cadence.perYear) / 12;

            results.push({
                key: g.key,
                label: g.label,
                category: last.category,
                occurrences: samples.length,
                months: Array.from(monthsSet).sort(),
                monthSpan: monthsSet.size,
                avgAmount: avg,
                lastAmount: last.absAmount,
                lastDate: last.date,
                firstDate: samples[0].date,
                cadence: cadence.name,
                perYear: cadence.perYear,
                monthly: monthly,
                yearly: monthly * 12,
                nextDate: nextDate,
                stopped: stopped,
            });
        });

        const visible = results.filter((r) => {
            r.dismissed = prefs.dismissed.has(r.key);
            return opts.includeDismissed || !r.dismissed;
        });
        const merged = manual.concat(visible);
        merged.sort((a, b) => b.monthly - a.monthly);
        return merged;
    };

    window.recurringMonthlyTotal = function (list) {
        return (list || []).reduce((sum, r) => sum + (r.stopped ? 0 : r.monthly || 0), 0);
    };
})();
