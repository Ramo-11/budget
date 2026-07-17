// js/import.js - Backup restore (validated and sanitized before adoption)
let pendingImportData = null;

// ---------------------------------------------------------------------------
// Validation / sanitization. Backups are untrusted input: every adopted value
// is shape-checked and dangerous keys (__proto__, constructor, prototype) are
// dropped so a crafted file cannot pollute prototypes or crash rendering.
// ---------------------------------------------------------------------------

const IMPORT_DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function importIsSafeKey(key) {
    return typeof key === 'string' && !IMPORT_DANGEROUS_KEYS.includes(key);
}

function importIsPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// monthlyData: array of [monthKey, { transactions: [], monthName }] pairs
function sanitizeImportedMonthlyData(raw) {
    if (!Array.isArray(raw)) return null;
    const entries = [];
    for (const entry of raw) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const [monthKey, monthData] = entry;
        if (typeof monthKey !== 'string' || !importIsPlainObject(monthData)) continue;
        if (!Array.isArray(monthData.transactions)) continue;
        entries.push([
            monthKey,
            {
                transactions: monthData.transactions.filter(importIsPlainObject),
                monthName:
                    typeof monthData.monthName === 'string' && monthData.monthName
                        ? monthData.monthName
                        : monthKey,
            },
        ]);
    }
    return entries;
}

// categoryConfig: object of { keywords: string[], icon?, _isIncome?, _isExcluded? }
function sanitizeImportedCategoryConfig(raw) {
    if (!importIsPlainObject(raw)) return null;
    const out = {};
    for (const key of Object.keys(raw)) {
        if (!importIsSafeKey(key)) continue;
        const config = raw[key];
        if (!importIsPlainObject(config)) continue;
        const clean = {
            keywords: Array.isArray(config.keywords)
                ? config.keywords.filter((k) => typeof k === 'string')
                : [],
        };
        if (typeof config.icon === 'string') clean.icon = config.icon;
        if (config._isIncome === true) clean._isIncome = true;
        if (config._isExcluded === true) clean._isExcluded = true;
        out[key] = clean;
    }
    return Object.keys(out).length > 0 ? out : null;
}

// budgets: { monthKey: { category: number } }
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

// transactionOverrides: { monthKey: { transactionId: categoryName } }
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

function sanitizeImportedRules(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(importIsPlainObject);
}

// Validate and sanitize an entire backup. Throws on structural problems.
function sanitizeImportedBackup(importData) {
    if (!importIsPlainObject(importData)) {
        throw new Error('Invalid backup file format');
    }
    if (!importData.version || importData.monthlyData === undefined) {
        throw new Error('Invalid backup file format');
    }

    const monthlyEntries = sanitizeImportedMonthlyData(importData.monthlyData);
    if (!monthlyEntries) {
        throw new Error('Backup contains no readable month data');
    }
    if (importData.categoryConfig !== undefined && importData.categoryConfig !== null) {
        if (!importIsPlainObject(importData.categoryConfig)) {
            throw new Error('Backup categories are not in a valid format');
        }
    }
    if (importData.unifiedRules !== undefined && importData.unifiedRules !== null) {
        if (!Array.isArray(importData.unifiedRules)) {
            throw new Error('Backup rules are not in a valid format');
        }
    }

    return {
        exportDate: typeof importData.exportDate === 'string' ? importData.exportDate : null,
        monthlyData: monthlyEntries,
        categoryConfig: sanitizeImportedCategoryConfig(importData.categoryConfig),
        budgets: sanitizeImportedBudgets(importData.budgets),
        transactionOverrides: sanitizeImportedOverrides(importData.transactionOverrides),
        transactionIncomeOverrides: importIsPlainObject(importData.transactionIncomeOverrides)
            ? importData.transactionIncomeOverrides
            : {},
        unifiedRules: sanitizeImportedRules(importData.unifiedRules),
        deletedTransactions: Array.isArray(importData.deletedTransactions)
            ? importData.deletedTransactions.filter(importIsPlainObject)
            : [],
        deletedFingerprints: Array.isArray(importData.deletedFingerprints)
            ? importData.deletedFingerprints.filter((fp) => typeof fp === 'string')
            : [],
    };
}

// ---------------------------------------------------------------------------
// Import flow
// ---------------------------------------------------------------------------

// Import JSON backup
function importJSONBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const cleaned = sanitizeImportedBackup(parsed);
            showImportOptionsModal(cleaned);
        } catch (error) {
            const message =
                error instanceof SyntaxError ? 'File is not valid JSON' : error.message;
            showNotification('Could not read backup: ' + message, 'error');
        }
    };

    input.click();
}

