(function () {
    const listeners = new Set();
    let loaded = false;
    let txCache = null;

    function invalidate() {
        txCache = null;
    }

    function init() {
        if (!loaded) {
            if (typeof loadSavedData === 'function') loadSavedData();
            if (typeof loadRules === 'function') {
                try { loadRules(); } catch (e) { console.error(e); }
            }
            loaded = true;
        }
        return api;
    }

    function reload() {
        loaded = false;
        invalidate();
        init();
        emit('reload');
    }

    function persist(reason) {
        invalidate();
        if (typeof saveData === 'function') saveData();
        if (typeof broadcastSync === 'function') {
            try { broadcastSync('dataChanged', { reason: reason || 'change' }); } catch (e) { void e; }
        }
        emit(reason || 'change');
    }

    function emit(reason) {
        listeners.forEach((fn) => {
            try { fn(reason); } catch (e) { console.error(e); }
        });
        try {
            window.dispatchEvent(new CustomEvent('budget:changed', { detail: { reason: reason || 'change' } }));
        } catch (e) { void e; }
    }

    function onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function prefs() {
        const p = window.appPreferences || {};
        return {
            currency: typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : 'USD',
            locale: typeof p.locale === 'string' && p.locale ? p.locale : undefined,
            weekStartsOn: p.weekStartsOn === 1 ? 1 : 0,
            hideAmounts: p.hideAmounts === true,
        };
    }

    function setPrefs(patch) {
        window.appPreferences = Object.assign({}, window.appPreferences || {}, patch || {});
        persist('prefs');
    }

    const fmtCache = new Map();
    function formatter(opts) {
        const p = prefs();
        const key = p.currency + '|' + (p.locale || '') + '|' + JSON.stringify(opts);
        if (!fmtCache.has(key)) {
            try {
                fmtCache.set(key, new Intl.NumberFormat(p.locale, Object.assign({ style: 'currency', currency: p.currency }, opts)));
            } catch (e) {
                fmtCache.set(key, new Intl.NumberFormat('en-US', Object.assign({ style: 'currency', currency: 'USD' }, opts)));
            }
        }
        return fmtCache.get(key);
    }

    function money(value, options) {
        const o = options || {};
        const n = Number(value) || 0;
        let text;
        if (o.compact && Math.abs(n) >= 10000) {
            text = formatter({ notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(n));
        } else if (o.cents === false || (o.cents === 'auto' && Math.abs(n) >= 1000)) {
            text = formatter({ minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
        } else {
            text = formatter({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
        }
        if (o.sign && n > 0.004) return '+' + text;
        if (n < -0.004) return (o.sign ? '−' : '-') + text;
        return text;
    }

    function monthKeys() {
        if (typeof monthlyData === 'undefined' || !monthlyData) return [];
        return Array.from(monthlyData.keys())
            .filter((k) => /^\d{4}-\d{2}$/.test(k) && (monthlyData.get(k).transactions || []).length > 0)
            .sort()
            .reverse();
    }

    function latestMonthKey() {
        return monthKeys()[0] || null;
    }

    function currentMonthKey() {
        return monthKeyFromDate(new Date());
    }

    function shiftMonth(key, delta) {
        const m = /^(\d{4})-(\d{2})$/.exec(key || '');
        if (!m) return null;
        return monthKeyFromDate(new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1));
    }

    function monthDate(key) {
        const m = /^(\d{4})-(\d{2})$/.exec(key || '');
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null;
    }

    function monthLabel(key, options) {
        const d = monthDate(key);
        if (!d) return '';
        const o = options || {};
        const p = prefs();
        if (o.short) return d.toLocaleDateString(p.locale, { month: 'short', year: '2-digit' });
        if (o.monthOnly) return d.toLocaleDateString(p.locale, { month: 'long' });
        return d.toLocaleDateString(p.locale, { month: 'long', year: 'numeric' });
    }

    function rawDate(t) {
        return t['Transaction Date'] || t['Posting Date'] || t['Post Date'] || t.Date || t.date || t['Trans Date'] || t['Trans. Date'] || t['Posted Date'];
    }

    const MERCHANT_NOISE = /\b(POS|DEBIT|CREDIT|PURCHASE|CARD|CHECKCARD|CHECK CARD|VISA|ACH|PMT|PAYMENT|RECURRING|AUTOPAY|ONLINE|WWW|COM|INC|LLC|CO|SQ|TST|PP|PAYPAL)\b/g;
    const merchantCache = new Map();
    function merchantName(description) {
        const src = String(description || '');
        if (merchantCache.has(src)) return merchantCache.get(src);
        let s = src
            .replace(/&amp;/gi, '&')
            .replace(/&#39;|&apos;/gi, "'")
            .toUpperCase()
            .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
            .replace(/[#*]+\s*\d*/g, ' ')
            .replace(/\bX{2,}\d+\b/g, ' ')
            .replace(/\b\d{3,}\b/g, ' ')
            .replace(/\.(COM|NET|ORG)\b/g, ' ')
            .replace(MERCHANT_NOISE, ' ')
            .replace(/[^A-Z0-9&' ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!s) s = src.trim();
        const words = s.split(' ').slice(0, 4).join(' ');
        const pretty = words
            .toLowerCase()
            .replace(/(^|[\s&'-])([a-z])/g, (m0, a, b) => a + b.toUpperCase())
            .replace(/'S\b/g, "'s");
        merchantCache.set(src, pretty);
        return pretty;
    }

    function merchantPattern(description) {
        const name = merchantName(description).toUpperCase();
        const upper = String(description || '').toUpperCase();
        const words = name.split(' ').filter(Boolean);
        for (let n = Math.min(words.length, 2); n >= 1; n--) {
            const candidate = words.slice(0, n).join(' ');
            if (candidate.length >= 3 && upper.includes(candidate)) return candidate;
        }
        return upper.split(/[\s#*]/)[0] || upper;
    }

    function categoryFlags(name) {
        const c = (typeof categoryConfig !== 'undefined' && categoryConfig[name]) || {};
        return {
            isIncome: c._isIncome === true || name === 'Income',
            isExcluded: c._isExcluded === true,
        };
    }

    function incomeOverrideFor(id) {
        const o = window.transactionIncomeOverrides || {};
        for (const mk of Object.keys(o)) {
            if (o[mk] && o[mk][id] !== undefined) return o[mk][id];
        }
        return undefined;
    }

    function normalize(t, monthKey) {
        const rawAmount = parseFloat(t.Amount) || 0;
        const description = t.Description || t.description || '';
        const category = categorizeTransaction(description, t._id);
        const flags = categoryFlags(category);
        const override = incomeOverrideFor(t._id);
        const isIncome = override !== undefined ? override === true : flags.isIncome || t._isIncome === true;
        const isTransfer = typeof window.isFlaggedTransfer === 'function' && window.isFlaggedTransfer(t);
        const date = parseLocalDate(rawDate(t));
        const absAmount = Math.abs(rawAmount);
        const isRefund = !isIncome && rawAmount > 0;
        let spend = 0;
        if (!isIncome && !isTransfer && !flags.isExcluded) spend = rawAmount < 0 ? absAmount : -absAmount;
        return {
            id: t._id,
            monthKey: monthKey,
            date: date,
            dateKey: isNaN(date) ? '' : `${monthKeyFromDate(date)}-${String(date.getDate()).padStart(2, '0')}`,
            description: description,
            merchant: t._displayName ? String(t._displayName) : merchantName(description),
            amount: rawAmount,
            absAmount: absAmount,
            signedAmount: isIncome ? absAmount : rawAmount < 0 ? -absAmount : absAmount,
            spend: spend,
            category: category,
            isIncome: isIncome,
            isRefund: isRefund,
            isTransfer: isTransfer,
            isExcluded: flags.isExcluded,
            isManual: t._manual === true,
            needsReview: category === 'Others' && !isIncome && !isTransfer,
            note: (window.transactionNotes || {})[t._id] || '',
            raw: t,
        };
    }

    function allTransactions() {
        if (txCache) return txCache;
        const out = [];
        if (typeof monthlyData !== 'undefined' && monthlyData) {
            monthlyData.forEach((md, mk) => {
                (md.transactions || []).forEach((t) => out.push(normalize(t, mk)));
            });
        }
        out.sort((a, b) => (b.date - a.date) || (b.absAmount - a.absAmount));
        txCache = out;
        return out;
    }

    function transactions(filter) {
        const f = filter || {};
        let list = allTransactions();
        if (f.monthKey) list = list.filter((t) => t.monthKey === f.monthKey);
        if (f.monthKeys) {
            const set = new Set(f.monthKeys);
            list = list.filter((t) => set.has(t.monthKey));
        }
        if (f.from) list = list.filter((t) => t.date >= f.from);
        if (f.to) list = list.filter((t) => t.date <= f.to);
        if (f.category) list = list.filter((t) => t.category === f.category);
        if (!f.includeTransfers) list = list.filter((t) => !t.isTransfer);
        return list;
    }

    function transaction(id) {
        return allTransactions().find((t) => t.id === id) || null;
    }

    function locate(id) {
        let found = null;
        if (typeof monthlyData === 'undefined') return null;
        monthlyData.forEach((md, mk) => {
            if (found) return;
            const i = (md.transactions || []).findIndex((t) => t._id === id);
            if (i !== -1) found = { monthKey: mk, index: i, tx: md.transactions[i] };
        });
        return found;
    }

    function categories(options) {
        const o = options || {};
        if (typeof categoryConfig === 'undefined') return [];
        return Object.keys(categoryConfig)
            .filter((name) => o.includeIncome || !categoryFlags(name).isIncome)
            .map((name) => {
                const f = categoryFlags(name);
                return {
                    name: name,
                    isIncome: f.isIncome,
                    isExcluded: f.isExcluded,
                    keywords: (categoryConfig[name].keywords || []).slice(),
                    colorVar: typeof getCategoryColorVar === 'function' ? getCategoryColorVar(name) : 'var(--cat-16)',
                };
            })
            .sort((a, b) => {
                if (a.name === 'Others') return 1;
                if (b.name === 'Others') return -1;
                return a.name.localeCompare(b.name);
            });
    }

    function rawBudget(monthKey, category) {
        const b = (typeof budgets !== 'undefined' && budgets[monthKey]) || {};
        const v = Number(b[category]);
        return Number.isFinite(v) && v > 0 ? v : 0;
    }

    function spentBy(list) {
        const by = {};
        list.forEach((t) => {
            if (t.isIncome || t.isTransfer || t.isExcluded) return;
            by[t.category] = (by[t.category] || 0) + t.spend;
        });
        Object.keys(by).forEach((k) => { if (by[k] < 0) by[k] = 0; });
        return by;
    }

    function carryOver(monthKey, category) {
        if (window.incomeSettings?.carryUnusedBudget !== true) return 0;
        const prev = shiftMonth(monthKey, -1);
        const b = rawBudget(prev, category);
        if (!b) return 0;
        const spent = spentBy(transactions({ monthKey: prev }))[category] || 0;
        const left = b - spent;
        return left > 0.005 ? left : 0;
    }

    function budget(monthKey, category) {
        const amount = rawBudget(monthKey, category);
        const carry = amount ? carryOver(monthKey, category) : 0;
        return { amount: amount, carry: carry, effective: amount + carry };
    }

    function budgetsFor(monthKey) {
        const out = {};
        categories().forEach((c) => {
            if (c.isExcluded) return;
            const b = budget(monthKey, c.name);
            if (b.effective > 0) out[c.name] = b;
        });
        return out;
    }

    function setBudget(category, amount, options) {
        const o = options || {};
        const value = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
        let keys;
        if (o.scope === 'all') {
            keys = Array.from(new Set(monthKeys().concat([currentMonthKey()])));
        } else if (o.scope === 'forward') {
            const start = o.monthKey || currentMonthKey();
            const existing = monthKeys().filter((k) => k >= start);
            keys = Array.from(new Set(existing.concat([start])));
            for (let i = 1; i <= 24; i++) keys.push(shiftMonth(start, i));
        } else {
            keys = [o.monthKey || currentMonthKey()];
        }
        keys.forEach((mk) => {
            if (!budgets[mk]) budgets[mk] = {};
            if (value > 0) budgets[mk][category] = value;
            else delete budgets[mk][category];
        });
        persist('budget');
    }

    function averageSpend(category, months) {
        const keys = monthKeys().slice(0, months || 3);
        if (!keys.length) return 0;
        let total = 0;
        keys.forEach((mk) => { total += spentBy(transactions({ monthKey: mk }))[category] || 0; });
        return total / keys.length;
    }

    function summary(filter) {
        const f = typeof filter === 'string' ? { monthKey: filter } : filter || {};
        const list = transactions(f);
        let spent = 0, income = 0, refunds = 0;
        list.forEach((t) => {
            if (t.isTransfer || t.isExcluded) return;
            if (t.isIncome) income += t.absAmount;
            else {
                spent += t.spend;
                if (t.isRefund) refunds += t.absAmount;
            }
        });
        spent = Math.max(0, spent);
        const byCategory = spentBy(list);
        let budgetTotal = 0;
        if (f.monthKey) {
            Object.values(budgetsFor(f.monthKey)).forEach((b) => { budgetTotal += b.effective; });
        }
        const net = income - spent;
        return {
            spent: spent,
            income: income,
            net: net,
            refunds: refunds,
            count: list.length,
            byCategory: byCategory,
            budgetTotal: budgetTotal,
            budgetLeft: budgetTotal - spent,
            savingsRate: income > 0 ? net / income : null,
            needsReview: list.filter((t) => t.needsReview).length,
        };
    }

    function ensureOverrides(mk) {
        if (!window.transactionOverrides) window.transactionOverrides = {};
        if (!window.transactionOverrides[mk]) window.transactionOverrides[mk] = {};
        return window.transactionOverrides[mk];
    }

    function upsertCategorizeRule(pattern, category) {
        if (!Array.isArray(window.unifiedRules)) window.unifiedRules = [];
        const p = String(pattern || '').trim().toUpperCase();
        if (!p) return null;
        let rule = window.unifiedRules.find((r) => r.type === 'categorize' && r.matchType === 'contains' && String(r.pattern).toUpperCase() === p);
        if (rule) {
            rule.action = category;
            rule.active = true;
            rule.name = `${merchantName(p)} → ${category}`;
            rule.updatedAt = new Date().toISOString();
        } else {
            rule = {
                id: typeof generateRuleId === 'function' ? generateRuleId() : 'rule_' + Math.random().toString(36).slice(2, 11),
                name: `${merchantName(p)} → ${category}`,
                type: 'categorize',
                pattern: p,
                matchType: 'contains',
                action: category,
                isAutomatic: false,
                active: true,
                createdAt: new Date().toISOString(),
            };
            window.unifiedRules.push(rule);
        }
        if (typeof unifiedRules !== 'undefined') {
            try { unifiedRules = window.unifiedRules; } catch (e) { void e; }
        }
        return rule;
    }

    function setCategory(id, category, options) {
        const o = options || {};
        const loc = locate(id);
        if (!loc || !categoryConfig[category]) return { changed: 0, rule: null };
        let changed = 0;
        let rule = null;
        if (o.applyToSimilar) {
            const pattern = o.pattern || merchantPattern(loc.tx.Description || loc.tx.description);
            rule = upsertCategorizeRule(pattern, category);
            monthlyData.forEach((md, mk) => {
                (md.transactions || []).forEach((t) => {
                    const d = String(t.Description || t.description || '').toUpperCase();
                    if (d.includes(rule.pattern)) {
                        ensureOverrides(mk)[t._id] = category;
                        changed++;
                    }
                });
            });
        } else {
            ensureOverrides(loc.monthKey)[id] = category;
            changed = 1;
        }
        const flags = categoryFlags(category);
        if (flags.isIncome) setIncomeFlag(loc.monthKey, id, true);
        else if (incomeOverrideFor(id) === true) setIncomeFlag(loc.monthKey, id, false);
        persist('category');
        return { changed: changed, rule: rule };
    }

    function setCategories(ids, category) {
        if (!categoryConfig[category]) return 0;
        const set = new Set(ids || []);
        const isIncomeCat = categoryFlags(category).isIncome;
        let changed = 0;
        monthlyData.forEach((md, mk) => {
            (md.transactions || []).forEach((t) => {
                if (!set.has(t._id)) return;
                ensureOverrides(mk)[t._id] = category;
                if (isIncomeCat) setIncomeFlag(mk, t._id, true);
                else if (incomeOverrideFor(t._id) === true) setIncomeFlag(mk, t._id, false);
                changed++;
            });
        });
        if (changed) persist('category');
        return changed;
    }

    function setIncomeFlag(mk, id, value) {
        if (!window.transactionIncomeOverrides) window.transactionIncomeOverrides = {};
        Object.keys(window.transactionIncomeOverrides).forEach((k) => {
            if (window.transactionIncomeOverrides[k]) delete window.transactionIncomeOverrides[k][id];
        });
        if (!window.transactionIncomeOverrides[mk]) window.transactionIncomeOverrides[mk] = {};
        window.transactionIncomeOverrides[mk][id] = value;
    }

    function setIncome(id, isIncome) {
        const loc = locate(id);
        if (!loc) return false;
        setIncomeFlag(loc.monthKey, id, isIncome === true);
        if (isIncome === true && categoryConfig.Income) ensureOverrides(loc.monthKey)[id] = 'Income';
        else if (isIncome !== true && ensureOverrides(loc.monthKey)[id] === 'Income') {
            delete window.transactionOverrides[loc.monthKey][id];
        }
        persist('income');
        return true;
    }

    function setNote(id, text) {
        if (!window.transactionNotes) window.transactionNotes = {};
        const clean = String(text || '').slice(0, 500).trim();
        if (clean) window.transactionNotes[id] = clean;
        else delete window.transactionNotes[id];
        persist('note');
    }

    function newId() {
        if (window.crypto && crypto.getRandomValues) {
            const a = new Uint32Array(2);
            crypto.getRandomValues(a);
            return a[0].toString(36) + a[1].toString(36);
        }
        return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    }

    function isoDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function addTransaction(input) {
        const i = input || {};
        const date = parseLocalDate(i.date || isoDate(new Date()));
        const amount = Math.abs(Number(i.amount) || 0);
        const description = String(i.description || '').trim().slice(0, 140);
        if (isNaN(date) || !amount || !description) return { ok: false, error: 'Add a date, a name, and an amount.' };
        const kind = i.kind === 'income' ? 'income' : 'expense';
        const mk = monthKeyFromDate(date);
        if (!monthlyData.has(mk)) {
            monthlyData.set(mk, { transactions: [], monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
        }
        const tx = {
            'Transaction Date': isoDate(date),
            Description: description.toUpperCase(),
            Amount: kind === 'income' ? amount : -amount,
            _originalFormat: 'Manual',
            _manual: true,
            _id: newId(),
        };
        if (kind === 'income') tx._isIncome = true;
        monthlyData.get(mk).transactions.push(tx);
        const category = i.category && categoryConfig[i.category] ? i.category : kind === 'income' && categoryConfig.Income ? 'Income' : null;
        if (category) ensureOverrides(mk)[tx._id] = category;
        if (kind === 'income') setIncomeFlag(mk, tx._id, true);
        if (i.note) {
            if (!window.transactionNotes) window.transactionNotes = {};
            window.transactionNotes[tx._id] = String(i.note).slice(0, 500).trim();
        }
        persist('add');
        return { ok: true, id: tx._id };
    }

    function editTransaction(id, patch) {
        const loc = locate(id);
        if (!loc) return { ok: false, error: 'That transaction no longer exists.' };
        const p = patch || {};
        const tx = loc.tx;
        if (p.description != null) {
            const d = String(p.description).trim().slice(0, 140);
            if (!d) return { ok: false, error: 'Add a name.' };
            if (tx._manual) tx.Description = d.toUpperCase();
            else tx._displayName = d;
        }
        if (tx._manual && (p.amount != null || p.kind != null)) {
            const amount = p.amount != null ? Math.abs(Number(p.amount) || 0) : Math.abs(parseFloat(tx.Amount) || 0);
            if (!amount) return { ok: false, error: 'Add an amount.' };
            const kind = p.kind || (tx._isIncome ? 'income' : 'expense');
            tx.Amount = kind === 'income' ? amount : -amount;
            tx._isIncome = kind === 'income';
            setIncomeFlag(loc.monthKey, id, kind === 'income');
        }
        if (tx._manual && p.date) {
            const date = parseLocalDate(p.date);
            if (isNaN(date)) return { ok: false, error: 'Pick a valid date.' };
            tx['Transaction Date'] = isoDate(date);
            const mk = monthKeyFromDate(date);
            if (mk !== loc.monthKey) {
                monthlyData.get(loc.monthKey).transactions.splice(loc.index, 1);
                if (!monthlyData.has(mk)) {
                    monthlyData.set(mk, { transactions: [], monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
                }
                monthlyData.get(mk).transactions.push(tx);
                const ov = window.transactionOverrides?.[loc.monthKey]?.[id];
                if (ov) {
                    delete window.transactionOverrides[loc.monthKey][id];
                    ensureOverrides(mk)[id] = ov;
                }
            }
        }
        persist('edit');
        return { ok: true };
    }

    function deleteTransactions(ids, options) {
        const o = options || {};
        const set = new Set(ids || []);
        if (!set.size) return 0;
        const snapshot = typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
        let count = 0;
        monthlyData.forEach((md, mk) => {
            md.transactions = (md.transactions || []).filter((t) => {
                if (!set.has(t._id)) return true;
                const cat = categorizeTransaction(t.Description || t.description || '', t._id);
                if (typeof moveToTrash === 'function') moveToTrash(t, mk, cat, o.reason || 'manual');
                else {
                    if (!window.deletedTransactions) window.deletedTransactions = [];
                    window.deletedTransactions.push({ transaction: Object.assign({}, t), monthKey: mk, category: cat, deletedAt: new Date().toISOString(), deleteReason: o.reason || 'manual' });
                    if (!window.deletedFingerprints) window.deletedFingerprints = [];
                    const fp = transactionFingerprint(t);
                    if (!window.deletedFingerprints.includes(fp)) window.deletedFingerprints.push(fp);
                }
                count++;
                return false;
            });
        });
        persist('delete');
        if (count && o.undo !== false && typeof showUndo === 'function' && snapshot) {
            showUndo(count === 1 ? 'Moved to trash' : `${count} transactions moved to trash`, () => restoreActiveData(snapshot), { reloadOnUndo: true });
        }
        return count;
    }

    function trash() {
        return (window.deletedTransactions || []).map((item, index) => ({
            index: index,
            monthKey: item.monthKey,
            category: item.category,
            deletedAt: item.deletedAt,
            reason: item.deleteReason,
            tx: normalize(item.transaction, item.monthKey),
        }));
    }

    function restoreFromTrash(indexes) {
        const list = window.deletedTransactions || [];
        const sorted = Array.from(new Set([].concat(indexes))).filter((i) => i >= 0 && i < list.length).sort((a, b) => b - a);
        sorted.forEach((i) => {
            const item = list.splice(i, 1)[0];
            const fp = transactionFingerprint(item.transaction);
            const fpi = (window.deletedFingerprints || []).indexOf(fp);
            if (fpi !== -1) window.deletedFingerprints.splice(fpi, 1);
            if (!monthlyData.has(item.monthKey)) {
                const d = monthDate(item.monthKey) || new Date();
                monthlyData.set(item.monthKey, { transactions: [], monthName: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
            }
            monthlyData.get(item.monthKey).transactions.push(item.transaction);
        });
        persist('restore');
        return sorted.length;
    }

    function purgeFromTrash(indexes) {
        const list = window.deletedTransactions || [];
        const sorted = Array.from(new Set([].concat(indexes))).filter((i) => i >= 0 && i < list.length).sort((a, b) => b - a);
        sorted.forEach((i) => list.splice(i, 1));
        persist('purge');
        return sorted.length;
    }

    function emptyTrashAll() {
        const n = (window.deletedTransactions || []).length;
        window.deletedTransactions = [];
        persist('purge');
        return n;
    }

    function goals() {
        return (window.savingsGoals || []).map((g) => {
            const saved = (g.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
            const target = Number(g.target) || 0;
            const remaining = Math.max(0, target - saved);
            let monthlyNeeded = null;
            if (g.targetDate && remaining > 0) {
                const end = parseLocalDate(g.targetDate);
                const now = new Date();
                const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1;
                monthlyNeeded = months > 0 ? remaining / months : remaining;
            }
            return Object.assign({}, g, {
                saved: saved,
                remaining: remaining,
                progress: target > 0 ? Math.min(1, saved / target) : 0,
                monthlyNeeded: monthlyNeeded,
                isComplete: target > 0 && saved >= target,
            });
        });
    }

    function saveGoal(input) {
        const g = input || {};
        const name = String(g.name || '').trim().slice(0, 60);
        const target = Math.round(Math.abs(Number(g.target) || 0) * 100) / 100;
        if (!name) return { ok: false, error: 'Give your goal a name.' };
        if (!target) return { ok: false, error: 'Set how much you want to save.' };
        if (!Array.isArray(window.savingsGoals)) window.savingsGoals = [];
        let goal = g.id ? window.savingsGoals.find((x) => x.id === g.id) : null;
        if (!goal) {
            goal = { id: newId(), createdAt: new Date().toISOString(), contributions: [] };
            window.savingsGoals.push(goal);
        }
        goal.name = name;
        goal.target = target;
        goal.targetDate = g.targetDate && !isNaN(parseLocalDate(g.targetDate)) ? g.targetDate : null;
        goal.color = typeof g.color === 'string' ? g.color.slice(0, 20) : goal.color || null;
        goal.icon = typeof g.icon === 'string' ? g.icon.slice(0, 30) : goal.icon || null;
        persist('goal');
        return { ok: true, id: goal.id };
    }

    function deleteGoal(id) {
        const before = (window.savingsGoals || []).length;
        window.savingsGoals = (window.savingsGoals || []).filter((g) => g.id !== id);
        persist('goal');
        return before !== window.savingsGoals.length;
    }

    function contributeToGoal(id, amount, note) {
        const goal = (window.savingsGoals || []).find((g) => g.id === id);
        const value = Math.round((Number(amount) || 0) * 100) / 100;
        if (!goal || !value) return { ok: false, error: 'Enter an amount.' };
        if (!Array.isArray(goal.contributions)) goal.contributions = [];
        goal.contributions.push({ id: newId(), amount: value, date: isoDate(new Date()), note: String(note || '').slice(0, 120) });
        persist('goal');
        return { ok: true };
    }

    function upcomingBills(options) {
        const o = options || {};
        const days = o.days || 30;
        if (typeof detectRecurring !== 'function') return [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const horizon = new Date(now.getTime() + days * 86400000);
        return detectRecurring()
            .map((r) => {
                if (!r.lastDate || isNaN(r.lastDate)) return null;
                if (r.stopped === true) return null;
                let due = r.nextDate instanceof Date && !isNaN(r.nextDate) ? new Date(r.nextDate) : null;
                if (!due) {
                    due = new Date(r.lastDate.getFullYear(), r.lastDate.getMonth() + 1, r.lastDate.getDate());
                    while (due < now) due = new Date(due.getFullYear(), due.getMonth() + 1, due.getDate());
                    if ((now - r.lastDate) / 86400000 > 75) return null;
                }
                due.setHours(0, 0, 0, 0);
                return {
                    key: r.key,
                    name: merchantName(r.label),
                    category: r.category,
                    amount: r.lastAmount || r.avgAmount,
                    cadence: r.cadence || 'monthly',
                    dueDate: due,
                    daysAway: Math.round((due - now) / 86400000),
                };
            })
            .filter((b) => b && b.dueDate >= now && b.dueDate <= horizon)
            .sort((a, b) => a.dueDate - b.dueDate);
    }

    function hasData() {
        return monthKeys().length > 0;
    }

    const api = {
        init, reload, onChange, emit, persist,
        prefs, setPrefs, money,
        monthKeys, latestMonthKey, currentMonthKey, shiftMonth, monthDate, monthLabel,
        merchantName, merchantPattern,
        allTransactions, transactions, transaction, categories,
        budget, budgetsFor, setBudget, averageSpend, summary,
        setCategory, setCategories, setIncome, setNote, addTransaction, editTransaction, deleteTransactions,
        trash, restoreFromTrash, purgeFromTrash, emptyTrash: emptyTrashAll,
        goals, saveGoal, deleteGoal, contributeToGoal,
        upcomingBills, hasData, isoDate,
    };

    window.Store = api;
    window.formatMoney = function (value) { return money(value); };
})();
