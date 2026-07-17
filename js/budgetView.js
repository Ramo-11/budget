// js/budgetView.js - Budget Goals modal (spending vs budget, per category)
// Spending is computed via window.computeSpendingSummary (comparison.js),
// which excludes income categories, income-flagged transactions, and
// categories excluded from totals. Budgets and spending always use the same
// basis: single month vs that month's budget, all months vs the sum of the
// budgets for the months present.

// Open budget goals view
function openBudgetGoals() {
    const existing = document.getElementById('budgetGoalsModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'budgetGoalsModal';

    // Current viewing context (specific month, all data, or custom range)
    let viewingMonth = 'ALL_DATA';
    if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
        viewingMonth = 'CUSTOM_RANGE';
    } else if (currentMonth && currentMonth !== 'ALL_DATA' && monthlyData.has(currentMonth)) {
        viewingMonth = currentMonth;
    }

    modal.innerHTML = `
        <div class="modal-content bgv-modal">
            <div class="modal-header">
                <h2>Budget Goals</h2>
                <button class="close-btn" onclick="closeBudgetGoalsModal()" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="bgv-toolbar">
                    <label class="bgv-toolbar-label" for="budgetViewSelector">Period</label>
                    <select id="budgetViewSelector" class="bgv-select" onchange="updateBudgetGoalsView(this.value)">
                        ${generateBudgetViewOptions(viewingMonth)}
                    </select>
                </div>
                <div id="budgetSummary"></div>
                <div id="budgetCategoriesOverview" class="bgv-list"></div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeBudgetGoalsModal();
    });

    document.body.appendChild(modal);
    updateBudgetGoalsView(viewingMonth);
}

// Generate budget view options
function generateBudgetViewOptions(selectedValue) {
    let options = `<option value="ALL_DATA" ${
        selectedValue === 'ALL_DATA' ? 'selected' : ''
    }>All Months Combined</option>`;

    if (window.customDateRange) {
        options += `<option value="CUSTOM_RANGE" ${
            selectedValue === 'CUSTOM_RANGE' ? 'selected' : ''
        }>Custom Date Range</option>`;
    }

    const months = Array.from(monthlyData.keys()).sort().reverse();
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const selected = monthKey === selectedValue ? 'selected' : '';
        options += `<option value="${escapeHtml(monthKey)}" ${selected}>${escapeHtml(
            monthData.monthName
        )}</option>`;
    });

    return options;
}

// Sum budgets per category across the given month keys, spending categories only.
function sumBudgetsForMonths(monthKeys) {
    const combined = {};
    monthKeys.forEach((monthKey) => {
        const monthBudgets = budgets[monthKey] || {};
        Object.entries(monthBudgets).forEach(([category, amount]) => {
            const value = Number(amount);
            if (!Number.isFinite(value) || value <= 0) return;
            if (!window.isSpendingCategory(category)) return;
            combined[category] = (combined[category] || 0) + value;
        });
    });
    return combined;
}

// Update budget goals view
function updateBudgetGoalsView(viewKey) {
    let transactions = [];
    let monthlyBudgets = {};
    let caption = '';

    if (viewKey === 'ALL_DATA') {
        const monthKeys = Array.from(monthlyData.keys());
        monthlyData.forEach((monthData) => {
            transactions.push(...monthData.transactions);
        });
        monthlyBudgets = sumBudgetsForMonths(monthKeys);
        caption =
            monthKeys.length > 1
                ? 'Total spending vs budgets summed across ' + monthKeys.length + ' months'
                : '';
    } else if (viewKey === 'CUSTOM_RANGE' && window.customDateRange) {
        const start = window.parseLocalDate(window.customDateRange.start);
        const end = window.parseLocalDate(window.customDateRange.end);
        end.setHours(23, 59, 59, 999);

        monthlyData.forEach((data) => {
            data.transactions.forEach((t) => {
                const date = window.parseLocalDate(t['Transaction Date'] || t.Date || t.date);
                if (!isNaN(date.getTime()) && date >= start && date <= end) {
                    transactions.push(t);
                }
            });
        });

        // Budgets for the months the range touches (consistent basis)
        const startKey = window.monthKeyFromDate(start);
        const endKey = window.monthKeyFromDate(end);
        const monthKeys = Array.from(monthlyData.keys()).filter(
            (key) => key >= startKey && key <= endKey
        );
        monthlyBudgets = sumBudgetsForMonths(monthKeys);
        caption =
            monthKeys.length > 1
                ? 'Range spending vs budgets summed across ' + monthKeys.length + ' months'
                : '';
    } else {
        const monthData = monthlyData.get(viewKey);
        if (monthData) {
            transactions = monthData.transactions;
            const monthBudgets = {};
            Object.entries(budgets[viewKey] || {}).forEach(([category, amount]) => {
                const value = Number(amount);
                if (Number.isFinite(value) && value > 0 && window.isSpendingCategory(category)) {
                    monthBudgets[category] = value;
                }
            });
            monthlyBudgets = monthBudgets;
        }
    }

    const summary = window.computeSpendingSummary(transactions);

    renderBudgetSummary(summary, monthlyBudgets, caption);
    renderBudgetCategories(summary, monthlyBudgets);
}

// Summary tiles + overall progress bar
function renderBudgetSummary(summary, monthlyBudgets, caption) {
    const container = document.getElementById('budgetSummary');
    if (!container) return;

    const totalBudget = Object.values(monthlyBudgets).reduce((a, b) => a + b, 0);
    const totalSpent = summary.total;
    const remaining = totalBudget - totalSpent;
    const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    if (totalBudget === 0) {
        container.innerHTML = `
            <div class="bgv-empty">
                <p>No budget goals for this period. Spent so far: <strong>${formatMoney(
                    totalSpent
                )}</strong></p>
                <a class="btn btn-primary btn-sm" href="settings.html">Set budgets</a>
            </div>
        `;
        return;
    }

    const usedClass = percentUsed > 100 ? 'negative' : percentUsed > 85 ? 'warning' : 'positive';
    const barClass = percentUsed > 100 ? 'over' : percentUsed > 85 ? 'warn' : '';

    container.innerHTML = `
        <div class="bgv-stats">
            <div class="bgv-stat">
                <span>Budget</span>
                <strong>${formatMoney(totalBudget)}</strong>
            </div>
            <div class="bgv-stat">
                <span>Spent</span>
                <strong>${formatMoney(totalSpent)}</strong>
            </div>
            <div class="bgv-stat">
                <span>${remaining >= 0 ? 'Left' : 'Over'}</span>
                <strong class="${remaining >= 0 ? 'positive' : 'negative'}">${formatMoney(
        remaining
    )}</strong>
            </div>
            <div class="bgv-stat">
                <span>Used</span>
                <strong class="${usedClass}">${percentUsed.toFixed(0)}%</strong>
            </div>
        </div>
        <div class="bgv-overall">
            <div class="bgv-overall-fill ${barClass}" style="width: ${Math.min(
        percentUsed,
        100
    )}%"></div>
        </div>
        ${caption ? `<p class="bgv-caption">${caption}</p>` : ''}
    `;
}

// Per-category rows: icon chip + name + spent/budget + progress bar
function renderBudgetCategories(summary, monthlyBudgets) {
    const container = document.getElementById('budgetCategoriesOverview');
    if (!container) return;

    const categories = [
        ...new Set([...Object.keys(summary.byCategory), ...Object.keys(monthlyBudgets)]),
    ].filter((category) => {
        if (!window.isSpendingCategory(category)) return false;
        const spent = summary.byCategory[category] || 0;
        const budget = monthlyBudgets[category] || 0;
        return spent > 0 || budget > 0;
    });

    // Budgeted categories first (most used first), then unbudgeted by spend.
    categories.sort((a, b) => {
        const budgetA = monthlyBudgets[a] || 0;
        const budgetB = monthlyBudgets[b] || 0;
        if (budgetA > 0 && budgetB > 0) {
            const pctA = (summary.byCategory[a] || 0) / budgetA;
            const pctB = (summary.byCategory[b] || 0) / budgetB;
            return pctB - pctA;
        }
        if (budgetA > 0) return -1;
        if (budgetB > 0) return 1;
        return (summary.byCategory[b] || 0) - (summary.byCategory[a] || 0);
    });

    const rows = categories
        .map((category) => {
            const spent = summary.byCategory[category] || 0;
            const budget = monthlyBudgets[category] || 0;

            let statusClass = 'nobudget';
            let fillColor = getCategoryColorVar(category);
            let width = 0;
            let deltaClass = 'muted';
            let deltaText = 'No budget';

            if (budget > 0) {
                const percentage = (spent / budget) * 100;
                width = Math.min(percentage, 100);
                if (spent > 0 && width < 2) width = 2;

                if (percentage > 100) {
                    statusClass = 'over';
                    fillColor = 'var(--danger)';
                    deltaClass = 'negative';
                    deltaText = formatMoney(spent - budget) + ' over';
                } else {
                    statusClass = percentage > 85 ? 'warn' : 'ok';
                    deltaClass = 'positive';
                    deltaText = formatMoney(budget - spent) + ' left';
                }
            }

            return `
            <div class="bgv-row ${statusClass}">
                ${getCategoryIconChip(category, { size: 36, icon: 18 })}
                <div class="bgv-row-main">
                    <div class="bgv-row-top">
                        <span class="bgv-name">${escapeHtml(category)}</span>
                        <span class="bgv-nums">
                            <strong>${formatMoney(spent)}</strong>${
                budget > 0 ? '<span class="bgv-of"> of ' + formatMoney(budget) + '</span>' : ''
            }
                        </span>
                    </div>
                    <div class="bgv-bar">
                        <div class="bgv-bar-fill" style="width: ${width}%; background: ${fillColor};"></div>
                    </div>
                </div>
                <span class="bgv-delta ${deltaClass}">${deltaText}</span>
            </div>
        `;
        })
        .join('');

    container.innerHTML = rows || '<p class="bgv-none">No spending in this period.</p>';
}

// Close budget goals modal
function closeBudgetGoalsModal() {
    const modal = document.getElementById('budgetGoalsModal');
    if (modal) {
        modal.remove();
    }
}
