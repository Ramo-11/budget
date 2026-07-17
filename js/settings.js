// js/settings.js - Settings View Functions

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSavedData === 'function') {
        loadSavedData();
    }
    updateSettingsMonthSelector();
    updateStorageStats();
    initializeIncomeToggle();
    ensureBudgetGridListeners();

    if (monthlyData.size > 0) {
        const dropdown = document.getElementById('settingsMonthDropdown');
        if (dropdown) dropdown.value = 'ALL_MONTHS';
        switchSettingsMonth('ALL_MONTHS');
    } else {
        // No data uploaded yet, but still show categories
        currentMonth = 'NO_DATA';
        updateBudgetView(null);
    }
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Compact money label: whole dollars unless cents matter.
function formatMoney(value) {
    const v = Number(value) || 0;
    const rounded = Math.round(v);
    return Math.abs(v - rounded) < 0.005 ? rounded.toLocaleString() : v.toFixed(2);
}

// Categories sorted alphabetically with Others last.
function sortedCategoryNames() {
    return Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });
}

// The month key budgets are edited against. Falls back to the real current
// calendar month for a brand-new user, so budgets never land on a junk key.
function getSettingsBudgetMonthKey() {
    if (
        currentMonth &&
        currentMonth !== 'NO_DATA' &&
        currentMonth !== 'ALL_MONTHS' &&
        monthlyData.has(currentMonth)
    ) {
        return currentMonth;
    }
    if (typeof monthKeyFromDate === 'function') {
        return monthKeyFromDate(new Date());
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Re-render whichever budget grid variant is active.
function refreshBudgetGrid() {
    if (currentMonth === 'ALL_MONTHS') {
        updateBudgetViewForAllMonths();
    } else if (currentMonth && monthlyData.has(currentMonth)) {
        const monthData = monthlyData.get(currentMonth);
        updateBudgetView(analyzeTransactions(monthData.transactions));
    } else {
        updateBudgetView(null);
    }
}

// Locate a category card by its (untrusted) name via dataset comparison.
function findCategoryCard(category) {
    const cards = document.querySelectorAll('#budgetGrid .category-card');
    for (const card of cards) {
        if (card.dataset.category === category) return card;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Income tracking (Advanced)
// ---------------------------------------------------------------------------

function initializeIncomeToggle() {
    const toggle = document.getElementById('incomeToggle');

    if (toggle && window.incomeSettings) {
        toggle.checked = window.incomeSettings.trackIncome === true;
        updateIncomeToggleLabel(toggle.checked);
    }
}

function toggleIncomeTracking(enabled) {
    window.incomeSettings = window.incomeSettings || {};
    window.incomeSettings.trackIncome = enabled;

    // Add or ensure Income category exists when enabled
    if (enabled && !categoryConfig['Income']) {
        categoryConfig['Income'] = {
            keywords: [],
            icon: '',
            _isIncome: true,
        };
    }

    // Scan existing transactions and move income ones to Income category
    let movedCount = 0;
    if (enabled && monthlyData.size > 0) {
        movedCount = scanAndMoveIncomeTransactions();
    }

    saveData();
    updateIncomeToggleLabel(enabled);

    if (typeof broadcastSync === 'function') {
        broadcastSync('data_changed', { incomeTracking: enabled });
    }

    if (enabled) {
        if (movedCount > 0) {
            showNotification(
                `Income tracking enabled. ${movedCount} existing transaction${movedCount > 1 ? 's' : ''} moved to Income.`,
                'success'
            );
        } else {
            showNotification('Income tracking enabled.', 'success');
        }
    } else {
        showNotification('Income tracking disabled. Existing income transactions are preserved.', 'info');
    }
}

// Scan existing transactions and move income ones to Income category
// Only pattern-based detection - positive amounts (refunds/cashback) are NOT moved
function scanAndMoveIncomeTransactions() {
    const incomePatterns = window.incomeSettings?.incomePatterns || [];
    let movedCount = 0;

    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((transaction) => {
            const description = (transaction.Description || transaction.description || '').toUpperCase();
            const transactionId = transaction._id;

            const currentCategory = window.transactionOverrides?.[monthKey]?.[transactionId];
            if (currentCategory === 'Income') {
                return; // Already income
            }

            const isIncomePattern = incomePatterns.some((pattern) => description.includes(pattern));

            if (isIncomePattern) {
                if (!window.transactionOverrides) {
                    window.transactionOverrides = {};
                }
                if (!window.transactionOverrides[monthKey]) {
                    window.transactionOverrides[monthKey] = {};
                }
                window.transactionOverrides[monthKey][transactionId] = 'Income';
                transaction._isIncome = true;
                movedCount++;
            }
        });
    });

    return movedCount;
}

function updateIncomeToggleLabel(enabled) {
    const label = document.getElementById('incomeToggleLabel');
    if (label) {
        label.textContent = enabled ? 'Income tracking is enabled' : 'Income tracking is disabled';
    }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

// Switch settings tab (2-tab structure: setup, data)
function switchSettingsTab(tab, el) {
    document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.settings-content').forEach((c) => c.classList.remove('active'));

    const trigger = el || (typeof event !== 'undefined' && event.target);
    if (trigger && trigger.closest) {
        const btn = trigger.closest('.settings-tab');
        if (btn) btn.classList.add('active');
    }
    const pane = document.getElementById(tab + 'Tab');
    if (pane) pane.classList.add('active');

    if (tab === 'setup') {
        if (typeof loadRules === 'function') loadRules();
        if (typeof updateRulesDisplay === 'function') updateRulesDisplay();
    } else if (tab === 'data') {
        updateStorageStats();
    }
}

// ---------------------------------------------------------------------------
// Export / storage stats
// ---------------------------------------------------------------------------

// Unified CSV export - reads scope from #exportMonthSelect ("all" or month key)
function exportTransactionsUnified() {
    const select = document.getElementById('exportMonthSelect');
    const scope = select ? select.value : 'all';
    if (scope === 'all' || !scope) {
        exportCategorizedCSV();
    } else {
        exportMonthCSV();
    }
}

function updateStorageStats() {
    let transactionCount = 0;
    const monthCount = monthlyData.size;
    const categoryCount = Object.keys(categoryConfig).length;
    let rulesCount = 0;

    if (window.unifiedRules && Array.isArray(window.unifiedRules)) {
        rulesCount = window.unifiedRules.length;
    }

    monthlyData.forEach((data) => {
        transactionCount += data.transactions.length;
    });

    const storageSize = new Blob([JSON.stringify(localStorage.getItem(getActiveDataKey()))]).size;
    const storageMB = (storageSize / (1024 * 1024)).toFixed(2);

    const container = document.getElementById('storageStats');
    if (container) {
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${transactionCount.toLocaleString()}</div>
                    <div class="stat-label">Transactions</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${monthCount}</div>
                    <div class="stat-label">Months</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${categoryCount}</div>
                    <div class="stat-label">Categories</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${rulesCount}</div>
                    <div class="stat-label">Rules</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${storageMB} MB</div>
                    <div class="stat-label">Storage Used</div>
                </div>
            </div>
        `;
    }

    if (typeof populateExportMonthDropdown === 'function') {
        populateExportMonthDropdown();
    }
}

// Export all data as CSV
function exportAllToCSV() {
    let csvContent = 'Date,Description,Amount,Category,Month\n';

    monthlyData.forEach((monthData) => {
        monthData.transactions.forEach((transaction) => {
            const date = transaction['Transaction Date'] || transaction.Date || transaction.date;
            const description = transaction.Description || transaction.description || '';
            const amount = parseFloat(transaction.Amount) || 0;
            const category = categorizeTransaction(description, transaction._id);

            const escapedDesc =
                description.includes(',') || description.includes('"')
                    ? `"${description.replace(/"/g, '""')}"`
                    : description;

            csvContent += `${date},${escapedDesc},${amount},${category},${monthData.monthName}\n`;
        });
    });

    downloadFile(csvContent, `all_transactions_${Date.now()}.csv`, 'text/csv');
    showNotification('All data exported successfully', 'success');
}

