// js/settings.js - Settings View Functions

// Update budget view in settings
function updateBudgetView(analyzer) {
    const container = document.getElementById('budgetGrid');
    if (!container) return;

    const monthKey = currentMonth;

    // Show notice if switched from ALL_DATA
    const noticeContainer = document.getElementById('settingsNotice');
    if (noticeContainer) {
        noticeContainer.style.display = 'block';
        noticeContainer.innerHTML = `
            <span class="settings-notice-icon">ℹ️</span>
            Currently editing: <strong>${monthlyData.get(currentMonth).monthName}</strong>
            <span style="margin-left: 10px; font-size: 12px; color: var(--gray);">
                (Budget settings are per-month. Select a different month to edit its budgets)
            </span>
        `;
    }

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
                <div class="budget-item expanded">
                    <div class="budget-item-header">
                        <div class="category-edit-group">
                            <input type="text" 
                                   class="icon-input" 
                                   id="icon-${categoryId}" 
                                   value="${config.icon}" 
                                   maxlength="2"
                                   onchange="updateCategoryIcon('${category}', this.value)">
                            <input type="text" 
                                   class="category-name-input" 
                                   id="name-${categoryId}" 
                                   value="${category}" 
                                   ${category === 'Others' ? 'readonly' : ''}
                                   onchange="renameCategory('${category}', this.value)">
                        </div>
                        ${
                            category !== 'Others'
                                ? `<button class="btn-remove" onclick="removeCategory('${category}')" title="Remove category">×</button>`
                                : ''
                        }
                    </div>
                    
                    <div class="keywords-section">
                        <label class="keywords-label">Keywords:</label>
                        <input type="text" 
                               class="keywords-input" 
                               id="keywords-${categoryId}" 
                               value="${config.keywords.join(', ')}" 
                               placeholder="Enter keywords separated by commas (e.g., AMAZON, WALMART)"
                               onchange="updateCategoryKeywords('${category}', this.value)">
                    </div>
                    
                    <div class="budget-divider"></div>
                    
                    <div class="budget-stats">
                        <div class="budget-stat">
                            <span class="label">Spent:</span>
                            <span class="value">$${actual.toFixed(2)}</span>
                        </div>
                        <div class="budget-stat">
                            <span class="label">Budget:</span>
                            <span class="value">${
                                budget > 0 ? '$' + budget.toFixed(2) : 'Not set'
                            }</span>
                        </div>
                        ${
                            budget > 0
                                ? `
                            <div class="budget-stat">
                                <span class="label">Remaining:</span>
                                <span class="value" style="color: ${
                                    remaining >= 0 ? 'var(--success)' : 'var(--danger)'
                                }">
                                    ${remaining >= 0 ? '+' : ''}$${Math.abs(remaining).toFixed(2)}
                                </span>
                            </div>
                        `
                                : ''
                        }
                    </div>
                    
                    ${
                        budget > 0
                            ? `
                        <div class="budget-progress">
                            <div class="budget-progress-fill ${progressClass}" 
                                 style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    `
                            : ''
                    }
                    
                    <div class="budget-input-group">
                        <input type="number" 
                               id="budget-${categoryId}" 
                               placeholder="Set monthly budget" 
                               value="${budget || ''}"
                               step="0.01">
                        <button onclick="setBudget('${category}')">Set Budget</button>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="budget-actions">
            <button class="btn btn-primary" onclick="addNewCategory()">+ Add Category</button>
            <button class="btn btn-primary" onclick="saveAllCategoryChanges()">Save All Changes</button>
        </div>
        ${categoriesHTML}
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
            }
        }
    });

    if (hasChanges) {
        if (
            confirm(
                'Save all changes and re-categorize transactions based on new keywords? (Manual overrides will be preserved)'
            )
        ) {
            const movedCount = reprocessAllTransactions();
            saveData();

            // Refresh current view
            if (currentMonth) {
                switchToMonth(currentMonth);
                const monthData = monthlyData.get(currentMonth);
                if (monthData) {
                    const analyzer = analyzeTransactions(monthData.transactions);
                    updateBudgetView(analyzer);
                }
            }

            updateMerchantRulesDisplay();

            let message = 'All changes saved';
            if (movedCount > 0) {
                message += ` and ${movedCount} transactions re-categorized`;
            }
            showNotification(message, 'success');
        }
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
    if (keywords.length > 0) {
        const movedCount = reprocessAllTransactions();
        if (movedCount > 0) {
            message += ` and ${movedCount} transactions categorized`;
        }
    }

    saveData();

    // Refresh the current view
    if (currentMonth) {
        switchToMonth(currentMonth);
    }

    updateCategoriesView();
    updateSettingsView();

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
