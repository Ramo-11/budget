// js/recurring.js - Detect recurring charges (subscriptions) from transaction
// history. Groups expenses by a normalized merchant key, finds those that recur
// across multiple months at a stable cadence/amount, and reports the monthly
// commitment. Pure logic + a render helper; safe to call anywhere.

(function () {
    // Normalize a merchant/description into a stable grouping key: strip trailing
    // reference numbers, card suffixes, dates, and extra punctuation.
    function merchantKey(desc) {
        return String(desc || '')
            .toUpperCase()
            .replace(/[#*]/g, ' ')
            .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ')   // dates
            .replace(/\bX{2,}\d+\b/g, ' ')                    // masked card numbers
            .replace(/\b\d{4,}\b/g, ' ')                      // long numbers
            .replace(/\b(PMT|PAYMENT|AUTOPAY|RECURRING|POS|PURCHASE|DEBIT)\b/g, ' ')
            .replace(/[^A-Z0-9&]+/g, ' ')
            .trim()
            .split(' ')
            .slice(0, 3)                                      // first few tokens = the brand
            .join(' ')
            .trim();
    }

    function titleCase(s) {
        return String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Returns an array of recurring charges:
    //   { key, label, category, occurrences, months:[monthKey], avgAmount,
    //     lastAmount, lastDate, monthly (est. per-month cost), cadence }
    window.detectRecurring = function (options) {
        const opts = options || {};
        const minOccurrences = opts.minOccurrences || 2;
        if (typeof monthlyData === 'undefined' || !monthlyData) return [];

        const groups = new Map();

        monthlyData.forEach((monthData, monthKey) => {
            monthData.transactions.forEach((t) => {
                const raw = t.Amount;
                const amount = parseFloat(raw) || 0;
                if (amount >= 0) return; // expenses only (negative)
                const desc = t.Description || t.description || '';
                const category = typeof categorizeTransaction === 'function'
                    ? categorizeTransaction(desc, t._id) : 'Others';
                // Skip income and transfers-like categories
                if (category === 'Income' || (typeof categoryConfig !== 'undefined' && categoryConfig[category] && categoryConfig[category]._isIncome)) return;

                const key = merchantKey(desc);
                if (!key || key.length < 3) return;

                if (!groups.has(key)) {
                    groups.set(key, { key, samples: [], category, label: titleCase(desc) });
                }
                const g = groups.get(key);
                const date = (typeof parseLocalDate === 'function')
                    ? parseLocalDate(t['Transaction Date'] || t.Date || t.date)
                    : new Date(t['Transaction Date'] || t.Date || t.date);
                g.samples.push({ monthKey, amount: Math.abs(amount), date: date, desc: desc, category: category });
            });
        });

        const results = [];
        groups.forEach((g) => {
            // Unique months this merchant appears in
            const monthsSet = new Set(g.samples.map((s) => s.monthKey));
            if (monthsSet.size < minOccurrences) return;

            const amounts = g.samples.map((s) => s.amount);
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            // Require reasonably stable amounts (subscriptions don't vary wildly)
            const maxDev = Math.max(...amounts.map((a) => Math.abs(a - avg)));
            if (avg > 0 && maxDev / avg > 0.35 && amounts.length > 2) return;

            const sorted = g.samples.slice().sort((a, b) => b.date - a.date);
            const last = sorted[0];
            const months = Array.from(monthsSet).sort();

            results.push({
                key: g.key,
                label: g.label,
                category: last.category || g.category,
                occurrences: g.samples.length,
                months: months,
                monthSpan: monthsSet.size,
                avgAmount: avg,
                lastAmount: last.amount,
                lastDate: last.date,
                monthly: avg, // estimated monthly cost (roughly one charge/month)
            });
        });

        // Sort by monthly cost desc
        results.sort((a, b) => b.monthly - a.monthly);
        return results;
    };

    // Total estimated monthly subscription commitment.
    window.recurringMonthlyTotal = function (list) {
        return (list || []).reduce((sum, r) => sum + (r.monthly || 0), 0);
    };
})();