// ---------------------------------------------------------------------------
// Month selector
// ---------------------------------------------------------------------------

function updateSettingsMonthSelector() {
    const dropdown = document.getElementById('settingsMonthDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    const months = Array.from(monthlyData.keys()).sort().reverse();
    const wrapper = dropdown.closest('.month-selector');
    if (wrapper) wrapper.style.display = months.length > 0 ? '' : 'none';
    if (months.length === 0) return;

    const allOption = document.createElement('option');
    allOption.value = 'ALL_MONTHS';
    allOption.textContent = 'All months';
    dropdown.appendChild(allOption);

    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthData.monthName;
        dropdown.appendChild(option);
    });
}

function switchSettingsMonth(monthKey) {
    if (monthKey === 'ALL_MONTHS') {
        currentMonth = 'ALL_MONTHS';
        updateBudgetViewForAllMonths();
        return;
    }

    currentMonth = monthKey;

    if (monthlyData.has(monthKey)) {
        const monthData = monthlyData.get(monthKey);
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
    } else {
        updateBudgetView(null);
    }
}

// ---------------------------------------------------------------------------
// Category grid rendering (shared card + shell, delegated events)
// ---------------------------------------------------------------------------

// One-time delegated listeners for everything rendered inside #budgetGrid.
// Category names never travel through inline handlers; they are read back
// from data-category, which is quote-safe for any name.
function ensureBudgetGridListeners() {
    const container = document.getElementById('budgetGrid');
    if (!container || container.dataset.listenersBound) return;
    container.dataset.listenersBound = 'true';

    container.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl || !container.contains(actionEl)) return;
        const card = actionEl.closest('.category-card');
        const category = card ? card.dataset.category : null;

        switch (actionEl.dataset.action) {
            case 'add-category':
                addNewCategory();
                break;
            case 'save-changes':
                saveAllCategoryChanges();
                break;
            case 'copy-budgets':
                copyBudgetsToAllMonths();
                break;
            case 'delete-category':
                if (category) removeCategory(category);
                break;
            case 'set-budget':
                if (category) setBudgetWithOptions(category);
                break;
            case 'set-budget-all':
                if (category) setBudgetForAllMonths(category);
                break;
        }
    });

    container.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'carryUnusedToggle') {
            toggleCarryUnused(target.checked);
            return;
        }
        const card = target.closest('.category-card');
        if (target.classList.contains('category-name-input')) {
            if (card) renameCategory(card.dataset.category, target.value);
            return;
        }
        if (
            target.classList.contains('keywords-input') ||
            target.classList.contains('income-category-toggle') ||
            target.classList.contains('exclude-category-toggle')
        ) {
            markUnsavedChanges();
        }
    });

    container.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.classList && e.target.classList.contains('budget-amount-input')) {
            const card = e.target.closest('.category-card');
            const btn = card && card.querySelector('.apply-budget-btn');
            if (btn) btn.click();
        }
    });
}

