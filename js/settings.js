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
            switchSettingsMonth(months[0]);
        }
    }
});

// Switch settings tab
function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.settings-content').forEach((c) => c.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');

    if (tab === 'rules') {
        updateMerchantRulesDisplay();
    } else if (tab === 'data') {
        updateStorageStats();
    } else if (tab === 'customRules') {
        updateCustomRulesDisplay();
    }
}

// Update storage stats
function updateStorageStats() {
    let transactionCount = 0;
    let monthCount = monthlyData.size;
    let categoryCount = Object.keys(categoryConfig).length;
    let merchantRuleCount = Object.keys(window.merchantRules || {}).length;

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
                            <div class="stat-value">${merchantRuleCount}</div>
                            <div class="stat-label">Merchant Rules</div>
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
    if (!monthlyData.has(monthKey)) return;

    currentMonth = monthKey;
    const monthData = monthlyData.get(monthKey);
    const analyzer = analyzeTransactions(monthData.transactions);
    updateBudgetView(analyzer);
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

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const categoriesHTML = allCategories
        .map((category) => {
            const actual = analyzer.categoryTotals[category] || 0;
            const budget = budgets[monthKey][category] || 0;
            const remaining = budget - actual;
            const percentage = budget > 0 ? (actual / budget) * 100 : 0;
            const progressClass = percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : '';
            const config = categoryConfig[category] || { icon: '📦', keywords: [] };
            const categoryId = category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

            return `
                <div class="budget-item compact">
                    <div class="budget-item-row">
                        <div class="category-info">
                            <input type="text" 
                                   class="icon-input-compact" 
                                   id="icon-${categoryId}" 
                                   value="${config.icon}" 
                                   maxlength="2"
                                   onchange="markUnsavedChanges()"
                                   title="Click to change icon">
                            <input type="text" 
                                   class="category-name-input-compact" 
                                   id="name-${categoryId}" 
                                   value="${category}" 
                                   ${category === 'Others' ? 'readonly' : ''}
                                   onchange="renameCategory('${category}', this.value); markUnsavedChanges()">
                        </div>
                        
                        <div class="budget-controls">
                            <div class="spending-info">
                                <span class="spent-label">Spent:</span>
                                <span class="spent-amount">$${actual.toFixed(2)}</span>
                                ${
                                    budget > 0
                                        ? `
                                    <span class="remaining-amount ${
                                        remaining >= 0 ? 'positive' : 'negative'
                                    }">
                                        (${remaining >= 0 ? '+' : ''}$${Math.abs(remaining).toFixed(
                                              2
                                          )})
                                    </span>
                                `
                                        : ''
                                }
                            </div>
                            
                            <div class="budget-input-compact">
                                <input type="number" 
                                       id="budget-${categoryId}" 
                                       placeholder="Budget" 
                                       value="${budget || ''}"
                                       step="0.01"
                                       class="budget-field">
                                <button class="btn-set-budget" onclick="setBudget('${category}')">Set</button>
                            </div>
                            
                            ${
                                category !== 'Others'
                                    ? `<button class="btn-remove-compact" onclick="removeCategory('${category}')" title="Remove">×</button>`
                                    : '<div style="width: 32px;"></div>'
                            }
                        </div>
                    </div>
                    
                    ${
                        budget > 0
                            ? `
                        <div class="budget-progress-compact">
                            <div class="budget-progress-fill ${progressClass}" 
                                 style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    `
                            : ''
                    }
                    
                    <div class="keywords-row">
                        <input type="text" 
                               class="keywords-input-compact" 
                               id="keywords-${categoryId}" 
                               value="${config.keywords.join(', ')}" 
                               placeholder="Keywords: e.g., AMAZON, WALMART (comma-separated)"
                               onchange="markUnsavedChanges()"
                               title="Add keywords that will auto-categorize transactions">
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="budget-header">
            <h3>Categories & Budgets - ${monthlyData.get(currentMonth).monthName}</h3>
            <div class="budget-actions-compact">
                <button class="btn btn-primary compact" onclick="addNewCategory()">+ Add Category</button>
                <button class="btn btn-primary compact" id="saveChangesBtn" onclick="saveAllCategoryChanges()">
                    <span id="saveChangesText">Save Changes</span>
                </button>
            </div>
        </div>
        <div id="unsavedNotice" style="display: none; background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 13px;">
            ⚠️ You have unsaved changes. Click "Save Changes" to apply keyword updates and re-categorize transactions.
        </div>
        <div class="budget-items-container">
            ${categoriesHTML}
        </div>
    `;
}

// Set budget
function setBudget(category) {
    const inputId = `budget-${category.replace(/\s+/g, '-')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const value = parseFloat(input.value);

    if (!isNaN(value) && value > 0) {
        if (!budgets[currentMonth]) {
            budgets[currentMonth] = {};
        }
        budgets[currentMonth][category] = value;
        saveData();

        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }

        showNotification(`Budget set for ${category}`, 'success');
    } else {
        showNotification('Please enter a valid budget amount', 'error');
    }
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
    const name = prompt('Enter category name:');
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();

    if (categoryConfig[trimmedName]) {
        showNotification('Category already exists', 'error');
        return;
    }

    // Ask for initial keywords
    const keywordsInput = prompt('Enter keywords for this category (comma-separated, optional):');
    const keywords = keywordsInput
        ? keywordsInput
              .split(',')
              .map((k) => k.trim().toUpperCase())
              .filter((k) => k.length > 0)
        : [];

    categoryConfig[trimmedName] = {
        keywords: keywords,
        icon: '📦',
    };

    // If keywords were added, reprocess transactions
    let message = `Category "${trimmedName}" added`;

    saveData();

    // Refresh the budget view immediately
    if (currentMonth && monthlyData.has(currentMonth)) {
        const monthData = monthlyData.get(currentMonth);
        const analyzer = analyzeTransactions(monthData.transactions);
        updateBudgetView(analyzer);
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
        localStorage.removeItem('sahabBudget_data');
        window.transactionOverrides = {};
        location.reload();
    }
}

// Mark that there are unsaved changes
function markUnsavedChanges() {
    const notice = document.getElementById('unsavedNotice');
    const saveBtn = document.getElementById('saveChangesBtn');

    if (notice) {
        notice.style.display = 'block';
    }

    if (saveBtn) {
        saveBtn.classList.add('pulse');
        document.getElementById('saveChangesText').textContent = 'Save Changes*';
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