// Show import options modal
function showImportOptionsModal(importData) {
    pendingImportData = importData;

    const modal = document.getElementById('importModal');
    const importDate = importData.exportDate
        ? new Date(importData.exportDate).toLocaleString()
        : 'Unknown';
    const monthCount = importData.monthlyData.length;

    let transactionCount = 0;
    importData.monthlyData.forEach(([, data]) => {
        transactionCount += data.transactions.length;
    });

    modal.innerHTML = `
        <div class="modal-content" style="width: 520px;">
            <div class="modal-header">
                <h2>Restore Backup</h2>
                <button class="close-btn" onclick="closeModal('importModal')" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="import-stats">
                    <div class="import-stat">
                        <span>Created</span>
                        <strong>${escapeHtml(importDate)}</strong>
                    </div>
                    <div class="import-stat">
                        <span>Months</span>
                        <strong>${monthCount}</strong>
                    </div>
                    <div class="import-stat">
                        <span>Transactions</span>
                        <strong>${transactionCount}</strong>
                    </div>
                </div>

                <div class="import-options">
                    <label class="import-option">
                        <input type="radio" name="importMode" value="replace" checked>
                        <div>
                            <strong>Replace</strong>
                            <small>Use the backup only, current data is removed</small>
                        </div>
                    </label>
                    <label class="import-option">
                        <input type="radio" name="importMode" value="merge">
                        <div>
                            <strong>Merge</strong>
                            <small>Add the backup to current data, duplicates skipped</small>
                        </div>
                    </label>
                </div>

                <div class="import-warning">This cannot be undone. Export a backup first if unsure.</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('importModal')">Cancel</button>
                <button class="btn btn-primary" onclick="executeImport()">Import</button>
            </div>
        </div>
    `;

    modal.classList.add('show');
    modal.onclick = (event) => {
        if (event.target === modal) closeModal('importModal');
    };
}

function executeImport() {
    const importData = pendingImportData;
    if (!importData) return;
    const mode = document.querySelector('input[name="importMode"]:checked').value;

    try {
        if (mode === 'replace') {
            // Replace everything with the backup, and reset the related state
            // the backup does not carry so nothing stale gets persisted.
            monthlyData = new Map(importData.monthlyData);
            categoryConfig = importData.categoryConfig || categoryConfig;
            budgets = importData.budgets;
            window.transactionOverrides = importData.transactionOverrides;
            window.unifiedRules = importData.unifiedRules;
            window.transactionIncomeOverrides = importData.transactionIncomeOverrides;
            window.deletedTransactions = importData.deletedTransactions;
            window.deletedFingerprints = importData.deletedFingerprints;
            window.merchantRules = {};
        } else {
            // Merge mode. Initialize targets first: on a fresh browser these
            // globals only exist after saved data has been loaded.
            if (!window.transactionOverrides) window.transactionOverrides = {};
            if (!window.unifiedRules) window.unifiedRules = [];
            if (!budgets) budgets = {};

            // Merge transactions, avoiding duplicates
            const existingData = new Map(monthlyData);
            const importMap = new Map(importData.monthlyData);

            importMap.forEach((monthData, monthKey) => {
                if (!existingData.has(monthKey)) {
                    existingData.set(monthKey, monthData);
                } else {
                    const existing = existingData.get(monthKey);
                    monthData.transactions.forEach((transaction) => {
                        if (!isDuplicateTransaction(transaction, existing.transactions)) {
                            existing.transactions.push(transaction);
                        }
                    });
                }
            });

            monthlyData = existingData;

            // Categories: imported definitions win for same-name categories
            Object.assign(categoryConfig, importData.categoryConfig || {});

            // Budgets and overrides: deep-merge per month key so an
            // overlapping month never wholesale-replaces local data.
            Object.entries(importData.budgets).forEach(([monthKey, monthBudgets]) => {
                budgets[monthKey] = { ...(budgets[monthKey] || {}), ...monthBudgets };
            });
            Object.entries(importData.transactionOverrides).forEach(
                ([monthKey, monthOverrides]) => {
                    window.transactionOverrides[monthKey] = {
                        ...(window.transactionOverrides[monthKey] || {}),
                        ...monthOverrides,
                    };
                }
            );

            // Rules: add imported rules, skipping duplicates
            importData.unifiedRules.forEach((importedRule) => {
                const exists = window.unifiedRules.some(
                    (r) =>
                        r.pattern === importedRule.pattern &&
                        r.type === importedRule.type &&
                        r.action === importedRule.action
                );
                if (!exists) {
                    importedRule.id = 'rule_' + Math.random().toString(36).substr(2, 9);
                    window.unifiedRules.push(importedRule);
                }
            });
        }

        saveData();

        // Update the appropriate month selector based on current page
        if (typeof updateMonthSelector === 'function') {
            updateMonthSelector();
        }
        if (typeof updateSettingsMonthSelector === 'function') {
            updateSettingsMonthSelector();
        }

        if (document.getElementById('settingsMonthDropdown')) {
            const months = Array.from(monthlyData.keys()).sort().reverse();
            if (months.length > 0) {
                document.getElementById('settingsMonthDropdown').value = months[0];
                switchSettingsMonth(months[0]);
            }
            if (typeof updateStorageStats === 'function') {
                updateStorageStats();
            }
        } else if (document.getElementById('monthDropdown')) {
            document.getElementById('monthDropdown').value = 'ALL_DATA';
            switchToMonth('ALL_DATA');
        }

        closeModal('importModal');
        showNotification('Backup imported successfully', 'success');

        pendingImportData = null;
    } catch (error) {
        showNotification('Import failed: ' + error.message, 'error');
    }
}