// Render one category card. info:
//   budgetValue (number|null), placeholder (string),
//   statusClass ('no-budget'|'has-budget'|'varies'|'over'), statusText,
//   progressPct (number|null), progressClass (''|'warning'|'danger'),
//   applyAll (boolean)
function renderCategoryCard(category, info) {
    const esc = window.escapeHtml;
    const config = categoryConfig[category] || { keywords: [] };
    const keywords = Array.isArray(config.keywords) ? config.keywords : [];
    const isOthers = category === 'Others';
    const safeName = esc(category);
    const chip = getCategoryIconChip(category, { size: 40, icon: 20 });

    const nameControl = isOthers
        ? `<div class="category-name-static">
               <span class="category-name-text">${safeName}</span>
               <span class="default-badge">Default</span>
           </div>`
        : `<input type="text" class="category-name-input" value="${safeName}"
                  aria-label="Category name" title="Click to rename" autocomplete="off">`;

    const deleteBtn = isOthers
        ? ''
        : `<button class="category-delete-btn" data-action="delete-category"
                   title="Delete category" aria-label="Delete ${safeName}">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <polyline points="3 6 5 6 21 6"></polyline>
                   <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
               </svg>
           </button>`;

    const progress =
        info.progressPct === null || info.progressPct === undefined
            ? ''
            : `<div class="budget-progress">
                   <div class="budget-progress-fill ${info.progressClass || ''}" style="width: ${info.progressPct}%"></div>
               </div>`;

    return `
        <div class="category-card" data-category="${safeName}">
            <div class="category-card-top">
                ${chip}
                ${nameControl}
                ${deleteBtn}
            </div>
            <div class="category-card-body">
                <div class="category-field">
                    <span class="field-label">Budget</span>
                    <div class="budget-input-group">
                        <span class="currency-prefix">$</span>
                        <input type="number" class="budget-amount-input" inputmode="decimal"
                               value="${info.budgetValue !== null && info.budgetValue !== undefined ? info.budgetValue : ''}"
                               placeholder="${esc(info.placeholder || '0')}" step="1" min="0"
                               aria-label="Monthly budget for ${safeName}">
                        <button class="apply-budget-btn" data-action="${info.applyAll ? 'set-budget-all' : 'set-budget'}"
                                title="${info.applyAll ? 'Apply this budget to every month' : 'Set this budget'}">
                            ${info.applyAll ? 'Set All' : 'Set'}
                        </button>
                    </div>
                    ${progress}
                    <div class="budget-status ${info.statusClass}">
                        <span class="status-indicator"></span>
                        <span>${esc(info.statusText)}</span>
                    </div>
                </div>
                <div class="category-field">
                    <span class="field-label">Keywords
                        <span class="keyword-count">${keywords.length}</span>
                    </span>
                    <input type="text" class="keywords-input"
                           value="${esc(keywords.join(', '))}"
                           placeholder="AMAZON, WALMART"
                           title="Comma-separated. Matching transactions land here automatically."
                           aria-label="Keywords for ${safeName}" autocomplete="off">
                </div>
                <div class="category-toggles">
                    <label class="mini-toggle" title="Amounts in this category count as income">
                        <input type="checkbox" class="income-category-toggle" ${config._isIncome ? 'checked' : ''}>
                        <span class="mini-track"></span>
                        <span class="mini-toggle-text">Income</span>
                    </label>
                    <label class="mini-toggle" title="Shown in lists but left out of totals and charts">
                        <input type="checkbox" class="exclude-category-toggle" ${config._isExcluded ? 'checked' : ''}>
                        <span class="mini-track"></span>
                        <span class="mini-toggle-text">Excluded</span>
                    </label>
                </div>
            </div>
        </div>`;
}

// Grid shell: header actions + budget tools + unsaved notice + cards.
function renderCategoriesShell(cardsHtml, ctx) {
    const esc = window.escapeHtml;
    const carryOn = window.incomeSettings?.carryUnusedBudget === true;

    return `
        <div class="categories-header">
            <div class="categories-header-content">
                <h2>Categories</h2>
                <p>${esc(ctx.subtitle || '')}</p>
            </div>
            <div class="categories-header-actions">
                <button class="btn btn-secondary" data-action="add-category">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Category
                </button>
                <button class="btn btn-primary" id="saveChangesBtn" data-action="save-changes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span id="saveChangesText">Save Changes</span>
                </button>
            </div>
        </div>
        <div class="budget-tools">
            ${
                ctx.showCopy
                    ? `<button class="btn btn-secondary btn-sm budget-tool-copy" data-action="copy-budgets"
                               title="Write this month's budgets into every month">
                           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                               <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                               <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                           </svg>
                           Copy this month's budgets to all months
                       </button>`
                    : ''
            }
            <label class="mini-toggle budget-tool-carry" title="Unspent budget is added to the same category next month">
                <input type="checkbox" id="carryUnusedToggle" ${carryOn ? 'checked' : ''}>
                <span class="mini-track"></span>
                <span class="mini-toggle-text">Carry unused budget to next month</span>
            </label>
        </div>
        <div id="unsavedNotice" class="unsaved-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Unsaved changes
            <button class="unsaved-save-btn" data-action="save-changes">Save</button>
        </div>
        <div class="categories-grid">
            ${cardsHtml}
        </div>
    `;
}

// Single-month (or fresh user) view
function updateBudgetView(analyzer) {
    const container = document.getElementById('budgetGrid');
    if (!container) return;
    ensureBudgetGridListeners();

    const monthKey = getSettingsBudgetMonthKey();
    const monthBudgets = budgets[monthKey] || {};
    const hasData = monthlyData.has(monthKey);
    const monthName = hasData
        ? monthlyData.get(monthKey).monthName
        : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!analyzer) {
        analyzer = { categoryTotals: {}, categoryDetails: {}, totalExpenses: 0, transactionCount: 0 };
    }

    const carryMap = computeCarryOverMap(monthKey);

    const cardsHtml = sortedCategoryNames()
        .map((category) => {
            const budget = monthBudgets[category] || 0;
            const carry = carryMap[category] || 0;
            const effectiveBudget = budget + carry;
            const spent = Math.max(0, analyzer.categoryTotals[category] || 0);

            let statusClass = 'no-budget';
            let statusText = 'No budget';
            let progressPct = null;
            let progressClass = '';

            if (effectiveBudget > 0) {
                if (!hasData) {
                    statusClass = 'has-budget';
                    statusText = `$${formatMoney(effectiveBudget)}/mo`;
                } else {
                    progressPct = Math.min(100, Math.round((spent / effectiveBudget) * 100));
                    if (spent > effectiveBudget) {
                        statusClass = 'over';
                        progressClass = 'danger';
                        statusText = `$${formatMoney(spent - effectiveBudget)} over $${formatMoney(effectiveBudget)}`;
                    } else {
                        statusClass = 'has-budget';
                        progressClass = progressPct >= 80 ? 'warning' : '';
                        statusText = `$${formatMoney(spent)} of $${formatMoney(effectiveBudget)}`;
                    }
                    if (carry > 0) {
                        statusText += ` (+$${formatMoney(carry)} carried)`;
                    }
                }
            }

            return renderCategoryCard(category, {
                budgetValue: budget > 0 ? budget : null,
                placeholder: '0',
                statusClass,
                statusText,
                progressPct,
                progressClass,
                applyAll: false,
            });
        })
        .join('');

    container.innerHTML = renderCategoriesShell(cardsHtml, {
        subtitle: hasData ? monthName : `Budgets start with ${monthName}`,
        showCopy: hasData && monthlyData.size > 1,
    });
}

