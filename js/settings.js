// js/settings.js - Settings View Functions

// Initialize settings page
window.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSavedData === 'function') {
        loadSavedData();
    }
    updateSettingsMonthSelector();
    updateStorageStats();

    if (monthlyData.size > 0) {
        const months = Array.from(monthlyData.keys()).sort().reverse();
        if (months.length > 0) {
            document.getElementById('settingsMonthDropdown').value = 'ALL_MONTHS';
            switchSettingsMonth('ALL_MONTHS');
        }
    } else {
        // No data uploaded yet, but still show categories
        currentMonth = 'NO_DATA';
        updateBudgetView(null);
    }
});

// Switch settings tab
function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.settings-content').forEach((c) => c.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');

    if (tab === 'rules') {
        // Load and display unified rules
        if (typeof loadRules === 'function') {
            loadRules();
        }
        if (typeof updateRulesDisplay === 'function') {
            updateRulesDisplay();
        }
    } else if (tab === 'data') {
        updateStorageStats();
    }
}

// Update storage stats
function updateStorageStats() {
    let transactionCount = 0;
    let monthCount = monthlyData.size;
    let categoryCount = Object.keys(categoryConfig).length;
    let rulesCount = 0;

    // Count unified rules if available
    if (window.unifiedRules && Array.isArray(window.unifiedRules)) {
        rulesCount = window.unifiedRules.length;
    }

    monthlyData.forEach((data) => {
        transactionCount += data.transactions.length;
    });

    const storageSize = new Blob([JSON.stringify(localStorage.getItem('sahabBudget_data'))]).size;
    const storageMB = (storageSize / (1024 * 1024)).toFixed(2);

    document.getElementById('storageStats').innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${transactionCount.toLocaleString()}</div>
                <div class="stat-label">Total Transactions</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${monthCount}</div>
                <div class="stat-label">Months of Data</div>
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

// Update month selector for settings
function updateSettingsMonthSelector() {
    const dropdown = document.getElementById('settingsMonthDropdown');
    dropdown.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'ALL_MONTHS';
    allOption.textContent = 'All Months (View/Edit)';
    dropdown.appendChild(allOption);

    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    dropdown.appendChild(separator);

    const months = Array.from(monthlyData.keys()).sort().reverse();
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthData.monthName;
        dropdown.appendChild(option);
    });
}

// Switch settings month
function switchSettingsMonth(monthKey) {
    if (monthKey === 'ALL_MONTHS') {
        // Handle all months view
        currentMonth = 'ALL_MONTHS';
        updateBudgetViewForAllMonths();
        return;
    }

    currentMonth = monthKey;

    // Check if month exists
    if (monthlyData.has(monthKey)) {
        const monthData = monthlyData.get(monthKey);
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
    } else {
        updateBudgetView(null);
    }
}

