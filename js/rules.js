// js/rules.js - Unified Rules System

let unifiedRules = [];

// Initialize rules from saved data
function initializeRules() {
    // Convert old merchant rules to new format
    if (window.merchantRules && !window.rulesConverted) {
        Object.entries(window.merchantRules).forEach(([pattern, category]) => {
            unifiedRules.push({
                id: generateRuleId(),
                name: `Auto: ${pattern} → ${category}`,
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

    // Convert old custom delete rules
    if (customRules.delete) {
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

    // Save converted rules
    saveRules();
}

// Generate unique rule ID
function generateRuleId() {
    return 'rule_' + Math.random().toString(36).substr(2, 9);
}

// Save rules
function saveRules() {
    const data = JSON.parse(localStorage.getItem('sahabBudget_data') || '{}');
    data.unifiedRules = unifiedRules;
    localStorage.setItem('sahabBudget_data', JSON.stringify(data));
}

// Load rules
function loadRules() {
    const data = JSON.parse(localStorage.getItem('sahabBudget_data') || '{}');
    if (data.unifiedRules) {
        unifiedRules = data.unifiedRules;
    } else {
        initializeRules();
    }
}

// Create rule from drag and drop
function createRuleFromDragDrop(description, toCategory) {
    const merchantName = description
        .toUpperCase()
        .split(/[\s#\*]/)[0]
        .trim();

    if (!merchantName) return null;

    // Check if rule already exists
    const existingRule = unifiedRules.find(
        (r) => r.pattern === merchantName && r.type === 'categorize' && r.action === toCategory
    );

    if (existingRule) return existingRule;

    const newRule = {
        id: generateRuleId(),
        name: `Auto: "${merchantName}" → ${toCategory}`,
        type: 'categorize',
        pattern: merchantName,
        matchType: 'contains',
        action: toCategory,
        isAutomatic: true,
        active: true,
        createdAt: new Date().toISOString(),
    };

    unifiedRules.push(newRule);
    saveRules();

    return newRule;
}

// Apply rules to transactions
function applyRulesToTransaction(transaction) {
    const description = (transaction.Description || transaction.description || '').toUpperCase();

    // Sort rules by priority: manual rules first, then automatic
    const sortedRules = [...unifiedRules].sort((a, b) => {
        if (a.isAutomatic === b.isAutomatic) return 0;
        return a.isAutomatic ? 1 : -1;
    });

    for (const rule of sortedRules) {
        if (!rule.active) continue;

        const pattern = rule.pattern.toUpperCase();
        let matches = false;

        switch (rule.matchType) {
            case 'contains':
                matches = description.includes(pattern);
                break;
            case 'startsWith':
                matches = description.startsWith(pattern);
                break;
            case 'endsWith':
                matches = description.endsWith(pattern);
                break;
            case 'exact':
                matches = description === pattern;
                break;
            case 'regex':
                try {
                    const regex = new RegExp(pattern, 'i');
                    matches = regex.test(description);
                } catch (e) {
                    console.error('Invalid regex:', pattern);
                }
                break;
        }

        if (matches) {
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

// Show add/edit rule modal
function showRuleModal(editRule = null) {
    const modal = document.createElement('div');
    modal.className = 'modal show';

    const isEdit = editRule !== null;
    const rule = editRule || {
        type: 'categorize',
        matchType: 'contains',
        active: true,
    };

    // Get available categories for the dropdown
    const categoryOptions = Object.keys(categoryConfig)
        .map(
            (cat) =>
                `<option value="${cat}" ${rule.action === cat ? 'selected' : ''}>${
                    categoryConfig[cat].icon
                } ${cat}</option>`
        )
        .join('');

    modal.innerHTML = `
        <div class="modal-content" style="width: 550px;">
            <div class="modal-header">
                <h2>${isEdit ? 'Edit Rule' : 'Create Custom Rule'}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                ${
                    rule.isAutomatic
                        ? `
                    <div style="background: #e0f2fe; border: 1px solid #0284c7; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
                        <span style="color: #0284c7; font-size: 13px;">
                            🤖 This rule was automatically created from your transaction movements
                        </span>
                    </div>
                `
                        : ''
                }
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Rule Type:</label>
                    <select id="ruleType" onchange="updateRuleModalFields()" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                        <option value="categorize" ${
                            rule.type === 'categorize' ? 'selected' : ''
                        }>Move to Category</option>
                        <option value="delete" ${
                            rule.type === 'delete' ? 'selected' : ''
                        }>Delete Transaction</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Rule Name:</label>
                    <input type="text" id="ruleName" value="${
                        rule.name || ''
                    }" placeholder="e.g., Starbucks to Coffee" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Pattern to Match:</label>
                    <input type="text" id="rulePattern" value="${
                        rule.pattern || ''
                    }" placeholder="e.g., STARBUCKS" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Match Type:</label>
                    <select id="ruleMatchType" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                        <option value="contains" ${
                            rule.matchType === 'contains' ? 'selected' : ''
                        }>Contains (anywhere in description)</option>
                        <option value="startsWith" ${
                            rule.matchType === 'startsWith' ? 'selected' : ''
                        }>Starts With</option>
                        <option value="endsWith" ${
                            rule.matchType === 'endsWith' ? 'selected' : ''
                        }>Ends With</option>
                        <option value="exact" ${
                            rule.matchType === 'exact' ? 'selected' : ''
                        }>Exact Match</option>
                        <option value="regex" ${
                            rule.matchType === 'regex' ? 'selected' : ''
                        }>Regular Expression (Advanced)</option>
                    </select>
                </div>
                
                <div id="actionField" style="margin-bottom: 15px; ${
                    rule.type === 'delete' ? 'display: none;' : ''
                }">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Move to Category:</label>
                    <select id="ruleAction" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                        ${categoryOptions}
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Description (optional):</label>
                    <input type="text" id="ruleDescription" value="${
                        rule.description || ''
                    }" placeholder="Why this rule exists" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="ruleActive" ${rule.active ? 'checked' : ''}>
                        <span style="font-size: 13px;">Rule is active</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveRule(${
                    isEdit ? `'${rule.id}'` : 'null'
                })">
                    ${isEdit ? 'Save Changes' : 'Create Rule'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Update modal fields based on rule type
function updateRuleModalFields() {
    const ruleType = document.getElementById('ruleType').value;
    const actionField = document.getElementById('actionField');

    if (ruleType === 'delete') {
        actionField.style.display = 'none';
    } else {
        actionField.style.display = 'block';
    }
}

// Save rule
function saveRule(ruleId = null) {
    const type = document.getElementById('ruleType').value;
    const name = document.getElementById('ruleName').value.trim();
    const pattern = document.getElementById('rulePattern').value.trim();
    const matchType = document.getElementById('ruleMatchType').value;
    const action = type === 'categorize' ? document.getElementById('ruleAction').value : null;
    const description = document.getElementById('ruleDescription').value.trim();
    const active = document.getElementById('ruleActive').checked;

    if (!name || !pattern) {
        showNotification('Please provide a rule name and pattern', 'error');
        return;
    }

    if (ruleId) {
        // Edit existing rule
        const ruleIndex = unifiedRules.findIndex((r) => r.id === ruleId);
        if (ruleIndex > -1) {
            unifiedRules[ruleIndex] = {
                ...unifiedRules[ruleIndex],
                name,
                type,
                pattern,
                matchType,
                action,
                description,
                active,
                updatedAt: new Date().toISOString(),
            };
        }
        showNotification('Rule updated successfully', 'success');
    } else {
        // Create new rule
        const newRule = {
            id: generateRuleId(),
            name,
            type,
            pattern,
            matchType,
            action,
            description,
            isAutomatic: false,
            active,
            createdAt: new Date().toISOString(),
        };
        unifiedRules.push(newRule);
        showNotification('Rule created successfully', 'success');
    }

    saveRules();
    updateRulesDisplay();
    document.querySelector('.modal').remove();
}

// Update rules display
function updateRulesDisplay() {
    const container = document.getElementById('rulesList');
    if (!container) return;

    if (unifiedRules.length === 0) {
        container.innerHTML =
            '<p style="color: var(--gray); font-size: 13px;">No rules created yet. Rules will be automatically created when you drag transactions to different categories.</p>';
        return;
    }

    // Group rules by type
    const categorizeRules = unifiedRules.filter((r) => r.type === 'categorize');
    const deleteRules = unifiedRules.filter((r) => r.type === 'delete');

    let html = '';

    // Categorize Rules Section
    if (categorizeRules.length > 0) {
        html += `
            <div style="margin-bottom: 30px;">
                <h4 style="font-size: 14px; margin-bottom: 15px; color: var(--dark);">
                    🔄 Categorization Rules (${categorizeRules.length})
                </h4>
                ${categorizeRules.map((rule) => createRuleCard(rule)).join('')}
            </div>
        `;
    }

    // Delete Rules Section
    if (deleteRules.length > 0) {
        html += `
            <div style="margin-bottom: 30px;">
                <h4 style="font-size: 14px; margin-bottom: 15px; color: var(--dark);">
                    🗑️ Deletion Rules (${deleteRules.length})
                </h4>
                ${deleteRules.map((rule) => createRuleCard(rule)).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

// Create rule card HTML
function createRuleCard(rule) {
    const statusColor = rule.active ? 'var(--success)' : 'var(--gray)';
    const statusText = rule.active ? 'Active' : 'Inactive';
    const toggleText = rule.active ? 'Disable' : 'Enable';
    const toggleClass = rule.active ? 'btn-secondary' : 'btn-primary';

    const icon =
        rule.type === 'categorize' && rule.action
            ? categoryConfig[rule.action]?.icon || '📦'
            : '🗑️';

    const actionText = rule.type === 'categorize' ? `Move to ${icon} ${rule.action}` : 'Delete';

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: ${
            rule.active ? 'var(--light)' : 'white'
        }; margin: 10px 0; border-radius: 6px; border: 1px solid ${
        rule.active ? 'var(--primary)' : 'var(--border)'
    }; position: relative;">
            ${
                rule.isAutomatic
                    ? `
                <div style="position: absolute; top: -8px; left: 15px; background: #3b82f6; color: white; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600;">
                    AUTO
                </div>
            `
                    : ''
            }
            
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <strong style="font-size: 14px;">${rule.name}</strong>
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">
                        ${statusText}
                    </span>
                </div>
                <div style="font-size: 13px; color: var(--gray); margin-bottom: 5px;">
                    If ${
                        rule.matchType === 'contains'
                            ? 'contains'
                            : rule.matchType === 'startsWith'
                            ? 'starts with'
                            : rule.matchType === 'endsWith'
                            ? 'ends with'
                            : rule.matchType === 'regex'
                            ? 'matches regex'
                            : 'exactly matches'
                    }: 
                    <code style="background: var(--light); padding: 2px 6px; border-radius: 3px;">"${
                        rule.pattern
                    }"</code>
                    → <strong>${actionText}</strong>
                </div>
                ${
                    rule.description
                        ? `
                    <div style="font-size: 12px; color: var(--gray); font-style: italic;">
                        ${rule.description}
                    </div>
                `
                        : ''
                }
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button class="btn ${toggleClass}" onclick="toggleRule('${
        rule.id
    }')" style="font-size: 12px;">
                    ${toggleText}
                </button>
                <button class="btn btn-secondary" onclick="editRule('${
                    rule.id
                }')" style="font-size: 12px;">
                    Edit
                </button>
                <button class="btn btn-danger" onclick="deleteRule('${
                    rule.id
                }')" style="font-size: 12px;">
                    Delete
                </button>
            </div>
        </div>
    `;
}

// Toggle rule
function toggleRule(ruleId) {
    const rule = unifiedRules.find((r) => r.id === ruleId);
    if (rule) {
        rule.active = !rule.active;
        saveRules();
        updateRulesDisplay();
        showNotification(rule.active ? 'Rule activated' : 'Rule deactivated', 'success');
    }
}

// Edit rule
function editRule(ruleId) {
    const rule = unifiedRules.find((r) => r.id === ruleId);
    if (rule) {
        showRuleModal(rule);
    }
}

// Delete rule
function deleteRule(ruleId) {
    const rule = unifiedRules.find((r) => r.id === ruleId);
    if (!rule) return;

    if (confirm(`Delete rule "${rule.name}"?`)) {
        unifiedRules = unifiedRules.filter((r) => r.id !== ruleId);
        saveRules();
        updateRulesDisplay();
        showNotification('Rule deleted', 'success');
    }
}

// Apply rules to existing data
function applyRulesToExistingData() {
    const activeRules = unifiedRules.filter((r) => r.active);

    if (activeRules.length === 0) {
        showNotification('No active rules to apply', 'error');
        return;
    }

    if (!confirm(`Apply ${activeRules.length} active rule(s) to existing data?`)) {
        return;
    }

    let totalProcessed = 0;
    let totalDeleted = 0;
    let totalMoved = 0;

    monthlyData.forEach((monthData, monthKey) => {
        const remainingTransactions = [];

        monthData.transactions.forEach((transaction) => {
            const result = applyRulesToTransaction(transaction);

            if (result) {
                totalProcessed++;

                if (result.action === 'delete') {
                    totalDeleted++;
                    // Don't add to remaining transactions
                } else if (result.action === 'categorize') {
                    // Update transaction category override
                    if (!window.transactionOverrides[monthKey]) {
                        window.transactionOverrides[monthKey] = {};
                    }
                    window.transactionOverrides[monthKey][transaction._id] = result.value;
                    totalMoved++;
                    remainingTransactions.push(transaction);
                } else {
                    remainingTransactions.push(transaction);
                }
            } else {
                remainingTransactions.push(transaction);
            }
        });

        monthData.transactions = remainingTransactions;
    });

    if (totalProcessed > 0) {
        saveData();

        // Refresh current view
        if (currentMonth) {
            switchToMonth(currentMonth);
        }

        let message = `Processed ${totalProcessed} transactions`;
        if (totalDeleted > 0) message += ` (${totalDeleted} deleted)`;
        if (totalMoved > 0) message += ` (${totalMoved} re-categorized)`;

        showNotification(message, 'success');
    } else {
        showNotification('No transactions matched the active rules', 'info');
    }
}

// Clear all rules
function clearAllRules() {
    if (unifiedRules.length === 0) {
        showNotification('No rules to clear', 'error');
        return;
    }

    if (confirm(`Clear all ${unifiedRules.length} rules? This cannot be undone.`)) {
        unifiedRules = [];
        saveRules();
        updateRulesDisplay();
        showNotification('All rules cleared', 'success');
    }
}

// Export rules
function exportRules() {
    if (unifiedRules.length === 0) {
        showNotification('No rules to export', 'error');
        return;
    }

    const exportData = {
        rules: unifiedRules,
        exportDate: new Date().toISOString(),
        version: '1.0',
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    downloadFile(jsonContent, `rules_export_${Date.now()}.json`, 'application/json');
    showNotification('Rules exported successfully', 'success');
}

// Import rules
function importRules() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.rules || !Array.isArray(importData.rules)) {
                throw new Error('Invalid rules file format');
            }

            const importCount = importData.rules.length;

            if (confirm(`Import ${importCount} rule(s)? This will merge with existing rules.`)) {
                // Merge with existing rules, avoiding duplicates
                importData.rules.forEach((importedRule) => {
                    const exists = unifiedRules.some(
                        (r) =>
                            r.pattern === importedRule.pattern &&
                            r.type === importedRule.type &&
                            r.action === importedRule.action
                    );

                    if (!exists) {
                        // Generate new ID to avoid conflicts
                        importedRule.id = generateRuleId();
                        unifiedRules.push(importedRule);
                    }
                });

                saveRules();
                updateRulesDisplay();
                showNotification(`Rules imported successfully`, 'success');
            }
        } catch (error) {
            showNotification('Error reading rules file: ' + error.message, 'error');
        }
    };

    input.click();
}

// Initialize on load
if (typeof window.rulesInitialized === 'undefined') {
    window.rulesInitialized = true;
    window.addEventListener('DOMContentLoaded', () => {
        loadRules();
    });
}