// All-months view
function updateBudgetViewForAllMonths() {
    const container = document.getElementById('budgetGrid');
    if (!container) return;
    ensureBudgetGridListeners();

    const monthsList = Array.from(monthlyData.keys()).sort();
    const budgetSummary = {};

    Object.keys(categoryConfig).forEach((category) => {
        budgetSummary[category] = {
            hasAnyBudget: false,
            isConsistent: true,
            firstValue: null,
            values: [],
        };
    });

    monthsList.forEach((monthKey) => {
        const monthBudgets = budgets[monthKey] || {};
        Object.keys(categoryConfig).forEach((category) => {
            const budget = monthBudgets[category] || 0;
            if (budget > 0) {
                const summary = budgetSummary[category];
                summary.hasAnyBudget = true;
                summary.values.push(budget);
                if (summary.firstValue === null) {
                    summary.firstValue = budget;
                } else if (summary.firstValue !== budget) {
                    summary.isConsistent = false;
                }
            }
        });
    });

    const cardsHtml = sortedCategoryNames()
        .map((category) => {
            const summary = budgetSummary[category] || { hasAnyBudget: false };

            let statusClass = 'no-budget';
            let statusText = 'No budget';
            let budgetValue = null;
            let placeholder = '0';

            if (summary.hasAnyBudget) {
                if (summary.isConsistent) {
                    statusClass = 'has-budget';
                    statusText = `$${formatMoney(summary.firstValue)}/mo, every month`;
                    budgetValue = summary.firstValue;
                } else {
                    statusClass = 'varies';
                    const avg = summary.values.reduce((a, b) => a + b, 0) / summary.values.length;
                    statusText = `Varies by month, avg $${formatMoney(avg)}`;
                    placeholder = 'Varies';
                }
            }

            return renderCategoryCard(category, {
                budgetValue,
                placeholder,
                statusClass,
                statusText,
                progressPct: null,
                progressClass: '',
                applyAll: true,
            });
        })
        .join('');

    container.innerHTML = renderCategoriesShell(cardsHtml, {
        subtitle: 'All months',
        showCopy: false,
    });
}

// ---------------------------------------------------------------------------
// Budget actions
// ---------------------------------------------------------------------------

// Read and validate the budget input for a category card.
// Returns a number (0 clears the budget) or null when invalid.
function readBudgetInput(category) {
    const card = findCategoryCard(category);
    const input = card ? card.querySelector('.budget-amount-input') : null;
    if (!input) return null;

    const raw = input.value.trim();
    const value = raw === '' ? 0 : parseFloat(raw);
    if (isNaN(value) || value < 0) {
        showNotification('Enter a valid budget amount', 'error');
        return null;
    }
    return value;
}

// All-months view button: apply to every month directly.
function setBudgetForAllMonths(category) {
    const value = readBudgetInput(category);
    if (value === null) return;
    applyBudgetToAllMonthsForCategory(category, value);
}

// Single-month view button. Works for a brand-new user (no imported data),
// for a single stored month, and offers a scope chooser otherwise.
function setBudgetWithOptions(category) {
    const value = readBudgetInput(category);
    if (value === null) return;

    if (currentMonth === 'ALL_MONTHS') {
        applyBudgetToAllMonthsForCategory(category, value);
        return;
    }

    // Fresh user: store against the real current calendar month, no chooser.
    if (!monthlyData.has(currentMonth)) {
        applyBudgetToMonth(category, value, getSettingsBudgetMonthKey());
        return;
    }

    // Only one month of data: nothing to choose.
    if (monthlyData.size === 1) {
        applyBudgetToMonth(category, value, currentMonth);
        return;
    }

    openBudgetScopeModal(category, value);
}

