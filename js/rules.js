// js/rules.js - Unified Rules System

window.unifiedRules = window.unifiedRules || [];

// ---------------------------------------------------------------------------
// Safety limits for user/backup-supplied patterns
// ---------------------------------------------------------------------------
const RULE_PATTERN_MAX_LENGTH = 200;
const RULE_REGEX_INPUT_MAX = 400;
const safeRegexCache = new Map();

// Compile a user-supplied regex defensively. Returns a RegExp or null when the
// pattern is too long, syntactically invalid, or shaped like a catastrophic
// backtracking pattern (nested/overlapping quantifiers). Results are cached so
// each pattern is vetted once.
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

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

// Initialize rules from saved data
function initializeRules() {
    // Convert old merchant rules to new format
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

    saveRules();
}

// Generate unique rule ID
function generateRuleId() {
    return 'rule_' + Math.random().toString(36).substr(2, 9);
}

// Save rules
function saveRules() {
    const key = getActiveDataKey();
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data.unifiedRules = unifiedRules;
    localStorage.setItem(key, JSON.stringify(data));
}

// Load rules
function loadRules() {
    const data = JSON.parse(localStorage.getItem(getActiveDataKey()) || '{}');
    if (data.unifiedRules) {
        unifiedRules = data.unifiedRules;
    } else if (!unifiedRules || unifiedRules.length === 0) {
        unifiedRules = [];
    } else {
        initializeRules();
    }
}

// ---------------------------------------------------------------------------
// Rule creation from drag and drop
// ---------------------------------------------------------------------------

