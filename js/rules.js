window.unifiedRules = window.unifiedRules || [];

const RULE_PATTERN_MAX_LENGTH = 200;
const RULE_REGEX_INPUT_MAX = 400;
const safeRegexCache = new Map();

function getSafeRuleRegex(pattern) {
    if (safeRegexCache.has(pattern)) return safeRegexCache.get(pattern);

    let compiled = null;
    const nestedQuantifier = /([*+]\??|\{\d+,?\d*\}\??)\)\s*[*+?{]/;
    const quantifiedAlternation = /\([^()]*\|[^()]*\)\s*([*+]|\{\d+,?\d*\})/;

    if (
        typeof pattern === 'string' &&
        pattern.length > 0 &&
        pattern.length <= RULE_PATTERN_MAX_LENGTH &&
        !nestedQuantifier.test(pattern) &&
        !quantifiedAlternation.test(pattern)
    ) {
        try {
            compiled = new RegExp(pattern, 'i');
        } catch (e) {
            compiled = null;
        }
    }

    safeRegexCache.set(pattern, compiled);
    return compiled;
}

function generateRuleId() {
    return 'rule_' + Math.random().toString(36).substr(2, 9);
}

function initializeRules() {
    if (window.merchantRules && !window.rulesConverted) {
        Object.entries(window.merchantRules).forEach(([pattern, category]) => {
            unifiedRules.push({
                id: generateRuleId(),
                name: `Auto: ${pattern} -> ${category}`,
                type: 'categorize',
                pattern: pattern,
                matchType: 'contains',
                action: category,
                isAutomatic: true,
                active: true,
                createdAt: new Date().toISOString(),
            });
        });
        window.rulesConverted = true;
    }

    if (typeof customRules !== 'undefined' && customRules.delete) {
        customRules.delete.forEach((rule) => {
            unifiedRules.push({
                id: generateRuleId(),
                name: rule.name,
                type: 'delete',
                pattern: rule.pattern,
                matchType: rule.matchType,
                action: null,
                description: rule.description,
                isAutomatic: false,
                active: rule.active,
                createdAt: rule.createdAt || new Date().toISOString(),
            });
        });
    }

    saveRules();
}

function saveRules() {
    const key = getActiveDataKey();
    let data = {};
    try {
        data = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (e) {
        data = {};
    }
    data.unifiedRules = unifiedRules;
    localStorage.setItem(key, JSON.stringify(data));
}

function loadRules() {
    let data = {};
    try {
        data = JSON.parse(localStorage.getItem(getActiveDataKey()) || '{}') || {};
    } catch (e) {
        data = {};
    }
    if (data.unifiedRules) {
        unifiedRules = data.unifiedRules;
    } else if (!unifiedRules || unifiedRules.length === 0) {
        unifiedRules = [];
    } else {
        initializeRules();
    }
}

function ruleMatchesDescription(rule, description) {
    const text = String(description || '').toUpperCase();
    const pattern = String(rule.pattern || '').toUpperCase();
    if (!pattern || pattern.length > RULE_PATTERN_MAX_LENGTH) return false;
    switch (rule.matchType) {
        case 'startsWith':
            return text.startsWith(pattern);
        case 'endsWith':
            return text.endsWith(pattern);
        case 'exact':
            return text === pattern;
        case 'regex': {
            const regex = getSafeRuleRegex(pattern);
            if (!regex) return false;
            try {
                return regex.test(text.slice(0, RULE_REGEX_INPUT_MAX));
            } catch (e) {
                return false;
            }
        }
        default:
            return text.includes(pattern);
    }
}

function applyRulesToTransaction(transaction) {
    const description = transaction.Description || transaction.description || '';

    const sortedRules = [...unifiedRules].sort((a, b) => {
        if (a.isAutomatic === b.isAutomatic) return 0;
        return a.isAutomatic ? 1 : -1;
    });

    for (const rule of sortedRules) {
        if (!rule.active) continue;
        if (ruleMatchesDescription(rule, description)) {
            return {
                action: rule.type,
                value: rule.action,
                ruleId: rule.id,
                ruleName: rule.name,
            };
        }
    }

    return null;
}

function applyRulesToExistingTransactions(options) {
    const dryRun = !!(options && options.dryRun);
    let matched = 0;
    let removed = 0;
    let moved = 0;
    if (typeof monthlyData === 'undefined') return { matched, removed, moved };
    if (!window.transactionOverrides) window.transactionOverrides = {};

    monthlyData.forEach((monthData, monthKey) => {
        const keep = [];
        monthData.transactions.forEach((transaction) => {
            const result = applyRulesToTransaction(transaction);
            if (!result) {
                keep.push(transaction);
                return;
            }
            if (result.action === 'delete') {
                matched++;
                removed++;
                if (dryRun) keep.push(transaction);
                return;
            }
            if (result.action === 'categorize' && result.value) {
                const current = window.transactionOverrides[monthKey] && window.transactionOverrides[monthKey][transaction._id];
                if (current && current !== result.value) {
                    matched++;
                    moved++;
                    if (!dryRun) {
                        if (!window.transactionOverrides[monthKey]) window.transactionOverrides[monthKey] = {};
                        window.transactionOverrides[monthKey][transaction._id] = result.value;
                    }
                }
            }
            keep.push(transaction);
        });
        if (!dryRun) monthData.transactions = keep;
    });

    return { matched, removed, moved };
}

window.ruleMatchesDescription = ruleMatchesDescription;
window.applyRulesToExistingTransactions = applyRulesToExistingTransactions;