// Scope chooser: this month, every month, or a picked month.
function openBudgetScopeModal(category, value) {
    const esc = window.escapeHtml;
    const monthName = monthlyData.get(currentMonth)?.monthName || 'This month';
    const amountLabel = value > 0 ? `$${formatMoney(value)} per month` : 'Clear budget';

    const monthOptions = Array.from(monthlyData.keys())
        .sort()
        .reverse()
        .map(
            (key) =>
                `<option value="${esc(key)}" ${key === currentMonth ? 'selected' : ''}>${esc(
                    monthlyData.get(key).monthName
                )}</option>`
        )
        .join('');

    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    overlay.innerHTML = `
        <div class="app-modal budget-scope-modal" role="dialog" aria-modal="true" aria-label="Set budget">
            <div class="app-modal-header">
                <div class="app-modal-title">Set Budget</div>
                <button class="app-modal-close" data-close aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="app-modal-body">
                <div class="budget-scope-summary">
                    ${getCategoryIconChip(category, { size: 40, icon: 20 })}
                    <div class="budget-scope-summary-text">
                        <strong>${esc(category)}</strong>
                        <span>${esc(amountLabel)}</span>
                    </div>
                </div>
                <div class="budget-scope-options">
                    <button class="btn btn-primary" data-scope="current">${esc(monthName)} only</button>
                    <button class="btn btn-secondary" data-scope="all">Every month</button>
                </div>
                <div class="budget-scope-month-row">
                    <label class="app-label" for="budgetScopeMonth">Or a different month</label>
                    <div class="budget-scope-month-controls">
                        <select id="budgetScopeMonth" class="app-input">${monthOptions}</select>
                        <button class="btn btn-secondary" data-scope="picked">Apply</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) {
            overlay.remove();
            return;
        }
        const scopeBtn = e.target.closest('[data-scope]');
        if (!scopeBtn) return;
        const scope = scopeBtn.dataset.scope;
        if (scope === 'current') {
            applyBudgetToMonth(category, value, currentMonth);
        } else if (scope === 'all') {
            applyBudgetToAllMonthsForCategory(category, value);
        } else if (scope === 'picked') {
            const sel = overlay.querySelector('#budgetScopeMonth');
            if (sel && sel.value) applyBudgetToMonth(category, value, sel.value);
        }
        overlay.remove();
    });

    document.body.appendChild(overlay);
}

// Apply budget to a single month (0 clears it)
function applyBudgetToMonth(category, value, monthKey) {
    if (!budgets[monthKey]) {
        budgets[monthKey] = {};
    }

    const monthName =
        monthlyData.get(monthKey)?.monthName ||
        (monthKey === getSettingsBudgetMonthKey()
            ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : monthKey);

    if (!value || value === 0) {
        delete budgets[monthKey][category];
        showNotification(`Budget cleared for ${category} in ${monthName}`, 'success');
    } else {
        budgets[monthKey][category] = value;
        showNotification(`Budget set for ${category} in ${monthName}`, 'success');
    }

    saveData();
    refreshBudgetGrid();
}

// Apply budget to all months for a specific category (0 clears it)
function applyBudgetToAllMonthsForCategory(category, value) {
    let months = Array.from(monthlyData.keys());
    if (months.length === 0) months = [getSettingsBudgetMonthKey()];

    months.forEach((monthKey) => {
        if (!budgets[monthKey]) {
            budgets[monthKey] = {};
        }

        if (!value || value === 0) {
            delete budgets[monthKey][category];
        } else {
            budgets[monthKey][category] = value;
        }
    });

    saveData();

    showNotification(
        value > 0
            ? `$${formatMoney(value)} budget set for ${category} in every month`
            : `Budget cleared for ${category} in every month`,
        'success'
    );

    refreshBudgetGrid();
}

// Budget template: copy the current month's per-category budgets to all months.
function copyBudgetsToAllMonths() {
    const sourceKey =
        currentMonth && currentMonth !== 'ALL_MONTHS' && monthlyData.has(currentMonth) ? currentMonth : null;
    if (!sourceKey) return;

    const source = budgets[sourceKey] || {};
    const activeBudgets = Object.entries(source).filter(([, v]) => v > 0);
    if (activeBudgets.length === 0) {
        showNotification('No budgets set for this month yet', 'info');
        return;
    }

    const monthName = monthlyData.get(sourceKey)?.monthName || sourceKey;
    if (
        !confirm(
            `Copy ${monthName} budgets (${activeBudgets.length} categories) to all months? Budgets in other months will be replaced.`
        )
    ) {
        return;
    }

    Array.from(monthlyData.keys()).forEach((monthKey) => {
        budgets[monthKey] = { ...source };
    });

    saveData();
    refreshBudgetGrid();
    showNotification(`Budgets copied to all ${monthlyData.size} months`, 'success');
}

// Budget rollover: persist the "carry unused budget" preference.
// Stored alongside incomeSettings because core.js persists and merges it.
function toggleCarryUnused(enabled) {
    window.incomeSettings = window.incomeSettings || {};
    window.incomeSettings.carryUnusedBudget = enabled === true;
    saveData();
    showNotification(
        enabled ? 'Unused budget now carries into the next month' : 'Budget carryover turned off',
        'success'
    );
    refreshBudgetGrid();
}

// Per-category unused budget carried in from the previous month.
function computeCarryOverMap(monthKey) {
    const map = {};
    if (window.incomeSettings?.carryUnusedBudget !== true) return map;

    const parts = /^(\d{4})-(\d{2})$/.exec(monthKey || '');
    if (!parts) return map;

    const prevDate = new Date(Number(parts[1]), Number(parts[2]) - 2, 1);
    const prevKey =
        typeof monthKeyFromDate === 'function'
            ? monthKeyFromDate(prevDate)
            : `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevBudgets = budgets[prevKey];
    if (!prevBudgets || !monthlyData.has(prevKey)) return map;

    const prevAnalyzer = analyzeTransactions(monthlyData.get(prevKey).transactions);
    Object.keys(prevBudgets).forEach((category) => {
        if (!categoryConfig[category]) return;
        const b = prevBudgets[category] || 0;
        if (b <= 0) return;
        const spent = Math.max(0, prevAnalyzer.categoryTotals[category] || 0);
        const left = b - spent;
        if (left > 0.005) map[category] = left;
    });
    return map;
}

// Back-compat alias
function setBudget(category) {
    setBudgetWithOptions(category);
}

// ---------------------------------------------------------------------------
// Category editing (keywords / flags / rename / delete)
// ---------------------------------------------------------------------------

// Update category keywords in memory (saved by saveAllCategoryChanges)
function updateCategoryKeywords(category, keywordsString) {
    const keywords = keywordsString
        .split(',')
        .map((k) => k.trim().toUpperCase())
        .filter((k) => k.length > 0);

    categoryConfig[category].keywords = keywords;
}

// Harvest every card's editable state (keywords + flags) into categoryConfig.
// Returns true when anything actually changed.
function collectCategoryEditsFromDOM() {
    let hasChanges = false;

    document.querySelectorAll('#budgetGrid .category-card').forEach((card) => {
        const category = card.dataset.category;
        const config = categoryConfig[category];
        if (!config) return;

        const keywordsInput = card.querySelector('.keywords-input');
        if (keywordsInput) {
            const newKeywords = keywordsInput.value
                .split(',')
                .map((k) => k.trim().toUpperCase())
                .filter((k) => k.length > 0);
            if (JSON.stringify(newKeywords) !== JSON.stringify(config.keywords || [])) {
                config.keywords = newKeywords;
                hasChanges = true;
            }
        }

        const incomeToggle = card.querySelector('.income-category-toggle');
        if (incomeToggle) {
            const wasIncome = config._isIncome === true;
            if (wasIncome !== incomeToggle.checked) {
                if (incomeToggle.checked) {
                    config._isIncome = true;
                } else {
                    delete config._isIncome;
                }
                hasChanges = true;
            }
        }

        const excludeToggle = card.querySelector('.exclude-category-toggle');
        if (excludeToggle) {
            const wasExcluded = config._isExcluded === true;
            if (wasExcluded !== excludeToggle.checked) {
                if (excludeToggle.checked) {
                    config._isExcluded = true;
                } else {
                    delete config._isExcluded;
                }
                hasChanges = true;
            }
        }
    });

    return hasChanges;
}

