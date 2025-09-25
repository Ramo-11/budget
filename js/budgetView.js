// js/budgetview.js - Budget Goals View Module

let budgetViewChart = null;

// Open budget goals view
function openBudgetGoals() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'budgetGoalsModal';

    // Get current viewing context (month or all data)
    const viewingMonth =
        currentMonth === 'ALL_DATA'
            ? 'ALL_DATA'
            : currentMonth === 'CUSTOM_RANGE'
            ? 'CUSTOM_RANGE'
            : currentMonth;

    modal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 1200px;">
            <div class="modal-header">
                <h2>Budget Goals Overview</h2>
                <button class="close-btn" onclick="closeBudgetGoalsModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="budget-view-controls">
                    <div class="view-selector">
                        <label>View:</label>
                        <select id="budgetViewSelector" onchange="updateBudgetGoalsView(this.value)">
                            ${generateBudgetViewOptions(viewingMonth)}
                        </select>
                    </div>
                    <div class="budget-summary" id="budgetSummary"></div>
                </div>
                
                <div class="budget-view-content">
                    <div class="budget-charts-container">
                        <div class="budget-chart-wrapper" style="max-width: 500px;">
                            <canvas id="budgetProgressChart"></canvas>
                        </div>
                        <div class="budget-categories-overview" id="budgetCategoriesOverview"></div>
                    </div>
                    <div class="budget-details-table" id="budgetDetailsTable"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initialize view
    setTimeout(() => {
        updateBudgetGoalsView(viewingMonth);
    }, 100);
}

// Generate budget view options
function generateBudgetViewOptions(selectedValue) {
    let options = '<option value="ALL_DATA">All Months Combined</option>';
    options += '<option disabled>──────────</option>';

    const months = Array.from(monthlyData.keys()).sort().reverse();
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const selected = monthKey === selectedValue ? 'selected' : '';
        options += `<option value="${monthKey}" ${selected}>${monthData.monthName}</option>`;
    });

    return options;
}

