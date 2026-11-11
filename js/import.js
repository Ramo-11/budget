const IMPORT_DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
const IMPORT_RULE_MATCH_TYPES = ['contains', 'startsWith', 'endsWith', 'exact', 'regex'];
const IMPORT_RULE_TYPES = ['categorize', 'delete'];

function importIsSafeKey(key) {
    return typeof key === 'string' && !IMPORT_DANGEROUS_KEYS.includes(key);
}

function importIsPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function importNewId() {
    return Math.random().toString(36).substr(2, 9);
}

function sanitizeImportedTransaction(t) {
    if (!importIsPlainObject(t)) return null;
    const out = {};
    Object.keys(t).forEach((k) => {
        if (importIsSafeKey(k)) out[k] = t[k];
    });
    const amount = Number(out.Amount !== undefined ? out.Amount : out.amount);
    if (!Number.isFinite(amount)) return null;
    if (typeof out._id !== 'string' || !out._id) out._id = importNewId();
    return out;
}

function sanitizeImportedMonthlyData(raw) {
    if (!Array.isArray(raw)) return null;
    const entries = [];
    const seenIds = new Set();
    for (const entry of raw) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const [monthKey, monthData] = entry;
        if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey) || !importIsPlainObject(monthData)) continue;
        if (!Array.isArray(monthData.transactions)) continue;
        const transactions = [];
        monthData.transactions.forEach((t) => {
            const clean = sanitizeImportedTransaction(t);
            if (!clean) return;
            while (seenIds.has(clean._id)) clean._id = importNewId();
            seenIds.add(clean._id);
            transactions.push(clean);
        });
        entries.push([
            monthKey,
            {
                transactions: transactions,
                monthName:
                    typeof monthData.monthName === 'string' && monthData.monthName
                        ? monthData.monthName
                        : monthKey,
            },
        ]);
    }
    return entries;
}

function sanitizeImportedCategoryConfig(raw) {
    if (!importIsPlainObject(raw)) return null;
    const out = {};
    for (const key of Object.keys(raw)) {
        if (!importIsSafeKey(key) || !key.trim() || key.length > 60) continue;
        const config = raw[key];
        if (!importIsPlainObject(config)) continue;
        const clean = {
            keywords: Array.isArray(config.keywords)
                ? config.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.slice(0, 80))
                : [],
        };
        if (typeof config.icon === 'string') clean.icon = config.icon;
        if (config._isIncome === true) clean._isIncome = true;
        if (config._isExcluded === true) clean._isExcluded = true;
        out[key] = clean;
    }
    if (!out.Others) out.Others = { keywords: [], icon: '' };
    return Object.keys(out).length > 1 ? out : null;
}

function sanitizeImportedBudgets(raw) {
    if (!importIsPlainObject(raw)) return {};
    const out = {};
    for (const monthKey of Object.keys(raw)) {
        if (!importIsSafeKey(monthKey) || !importIsPlainObject(raw[monthKey])) continue;
        const monthOut = {};
        for (const category of Object.keys(raw[monthKey])) {
            if (!importIsSafeKey(category)) continue;
            const value = Number(raw[monthKey][category]);
            if (Number.isFinite(value) && value >= 0) monthOut[category] = value;
        }
        out[monthKey] = monthOut;
    }
    return out;
}

function sanitizeImportedOverrides(raw) {
    if (!importIsPlainObject(raw)) return {};
    const out = {};
    for (const monthKey of Object.keys(raw)) {
        if (!importIsSafeKey(monthKey) || !importIsPlainObject(raw[monthKey])) continue;
        const monthOut = {};
        for (const id of Object.keys(raw[monthKey])) {
            if (!importIsSafeKey(id)) continue;
            if (typeof raw[monthKey][id] === 'string') monthOut[id] = raw[monthKey][id];
        }
        out[monthKey] = monthOut;
    }
    return out;
}

function sanitizeImportedIncomeOverrides(raw) {
    if (!importIsPlainObject(raw)) return {};
    const out = {};
    for (const monthKey of Object.keys(raw)) {
        if (!importIsSafeKey(monthKey) || !importIsPlainObject(raw[monthKey])) continue;
        const monthOut = {};
        for (const id of Object.keys(raw[monthKey])) {
            if (importIsSafeKey(id) && typeof raw[monthKey][id] === 'boolean') monthOut[id] = raw[monthKey][id];
        }
        out[monthKey] = monthOut;
    }
    return out;
}