// Save all category changes (keywords + flags)
function saveAllCategoryChanges() {
    const hasChanges = collectCategoryEditsFromDOM();

    if (hasChanges) {
        saveData();

        if (typeof broadcastSync === 'function') {
            broadcastSync('category_updated', {});
        }

        refreshBudgetGrid();
        clearUnsavedChanges();
        showNotification('Changes saved', 'success');
    } else {
        clearUnsavedChanges();
        showNotification('No changes to save', 'info');
    }
}

// Rename category: migrates config, budgets, overrides, merchant rules, and
// unified rules to the new name, then persists immediately.
function renameCategory(oldName, newName) {
    newName = (newName || '').trim();

    if (!newName || newName === oldName) {
        refreshBudgetGrid();
        return;
    }

    if (oldName === 'Others' || !categoryConfig[oldName]) {
        refreshBudgetGrid();
        return;
    }

    if (oldName === 'Income' && window.incomeSettings?.trackIncome) {
        showNotification('Turn off income tracking before renaming Income', 'error');
        refreshBudgetGrid();
        return;
    }

    if (categoryConfig[newName]) {
        showNotification('A category with that name already exists', 'error');
        refreshBudgetGrid();
        return;
    }

    // Keep any pending unsaved edits (keywords/flags) before re-rendering.
    collectCategoryEditsFromDOM();

    // Move the category configuration
    categoryConfig[newName] = categoryConfig[oldName];
    delete categoryConfig[oldName];

    // Migrate budgets across every month
    Object.keys(budgets).forEach((monthKey) => {
        const monthBudgets = budgets[monthKey];
        if (monthBudgets && monthBudgets[oldName] !== undefined) {
            monthBudgets[newName] = monthBudgets[oldName];
            delete monthBudgets[oldName];
        }
    });

    // Migrate transaction overrides
    if (window.transactionOverrides) {
        Object.keys(window.transactionOverrides).forEach((monthKey) => {
            const monthOverrides = window.transactionOverrides[monthKey];
            Object.keys(monthOverrides).forEach((transId) => {
                if (monthOverrides[transId] === oldName) {
                    monthOverrides[transId] = newName;
                }
            });
        });
    }

    // Migrate merchant rules
    if (window.merchantRules) {
        Object.keys(window.merchantRules).forEach((merchant) => {
            if (window.merchantRules[merchant] === oldName) {
                window.merchantRules[merchant] = newName;
            }
        });
    }

    // Migrate unified rules that move transactions into this category
    if (Array.isArray(window.unifiedRules)) {
        window.unifiedRules.forEach((rule) => {
            if (rule.type === 'categorize' && rule.action === oldName) {
                rule.action = newName;
                if (rule.isAutomatic) {
                    rule.name = `Auto: "${rule.pattern}" -> ${newName}`;
                }
            }
        });
    }

    saveData();

    if (typeof broadcastSync === 'function') {
        broadcastSync('category_updated', { oldName: oldName, newName: newName });
    }

    clearUnsavedChanges();
    refreshBudgetGrid();
    if (typeof updateRulesDisplay === 'function') updateRulesDisplay();
    updateStorageStats();
    showNotification(`Renamed "${oldName}" to "${newName}"`, 'success');
}

// Remove category: transactions move to Others, rules and budgets are cleaned
// up so nothing points at the deleted name.
function removeCategory(name) {
    if (!name || !categoryConfig[name] || name === 'Others') return;

    if (name === 'Income' && window.incomeSettings?.trackIncome) {
        showNotification('Cannot delete Income while income tracking is enabled', 'error');
        return;
    }

    if (!confirm(`Delete "${name}"? Its transactions move to Others.`)) return;

    // Snapshot for undo (in-place action, no reload).
    const undoSnapshot = (typeof snapshotActiveData === 'function') ? snapshotActiveData() : null;

    delete categoryConfig[name];

    // Reassign this category's transaction overrides to Others
    if (window.transactionOverrides) {
        Object.keys(window.transactionOverrides).forEach((monthKey) => {
            const monthOverrides = window.transactionOverrides[monthKey];
            Object.keys(monthOverrides).forEach((transId) => {
                if (monthOverrides[transId] === name) {
                    monthOverrides[transId] = 'Others';
                }
            });
        });
    }

    // Drop unified rules that move transactions into the deleted category
    if (Array.isArray(window.unifiedRules)) {
        window.unifiedRules = window.unifiedRules.filter(
            (rule) => !(rule.type === 'categorize' && rule.action === name)
        );
    }

    // Drop learned merchant rules pointing at it
    if (window.merchantRules) {
        Object.keys(window.merchantRules).forEach((merchant) => {
            if (window.merchantRules[merchant] === name) {
                delete window.merchantRules[merchant];
            }
        });
    }

    // Delete its budgets across every month
    Object.keys(budgets).forEach((monthKey) => {
        if (budgets[monthKey] && budgets[monthKey][name] !== undefined) {
            delete budgets[monthKey][name];
        }
    });

    saveData();

    if (typeof broadcastSync === 'function') {
        broadcastSync('category_deleted', { name: name });
    }

    refreshBudgetGrid();
    if (typeof updateRulesDisplay === 'function') updateRulesDisplay();
    updateStorageStats();

    if (undoSnapshot && typeof showUndo === 'function') {
        showUndo(`"${name}" deleted`, () => { restoreActiveData(undoSnapshot); }, { reloadOnUndo: true });
    } else {
        showNotification(`"${name}" deleted. Its transactions moved to Others.`, 'success');
    }
}

// ---------------------------------------------------------------------------
// Add category (icons are automatic; no picker)
// ---------------------------------------------------------------------------