function updateBudgetViewForAllMonths() {
    const container = document.getElementById('budgetGrid');
    if (!container) return;

    // Calculate budgets across all months
    const budgetSummary = {};
    const monthsList = Array.from(monthlyData.keys()).sort();

    // Gather budget info for each category across all months
    Object.keys(categoryConfig).forEach((category) => {
        budgetSummary[category] = {
            budgets: {},
            hasAnyBudget: false,
            isConsistent: true,
            firstValue: null,
        };
    });

    // Check each month's budgets
    monthsList.forEach((monthKey) => {
        const monthBudgets = budgets[monthKey] || {};

        Object.keys(categoryConfig).forEach((category) => {
            const budget = monthBudgets[category] || 0;
            budgetSummary[category].budgets[monthKey] = budget;

            if (budget > 0) {
                budgetSummary[category].hasAnyBudget = true;

                if (budgetSummary[category].firstValue === null) {
                    budgetSummary[category].firstValue = budget;
                } else if (budgetSummary[category].firstValue !== budget) {
                    budgetSummary[category].isConsistent = false;
                }
            }
        });
    });

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const categoriesHTML = allCategories
        .map((category) => {
            const config = categoryConfig[category] || { icon: '📦', keywords: [] };
            const categoryId = category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            const summary = budgetSummary[category];

            // Determine what to show for budget
            let budgetStatusClass = 'no-budget';
            let budgetStatusText = 'No monthly limit set';
            let currentBudgetValue = '';

            if (summary.hasAnyBudget) {
                if (summary.isConsistent) {
                    budgetStatusClass = 'has-budget';
                    budgetStatusText = `$${summary.firstValue.toFixed(0)}/month`;
                    currentBudgetValue = summary.firstValue;
                } else {
                    budgetStatusClass = 'varies';
                    const validBudgets = Object.values(summary.budgets).filter((b) => b > 0);
                    const average = validBudgets.reduce((a, b) => a + b, 0) / validBudgets.length;
                    budgetStatusText = `Varies by month (avg: $${average.toFixed(0)})`;
                }
            }

            const keywordsCount = config.keywords.length;
            const keywordsPreview = keywordsCount > 0
                ? config.keywords.slice(0, 3).join(', ') + (keywordsCount > 3 ? ` +${keywordsCount - 3} more` : '')
                : 'No keywords set';

            return `
                <div class="category-card" data-category="${category}">
                    <div class="category-card-header">
                        <div class="category-identity">
                            <input type="text"
                                   class="category-icon-input"
                                   id="icon-${categoryId}"
                                   value="${config.icon}"
                                   maxlength="2"
                                   onchange="markUnsavedChanges()"
                                   title="Change icon">
                            <div class="category-name-wrapper">
                                <input type="text"
                                       class="category-name-input"
                                       id="name-${categoryId}"
                                       value="${category}"
                                       ${category === 'Others' ? 'readonly title="Default category cannot be renamed"' : 'title="Click to rename"'}
                                       onchange="renameCategory('${category}', this.value); markUnsavedChanges()">
                                ${category === 'Others' ? '<span class="default-badge">Default</span>' : ''}
                            </div>
                        </div>
                        ${category !== 'Others' ? `
                            <button class="category-delete-btn" onclick="removeCategory('${category}')" title="Delete category">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>

                    <div class="category-card-body">
                        <div class="category-field">
                            <label class="field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                                Monthly Budget
                            </label>
                            <div class="budget-input-group">
                                <span class="currency-prefix">$</span>
                                <input type="number"
                                       id="budget-${categoryId}"
                                       placeholder="${currentBudgetValue || '0.00'}"
                                       value=""
                                       step="1"
                                       min="0"
                                       class="budget-amount-input">
                                <button class="apply-budget-btn" onclick="setBudgetForAllMonths('${category}')" title="Apply this budget to all months">
                                    Apply to All Months
                                </button>
                            </div>
                            <div class="budget-status ${budgetStatusClass}">
                                <span class="status-indicator"></span>
                                ${budgetStatusText}
                            </div>
                        </div>

                        <div class="category-field">
                            <label class="field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                Auto-Match Keywords
                                <span class="keyword-count">${keywordsCount} keyword${keywordsCount !== 1 ? 's' : ''}</span>
                            </label>
                            <input type="text"
                                   class="keywords-input"
                                   id="keywords-${categoryId}"
                                   value="${config.keywords.join(', ')}"
                                   placeholder="e.g., AMAZON, WALMART, COSTCO"
                                   onchange="markUnsavedChanges()"
                                   onfocus="this.select()">
                            <span class="field-hint">Transactions containing these keywords will auto-categorize here</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="categories-header">
            <div class="categories-header-content">
                <h2>Manage Your Categories</h2>
                <p>Organize transactions and set monthly spending limits for each category</p>
            </div>
            <div class="categories-header-actions">
                <button class="btn-add-category" onclick="addNewCategory()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Category
                </button>
                <button class="btn-save-changes" id="saveChangesBtn" onclick="saveAllCategoryChanges()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span id="saveChangesText">Save Changes</span>
                </button>
            </div>
        </div>
        <div id="unsavedNotice" class="unsaved-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            You have unsaved changes. Click "Save Changes" to apply updates.
        </div>
        <div class="categories-grid">
            ${categoriesHTML}
        </div>
    `;
}

function setBudgetForAllMonths(category) {
    const inputId = `budget-${category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const value = parseFloat(input.value);

    if (isNaN(value) || value < 0) {
        showNotification('Please enter a valid budget amount', 'error');
        return;
    }

    // Apply to all months directly
    applyBudgetToAllMonthsForCategory(category, value);

    // Refresh the view
    updateBudgetViewForAllMonths();
}

// Export all data as CSV
function exportAllToCSV() {
    let csvContent = 'Date,Description,Amount,Category,Month\n';

    monthlyData.forEach((monthData, monthKey) => {
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

// Update budget view in settings
function updateBudgetView(analyzer) {
    const container = document.getElementById('budgetGrid');
    if (!container) return;

    const monthKey = currentMonth;

    if (!budgets[monthKey]) {
        budgets[monthKey] = {};
    }

    // Create empty analyzer if none provided (no data uploaded yet)
    if (!analyzer) {
        analyzer = {
            categoryTotals: {},
            categoryDetails: {},
            totalExpenses: 0,
            transactionCount: 0,
        };
    }

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const categoriesHTML = allCategories
        .map((category) => {
            const budget = budgets[monthKey][category] || 0;
            const config = categoryConfig[category] || { icon: '📦', keywords: [] };
            const categoryId = category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

            // Budget status
            let budgetStatusClass = budget > 0 ? 'has-budget' : 'no-budget';
            let budgetStatusText = budget > 0 ? `$${budget.toFixed(0)}/month` : 'No monthly limit set';

            const keywordsCount = config.keywords.length;

            return `
                <div class="category-card" data-category="${category}">
                    <div class="category-card-header">
                        <div class="category-identity">
                            <input type="text"
                                   class="category-icon-input"
                                   id="icon-${categoryId}"
                                   value="${config.icon}"
                                   maxlength="2"
                                   onchange="markUnsavedChanges()"
                                   title="Change icon">
                            <div class="category-name-wrapper">
                                <input type="text"
                                       class="category-name-input"
                                       id="name-${categoryId}"
                                       value="${category}"
                                       ${category === 'Others' ? 'readonly title="Default category cannot be renamed"' : 'title="Click to rename"'}
                                       onchange="renameCategory('${category}', this.value); markUnsavedChanges()">
                                ${category === 'Others' ? '<span class="default-badge">Default</span>' : ''}
                            </div>
                        </div>
                        ${category !== 'Others' ? `
                            <button class="category-delete-btn" onclick="removeCategory('${category}')" title="Delete category">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>

                    <div class="category-card-body">
                        <div class="category-field">
                            <label class="field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                                Monthly Budget
                            </label>
                            <div class="budget-input-group">
                                <span class="currency-prefix">$</span>
                                <input type="number"
                                       id="budget-${categoryId}"
                                       placeholder="${budget || '0.00'}"
                                       value="${budget || ''}"
                                       step="1"
                                       min="0"
                                       class="budget-amount-input">
                                <button class="apply-budget-btn" onclick="setBudgetWithOptions('${category}')" title="Set budget for this month or all months">
                                    Set Budget
                                </button>
                            </div>
                            <div class="budget-status ${budgetStatusClass}">
                                <span class="status-indicator"></span>
                                ${budgetStatusText}
                            </div>
                        </div>

                        <div class="category-field">
                            <label class="field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                Auto-Match Keywords
                                <span class="keyword-count">${keywordsCount} keyword${keywordsCount !== 1 ? 's' : ''}</span>
                            </label>
                            <input type="text"
                                   class="keywords-input"
                                   id="keywords-${categoryId}"
                                   value="${config.keywords.join(', ')}"
                                   placeholder="e.g., AMAZON, WALMART, COSTCO"
                                   onchange="markUnsavedChanges()"
                                   onfocus="this.select()">
                            <span class="field-hint">Transactions containing these keywords will auto-categorize here</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="categories-header">
            <div class="categories-header-content">
                <h2>Manage Your Categories</h2>
                <p>Organize transactions and set monthly spending limits for each category</p>
            </div>
            <div class="categories-header-actions">
                <button class="btn-add-category" onclick="addNewCategory()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Category
                </button>
                <button class="btn-save-changes" id="saveChangesBtn" onclick="saveAllCategoryChanges()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span id="saveChangesText">Save Changes</span>
                </button>
            </div>
        </div>
        <div id="unsavedNotice" class="unsaved-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            You have unsaved changes. Click "Save Changes" to apply updates.
        </div>
        <div class="categories-grid">
            ${categoriesHTML}
        </div>
    `;
}

// Set budget with options (single month or all months)
function setBudgetWithOptions(category) {
    const inputId = `budget-${category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const value = parseFloat(input.value);

    if (isNaN(value) || value < 0) {
        showNotification('Please enter a valid budget amount', 'error');
        return;
    }
    const currentMonthName = monthlyData.get(currentMonth).monthName;

    if (currentMonthName === 'ALL_MONTHS') {
        // When viewing all months, default action is to apply to all
        applyBudgetToAllMonthsForCategory(category, value);
        return;
    }

    // Get all months sorted
    const months = Array.from(monthlyData.keys()).sort().reverse();

    // Create month options
    const monthOptions = months
        .map((monthKey) => {
            const monthName = monthlyData.get(monthKey).monthName;
            const isCurrentMonth = monthKey === currentMonth;
            return `
            <button class="btn ${isCurrentMonth ? 'btn-primary' : 'btn-secondary'}" 
                    style="width: 100%; text-align: left; margin-bottom: 8px;" 
                    onclick="applyBudgetToMonth('${category}', ${value}, '${monthKey}'); this.closest('.modal').remove();">
                ${monthName} ${isCurrentMonth ? '(Current)' : ''}
            </button>
        `;
        })
        .join('');

    // Ask user if they want to apply to all months or specific month
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="width: 450px;">
            <div class="modal-header">
                <h2>Set Budget for ${category}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px;">Budget amount: <strong>$${value.toFixed(
                    2
                )}</strong></p>
                <p style="margin-bottom: 20px; font-weight: 600;">Apply to which month(s)?</p>
                
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 15px; font-weight: 600;" 
                            onclick="applyBudgetToAllMonthsForCategory('${category}', ${value}); this.closest('.modal').remove();">
                        🌐 Apply to ALL Months
                    </button>
                </div>
                
                <div style="border-top: 1px solid var(--border); padding-top: 15px; margin-bottom: 10px;">
                    <p style="margin-bottom: 10px; font-size: 14px; color: var(--gray);">Or choose a specific month:</p>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${monthOptions}
                    </div>
                </div>
                
                <div style="border-top: 1px solid var(--border); padding-top: 15px;">
                    <button class="btn btn-secondary" style="width: 100%;" onclick="this.closest('.modal').remove();">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Apply budget to a single month
function applyBudgetToMonth(category, value, monthKey) {
    if (!budgets[monthKey]) {
        budgets[monthKey] = {};
    }

    if (value === 0 || value === '') {
        delete budgets[monthKey][category];
        showNotification(
            `Budget removed for ${category} in ${monthlyData.get(monthKey).monthName}`,
            'success'
        );
    } else {
        budgets[monthKey][category] = value;
        showNotification(
            `Budget set for ${category} in ${monthlyData.get(monthKey).monthName}`,
            'success'
        );
    }

    saveData();

    // Refresh the view
    const monthData = monthlyData.get(currentMonth);
    if (monthData) {
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
    }
}

// Apply budget to all months for a specific category
function applyBudgetToAllMonthsForCategory(category, value) {
    const months = Array.from(monthlyData.keys());

    months.forEach((monthKey) => {
        if (!budgets[monthKey]) {
            budgets[monthKey] = {};
        }

        if (value === 0 || value === '') {
            delete budgets[monthKey][category];
        } else {
            budgets[monthKey][category] = value;
        }
    });

    saveData();

    showNotification(
        value > 0
            ? `Budget of $${value.toFixed(2)} set for ${category} in all months`
            : `Budget removed for ${category} in all months`,
        'success'
    );

    // Refresh the view
    const monthData = monthlyData.get(currentMonth);
    if (monthData) {
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
    }
}

// Apply current month's budget to all months
function applyBudgetToAllMonths() {
    const currentBudgets = budgets[currentMonth] || {};

    if (Object.keys(currentBudgets).length === 0) {
        showNotification('No budgets set for current month', 'error');
        return;
    }

    if (
        !confirm(
            `Apply all budget goals from ${
                monthlyData.get(currentMonth).monthName
            } to all other months?`
        )
    ) {
        return;
    }

    const months = Array.from(monthlyData.keys());

    months.forEach((monthKey) => {
        if (monthKey !== currentMonth) {
            budgets[monthKey] = { ...currentBudgets };
        }
    });

    saveData();
    showNotification('Budget goals applied to all months', 'success');
}

// Set budget
function setBudget(category) {
    setBudgetWithOptions(category);
}

// Update categories view in settings
function updateCategoriesView() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    // Sort categories alphabetically, but keep "Others" at the end
    const sortedCategories = Object.entries(categoryConfig).sort((a, b) => {
        if (a[0] === 'Others') return 1;
        if (b[0] === 'Others') return -1;
        return a[0].localeCompare(b[0]);
    });

    const html = sortedCategories
        .map(([name, config]) => {
            const nameId = name.replace(/\s+/g, '-');

            return `
                <div class="category-list-item">
                    <div class="category-list-header">
                        <div class="category-list-info">
                            <input type="text" id="icon-${nameId}" value="${
                config.icon
            }" style="width: 40px;" />
                            <h4>${name}</h4>
                        </div>
                        ${
                            name !== 'Others'
                                ? `<button class="btn btn-danger" onclick="removeCategory('${name}')">Remove</button>`
                                : ''
                        }
                    </div>
                    <div class="category-keywords">
                        <label>Keywords:</label>
                        <input type="text" id="keywords-${nameId}" value="${config.keywords.join(
                ', '
            )}" style="width: 100%;" />
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = html;
}

// Update category icon
function updateCategoryIcon(category, newIcon) {
    if (!newIcon || newIcon.trim() === '') {
        newIcon = '📦';
    }
    categoryConfig[category].icon = newIcon.trim();
    // Don't save immediately, wait for "Save All Changes"
}

// Update category keywords
function updateCategoryKeywords(category, keywordsString) {
    const keywords = keywordsString
        .split(',')
        .map((k) => k.trim().toUpperCase())
        .filter((k) => k.length > 0);

    categoryConfig[category].keywords = keywords;
    // Don't save immediately, wait for "Save All Changes"
}

// Rename category
function renameCategory(oldName, newName) {
    newName = newName.trim();

    if (!newName || newName === oldName) return;

    if (categoryConfig[newName]) {
        showNotification('Category name already exists', 'error');
        // Reset the input
        const categoryId = oldName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        document.getElementById(`name-${categoryId}`).value = oldName;
        return;
    }

    // Move the category configuration
    categoryConfig[newName] = categoryConfig[oldName];
    delete categoryConfig[oldName];

    // Update budgets
    Object.keys(budgets).forEach((monthKey) => {
        if (budgets[monthKey][oldName] !== undefined) {
            budgets[monthKey][newName] = budgets[monthKey][oldName];
            delete budgets[monthKey][oldName];
        }
    });

    // Update transaction overrides
    if (window.transactionOverrides) {
        Object.keys(window.transactionOverrides).forEach((monthKey) => {
            Object.keys(window.transactionOverrides[monthKey]).forEach((transId) => {
                if (window.transactionOverrides[monthKey][transId] === oldName) {
                    window.transactionOverrides[monthKey][transId] = newName;
                }
            });
        });
    }

    // Update merchant rules
    if (window.merchantRules) {
        Object.keys(window.merchantRules).forEach((merchant) => {
            if (window.merchantRules[merchant] === oldName) {
                window.merchantRules[merchant] = newName;
            }
        });
    }
}

// Save all category changes
function saveAllCategoryChanges() {
    // Collect all changes from the UI
    const allCategories = Object.keys(categoryConfig);
    let hasChanges = false;
    let keywordChanges = false;

    allCategories.forEach((category) => {
        const categoryId = category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

        // Update icon
        const iconInput = document.getElementById(`icon-${categoryId}`);
        if (iconInput && iconInput.value !== categoryConfig[category].icon) {
            categoryConfig[category].icon = iconInput.value || '📦';
            hasChanges = true;
        }

        // Update keywords
        const keywordsInput = document.getElementById(`keywords-${categoryId}`);
        if (keywordsInput) {
            const newKeywords = keywordsInput.value
                .split(',')
                .map((k) => k.trim().toUpperCase())
                .filter((k) => k.length > 0);

            if (JSON.stringify(newKeywords) !== JSON.stringify(categoryConfig[category].keywords)) {
                categoryConfig[category].keywords = newKeywords;
                hasChanges = true;
                keywordChanges = true;
            }
        }
    });

    if (hasChanges) {
        saveData();

        // Refresh current view immediately
        if (currentMonth && monthlyData.has(currentMonth)) {
            const monthData = monthlyData.get(currentMonth);
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }

        // Update merchant rules display if on that tab
        const rulesTab = document.getElementById('rulesTab');
        if (rulesTab && rulesTab.classList.contains('active')) {
            updateMerchantRulesDisplay();
        }

        let message = 'All changes saved successfully';
        showNotification(message, 'success');
    } else {
        showNotification('No changes to save', 'info');
    }
}

// Add new category with keywords
function addNewCategory() {
    const iconOptions = [
        '📦',
        '🛒',
        '🍕',
        '☕',
        '🚗',
        '⛽',
        '🏠',
        '💡',
        '📱',
        '💻',
        '👕',
        '👟',
        '🎬',
        '🎮',
        '📚',
        '✈️',
        '🏥',
        '💊',
        '🎓',
        '🏦',
        '💳',
        '🎁',
        '🔧',
        '🏪',
        '🍔',
        '🥗',
        '🍺',
        '🎵',
        '📺',
        '🏋️',
        '💄',
        '🧴',
        '🐕',
        '🌱',
        '🎨',
        '⚽',
        '🏖️',
        '🚕',
        '🚇',
        '🅿️',
        '✂️',
        '👔',
        '💍',
        '🏨',
        '🎭',
        '🎪',
        '🏛️',
        '⛪',
        '🕹️',
        '📷',
    ];

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>Add New Category</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Category Name:</label>
                    <input type="text" id="newCategoryName" 
                           style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px;"
                           placeholder="e.g., Entertainment">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Choose Icon:</label>
                    <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; padding: 10px; background: var(--light); border-radius: 4px; max-height: 200px; overflow-y: auto;">
                        ${iconOptions
                            .map(
                                (icon, index) => `
                            <button type="button" 
                                    class="icon-option ${index === 0 ? 'selected' : ''}" 
                                    onclick="selectCategoryIcon(this, '${icon}')"
                                    style="padding: 10px; border: 2px solid ${
                                        index === 0 ? 'var(--primary)' : 'transparent'
                                    }; 
                                           background: white; border-radius: 4px; cursor: pointer; font-size: 20px;
                                           transition: all 0.2s;">
                                ${icon}
                            </button>
                        `
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="selectedIcon" value="${iconOptions[0]}">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Keywords (comma-separated):</label>
                    <input type="text" id="newCategoryKeywords" 
                           style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px;"
                           placeholder="e.g., NETFLIX, SPOTIFY, CINEMA">
                    <small style="color: var(--gray); font-size: 12px;">Keywords will auto-categorize matching transactions</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveNewCategory()">Create Category</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('newCategoryName').focus();
}

function selectCategoryIcon(button, icon) {
    // Remove selected class from all icons
    document.querySelectorAll('.icon-option').forEach((btn) => {
        btn.style.border = '2px solid transparent';
        btn.classList.remove('selected');
    });

    // Add selected class to clicked icon
    button.style.border = '2px solid var(--primary)';
    button.classList.add('selected');
    document.getElementById('selectedIcon').value = icon;
}

function saveNewCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const icon = document.getElementById('selectedIcon').value;
    const keywordsInput = document.getElementById('newCategoryKeywords').value;

    if (!name) {
        showNotification('Please enter a category name', 'error');
        return;
    }

    if (categoryConfig[name]) {
        showNotification('Category already exists', 'error');
        return;
    }

    const keywords = keywordsInput
        .split(',')
        .map((k) => k.trim().toUpperCase())
        .filter((k) => k.length > 0);

    // Check for keyword conflicts
    const conflicts = [];
    keywords.forEach((keyword) => {
        for (const [categoryName, config] of Object.entries(categoryConfig)) {
            if (config.keywords && config.keywords.includes(keyword)) {
                conflicts.push({
                    keyword: keyword,
                    existingCategory: categoryName,
                    icon: config.icon,
                });
            }
        }
    });

    // If there are conflicts, show confirmation modal
    if (conflicts.length > 0) {
        showKeywordConflictModal(name, icon, keywords, conflicts);
        return;
    }

    // No conflicts, proceed with creation
    proceedWithCategoryCreation(name, icon, keywords);
}

function showKeywordConflictModal(newCategoryName, newIcon, newKeywords, conflicts) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '2000'; // Higher z-index for nested modal

    const conflictsList = conflicts
        .map(
            (conflict) => `
        <div style="padding: 10px; background: var(--light); margin: 8px 0; border-radius: 4px; border-left: 3px solid var(--warning);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--dark);">"${conflict.keyword}"</strong>
                    <span style="color: var(--gray); margin: 0 8px;">is currently in</span>
                    <span style="background: white; padding: 3px 8px; border-radius: 3px; border: 1px solid var(--border);">
                        ${conflict.icon} ${conflict.existingCategory}
                    </span>
                </div>
            </div>
        </div>
    `
        )
        .join('');

    const conflictsJson = JSON.stringify(conflicts).replace(/"/g, '&quot;');

    modal.innerHTML = `
        <div class="modal-content" style="width: 550px;">
            <div class="modal-header" style="background: #fef3c7; border-bottom: 2px solid #fbbf24;">
                <h2 style="color: #92400e;">⚠️ Keyword Conflict Detected</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <p style="font-size: 14px; color: var(--dark); margin-bottom: 15px;">
                        The following keyword${
                            conflicts.length > 1 ? 's are' : ' is'
                        } already assigned to other categories:
                    </p>
                    ${conflictsList}
                </div>
                
                <div style="background: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                    <p style="color: #075985; font-size: 13px; margin: 0;">
                        <strong>What will happen if you proceed:</strong><br>
                        • The keyword${
                            conflicts.length > 1 ? 's' : ''
                        } will be <strong>moved</strong> to the new category "${newCategoryName}"<br>
                        • Future transactions matching ${
                            conflicts.length > 1 ? 'these keywords' : 'this keyword'
                        } will be categorized as "${newCategoryName}"<br>
                        • Existing categorized transactions will NOT be affected unless you reprocess them
                    </p>
                </div>
                
                <div style="padding: 15px; background: var(--light); border-radius: 6px;">
                    <p style="font-size: 13px; color: var(--gray); margin: 0;">
                        <strong>Tip:</strong> If you want to keep the keyword in both categories, consider using more specific keywords. 
                        For example, instead of "AMAZON", use "AMAZON PRIME" for subscriptions and "AMAZON.COM" for shopping.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button 
                    class="btn btn-warning"
                    data-category="${newCategoryName}"
                    data-icon="${newIcon}"
                    data-keywords="${newKeywords.join(',')}"
                    data-conflicts='${conflictsJson}'
                    onclick="handleConflictOverrideClick(this)"
                    style="background: #f59e0b; border-color: #f59e0b;">
                    Override & Move Keywords
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 🔹 new safe handler
function handleConflictOverrideClick(btn) {
    const category = btn.dataset.category;
    const icon = btn.dataset.icon;
    const keywords = btn.dataset.keywords;
    const conflictsJson = btn.dataset.conflicts;

    proceedWithConflictOverride(category, icon, keywords, conflictsJson);
    btn.closest('.modal').remove();
}

function proceedWithConflictOverride(categoryName, icon, keywordsString, conflictsJson) {
    const keywords = keywordsString.split(',');
    const conflicts = JSON.parse(conflictsJson.replace(/\\'/g, "'"));

    // Remove conflicting keywords from their current categories
    conflicts.forEach((conflict) => {
        const existingCategory = categoryConfig[conflict.existingCategory];
        if (existingCategory && existingCategory.keywords) {
            existingCategory.keywords = existingCategory.keywords.filter(
                (k) => k !== conflict.keyword
            );
        }
    });

    // Close the original add category modal if it exists
    const originalModal = document.querySelector('.modal:not([style*="z-index"])');
    if (originalModal) {
        originalModal.remove();
    }

    // Proceed with creation
    proceedWithCategoryCreation(categoryName, icon, keywords);

    // Show confirmation with details about what was moved
    const movedFrom = [...new Set(conflicts.map((c) => c.existingCategory))].join(', ');
    showNotification(
        `Category "${categoryName}" created. Keywords moved from: ${movedFrom}`,
        'success'
    );
}

function proceedWithCategoryCreation(name, icon, keywords) {
    // Add the new category
    categoryConfig[name] = {
        keywords: keywords,
        icon: icon,
    };

    // Reprocess all transactions if keywords were provided
    let reprocessedCount = 0;
    if (keywords.length > 0) {
        monthlyData.forEach((monthData, monthKey) => {
            monthData.transactions.forEach((transaction) => {
                // Skip if there's already an override for this transaction
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

                // Check if any of the new keywords match
                for (const keyword of keywords) {
                    if (description.includes(keyword)) {
                        // This transaction should be in the new category
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

    // Refresh the budget view
    if (currentMonth && monthlyData.has(currentMonth)) {
        const monthData = monthlyData.get(currentMonth);
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
    }

    // Close modal
    const modal = document.querySelector('.modal:not([style*="z-index"])');
    if (modal) {
        modal.remove();
    }

    // Show success message
    let message = `Category "${name}" created successfully`;
    if (reprocessedCount > 0) {
        message += ` (${reprocessedCount} transactions will be re-categorized)`;
    }
    showNotification(message, 'success');
}

// Remove category
function removeCategory(name) {
    if (!confirm(`Remove category "${name}"? Transactions will be moved to "Others".`)) return;

    delete categoryConfig[name];
    saveData();

    // Refresh views
    if (currentMonth) {
        switchToMonth(currentMonth);
        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }
    }

    updateCategoriesView();
    updateSettingsView();

    showNotification(`Category "${name}" removed`, 'success');
}

// Update settings view
function updateSettingsView() {
    const container = document.getElementById('categoryConfig');
    if (!container) return;

    const html = Object.entries(categoryConfig)
        .map(
            ([name, config]) => `
        <div class="config-item">
            <h4>${name}</h4>
            <div class="config-inputs">
                <input type="text" 
                       id="icon-${name.replace(/\s+/g, '-')}" 
                       value="${config.icon}" 
                       placeholder="Icon">
                <input type="text" 
                       id="keywords-${name.replace(/\s+/g, '-')}" 
                       value="${config.keywords.join(', ')}" 
                       placeholder="Keywords (comma-separated)">
            </div>
        </div>
    `
        )
        .join('');

    container.innerHTML = html;

    // ADD THIS: Update merchant rules display
    updateMerchantRulesDisplay();
}

// Save category configuration
function saveCategoryConfig() {
    saveAllCategoryChanges();
}

// Show merchant rules in settings (optional - call this from settings view)
function showMerchantRules() {
    if (!window.merchantRules || Object.keys(window.merchantRules).length === 0) {
        return '<p style="color: var(--gray); font-size: 13px;">No learned merchant rules yet. Drag transactions to different categories to teach the app.</p>';
    }

    const rulesHtml = Object.entries(window.merchantRules)
        .map(
            ([merchant, category]) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--light); margin: 5px 0; border-radius: 4px;">
                <span style="font-size: 13px;">
                    <strong>${merchant}</strong> → ${category}
                </span>
                <button class="btn-icon" onclick="removeMerchantRule('${merchant}')">×</button>
            </div>
        `
        )
        .join('');

    return `
        <div>
            <h4 style="font-size: 14px; margin-bottom: 10px;">Learned Merchant Rules:</h4>
            ${rulesHtml}
        </div>
    `;
}

// Update merchant rules display
function updateMerchantRulesDisplay() {
    const container = document.getElementById('merchantRulesList');
    if (!container) return;

    // Ensure merchantRules exists
    if (!window.merchantRules) {
        window.merchantRules = {};
    }

    if (Object.keys(window.merchantRules).length === 0) {
        container.innerHTML =
            '<p style="color: var(--gray); font-size: 13px;">No learned rules yet. Drag transactions to different categories and the app will learn patterns.</p>';
        return;
    }

    const rulesHtml = Object.entries(window.merchantRules)
        .sort((a, b) => a[0].localeCompare(b[0])) // Sort alphabetically
        .map(([merchant, category]) => {
            const icon = categoryConfig[category]?.icon || '📦';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--light); margin: 8px 0; border-radius: 4px; border: 1px solid var(--border);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 13px; color: var(--gray);">If contains:</span>
                        <strong style="font-size: 13px; color: var(--dark);">"${merchant}"</strong>
                        <span style="font-size: 13px; color: var(--gray);">→</span>
                        <span style="font-size: 13px; background: var(--white); padding: 3px 8px; border-radius: 3px; border: 1px solid var(--border);">
                            ${icon} ${category}
                        </span>
                    </div>
                    <button class="btn-icon" onclick="removeMerchantRule('${merchant.replace(
                        /'/g,
                        "\\'"
                    )}')" title="Remove rule">×</button>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div style="margin-bottom: 10px;">
            <button class="btn btn-secondary" onclick="clearAllMerchantRules()">Clear All Rules</button>
        </div>
        ${rulesHtml}
    `;
}

// Remove a merchant rule
function removeMerchantRule(merchant) {
    if (confirm(`Remove rule for "${merchant}"?`)) {
        delete window.merchantRules[merchant];
        saveData();
        updateMerchantRulesDisplay();

        // Refresh current view if needed
        if (currentMonth) {
            switchToMonth(currentMonth);
        }

        showNotification('Merchant rule removed', 'success');
    }
}

// Clear all merchant rules
function clearAllMerchantRules() {
    if (!window.merchantRules || Object.keys(window.merchantRules).length === 0) {
        showNotification('No rules to clear', 'error');
        return;
    }

    if (
        confirm(
            `Clear all ${
                Object.keys(window.merchantRules).length
            } learned rules? This cannot be undone.`
        )
    ) {
        window.merchantRules = {};
        saveData();
        updateMerchantRulesDisplay();

        // Refresh current view
        if (currentMonth) {
            switchToMonth(currentMonth);
        }

        showNotification('All merchant rules cleared', 'success');
    }
}

// Clear all data
function clearAllData() {
    if (
        !confirm(
            'This will delete all data including transactions, budgets, and categories. Continue?'
        )
    ) {
        return;
    }

    if (confirm('Are you absolutely sure? This cannot be undone.')) {
        try {
            // Clear localStorage
            localStorage.removeItem('sahabBudget_data');
            localStorage.removeItem('sahabBudget_sampleMode');
            localStorage.removeItem('sahabBudget_hideGettingStarted');

            // Clear in-memory data
            if (typeof monthlyData !== 'undefined' && monthlyData) {
                monthlyData.clear();
            }
            if (typeof budgets !== 'undefined') {
                budgets = {};
            }
            if (typeof window.transactionOverrides !== 'undefined') {
                window.transactionOverrides = {};
            }
            if (typeof window.unifiedRules !== 'undefined') {
                window.unifiedRules = [];
            }

            // Remove widget if exists
            const widget = document.getElementById('quickStatsWidget');
            if (widget) {
                widget.remove();
            }

            // Show notification before reload
            showNotification('All data cleared. Reloading...', 'success');

            // Reload after short delay
            setTimeout(() => {
                location.reload();
            }, 500);
        } catch (error) {
            console.error('Error clearing data:', error);
            showNotification('Error clearing data. Please try again.', 'error');
        }
    }
}

// Clear all transactions only
function clearAllTransactions() {
    if (
        !confirm(
            'This will delete all transactions but keep your categories, budgets, and rules. Continue?'
        )
    ) {
        return;
    }

    if (confirm('Are you absolutely sure? This cannot be undone.')) {
        try {
            // Clear only transactions
            if (typeof monthlyData !== 'undefined' && monthlyData) {
                monthlyData.clear();
            }

            // Clear transaction overrides since transactions are gone
            if (typeof window.transactionOverrides !== 'undefined') {
                window.transactionOverrides = {};
            }

            // Keep everything else: categoryConfig, budgets, unifiedRules
            saveData();

            // Remove widget if exists
            const widget = document.getElementById('quickStatsWidget');
            if (widget) {
                widget.remove();
            }

            // Show notification before reload
            showNotification(
                'All transactions cleared. Categories, budgets, and rules preserved. Reloading...',
                'success'
            );

            // Reload after short delay
            setTimeout(() => {
                location.reload();
            }, 500);
        } catch (error) {
            console.error('Error clearing transactions:', error);
            showNotification('Error clearing transactions. Please try again.', 'error');
        }
    }
}

// Mark that there are unsaved changes
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

// Show notification function (if not already defined elsewhere)
if (typeof showNotification === 'undefined') {
    window.showNotification = function (message, type = 'success') {
        // Remove any existing notifications
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