function sanitizeImportedRules(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach((r) => {
        if (!importIsPlainObject(r)) return;
        const pattern = typeof r.pattern === 'string' ? r.pattern.trim() : '';
        const type = IMPORT_RULE_TYPES.includes(r.type) ? r.type : null;
        const matchType = IMPORT_RULE_MATCH_TYPES.includes(r.matchType) ? r.matchType : 'contains';
        if (!pattern || pattern.length > 200 || !type) return;
        if (type === 'categorize' && (typeof r.action !== 'string' || !r.action || !importIsSafeKey(r.action))) return;
        if (matchType === 'regex' && typeof getSafeRuleRegex === 'function' && !getSafeRuleRegex(pattern.toUpperCase())) return;
        out.push({
            id: typeof r.id === 'string' && r.id ? r.id : 'rule_' + importNewId(),
            name: typeof r.name === 'string' ? r.name.slice(0, 200) : '',
            type: type,
            pattern: pattern,
            matchType: matchType,
            action: type === 'categorize' ? r.action : null,
            description: typeof r.description === 'string' ? r.description.slice(0, 300) : '',
            isAutomatic: r.isAutomatic === true,
            active: r.active !== false,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
        });
    });
    return out;
}

function sanitizeImportedNotes(raw) {
    if (!importIsPlainObject(raw)) return {};
    const out = {};
    Object.keys(raw).forEach((id) => {
        if (importIsSafeKey(id) && typeof raw[id] === 'string' && raw[id].trim()) out[id] = raw[id].slice(0, 500);
    });
    return out;
}

const SUB_CADENCES = ['weekly', 'every two weeks', 'monthly', 'every three months', 'every six months', 'yearly'];

function sanitizeImportedSubscriptionPrefs(raw) {
    const out = { dismissed: [], manual: [] };
    if (!importIsPlainObject(raw)) return out;
    if (Array.isArray(raw.dismissed)) out.dismissed = raw.dismissed.filter((k) => typeof k === 'string' && k.length <= 120).slice(0, 500);
    if (Array.isArray(raw.manual)) {
        raw.manual.forEach((m) => {
            if (!importIsPlainObject(m) || typeof m.name !== 'string' || !m.name.trim()) return;
            const amount = Number(m.amount);
            if (!Number.isFinite(amount) || amount <= 0) return;
            out.manual.push({
                id: typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : 'sub_' + importNewId(),
                name: m.name.trim().slice(0, 80),
                amount: Math.round(amount * 100) / 100,
                cadence: SUB_CADENCES.includes(m.cadence) ? m.cadence : 'monthly',
                nextDate: typeof m.nextDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.nextDate) ? m.nextDate : null,
                category: typeof m.category === 'string' ? m.category.slice(0, 80) : null,
                pattern: typeof m.pattern === 'string' ? m.pattern.toUpperCase().slice(0, 80) : '',
                createdAt: typeof m.createdAt === 'string' ? m.createdAt.slice(0, 40) : new Date().toISOString(),
            });
        });
    }
    return out;
}

function sanitizeImportedGoals(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach((g) => {
        if (!importIsPlainObject(g)) return;
        const target = Number(g.target);
        if (typeof g.name !== 'string' || !g.name.trim() || !Number.isFinite(target) || target <= 0) return;
        const goal = {};
        Object.keys(g).forEach((k) => {
            if (importIsSafeKey(k)) goal[k] = g[k];
        });
        goal.id = typeof g.id === 'string' && g.id ? g.id : 'goal_' + importNewId();
        goal.name = g.name.trim().slice(0, 80);
        goal.target = target;
        goal.targetDate = typeof g.targetDate === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(g.targetDate) ? g.targetDate : null;
        goal.contributions = Array.isArray(g.contributions)
            ? g.contributions
                  .filter((c) => importIsPlainObject(c) && Number.isFinite(Number(c.amount)))
                  .map((c) => ({
                      amount: Number(c.amount),
                      date: typeof c.date === 'string' ? c.date.slice(0, 30) : '',
                      note: typeof c.note === 'string' ? c.note.slice(0, 200) : '',
                  }))
            : [];
        out.push(goal);
    });
    return out;
}