function addNewCategory() {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    overlay.innerHTML = `
        <div class="app-modal" role="dialog" aria-modal="true" aria-label="New category">
            <div class="app-modal-header">
                <div class="app-modal-title">New Category</div>
                <button class="app-modal-close" data-close aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="app-modal-body">
                <div class="app-field">
                    <label class="app-label" for="newCategoryName">Name</label>
                    <input type="text" id="newCategoryName" class="app-input" placeholder="Entertainment" maxlength="40" autocomplete="off">
                </div>
                <div class="category-preview" id="newCategoryPreview" hidden>
                    <span class="category-preview-chip" id="newCategoryPreviewChip"></span>
                    <div class="category-preview-text">
                        <strong id="newCategoryPreviewName"></strong>
                        <span>Icon and color are chosen automatically</span>
                    </div>
                    <span class="category-preview-swatch" id="newCategoryPreviewSwatch"></span>
                </div>
                <div class="app-field">
                    <label class="app-label" for="newCategoryKeywords">Keywords (optional)</label>
                    <input type="text" id="newCategoryKeywords" class="app-input" placeholder="NETFLIX, SPOTIFY" autocomplete="off">
                    <p class="app-hint">Comma-separated. Matching transactions land here automatically.</p>
                </div>
                <div class="app-modal-actions">
                    <button class="btn btn-secondary" data-close>Cancel</button>
                    <button class="btn btn-primary" data-create>Create Category</button>
                </div>
            </div>
        </div>
    `;

    const nameInput = overlay.querySelector('#newCategoryName');
    const preview = overlay.querySelector('#newCategoryPreview');

    const updatePreview = () => {
        const name = nameInput.value.trim();
        if (!name) {
            preview.hidden = true;
            return;
        }
        preview.hidden = false;
        overlay.querySelector('#newCategoryPreviewChip').innerHTML = getCategoryIconChip(name, {
            size: 40,
            icon: 20,
        });
        overlay.querySelector('#newCategoryPreviewName').textContent = name;
        overlay.querySelector('#newCategoryPreviewSwatch').style.background = getCategoryColorVar(name);
    };
    nameInput.addEventListener('input', updatePreview);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) {
            overlay.remove();
            return;
        }
        if (e.target.closest('[data-create]')) {
            saveNewCategory(overlay);
        }
    });

    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === nameInput) {
            e.preventDefault();
            saveNewCategory(overlay);
        }
        if (e.key === 'Escape') overlay.remove();
    });

    document.body.appendChild(overlay);
    nameInput.focus();
}

function saveNewCategory(overlay) {
    const scope = overlay || document;
    const nameInput = scope.querySelector('#newCategoryName');
    const keywordsInput = scope.querySelector('#newCategoryKeywords');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        showNotification('Enter a category name', 'error');
        return;
    }

    if (categoryConfig[name]) {
        showNotification('Category already exists', 'error');
        return;
    }

    const keywords = (keywordsInput ? keywordsInput.value : '')
        .split(',')
        .map((k) => k.trim().toUpperCase())
        .filter((k) => k.length > 0);

    // Check for keyword conflicts with existing categories
    const conflicts = [];
    keywords.forEach((keyword) => {
        for (const [categoryName, config] of Object.entries(categoryConfig)) {
            if (config.keywords && config.keywords.includes(keyword)) {
                conflicts.push({ keyword: keyword, existingCategory: categoryName });
            }
        }
    });

    if (conflicts.length > 0) {
        showKeywordConflictModal(name, keywords, conflicts, overlay);
        return;
    }

    proceedWithCategoryCreation(name, keywords);
    if (overlay) overlay.remove();
}

function showKeywordConflictModal(newCategoryName, newKeywords, conflicts, parentOverlay) {
    const esc = window.escapeHtml;
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const conflictsList = conflicts
        .map(
            (conflict) => `
        <div class="conflict-row">
            <code class="conflict-keyword">${esc(conflict.keyword)}</code>
            <svg class="conflict-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
            <span class="conflict-category">
                ${getCategoryIconChip(conflict.existingCategory, { size: 24, icon: 13 })}
                ${esc(conflict.existingCategory)}
            </span>
        </div>`
        )
        .join('');

    overlay.innerHTML = `
        <div class="app-modal" role="dialog" aria-modal="true" aria-label="Keyword conflict">
            <div class="app-modal-header">
                <div class="app-modal-title">Keywords Already In Use</div>
                <button class="app-modal-close" data-close aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="app-modal-body">
                <div class="conflict-list">${conflictsList}</div>
                <p class="app-hint">Move them and future matches go to "${esc(newCategoryName)}" instead. Already-categorized transactions stay put.</p>
                <div class="app-modal-actions">
                    <button class="btn btn-secondary" data-close>Cancel</button>
                    <button class="btn btn-warning" data-override>Move Keywords</button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) {
            overlay.remove();
            return;
        }
        if (e.target.closest('[data-override]')) {
            conflicts.forEach((conflict) => {
                const existing = categoryConfig[conflict.existingCategory];
                if (existing && existing.keywords) {
                    existing.keywords = existing.keywords.filter((k) => k !== conflict.keyword);
                }
            });

            proceedWithCategoryCreation(newCategoryName, newKeywords);
            overlay.remove();
            if (parentOverlay) parentOverlay.remove();

            const movedFrom = [...new Set(conflicts.map((c) => c.existingCategory))].join(', ');
            showNotification(
                `Category "${newCategoryName}" created. Keywords moved from ${movedFrom}`,
                'success'
            );
        }
    });

    document.body.appendChild(overlay);
}

function proceedWithCategoryCreation(name, keywords) {
    // Icon and color are derived automatically from the name (icons.js).
    // The icon field stays in the data shape for back-compat but is unused.
    categoryConfig[name] = {
        keywords: keywords,
        icon: '',
    };

    // Count transactions the new keywords will re-categorize
    let reprocessedCount = 0;
    if (keywords.length > 0) {
        monthlyData.forEach((monthData, monthKey) => {
            monthData.transactions.forEach((transaction) => {
                if (
                    window.transactionOverrides &&
                    window.transactionOverrides[monthKey] &&
                    window.transactionOverrides[monthKey][transaction._id]
                ) {
                    return;
                }

                const description = (
                    transaction.Description ||
                    transaction.description ||
                    ''
                ).toUpperCase();

                for (const keyword of keywords) {
                    if (description.includes(keyword)) {
                        const oldCategory = categorizeTransaction(description, transaction._id);
                        if (oldCategory !== name) {
                            reprocessedCount++;
                        }
                        break;
                    }
                }
            });
        });
    }

    saveData();

    if (typeof broadcastSync === 'function') {
        broadcastSync('category_added', { name: name });
    }

    refreshBudgetGrid();
    updateStorageStats();

    let message = `Category "${name}" created`;
    if (reprocessedCount > 0) {
        message += ` (${reprocessedCount} transactions will be re-categorized)`;
    }
    showNotification(message, 'success');
}

// Back-compat alias
function saveCategoryConfig() {
    saveAllCategoryChanges();
}

// ---------------------------------------------------------------------------
// Learned merchant rules (legacy display, kept for pages that include it)
// ---------------------------------------------------------------------------

function updateMerchantRulesDisplay() {
    const container = document.getElementById('merchantRulesList');
    if (!container) return;

    if (!window.merchantRules) {
        window.merchantRules = {};
    }

    const esc = window.escapeHtml;
    const entries = Object.entries(window.merchantRules).sort((a, b) => a[0].localeCompare(b[0]));

    if (entries.length === 0) {
        container.innerHTML =
            '<p class="rules-empty-hint">No learned rules yet. Drag transactions between categories to teach the app.</p>';
        return;
    }

    const rowsHtml = entries
        .map(
            ([merchant, category]) => `
            <div class="merchant-rule-row">
                <div class="merchant-rule-text">
                    <code>${esc(merchant)}</code>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                    <span>${esc(category)}</span>
                </div>
                <button class="btn-icon merchant-rule-remove" data-merchant="${esc(merchant)}" title="Remove rule" aria-label="Remove rule for ${esc(merchant)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>`
        )
        .join('');

    container.innerHTML = `
        <div class="merchant-rules-toolbar">
            <button class="btn btn-secondary btn-sm" data-merchant-clear>Clear All</button>
        </div>
        ${rowsHtml}
    `;

    if (!container.dataset.listenersBound) {
        container.dataset.listenersBound = 'true';
        container.addEventListener('click', (e) => {
            if (e.target.closest('[data-merchant-clear]')) {
                clearAllMerchantRules();
                return;
            }
            const btn = e.target.closest('.merchant-rule-remove');
            if (btn) removeMerchantRule(btn.dataset.merchant);
        });
    }
}