// Update budget goals view
function updateBudgetGoalsView(viewKey) {
    let transactions = [];
    let viewLabel = '';
    let monthlyBudgets = {};

    if (viewKey === 'ALL_DATA') {
        // Aggregate all transactions and budgets
        monthlyData.forEach((monthData) => {
            transactions.push(...monthData.transactions);
        });
        viewLabel = 'All Data Combined';

        // Aggregate budgets (use average or sum)
        const allBudgets = {};
        let monthCount = 0;

        Object.keys(budgets).forEach((monthKey) => {
            monthCount++;
            Object.entries(budgets[monthKey]).forEach(([category, amount]) => {
                if (!allBudgets[category]) allBudgets[category] = 0;
                allBudgets[category] += amount;
            });
        });

        // Use average monthly budget for all data view
        Object.keys(allBudgets).forEach((category) => {
            monthlyBudgets[category] = allBudgets[category] / Math.max(1, monthCount);
        });
    } else if (viewKey === 'CUSTOM_RANGE' && window.customDateRange) {
        const start = new Date(window.customDateRange.start);
        const end = new Date(window.customDateRange.end);

        monthlyData.forEach((data) => {
            data.transactions.forEach((t) => {
                const date = new Date(t['Transaction Date'] || t.Date || t.date);
                if (date >= start && date <= end) {
                    transactions.push(t);
                }
            });
        });

        viewLabel = `Custom Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        // Use most recent month's budget for custom range
        const recentMonth = Array.from(monthlyData.keys()).sort().reverse()[0];
        monthlyBudgets = budgets[recentMonth] || {};
    } else {
        // Single month view
        const monthData = monthlyData.get(viewKey);
        if (monthData) {
            transactions = monthData.transactions;
            viewLabel = monthData.monthName;
            monthlyBudgets = budgets[viewKey] || {};
        }
    }

    const analyzer = analyzeTransactions(transactions);

    // Update summary
    updateBudgetSummary(analyzer, monthlyBudgets, viewLabel);

    // Update chart
    updateBudgetProgressChart(analyzer, monthlyBudgets);

    // Update categories overview
    updateBudgetCategoriesOverview(analyzer, monthlyBudgets);

    // Update details table
    updateBudgetDetailsTable(analyzer, monthlyBudgets);
}

// Update budget summary
function updateBudgetSummary(analyzer, monthlyBudgets, viewLabel) {
    const totalBudget = Object.values(monthlyBudgets).reduce((a, b) => a + b, 0);
    const totalSpent = analyzer.totalExpenses;
    const remaining = totalBudget - totalSpent;
    const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Check if no budget is set
    if (totalBudget === 0) {
        const summaryHTML = `
            <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 24px;">⚠️</span>
                    <strong style="color: #92400e; font-size: 16px;">No Budget Goals Set</strong>
                </div>
                <p style="color: #78350f; margin-bottom: 10px; font-size: 14px;">
                    You haven't set any budget goals for this period. Budget goals help you track and control your spending.
                </p>
                <p style="color: #78350f; font-size: 13px;">
                    <strong>How to set budget goals:</strong> Go to <strong>Settings → Categories & Budgets</strong>, 
                    select the month you want to budget for, and enter budget amounts for each category.
                </p>
            </div>
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="summary-label">Period:</span>
                    <strong>${viewLabel}</strong>
                </div>
                <div class="summary-stat">
                    <span class="summary-label">Total Spent:</span>
                    <strong>$${totalSpent.toFixed(2)}</strong>
                </div>
                <div class="summary-stat">
                    <span class="summary-label">Transactions:</span>
                    <strong>${analyzer.transactionCount}</strong>
                </div>
            </div>
        `;

        document.getElementById('budgetSummary').innerHTML = summaryHTML;
        return;
    }

    // Original summary when budget exists
    const summaryHTML = `
        <div class="summary-stats">
            <div class="summary-stat">
                <span class="summary-label">Period:</span>
                <strong>${viewLabel}</strong>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Total Budget:</span>
                <strong>$${totalBudget.toFixed(2)}</strong>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Total Spent:</span>
                <strong>$${totalSpent.toFixed(2)}</strong>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Remaining:</span>
                <strong class="${remaining >= 0 ? 'positive' : 'negative'}">
                    ${remaining >= 0 ? '+' : ''}$${Math.abs(remaining).toFixed(2)}
                </strong>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Used:</span>
                <strong class="${
                    percentUsed > 100 ? 'negative' : percentUsed > 80 ? 'warning' : 'positive'
                }">
                    ${percentUsed.toFixed(1)}%
                </strong>
            </div>
        </div>
    `;

    document.getElementById('budgetSummary').innerHTML = summaryHTML;
}

// Update budget progress chart
function updateBudgetProgressChart(analyzer, monthlyBudgets) {
    // Destroy existing chart
    if (budgetViewChart) {
        budgetViewChart.destroy();
    }

    const categories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const budgetData = [];
    const spentData = [];
    const labels = [];
    const colors = [];

    categories.forEach((category, index) => {
        const budget = monthlyBudgets[category] || 0;
        const spent = analyzer.categoryTotals[category] || 0;

        if (budget > 0 || spent > 0) {
            labels.push(category);
            budgetData.push(budget);
            spentData.push(spent);

            // Color based on budget status
            if (spent > budget) {
                colors.push('rgba(239, 68, 68, 0.7)'); // Red for over budget
            } else if (spent > budget * 0.8) {
                colors.push('rgba(245, 158, 11, 0.7)'); // Yellow for warning
            } else {
                colors.push('rgba(16, 185, 129, 0.7)'); // Green for good
            }
        }
    });

    const ctx = document.getElementById('budgetProgressChart').getContext('2d');
    budgetViewChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Budget',
                    data: budgetData,
                    backgroundColor: 'rgba(79, 70, 229, 0.3)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 2,
                },
                {
                    label: 'Spent',
                    data: spentData,
                    backgroundColor: colors,
                    borderColor: colors.map((c) => c.replace('0.7', '1')),
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Budget vs Actual Spending',
                },
                legend: {
                    position: 'bottom',
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + value.toFixed(0),
                    },
                },
            },
        },
    });
}

// Update budget categories overview
function updateBudgetCategoriesOverview(analyzer, monthlyBudgets) {
    const categories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const cardsHTML = categories
        .map((category) => {
            const budget = monthlyBudgets[category] || 0;
            const spent = analyzer.categoryTotals[category] || 0;
            const remaining = budget - spent;
            const percentage = budget > 0 ? (spent / budget) * 100 : 0;
            const icon = categoryConfig[category]?.icon || '📦';

            if (budget === 0 && spent === 0) return ''; // Skip categories with no activity

            const statusClass =
                budget > 0
                    ? percentage > 100
                        ? 'over-budget'
                        : percentage > 80
                        ? 'warning-budget'
                        : 'within-budget'
                    : 'no-budget';

            const noBudgetWarning =
                budget === 0
                    ? `
    <div class="no-budget-warning" title="No budget set. Go to Settings → Categories & Budgets">
        <span style="cursor: help;">⚠️</span>
    </div>
`
                    : '';

            return `
            <div class="budget-category-card ${statusClass}">
                ${noBudgetWarning}
                <div class="category-header">
                    <span class="category-icon">${icon}</span>
                    <span class="category-name">${category}</span>
                </div>
                <div class="category-amounts">
                    <div class="amount-row">
                        <span>Budget:</span>
                        <strong>${budget > 0 ? '$' + budget.toFixed(2) : 'Not set'}</strong>
                    </div>
                    <div class="amount-row">
                        <span>Spent:</span>
                        <strong>$${spent.toFixed(2)}</strong>
                    </div>
                    ${
                        budget > 0
                            ? `
                        <div class="amount-row">
                            <span>Remaining:</span>
                            <strong class="${remaining >= 0 ? 'positive' : 'negative'}">
                                $${Math.abs(remaining).toFixed(2)}
                            </strong>
                        </div>
                    `
                            : ''
                    }
                </div>
                ${
                    budget > 0
                        ? `
                    <div class="category-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(
                                percentage,
                                100
                            )}%"></div>
                        </div>
                        <span class="progress-text">${percentage.toFixed(0)}%</span>
                    </div>
                `
                        : `
                    <div style="font-size: 11px; color: var(--gray); font-style: italic; margin-top: 8px;">
                        No budget goal set
                    </div>
                `
                }
            </div>
        `;
        })
        .filter((html) => html !== '')
        .join('');

    document.getElementById('budgetCategoriesOverview').innerHTML =
        cardsHTML ||
        '<p style="text-align: center; color: var(--gray);">No budget data available</p>';
}

// Update budget details table
function updateBudgetDetailsTable(analyzer, monthlyBudgets) {
    const categories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const rows = categories
        .map((category) => {
            const budget = monthlyBudgets[category] || 0;
            const spent = analyzer.categoryTotals[category] || 0;
            const remaining = budget - spent;
            const percentage = budget > 0 ? (spent / budget) * 100 : 0;
            const icon = categoryConfig[category]?.icon || '📦';
            const transactionCount = analyzer.categoryDetails[category]?.length || 0;

            if (budget === 0 && spent === 0) return ''; // Skip inactive categories

            const statusColor = remaining >= 0 ? 'var(--success)' : 'var(--danger)';

            return `
            <tr>
                <td><span class="table-icon">${icon}</span> ${category}</td>
                <td class="amount">$${budget.toFixed(2)}</td>
                <td class="amount">$${spent.toFixed(2)}</td>
                <td class="amount" style="color: ${statusColor}; font-weight: 600;">
                    ${remaining >= 0 ? '+' : '-'}$${Math.abs(remaining).toFixed(2)}
                </td>
                <td class="center">${transactionCount}</td>
                <td class="center">
                    <div class="inline-progress">
                        <div class="inline-progress-bar">
                            <div class="inline-progress-fill ${
                                percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : ''
                            }" 
                                 style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                        <span class="progress-label">${percentage.toFixed(0)}%</span>
                    </div>
                </td>
            </tr>
        `;
        })
        .filter((row) => row !== '')
        .join('');

    const tableHTML = `
        <h3>Detailed Budget Breakdown</h3>
        <table class="budget-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Budget</th>
                    <th>Spent</th>
                    <th>Difference</th>
                    <th>Transactions</th>
                    <th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${
                    rows ||
                    '<tr><td colspan="6" style="text-align: center;">No budget data available</td></tr>'
                }
            </tbody>
        </table>
    `;

    document.getElementById('budgetDetailsTable').innerHTML = tableHTML;
}

// Close budget goals modal
function closeBudgetGoalsModal() {
    if (budgetViewChart) {
        budgetViewChart.destroy();
        budgetViewChart = null;
    }

    const modal = document.getElementById('budgetGoalsModal');
    if (modal) {
        modal.remove();
    }
}