function sanitizeImportedPreferences(raw) {
    if (!importIsPlainObject(raw)) return {};
    const out = {};
    if (typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency)) out.currency = raw.currency;
    if (raw.weekStartsOn === 0 || raw.weekStartsOn === 1) out.weekStartsOn = raw.weekStartsOn;
    if (typeof raw.hideAmounts === 'boolean') out.hideAmounts = raw.hideAmounts;
    if (typeof raw.locale === 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(raw.locale)) out.locale = raw.locale;
    return out;
}

function sanitizeImportedIncomeSettings(raw) {
    if (!importIsPlainObject(raw)) return null;
    const out = {};
    if (typeof raw.trackIncome === 'boolean') out.trackIncome = raw.trackIncome;
    if (typeof raw.carryUnusedBudget === 'boolean') out.carryUnusedBudget = raw.carryUnusedBudget;
    if (Array.isArray(raw.incomePatterns)) {
        out.incomePatterns = raw.incomePatterns
            .filter((p) => typeof p === 'string' && p.trim())
            .map((p) => p.trim().toUpperCase().slice(0, 80))
            .slice(0, 200);
    }
    return Object.keys(out).length ? out : null;
}

function sanitizeImportedBackup(importData) {
    if (!importIsPlainObject(importData)) {
        throw new Error('This file is not a Sahab Budget backup');
    }
    if (!importData.version || importData.monthlyData === undefined) {
        throw new Error('This file is not a Sahab Budget backup');
    }

    const monthlyEntries = sanitizeImportedMonthlyData(importData.monthlyData);
    if (!monthlyEntries) {
        throw new Error('The backup has no readable months');
    }
    if (importData.categoryConfig !== undefined && importData.categoryConfig !== null) {
        if (!importIsPlainObject(importData.categoryConfig)) {
            throw new Error('The backup categories are not readable');
        }
    }
    if (importData.unifiedRules !== undefined && importData.unifiedRules !== null) {
        if (!Array.isArray(importData.unifiedRules)) {
            throw new Error('The backup rules are not readable');
        }
    }

    return {
        exportDate: typeof importData.exportDate === 'string' ? importData.exportDate : null,
        monthlyData: monthlyEntries,
        categoryConfig: sanitizeImportedCategoryConfig(importData.categoryConfig),
        budgets: sanitizeImportedBudgets(importData.budgets),
        transactionOverrides: sanitizeImportedOverrides(importData.transactionOverrides),
        transactionIncomeOverrides: sanitizeImportedIncomeOverrides(importData.transactionIncomeOverrides),
        unifiedRules: sanitizeImportedRules(importData.unifiedRules),
        incomeSettings: sanitizeImportedIncomeSettings(importData.incomeSettings),
        deletedTransactions: Array.isArray(importData.deletedTransactions)
            ? importData.deletedTransactions.filter(importIsPlainObject)
            : [],
        deletedFingerprints: Array.isArray(importData.deletedFingerprints)
            ? importData.deletedFingerprints.filter((fp) => typeof fp === 'string')
            : [],
        transactionNotes: sanitizeImportedNotes(importData.transactionNotes),
        savingsGoals: sanitizeImportedGoals(importData.savingsGoals),
        appPreferences: sanitizeImportedPreferences(importData.appPreferences),
        subscriptionPrefs: sanitizeImportedSubscriptionPrefs(importData.subscriptionPrefs),
    };
}

function summarizeImportedBackup(clean) {
    let transactions = 0;
    clean.monthlyData.forEach((entry) => {
        transactions += entry[1].transactions.length;
    });
    return {
        months: clean.monthlyData.length,
        transactions: transactions,
        categories: clean.categoryConfig ? Object.keys(clean.categoryConfig).length : 0,
        rules: clean.unifiedRules.length,
        goals: clean.savingsGoals.length,
        exportDate: clean.exportDate,
    };
}