function removeMerchantRule(merchant) {
    if (confirm(`Remove rule for "${merchant}"?`)) {
        delete window.merchantRules[merchant];
        saveData();
        updateMerchantRulesDisplay();

        if (currentMonth && monthlyData.has(currentMonth)) {
            switchToMonth(currentMonth);
        }

        showNotification('Merchant rule removed', 'success');
    }
}

function clearAllMerchantRules() {
    if (!window.merchantRules || Object.keys(window.merchantRules).length === 0) {
        showNotification('No rules to clear', 'error');
        return;
    }

    if (
        confirm(
            `Clear all ${Object.keys(window.merchantRules).length} learned rules? This cannot be undone.`
        )
    ) {
        window.merchantRules = {};
        saveData();
        updateMerchantRulesDisplay();

        if (currentMonth && monthlyData.has(currentMonth)) {
            switchToMonth(currentMonth);
        }

        showNotification('All merchant rules cleared', 'success');
    }
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function clearAllData() {
    if (
        !confirm(
            'This will delete all data including transactions, budgets, and categories. Continue?'
        )
    ) {
        return;
    }

    try {
        // Snapshot for undo before removing anything.
        const snapshot = (typeof snapshotActiveData === 'function') ? snapshotActiveData() : null;

        localStorage.removeItem(getActiveDataKey());
        localStorage.removeItem('sahabBudget_sampleMode');
        localStorage.removeItem('sahabBudget_hideGettingStarted');

        if (typeof monthlyData !== 'undefined' && monthlyData) monthlyData.clear();
        if (typeof budgets !== 'undefined') budgets = {};
        if (typeof window.transactionOverrides !== 'undefined') window.transactionOverrides = {};
        if (typeof window.unifiedRules !== 'undefined') window.unifiedRules = [];

        if (snapshot && typeof showUndoAfterReload === 'function') {
            showUndoAfterReload('All data cleared', snapshot);
        }

        setTimeout(() => { location.reload(); }, 150);
    } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('Error clearing data. Please try again.', 'error');
    }
}

function clearAllTransactions() {
    if (
        !confirm(
            'This will delete all transactions but keep your categories, budgets, and rules. Continue?'
        )
    ) {
        return;
    }

    try {
        const snapshot = (typeof snapshotActiveData === 'function') ? snapshotActiveData() : null;

        if (typeof monthlyData !== 'undefined' && monthlyData) monthlyData.clear();
        if (typeof window.transactionOverrides !== 'undefined') window.transactionOverrides = {};

        saveData();

        if (snapshot && typeof showUndoAfterReload === 'function') {
            showUndoAfterReload('All transactions cleared', snapshot);
        }

        setTimeout(() => { location.reload(); }, 150);
    } catch (error) {
        console.error('Error clearing transactions:', error);
        showNotification('Error clearing transactions. Please try again.', 'error');
    }
}

// ---------------------------------------------------------------------------
// Unsaved changes indicator
// ---------------------------------------------------------------------------

function markUnsavedChanges() {
    const notice = document.getElementById('unsavedNotice');
    const saveBtn = document.getElementById('saveChangesBtn');

    if (notice) {
        notice.style.display = 'flex';
    }

    if (saveBtn) {
        saveBtn.classList.add('pulse');
        const saveText = document.getElementById('saveChangesText');
        if (saveText) {
            saveText.textContent = 'Save Changes*';
        }
    }
}

function clearUnsavedChanges() {
    const notice = document.getElementById('unsavedNotice');
    const saveBtn = document.getElementById('saveChangesBtn');

    if (notice) {
        notice.style.display = 'none';
    }

    if (saveBtn) {
        saveBtn.classList.remove('pulse');
        const saveText = document.getElementById('saveChangesText');
        if (saveText) {
            saveText.textContent = 'Save Changes';
        }
    }
}

// Show notification function (if not already defined elsewhere)
if (typeof showNotification === 'undefined') {
    window.showNotification = function (message, type = 'success') {
        const existing = document.querySelectorAll('.notification');
        existing.forEach((n) => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    };
}
