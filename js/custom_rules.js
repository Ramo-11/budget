// Display custom rules
function updateCustomRulesDisplay() {
    const container = document.getElementById('customRulesList');
    if (!container) return;

    if (!customRules.delete || customRules.delete.length === 0) {
        container.innerHTML =
            '<p style="color: var(--gray); font-size: 13px;">No custom rules created yet.</p>';
        return;
    }

    const rulesHtml = customRules.delete
        .map((rule, index) => {
            const statusColor = rule.active ? 'var(--success)' : 'var(--gray)';
            const statusText = rule.active ? 'Active' : 'Inactive';
            const toggleText = rule.active ? 'Disable' : 'Enable';
            const toggleClass = rule.active ? 'btn-secondary' : 'btn-primary';

            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: ${
                rule.active ? 'var(--light)' : 'white'
            }; margin: 10px 0; border-radius: 6px; border: 1px solid ${
                rule.active ? 'var(--primary)' : 'var(--border)'
            };">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <strong style="font-size: 14px;">${rule.name}</strong>
                        <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">
                            ${statusText}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: var(--gray);">
                        ${
                            rule.matchType === 'contains'
                                ? 'Contains'
                                : rule.matchType === 'startsWith'
                                ? 'Starts with'
                                : rule.matchType === 'endsWith'
                                ? 'Ends with'
                                : 'Exactly matches'
                        }: 
                        <code style="background: var(--light); padding: 2px 6px; border-radius: 3px;">"${
                            rule.pattern
                        }"</code>
                    </div>
                    ${
                        rule.description
                            ? `<div style="font-size: 12px; color: var(--gray); margin-top: 5px; font-style: italic;">${rule.description}</div>`
                            : ''
                    }
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn ${toggleClass}" onclick="toggleCustomRule(${index})" style="font-size: 12px;">
                        ${toggleText}
                    </button>
                    <button class="btn btn-secondary" onclick="editCustomRule(${index})" style="font-size: 12px;">
                        Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteCustomRule(${index})" style="font-size: 12px;">
                        Delete
                    </button>
                </div>
            </div>
        `;
        })
        .join('');

    container.innerHTML = rulesHtml;
}

// Add a new custom rule
function addCustomRule() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>Add Custom Rule</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Rule Name:</label>
                    <input type="text" id="ruleName" placeholder="e.g., Skip Internal Transfers" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Pattern to Match:</label>
                    <input type="text" id="rulePattern" placeholder="e.g., Online Transfer To" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Match Type:</label>
                    <select id="ruleMatchType" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                        <option value="contains">Contains (anywhere in description)</option>
                        <option value="startsWith">Starts With</option>
                        <option value="endsWith">Ends With</option>
                        <option value="exact">Exact Match</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Description (optional):</label>
                    <input type="text" id="ruleDescription" placeholder="Why this rule exists" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="ruleActive" checked>
                        <span style="font-size: 13px;">Activate immediately</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveCustomRule()">Create Rule</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Save custom rule
function saveCustomRule(editIndex = null) {
    const name = document.getElementById('ruleName').value.trim();
    const pattern = document.getElementById('rulePattern').value.trim();
    const matchType = document.getElementById('ruleMatchType').value;
    const description = document.getElementById('ruleDescription').value.trim();
    const active = document.getElementById('ruleActive').checked;

    if (!name || !pattern) {
        showNotification('Please provide a rule name and pattern', 'error');
        return;
    }

    if (!customRules.delete) {
        customRules.delete = [];
    }

    const rule = {
        name,
        pattern,
        matchType,
        description,
        active,
        createdAt: new Date().toISOString(),
    };

    if (editIndex !== null) {
        customRules.delete[editIndex] = rule;
        showNotification('Rule updated successfully', 'success');
    } else {
        customRules.delete.push(rule);
        showNotification('Rule created successfully', 'success');
    }

    saveData();
    updateCustomRulesDisplay();
    document.querySelector('.modal').remove();
}

// Toggle custom rule
function toggleCustomRule(index) {
    if (customRules.delete && customRules.delete[index]) {
        customRules.delete[index].active = !customRules.delete[index].active;
        saveData();
        updateCustomRulesDisplay();
        showNotification(
            customRules.delete[index].active ? 'Rule activated' : 'Rule deactivated',
            'success'
        );
    }
}

// Edit custom rule
function editCustomRule(index) {
    const rule = customRules.delete[index];
    if (!rule) return;

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>Edit Custom Rule</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Rule Name:</label>
                    <input type="text" id="ruleName" value="${
                        rule.name
                    }" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Pattern to Match:</label>
                    <input type="text" id="rulePattern" value="${
                        rule.pattern
                    }" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
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
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500;">Description (optional):</label>
                    <input type="text" id="ruleDescription" value="${
                        rule.description || ''
                    }" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
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
                <button class="btn btn-primary" onclick="saveCustomRule(${index})">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Delete custom rule
function deleteCustomRule(index) {
    if (confirm('Are you sure you want to delete this rule?')) {
        customRules.delete.splice(index, 1);
        saveData();
        updateCustomRulesDisplay();
        showNotification('Rule deleted', 'success');
    }
}

// Apply rules to existing data
function applyRulesToExisting() {
    const activeRules = (customRules.delete || []).filter((rule) => rule.active);

    if (activeRules.length === 0) {
        showNotification('No active rules to apply', 'error');
        return;
    }

    if (
        !confirm(
            `Apply ${activeRules.length} active rule(s) to existing data? This will delete matching transactions.`
        )
    ) {
        return;
    }

    let totalDeleted = 0;

    monthlyData.forEach((monthData, monthKey) => {
        const originalCount = monthData.transactions.length;

        monthData.transactions = monthData.transactions.filter((transaction) => {
            const description = (
                transaction.Description ||
                transaction.description ||
                ''
            ).toUpperCase();

            const shouldDelete = activeRules.some((rule) => {
                const pattern = rule.pattern.toUpperCase();
                if (rule.matchType === 'contains') {
                    return description.includes(pattern);
                } else if (rule.matchType === 'startsWith') {
                    return description.startsWith(pattern);
                } else if (rule.matchType === 'endsWith') {
                    return description.endsWith(pattern);
                } else if (rule.matchType === 'exact') {
                    return description === pattern;
                }
                return false;
            });

            return !shouldDelete;
        });

        totalDeleted += originalCount - monthData.transactions.length;
    });

    if (totalDeleted > 0) {
        saveData();

        // Refresh current view
        if (currentMonth) {
            switchToMonth(currentMonth);
        }

        showNotification(`Deleted ${totalDeleted} transaction(s) based on active rules`, 'success');
    } else {
        showNotification('No transactions matched the active rules', 'info');
    }
}
