// js/transfers.js - Cross-account transfer detection.
// When you move money between your own accounts (e.g. pay a credit card from
// checking), it appears as an expense in one account and a credit in another.
// This finds those matched pairs so they can be flagged as internal transfers
// and excluded from spending totals (double-counting). Detection is read-only;
// the user confirms which pairs are transfers, and confirmations are persisted
// per account so analysis can skip them.

(function () {
    const FLAG_PREFIX = 'sahabBudget_transferFlags__'; // + accountId -> [fingerprint]

    function readAccountPayload(id) {
        try {
            const v = localStorage.getItem('sahabBudget_data__' + id);
            return v ? JSON.parse(v) : null;
        } catch (e) { return null; }
    }

    function txDate(t) {
        const raw = t['Transaction Date'] || t['Posting Date'] || t['Post Date'] || t.Date || t.date;
        return (typeof parseLocalDate === 'function') ? parseLocalDate(raw) : new Date(raw);
    }

    function fingerprint(t) {
        const d = txDate(t);
        const key = isNaN(d) ? '' : d.toDateString();
        const desc = (t.Description || t.description || '').trim().toUpperCase();
        const amt = (parseFloat(t.Amount || 0) || 0).toFixed(2);
        return key + '|' + desc + '|' + amt;
    }

    window.getTransferFlags = function (accountId) {
        try {
            const v = localStorage.getItem(FLAG_PREFIX + accountId);
            return v ? new Set(JSON.parse(v)) : new Set();
        } catch (e) { return new Set(); }
    };

    function saveTransferFlags(accountId, set) {
        try { localStorage.setItem(FLAG_PREFIX + accountId, JSON.stringify(Array.from(set))); }
        catch (e) { /* ignore */ }
    }

    // True if a transaction in the active (or given) account is flagged as an
    // internal transfer. Cheap enough to call during analysis.
    window.isFlaggedTransfer = function (transaction, accountId) {
        const id = accountId || (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null);
        if (!id) return false;
        if (!window.__transferFlagCache || window.__transferFlagCacheId !== id) {
            window.__transferFlagCache = window.getTransferFlags(id);
            window.__transferFlagCacheId = id;
        }
        return window.__transferFlagCache.has(fingerprint(transaction));
    };

    window.confirmTransferPair = function (pair) {
        const a = window.getTransferFlags(pair.fromAccountId);
        a.add(fingerprint(pair.from));
        saveTransferFlags(pair.fromAccountId, a);
        const b = window.getTransferFlags(pair.toAccountId);
        b.add(fingerprint(pair.to));
        saveTransferFlags(pair.toAccountId, b);
        window.__transferFlagCache = null; // invalidate
    };

    // Find candidate transfer pairs across all accounts.
    // options: { toleranceDays=5 }
    // Returns [{ amount, from:{tx}, to:{tx}, fromAccountId, fromAccountName,
    //            toAccountId, toAccountName, dayGap, alreadyFlagged }]
    window.findCrossAccountTransfers = function (options) {
        const opts = options || {};
        const tolDays = opts.toleranceDays || 5;
        if (typeof getAccounts !== 'function') return [];
        const accounts = getAccounts().filter((a) => !a.sample);
        if (accounts.length < 2) return [];

        // Build debit/credit lists per account
        const byAccount = accounts.map((acc) => {
            const payload = readAccountPayload(acc.id);
            const debits = [];
            const credits = [];
            if (payload && Array.isArray(payload.monthlyData)) {
                const map = new Map(payload.monthlyData);
                map.forEach((m) => {
                    (m.transactions || []).forEach((t) => {
                        const amt = parseFloat(t.Amount || 0) || 0;
                        const entry = { t: t, amt: Math.abs(amt), date: txDate(t) };
                        if (amt < 0) debits.push(entry);
                        else if (amt > 0) credits.push(entry);
                    });
                });
            }
            return { acc: acc, debits: debits, credits: credits };
        });

        const pairs = [];
        const usedCredits = new Set();

        for (let i = 0; i < byAccount.length; i++) {
            for (let j = 0; j < byAccount.length; j++) {
                if (i === j) continue;
                byAccount[i].debits.forEach((d) => {
                    // find a matching credit in account j
                    for (const c of byAccount[j].credits) {
                        const cid = byAccount[j].acc.id + '|' + fingerprint(c.t);
                        if (usedCredits.has(cid)) continue;
                        if (Math.abs(d.amt - c.amt) > 0.01) continue;
                        if (d.amt < 1) continue;
                        const gap = Math.abs((d.date - c.date) / 86400000);
                        if (isNaN(gap) || gap > tolDays) continue;
                        usedCredits.add(cid);
                        pairs.push({
                            amount: d.amt,
                            from: d.t,
                            to: c.t,
                            fromAccountId: byAccount[i].acc.id,
                            fromAccountName: byAccount[i].acc.name,
                            toAccountId: byAccount[j].acc.id,
                            toAccountName: byAccount[j].acc.name,
                            dayGap: Math.round(gap),
                            alreadyFlagged: window.getTransferFlags(byAccount[i].acc.id).has(fingerprint(d.t)),
                        });
                        break;
                    }
                });
            }
        }
        pairs.sort((a, b) => b.amount - a.amount);
        return pairs;
    };
})();