function createRuleFromDragDrop(description, toCategory) {
    const merchantName = description
        .toUpperCase()
        .split(/[\s#\*]/)[0]
        .trim();

    if (!merchantName) return null;

    // Check if rule already exists for this pattern
    const existingRule = unifiedRules.find(
        (r) => r.pattern === merchantName && r.type === 'categorize' && r.active
    );

    if (existingRule) {
        if (existingRule.action !== toCategory) {
            const message = `A rule already exists: "${merchantName}" -> ${existingRule.action}\n\nDo you want to change it to: "${merchantName}" -> ${toCategory}?`;

            if (confirm(message)) {
                existingRule.action = toCategory;
                existingRule.name = `Auto: "${merchantName}" -> ${toCategory}`;
                existingRule.updatedAt = new Date().toISOString();

                saveRules();
                saveData();

                showNotification(
                    `Rule updated: "${merchantName}" now moves to ${toCategory}`,
                    'success'
                );
                return existingRule;
            } else {
                showNotification(
                    `Transaction moved to ${toCategory} (existing rule for "${merchantName}" not changed)`,
                    'info'
                );
                return null;
            }
        } else {
            showNotification(`Moved to ${toCategory} (using existing rule)`, 'success');
            return existingRule;
        }
    }

    const newRule = {
        id: generateRuleId(),
        name: `Auto: "${merchantName}" -> ${toCategory}`,
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
    saveData();

    showNotification(`New rule created: "${merchantName}" -> ${toCategory}`, 'success');
    return newRule;
}

// ---------------------------------------------------------------------------
// Rule matching
// ---------------------------------------------------------------------------

function applyRulesToTransaction(transaction) {
    const description = (transaction.Description || transaction.description || '').toUpperCase();

    // Sort rules by priority: manual rules first, then automatic
    const sortedRules = [...unifiedRules].sort((a, b) => {
        if (a.isAutomatic === b.isAutomatic) return 0;
        return a.isAutomatic ? 1 : -1;
    });

    for (const rule of sortedRules) {
        if (!rule.active) continue;

        // Patterns come from users and restored backups: treat as untrusted.
        const pattern = String(rule.pattern || '').toUpperCase();
        if (!pattern || pattern.length > RULE_PATTERN_MAX_LENGTH) continue;

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
            case 'regex': {
                const regex = getSafeRuleRegex(pattern);
                if (regex) {
                    try {
                        // Bounded input keeps a pathological pattern from
                        // freezing the tab even if it slipped past the vet.
                        matches = regex.test(description.slice(0, RULE_REGEX_INPUT_MAX));
                    } catch (e) {
                        matches = false;
                    }
                }
                break;
            }
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

// ---------------------------------------------------------------------------
// Rule editor modal
// ---------------------------------------------------------------------------

function showRuleModal(editRule = null) {
    const esc = window.escapeHtml;
    const isEdit = editRule !== null;
    const rule = editRule || {
        type: 'categorize',
        matchType: 'contains',
        active: true,
    };

    const categoryOptions = Object.keys(categoryConfig)
        .sort((a, b) => a.localeCompare(b))
        .map(
            (cat) =>
                `<option value="${esc(cat)}" ${rule.action === cat ? 'selected' : ''}>${esc(cat)}</option>`
        )
        .join('');

    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    overlay.innerHTML = `
        <div class="app-modal rule-editor-modal" role="dialog" aria-modal="true" aria-label="${isEdit ? 'Edit rule' : 'Create rule'}">
            <div class="app-modal-header">
                <div class="app-modal-title">${isEdit ? 'Edit Rule' : 'New Rule'}</div>
                <button class="app-modal-close" data-close aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="app-modal-body">
                ${
                    rule.isAutomatic
                        ? `<div class="rule-auto-note">Learned automatically from your transaction moves</div>`
                        : ''
                }
                <div class="app-field">
                    <label class="app-label" for="ruleName">Name</label>
                    <input type="text" id="ruleName" class="app-input" value="${esc(rule.name || '')}"
                           placeholder="Starbucks to Coffee" autocomplete="off">
                </div>
                <div class="rule-editor-grid">
                    <div class="app-field">
                        <label class="app-label" for="ruleMatchType">Match</label>
                        <select id="ruleMatchType" class="app-input">
                            <option value="contains" ${rule.matchType === 'contains' ? 'selected' : ''}>Contains</option>
                            <option value="startsWith" ${rule.matchType === 'startsWith' ? 'selected' : ''}>Starts with</option>
                            <option value="endsWith" ${rule.matchType === 'endsWith' ? 'selected' : ''}>Ends with</option>
                            <option value="exact" ${rule.matchType === 'exact' ? 'selected' : ''}>Exact match</option>
                            <option value="regex" ${rule.matchType === 'regex' ? 'selected' : ''}>Regex</option>
                        </select>
                    </div>
                    <div class="app-field">
                        <label class="app-label" for="rulePattern">Pattern</label>
                        <input type="text" id="rulePattern" class="app-input" value="${esc(rule.pattern || '')}"
                               placeholder="STARBUCKS" maxlength="${RULE_PATTERN_MAX_LENGTH}" autocomplete="off">
                    </div>
                </div>
                <div class="rule-editor-grid">
                    <div class="app-field">
                        <label class="app-label" for="ruleType">Then</label>
                        <select id="ruleType" class="app-input" onchange="updateRuleModalFields()">
                            <option value="categorize" ${rule.type === 'categorize' ? 'selected' : ''}>Move to category</option>
                            <option value="delete" ${rule.type === 'delete' ? 'selected' : ''}>Delete transaction</option>
                        </select>
                    </div>
                    <div class="app-field" id="actionField" ${rule.type === 'delete' ? 'style="display: none;"' : ''}>
                        <label class="app-label" for="ruleAction">Category</label>
                        <select id="ruleAction" class="app-input">${categoryOptions}</select>
                    </div>
                </div>
                <div class="app-field">
                    <label class="app-label" for="ruleDescription">Note (optional)</label>
                    <input type="text" id="ruleDescription" class="app-input" value="${esc(rule.description || '')}"
                           placeholder="Why this rule exists" autocomplete="off">
                </div>
                <label class="app-check">
                    <input type="checkbox" id="ruleActive" ${rule.active ? 'checked' : ''}>
                    <span>Rule is active</span>
                </label>
                <div class="app-modal-actions">
                    <button class="btn btn-secondary" data-close>Cancel</button>
                    <button class="btn btn-primary" data-save>${isEdit ? 'Save Changes' : 'Create Rule'}</button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) {
            overlay.remove();
            return;
        }
        if (e.target.closest('[data-save]')) {
            saveRule(isEdit ? rule.id : null, overlay);
        }
    });

    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') overlay.remove();
    });

    document.body.appendChild(overlay);
    const nameInput = overlay.querySelector('#ruleName');
    if (nameInput) nameInput.focus();
}

// Update modal fields based on rule type
function updateRuleModalFields() {
    const ruleType = document.getElementById('ruleType').value;
    const actionField = document.getElementById('actionField');

    if (ruleType === 'delete') {
        actionField.style.display = 'none';
    } else {
        actionField.style.display = '';
    }
}

// Save rule (create or edit)
function saveRule(ruleId = null, overlay = null) {
    const type = document.getElementById('ruleType').value;
    const name = document.getElementById('ruleName').value.trim();
    const pattern = document.getElementById('rulePattern').value.trim();
    const matchType = document.getElementById('ruleMatchType').value;
    const action = type === 'categorize' ? document.getElementById('ruleAction').value : null;
    const description = document.getElementById('ruleDescription').value.trim();
    const active = document.getElementById('ruleActive').checked;

    if (!name || !pattern) {
        showNotification('Provide a rule name and pattern', 'error');
        return;
    }

    if (pattern.length > RULE_PATTERN_MAX_LENGTH) {
        showNotification(`Pattern is too long (max ${RULE_PATTERN_MAX_LENGTH} characters)`, 'error');
        return;
    }

    if (type === 'categorize' && !action) {
        showNotification('Choose a category to move matches into', 'error');
        return;
    }

    if (matchType === 'regex' && !getSafeRuleRegex(pattern.toUpperCase())) {
        showNotification('That regular expression is invalid or unsafe', 'error');
        return;
    }

    if (ruleId) {
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
        showNotification('Rule updated', 'success');
    } else {
        unifiedRules.push({
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
        });
        showNotification('Rule created', 'success');
    }

    saveRules();
    updateRulesDisplay();

    if (overlay) {
        overlay.remove();
    } else {
        const open = document.querySelector('.app-modal-overlay');
        if (open) open.remove();
    }
}

// ---------------------------------------------------------------------------
// Rules list rendering (delegated events; no untrusted data in handlers)
// ---------------------------------------------------------------------------

function ensureRulesListListeners() {
    const container = document.getElementById('rulesList');
    if (!container || container.dataset.listenersBound) return;
    container.dataset.listenersBound = 'true';

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-rule-action]');
        if (!btn) return;
        const card = btn.closest('[data-rule-id]');
        if (!card) return;
        const ruleId = card.dataset.ruleId;

        if (btn.dataset.ruleAction === 'edit') {
            editRule(ruleId);
        } else if (btn.dataset.ruleAction === 'delete') {
            deleteRule(ruleId);
        }
    });

    container.addEventListener('change', (e) => {
        if (e.target.matches('input[data-rule-action="toggle"]')) {
            const card = e.target.closest('[data-rule-id]');
            if (card) toggleRule(card.dataset.ruleId);
        }
    });
}

function updateRulesDisplay() {
    const container = document.getElementById('rulesList');
    if (!container) return;
    ensureRulesListListeners();

    if (!unifiedRules || unifiedRules.length === 0) {
        container.innerHTML = `
            <div class="rules-empty">
                <p>No rules yet</p>
                <span>Drag a transaction onto a category on the dashboard, or create one here.</span>
            </div>
        `;
        return;
    }

    const categorizeRules = unifiedRules.filter((r) => r.type === 'categorize');
    const deleteRules = unifiedRules.filter((r) => r.type === 'delete');

    let html = '';

    if (categorizeRules.length > 0) {
        html += `
            <div class="rules-group">
                <h4 class="rules-group-title">Move to category <span class="rules-group-count">${categorizeRules.length}</span></h4>
                ${categorizeRules.map((rule) => createRuleCard(rule)).join('')}
            </div>
        `;
    }

    if (deleteRules.length > 0) {
        html += `
            <div class="rules-group">
                <h4 class="rules-group-title">Delete matching <span class="rules-group-count">${deleteRules.length}</span></h4>
                ${deleteRules.map((rule) => createRuleCard(rule)).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

// Create rule card HTML (all rule fields are untrusted: escaped)
function createRuleCard(rule) {
    const esc = window.escapeHtml;
    const active = rule.active !== false;

    const matchLabels = {
        contains: 'contains',
        startsWith: 'starts with',
        endsWith: 'ends with',
        exact: 'is exactly',
        regex: 'matches regex',
    };
    const matchLabel = matchLabels[rule.matchType] || 'contains';

    const target =
        rule.type === 'categorize' && rule.action
            ? `<span class="rule-target">
                   ${typeof getCategoryIconChip === 'function' ? getCategoryIconChip(rule.action, { size: 22, icon: 12 }) : ''}
                   <span>${esc(rule.action)}</span>
               </span>`
            : `<span class="rule-target rule-target-delete">Delete</span>`;

    return `
        <div class="rule-card${active ? '' : ' rule-inactive'}" data-rule-id="${esc(rule.id)}">
            <div class="rule-card-main">
                <div class="rule-card-title">
                    <strong>${esc(rule.name)}</strong>
                    ${rule.isAutomatic ? '<span class="rule-badge">Auto</span>' : ''}
                    ${active ? '' : '<span class="rule-badge rule-badge-off">Off</span>'}
                </div>
                <div class="rule-card-flow">
                    <span class="rule-match-label">${matchLabel}</span>
                    <code class="rule-pattern">${esc(rule.pattern)}</code>
                    <svg class="rule-flow-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                    ${target}
                </div>
                ${rule.description ? `<div class="rule-card-desc">${esc(rule.description)}</div>` : ''}
            </div>
            <div class="rule-card-actions">
                <label class="mini-toggle rule-active-toggle" title="${active ? 'Disable rule' : 'Enable rule'}">
                    <input type="checkbox" data-rule-action="toggle" ${active ? 'checked' : ''} aria-label="Rule active">
                    <span class="mini-track"></span>
                </label>
                <button class="rule-icon-btn" data-rule-action="edit" title="Edit rule" aria-label="Edit rule">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="rule-icon-btn rule-icon-btn-danger" data-rule-action="delete" title="Delete rule" aria-label="Delete rule">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Rule actions
// ---------------------------------------------------------------------------

function toggleRule(ruleId) {
    const rule = unifiedRules.find((r) => r.id === ruleId);
    if (rule) {
        rule.active = !rule.active;
        saveRules();
        updateRulesDisplay();
        showNotification(rule.active ? 'Rule activated' : 'Rule deactivated', 'success');
    }
}

function editRule(ruleId) {
    const rule = unifiedRules.find((r) => r.id === ruleId);
    if (rule) {
        showRuleModal(rule);
    }
}

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

    // Pre-calculate affected transactions before confirmation
    let previewCount = 0;
    let previewDeleteCount = 0;
    let previewMoveCount = 0;

    monthlyData.forEach((monthData) => {
        monthData.transactions.forEach((transaction) => {
            const result = applyRulesToTransaction(transaction);
            if (result) {
                previewCount++;
                if (result.action === 'delete') {
                    previewDeleteCount++;
                } else if (result.action === 'categorize') {
                    previewMoveCount++;
                }
            }
        });
    });

    if (previewCount === 0) {
        showNotification('No transactions match your active rules', 'info');
        return;
    }

    let confirmMsg = `Apply rules to ${previewCount} matching transaction(s)?`;
    if (previewDeleteCount > 0) confirmMsg += `\n- ${previewDeleteCount} will be deleted`;
    if (previewMoveCount > 0) confirmMsg += `\n- ${previewMoveCount} will be re-categorized`;

    if (!confirm(confirmMsg)) {
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

// Initialize on load
if (typeof window.rulesInitialized === 'undefined') {
    window.rulesInitialized = true;
    window.addEventListener('DOMContentLoaded', () => {
        loadRules();
        updateRulesDisplay();
    });
}
