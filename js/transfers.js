(function () {
    const FLAG_PREFIX = 'sahabBudget_transferFlags__';
    const DISMISS_KEY = 'sahabBudget_transferDismissed';

    function readAccountPayload(id) {
        try {
            const v = localStorage.getItem('sahabBudget_data__' + id);
            return v ? JSON.parse(v) : null;
        } catch (e) {
            return null;
        }
    }

    function txDate(t) {
        const raw = t['Transaction Date'] || t['Posting Date'] || t['Post Date'] || t.Date || t.date;
        return typeof parseLocalDate === 'function' ? parseLocalDate(raw) : new Date(raw);
    }

    function fingerprint(t) {
        const d = txDate(t);
        const key = isNaN(d) ? '' : d.toDateString();
        const desc = (t.Description || t.description || '').trim().toUpperCase();
        const amt = (parseFloat(t.Amount || 0) || 0).toFixed(2);
        return key + '|' + desc + '|' + amt;
    }

    function pairKey(fromId, from, toId, to) {
        return fromId + '|' + fingerprint(from) + '>' + toId + '|' + fingerprint(to);
    }

    function readDismissed() {
        try {
            const v = localStorage.getItem(DISMISS_KEY);
            const list = v ? JSON.parse(v) : [];
            return new Set(Array.isArray(list) ? list : []);
        } catch (e) {
            return new Set();
        }
    }

    function writeDismissed(set) {
        try {
            localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set)));
        } catch (e) {
            void e;
        }
    }

    window.getTransferFlags = function (accountId) {
        try {
            const v = localStorage.getItem(FLAG_PREFIX + accountId);
            return v ? new Set(JSON.parse(v)) : new Set();
        } catch (e) {
            return new Set();
        }
    };

    function saveTransferFlags(accountId, set) {
        try {
            localStorage.setItem(FLAG_PREFIX + accountId, JSON.stringify(Array.from(set)));
        } catch (e) {
            void e;
        }
    }

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
        window.__transferFlagCache = null;
    };

    window.unconfirmTransferPair = function (pair) {
        const a = window.getTransferFlags(pair.fromAccountId);
        a.delete(fingerprint(pair.from));
        saveTransferFlags(pair.fromAccountId, a);
        const b = window.getTransferFlags(pair.toAccountId);
        b.delete(fingerprint(pair.to));
        saveTransferFlags(pair.toAccountId, b);
        window.__transferFlagCache = null;
    };

    window.dismissTransferPair = function (pair) {
        const set = readDismissed();
        set.add(pairKey(pair.fromAccountId, pair.from, pair.toAccountId, pair.to));
        writeDismissed(set);
    };

    window.undismissTransferPair = function (pair) {
        const set = readDismissed();
        set.delete(pairKey(pair.fromAccountId, pair.from, pair.toAccountId, pair.to));
        writeDismissed(set);
    };

    window.findCrossAccountTransfers = function (options) {
        const opts = options || {};
        const tolDays = opts.toleranceDays || 5;
        if (typeof getAccounts !== 'function') return [];
        const accounts = getAccounts().filter((a) => !a.sample);
        if (accounts.length < 2) return [];
        const dismissed = readDismissed();

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
            return { acc: acc, debits: debits, credits: credits, flags: window.getTransferFlags(acc.id) };
        });

        const pairs = [];
        const usedCredits = new Set();

        for (let i = 0; i < byAccount.length; i++) {
            for (let j = 0; j < byAccount.length; j++) {
                if (i === j) continue;
                byAccount[i].debits.forEach((d) => {
                    if (d.amt < 1) return;
                    for (const c of byAccount[j].credits) {
                        const cid = byAccount[j].acc.id + '|' + fingerprint(c.t);
                        if (usedCredits.has(cid)) continue;
                        if (Math.abs(d.amt - c.amt) > 0.01) continue;
                        const gap = Math.abs((d.date - c.date) / 86400000);
                        if (isNaN(gap) || gap > tolDays) continue;
                        usedCredits.add(cid);
                        const key = pairKey(byAccount[i].acc.id, d.t, byAccount[j].acc.id, c.t);
                        pairs.push({
                            key: key,
                            amount: d.amt,
                            from: d.t,
                            to: c.t,
                            fromDate: d.date,
                            toDate: c.date,
                            fromAccountId: byAccount[i].acc.id,
                            fromAccountName: byAccount[i].acc.name,
                            toAccountId: byAccount[j].acc.id,
                            toAccountName: byAccount[j].acc.name,
                            dayGap: Math.round(gap),
                            alreadyFlagged: byAccount[i].flags.has(fingerprint(d.t)),
                            dismissed: dismissed.has(key),
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