function applyImportedBackup(clean, mode) {
    if (mode === 'replace') {
        monthlyData = new Map(clean.monthlyData);
        categoryConfig = clean.categoryConfig || categoryConfig;
        budgets = clean.budgets;
        window.transactionOverrides = clean.transactionOverrides;
        window.transactionIncomeOverrides = clean.transactionIncomeOverrides;
        window.unifiedRules = clean.unifiedRules;
        window.deletedTransactions = clean.deletedTransactions;
        window.deletedFingerprints = clean.deletedFingerprints;
        window.transactionNotes = clean.transactionNotes;
        window.savingsGoals = clean.savingsGoals;
        window.appPreferences = Object.assign({}, window.appPreferences || {}, clean.appPreferences);
        window.subscriptionPrefs = clean.subscriptionPrefs;
        window.merchantRules = {};
        if (clean.incomeSettings) {
            window.incomeSettings = Object.assign({}, window.incomeSettings || {}, clean.incomeSettings);
        }
    } else {
        if (!window.transactionOverrides) window.transactionOverrides = {};
        if (!window.transactionIncomeOverrides) window.transactionIncomeOverrides = {};
        if (!window.unifiedRules) window.unifiedRules = [];
        if (!window.transactionNotes) window.transactionNotes = {};
        if (!Array.isArray(window.savingsGoals)) window.savingsGoals = [];
        if (!window.deletedFingerprints) window.deletedFingerprints = [];
        if (!window.deletedTransactions) window.deletedTransactions = [];
        if (!budgets) budgets = {};

        const existingData = new Map(monthlyData);
        const usedIds = new Set();
        existingData.forEach((md) => md.transactions.forEach((t) => usedIds.add(t._id)));
        const idMap = {};

        clean.monthlyData.forEach(([monthKey, monthData]) => {
            if (!existingData.has(monthKey)) {
                existingData.set(monthKey, { transactions: [], monthName: monthData.monthName });
            }
            const existing = existingData.get(monthKey);
            monthData.transactions.forEach((transaction) => {
                if (isDuplicateTransaction(transaction, existing.transactions)) return;
                const oldId = transaction._id;
                while (usedIds.has(transaction._id)) transaction._id = importNewId();
                usedIds.add(transaction._id);
                if (oldId !== transaction._id) idMap[oldId] = transaction._id;
                existing.transactions.push(transaction);
            });
        });
        monthlyData = existingData;

        if (clean.categoryConfig) {
            Object.keys(clean.categoryConfig).forEach((name) => {
                if (!categoryConfig[name]) categoryConfig[name] = clean.categoryConfig[name];
            });
        }

        Object.entries(clean.budgets).forEach(([monthKey, monthBudgets]) => {
            budgets[monthKey] = Object.assign({}, monthBudgets, budgets[monthKey] || {});
        });
        Object.entries(clean.transactionOverrides).forEach(([monthKey, overrides]) => {
            const mapped = {};
            Object.keys(overrides).forEach((id) => {
                mapped[idMap[id] || id] = overrides[id];
            });
            window.transactionOverrides[monthKey] = Object.assign({}, mapped, window.transactionOverrides[monthKey] || {});
        });
        Object.entries(clean.transactionIncomeOverrides).forEach(([monthKey, overrides]) => {
            const mapped = {};
            Object.keys(overrides).forEach((id) => {
                mapped[idMap[id] || id] = overrides[id];
            });
            window.transactionIncomeOverrides[monthKey] = Object.assign({}, mapped, window.transactionIncomeOverrides[monthKey] || {});
        });

        clean.unifiedRules.forEach((rule) => {
            const exists = window.unifiedRules.some(
                (r) => r.pattern === rule.pattern && r.type === rule.type && r.action === rule.action && r.matchType === rule.matchType
            );
            if (!exists) {
                rule.id = 'rule_' + importNewId();
                window.unifiedRules.push(rule);
            }
        });

        Object.keys(clean.transactionNotes).forEach((id) => {
            const target = idMap[id] || id;
            if (!window.transactionNotes[target]) window.transactionNotes[target] = clean.transactionNotes[id];
        });

        clean.savingsGoals.forEach((goal) => {
            if (!window.savingsGoals.some((g) => g.id === goal.id)) window.savingsGoals.push(goal);
        });

        const subs = window.subscriptionPrefs || (window.subscriptionPrefs = {});
        subs.dismissed = Array.from(new Set((subs.dismissed || []).concat(clean.subscriptionPrefs.dismissed)));
        subs.manual = (subs.manual || []).concat(clean.subscriptionPrefs.manual.filter((m) => !(subs.manual || []).some((x) => x.id === m.id)));

        clean.deletedFingerprints.forEach((fp) => {
            if (!window.deletedFingerprints.includes(fp)) window.deletedFingerprints.push(fp);
        });
    }

    if (typeof saveData === 'function') saveData();
}

window.sanitizeImportedBackup = sanitizeImportedBackup;
window.summarizeImportedBackup = summarizeImportedBackup;
window.applyImportedBackup = applyImportedBackup;
