// js/analytics.js - Analytics Module

// Analytics Module
let analyticsData = {
    charts: {},
    currentDateRange: null,
    searchResults: [],
};

// Initialize analytics
window.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();

    // Check if there's any data
    if (!analyticsData.monthlyData || analyticsData.monthlyData.size === 0) {
        showAnalyticsGlobalEmptyState();
        return;
    }

    initializeDateRangeSelectors();
    loadOverviewView();
});

function showAnalyticsGlobalEmptyState() {
    const emptyStateHTML = `
        <div class="analytics-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <h2>No Analytics Data Available</h2>
            <p>Upload your transaction data on the Dashboard first to see detailed analytics and spending insights.</p>
            <button class="btn btn-primary" onclick="window.location.href='index.html'">
                Go to Dashboard
            </button>
        </div>
    `;

    // Hide controls and tabs
    const controls = document.querySelector('.analytics-controls');
    const tabs = document.querySelector('.analytics-tabs');
    if (controls) controls.style.display = 'none';
    if (tabs) tabs.style.display = 'none';

    // Hide all views first
    document.querySelectorAll('.analytics-view').forEach((view) => {
        view.style.display = 'none';
    });

    // Show empty state only in the overview view
    const overviewView = document.getElementById('overviewView');
    if (overviewView) {
        overviewView.innerHTML = emptyStateHTML;
        overviewView.style.display = 'flex';
        overviewView.style.alignItems = 'center';
        overviewView.style.justifyContent = 'center';
        overviewView.style.minHeight = '400px';
        overviewView.style.textAlign = 'center';
    }
}

// Load data from localStorage
function loadDataFromStorage() {
    try {
        const saved = localStorage.getItem('sahabBudget_data');
        if (saved) {
            const data = JSON.parse(saved);
            analyticsData.monthlyData = new Map(data.monthlyData || []);
            analyticsData.categoryConfig = data.categoryConfig || {};
            analyticsData.transactionOverrides = data.transactionOverrides || {};
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Initialize date range selectors
function initializeDateRangeSelectors() {
    if (!analyticsData.monthlyData || analyticsData.monthlyData.size === 0) return;

    const months = Array.from(analyticsData.monthlyData.keys()).sort();
    document.getElementById('startMonth').value = months[0];
    document.getElementById('endMonth').value = months[months.length - 1];
}

// Switch analytics tab
function switchAnalyticsTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.analytics-tab').forEach((b) => b.classList.remove('active'));
    document.querySelector(`.analytics-tab[data-tab="${tab}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.analytics-view').forEach((v) => v.classList.remove('active'));
    document.getElementById(tab + 'View').classList.add('active');

    // Show/hide date controls based on tab
    const controls = document.getElementById('analyticsControls');
    if (controls) {
        controls.style.display = tab === 'search' ? 'none' : 'block';
    }

    // Load the appropriate view
    switch (tab) {
        case 'overview':
            loadOverviewView();
            break;
        case 'trends':
            loadTrendsView();
            break;
        case 'categories':
            loadCategoriesView();
            break;
        case 'merchants':
            loadMerchantsView();
            break;
        case 'search':
            showSearchPrompt();
            document.getElementById('transactionSearch').focus();
            break;
    }
}

// Show search prompt
function showSearchPrompt() {
    const container = document.getElementById('searchResults');
    container.innerHTML = `
        <div class="search-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h3>Search Your Transactions</h3>
            <p>Type in the search box above to find transactions by description or amount</p>
            <div class="search-tips">
                <h4>Try searching for:</h4>
                <ul>
                    <li>Merchant names (e.g., "Amazon", "Walmart")</li>
                    <li>Transaction amounts (e.g., "25.99")</li>
                    <li>Keywords (e.g., "food", "gas")</li>
                </ul>
            </div>
        </div>
    `;
}

// Apply date range filter
function applyDateRange() {
    const startMonth = document.getElementById('startMonth').value;
    const endMonth = document.getElementById('endMonth').value;

    if (!startMonth || !endMonth) {
        alert('Please select both start and end months');
        return;
    }

    analyticsData.currentDateRange = { start: startMonth, end: endMonth };

    // Reload current view with new date range
    const activeTab = document.querySelector('.analytics-tab.active');
    if (activeTab) {
        const tabName = activeTab.dataset.tab;
        switchAnalyticsTab(tabName);
    }
}

// Reset date range
function resetDateRange() {
    analyticsData.currentDateRange = null;
    initializeDateRangeSelectors();

    const activeTab = document.querySelector('.analytics-tab.active');
    if (activeTab) {
        const tabName = activeTab.dataset.tab;
        switchAnalyticsTab(tabName);
    }
}

// Get filtered months based on date range
function getFilteredMonths() {
    let months = Array.from(analyticsData.monthlyData.keys()).sort();

    if (analyticsData.currentDateRange) {
        months = months.filter(
            (month) =>
                month >= analyticsData.currentDateRange.start &&
                month <= analyticsData.currentDateRange.end
        );
    }

    return months;
}

// Load Overview View
function loadOverviewView() {
    const months = getFilteredMonths();

    if (months.length === 0) {
        showAnalyticsEmptyState('overviewView', 'Overview');
        return;
    }

    // Calculate aggregated data
    let totalSpending = 0;
    let transactionCount = 0;
    const categoryTotals = {};
    const merchantTotals = {};
    const monthlyTotals = [];
    let allTransactions = [];

    months.forEach((monthKey) => {
        const monthData = analyticsData.monthlyData.get(monthKey);
        let monthTotal = 0;

        monthData.transactions.forEach((transaction) => {
            const amount = Math.abs(parseFloat(transaction.Amount) || 0);
            const description = transaction.Description || transaction.description || 'Unknown';
            const category = categorizeTransactionForAnalytics(description, transaction._id);

            totalSpending += amount;
            monthTotal += amount;
            transactionCount++;

            // Track categories
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += amount;

            // Track merchants
            if (!merchantTotals[description]) {
                merchantTotals[description] = { total: 0, count: 0 };
            }
            merchantTotals[description].total += amount;
            merchantTotals[description].count++;

            // Collect all transactions for recent activity
            allTransactions.push({
                ...transaction,
                parsedAmount: amount,
                monthName: monthData.monthName,
                parsedDate: new Date(
                    transaction['Transaction Date'] ||
                    transaction['Posting Date'] ||
                    transaction['Post Date'] ||
                    transaction.Date ||
                    transaction.date ||
                    transaction['Trans Date'] ||
                    transaction['Trans. Date'] ||
                    transaction['Posted Date']
                ),
            });
        });

        monthlyTotals.push({
            month: monthData.monthName,
            total: monthTotal,
        });
    });

    // Sort transactions by date for recent activity
    allTransactions.sort((a, b) => b.parsedDate - a.parsedDate);
    const recentTransactions = allTransactions.slice(0, 5);

    // Sort categories and merchants
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const sortedMerchants = Object.entries(merchantTotals).sort((a, b) => b[1].total - a[1].total);

    // Calculate averages
    const avgMonthly = totalSpending / months.length;
    const avgTransaction = totalSpending / transactionCount;

    // Render Quick Stats
    renderQuickStats(totalSpending, avgMonthly, transactionCount, avgTransaction);

    // Render Spending Summary
    renderSpendingSummary(totalSpending, avgMonthly, months);

    // Render Top Categories
    renderTopCategories(sortedCategories, totalSpending);

    // Render Recent Activity
    renderRecentActivity(recentTransactions);

    // Render Top Merchants
    renderTopMerchants(sortedMerchants.slice(0, 5));

    // Render Overview Chart
    renderOverviewChart(monthlyTotals);
}

function renderQuickStats(totalSpending, avgMonthly, transactionCount, avgTransaction) {
    const html = `
        <div class="quick-stat">
            <div class="quick-stat-icon primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
            </div>
            <h4>Total Spending</h4>
            <div class="value">$${totalSpending.toFixed(2)}</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-icon success">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            </div>
            <h4>Monthly Average</h4>
            <div class="value">$${avgMonthly.toFixed(2)}</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-icon warning">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
            </div>
            <h4>Transactions</h4>
            <div class="value">${transactionCount.toLocaleString()}</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-icon info">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h4>Avg Transaction</h4>
            <div class="value">$${avgTransaction.toFixed(2)}</div>
        </div>
    `;

    document.getElementById('quickStats').innerHTML = html;
}

function renderSpendingSummary(totalSpending, avgMonthly, months) {
    const html = `
        <div class="spending-summary-grid">
            <div class="summary-item">
                <h5>Total Spent</h5>
                <div class="amount">$${totalSpending.toFixed(2)}</div>
                <div class="period">${months.length} month${months.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="summary-item">
                <h5>Monthly Average</h5>
                <div class="amount">$${avgMonthly.toFixed(2)}</div>
                <div class="period">per month</div>
            </div>
        </div>
    `;

    document.getElementById('spendingSummary').innerHTML = html;
}

function renderTopCategories(sortedCategories, totalSpending) {
    const top5 = sortedCategories.slice(0, 5);
    const maxAmount = top5.length > 0 ? top5[0][1] : 1;

    const html = `
        <div class="category-list">
            ${top5.map(([category, amount], index) => `
                <div class="category-item">
                    <div class="category-color" style="background: ${getChartColor(index)}"></div>
                    <div class="category-info">
                        <h5>${category}</h5>
                        <div class="category-bar">
                            <div class="category-bar-fill" style="width: ${(amount / maxAmount) * 100}%; background: ${getChartColor(index)}"></div>
                        </div>
                    </div>
                    <div class="category-amount">$${amount.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('topCategories').innerHTML = html;
}

function renderRecentActivity(transactions) {
    const categoryIcons = {
        'Food & Dining': '🍽️',
        'Shopping': '🛍️',
        'Transportation': '🚗',
        'Entertainment': '🎬',
        'Bills & Utilities': '💡',
        'Health': '🏥',
        'Travel': '✈️',
        'Education': '📚',
        'Groceries': '🛒',
        'Others': '📋',
    };

    const html = `
        <div class="activity-list">
            ${transactions.map((tx) => {
                const description = tx.Description || tx.description || 'Unknown';
                const category = categorizeTransactionForAnalytics(description, tx._id);
                const icon = categoryIcons[category] || '💳';
                const dateStr = tx.parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return `
                    <div class="activity-item">
                        <div class="activity-icon">${icon}</div>
                        <div class="activity-details">
                            <h5>${description.length > 30 ? description.substring(0, 30) + '...' : description}</h5>
                            <span>${dateStr} • ${category}</span>
                        </div>
                        <div class="activity-amount">$${tx.parsedAmount.toFixed(2)}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    document.getElementById('recentActivity').innerHTML = html;
}

function renderTopMerchants(merchants) {
    const html = `
        <div class="merchant-mini-list">
            ${merchants.map(([name, data], index) => `
                <div class="merchant-mini-item">
                    <div class="merchant-rank ${index === 0 ? 'top' : ''}">${index + 1}</div>
                    <div class="merchant-mini-info">
                        <h5>${name.length > 25 ? name.substring(0, 25) + '...' : name}</h5>
                        <span>${data.count} transaction${data.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="merchant-mini-amount">$${data.total.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('topMerchants').innerHTML = html;
}

function renderOverviewChart(monthlyTotals) {
    // Destroy existing chart
    if (analyticsData.charts.overview) {
        analyticsData.charts.overview.destroy();
    }

    const ctx = document.getElementById('overviewChart').getContext('2d');
    analyticsData.charts.overview = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthlyTotals.map((m) => m.month),
            datasets: [
                {
                    label: 'Monthly Spending',
                    data: monthlyTotals.map((m) => m.total),
                    backgroundColor: 'rgba(8, 145, 178, 0.8)',
                    borderColor: 'rgba(8, 145, 178, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: (context) => '$' + context.parsed.y.toFixed(2),
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + value.toFixed(0),
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
        },
    });
}

function showAnalyticsEmptyState(viewId, title) {
    const view = document.getElementById(viewId);
    const emptyHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--gray);">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gray-300); margin-bottom: 20px;">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <h3 style="color: var(--dark); margin-bottom: 10px;">No Data for ${title}</h3>
            <p style="font-size: 14px; text-align: center; max-width: 400px;">
                Upload your transaction data to see detailed analytics and insights about your spending patterns
            </p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="window.location.href='index.html'">
                Go to Dashboard
            </button>
        </div>
    `;

    view.innerHTML = emptyHTML;
}

// Load trends view
function loadTrendsView() {
    const months = getFilteredMonths();

    if (months.length === 0) {
        showAnalyticsEmptyState('trendsView', 'Spending Trends');
        return;
    }

    // Prepare data for chart
    const labels = [];
    const datasets = {};
    const totals = [];

    months.forEach((monthKey) => {
        const monthData = analyticsData.monthlyData.get(monthKey);
        labels.push(monthData.monthName);

        const analyzer = analyzeMonthTransactions(monthData.transactions);
        totals.push(analyzer.totalExpenses);

        // Track by category
        Object.entries(analyzer.categoryTotals).forEach(([category, amount]) => {
            if (!datasets[category]) {
                datasets[category] = new Array(months.length).fill(0);
            }
            const index = labels.length - 1;
            datasets[category][index] = amount;
        });
    });

    // Destroy existing chart
    if (analyticsData.charts.trends) {
        analyticsData.charts.trends.destroy();
    }

    // Create trends chart
    const ctx = document.getElementById('trendsChart').getContext('2d');
    analyticsData.charts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: Object.entries(datasets).map(([category, data], index) => ({
                label: category,
                data: data,
                borderColor: getChartColor(index),
                backgroundColor: getChartColor(index, 0.1),
                tension: 0.3,
                fill: true,
            })),
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + value.toFixed(0),
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
        },
    });

    // Update stats
    updateTrendsStats(totals, labels);
}

// Load categories view
function loadCategoriesView() {
    const months = getFilteredMonths();

    if (months.length === 0) {
        showAnalyticsEmptyState('categoriesView', 'Category Analysis');
        return;
    }

    // Aggregate category data
    const categoryTotals = {};
    let totalSpending = 0;

    months.forEach((monthKey) => {
        const monthData = analyticsData.monthlyData.get(monthKey);
        monthData.transactions.forEach((transaction) => {
            const amount = Math.abs(parseFloat(transaction.Amount) || 0);
            const description = transaction.Description || transaction.description || '';
            const category = categorizeTransactionForAnalytics(description, transaction._id);

            if (!categoryTotals[category]) {
                categoryTotals[category] = { total: 0, count: 0 };
            }

            categoryTotals[category].total += amount;
            categoryTotals[category].count += 1;
            totalSpending += amount;
        });
    });

    // Sort by total
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total);

    // Destroy existing chart
    if (analyticsData.charts.categories) {
        analyticsData.charts.categories.destroy();
    }

    // Create chart
    const ctx = document.getElementById('categoryChart').getContext('2d');
    analyticsData.charts.categories = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories.map(([name]) => name),
            datasets: [
                {
                    data: sortedCategories.map(([_, data]) => data.total),
                    backgroundColor: sortedCategories.map((_, i) => getChartColor(i)),
                    borderWidth: 2,
                    borderColor: '#fff',
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 12 },
                        padding: 15,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const percent = ((context.parsed / totalSpending) * 100).toFixed(1);
                            return `$${context.parsed.toFixed(2)} (${percent}%)`;
                        },
                    },
                },
            },
        },
    });

    // Update category breakdown
    updateCategoryBreakdown(sortedCategories, totalSpending);
}

function updateCategoryBreakdown(categories, totalSpending) {
    const html = `
        <h3>Category Breakdown</h3>
        ${categories.map(([name, data], index) => {
            const percent = ((data.total / totalSpending) * 100).toFixed(1);
            return `
                <div class="breakdown-item">
                    <div class="breakdown-color" style="background: ${getChartColor(index)}"></div>
                    <div class="breakdown-info">
                        <h4>${name}</h4>
                        <span>${data.count} transaction${data.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="breakdown-amount">
                        <div class="total">$${data.total.toFixed(2)}</div>
                        <div class="percent">${percent}%</div>
                    </div>
                </div>
            `;
        }).join('')}
    `;

    document.getElementById('categoryBreakdown').innerHTML = html;
}

// Load merchants view
function loadMerchantsView() {
    const months = getFilteredMonths();

    if (months.length === 0) {
        showAnalyticsEmptyState('merchantsView', 'Merchant Analysis');
        return;
    }

    // Aggregate merchant data
    const merchantTotals = {};

    months.forEach((monthKey) => {
        const monthData = analyticsData.monthlyData.get(monthKey);
        monthData.transactions.forEach((transaction) => {
            const description = transaction.Description || transaction.description || 'Unknown';
            const amount = Math.abs(parseFloat(transaction.Amount) || 0);

            if (!merchantTotals[description]) {
                merchantTotals[description] = { total: 0, count: 0, transactions: [] };
            }

            merchantTotals[description].total += amount;
            merchantTotals[description].count += 1;
            merchantTotals[description].transactions.push({
                amount: amount,
                date:
                    transaction['Transaction Date'] ||
                    transaction['Posting Date'] ||
                    transaction['Post Date'] ||
                    transaction.Date ||
                    transaction.date ||
                    transaction['Trans Date'] ||
                    transaction['Trans. Date'] ||
                    transaction['Posted Date'],
            });
        });
    });

    // Sort by total amount
    const sortedMerchants = Object.entries(merchantTotals).sort((a, b) => b[1].total - a[1].total);

    // Top 10 for chart
    const top10 = sortedMerchants.slice(0, 10);

    // Destroy existing chart
    if (analyticsData.charts.merchants) {
        analyticsData.charts.merchants.destroy();
    }

    // Create chart
    const ctx = document.getElementById('merchantChart').getContext('2d');
    analyticsData.charts.merchants = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: top10.map(([name]) =>
                name.length > 30 ? name.substring(0, 30) + '...' : name
            ),
            datasets: [
                {
                    data: top10.map(([_, data]) => data.total),
                    backgroundColor: top10.map((_, i) => getChartColor(i)),
                    borderWidth: 2,
                    borderColor: '#fff',
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 11 },
                        padding: 12,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return '$' + context.parsed.toFixed(2);
                        },
                    },
                },
            },
        },
    });

    // Update merchant list
    updateMerchantList(sortedMerchants);
}

// Search transactions
function searchTransactions(query) {
    if (!query || query.trim() === '') {
        showSearchPrompt();
        return;
    }

    const searchTerm = query.toLowerCase();
    const results = [];

    const months = getFilteredMonths();
    months.forEach((monthKey) => {
        const monthData = analyticsData.monthlyData.get(monthKey);
        monthData.transactions.forEach((transaction) => {
            const description = (
                transaction.Description ||
                transaction.description ||
                ''
            ).toLowerCase();
            const amount = Math.abs(parseFloat(transaction.Amount) || 0).toString();

            if (description.includes(searchTerm) || amount.includes(searchTerm)) {
                results.push({
                    ...transaction,
                    monthKey: monthKey,
                    monthName: monthData.monthName,
                    parsedAmount: Math.abs(parseFloat(transaction.Amount) || 0),
                    parsedDate: new Date(
                        transaction['Transaction Date'] ||
                            transaction['Posting Date'] ||
                            transaction['Post Date'] ||
                            transaction.Date ||
                            transaction.date ||
                            transaction['Trans Date'] ||
                            transaction['Trans. Date'] ||
                            transaction['Posted Date']
                    ),
                });
            }
        });
    });

    // Store results globally for sorting
    analyticsData.searchResults = results;
    analyticsData.searchTerm = searchTerm;
    analyticsData.currentSort = { field: 'date', direction: 'desc' };

    displaySearchResults(results, searchTerm);
}

function sortSearchResults(field) {
    if (!analyticsData.searchResults) return;

    // Toggle direction if clicking same field
    if (analyticsData.currentSort.field === field) {
        analyticsData.currentSort.direction =
            analyticsData.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        analyticsData.currentSort.field = field;
        analyticsData.currentSort.direction = field === 'amount' ? 'desc' : 'asc';
    }

    const sorted = [...analyticsData.searchResults].sort((a, b) => {
        let compareValue = 0;

        switch (field) {
            case 'date':
                compareValue = a.parsedDate - b.parsedDate;
                break;
            case 'description':
                compareValue = (a.Description || a.description || '').localeCompare(
                    b.Description || b.description || ''
                );
                break;
            case 'amount':
                compareValue = a.parsedAmount - b.parsedAmount;
                break;
            case 'month':
                compareValue = a.monthKey.localeCompare(b.monthKey);
                break;
        }

        return analyticsData.currentSort.direction === 'asc' ? compareValue : -compareValue;
    });

    displaySearchResults(sorted, analyticsData.searchTerm);
}

// Display search results
function displaySearchResults(results, searchTerm) {
    const container = document.getElementById('searchResults');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="search-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No Results Found</h3>
                <p>No transactions found matching "${searchTerm}". Try a different search term.</p>
            </div>
        `;
        return;
    }

    const sortIndicator = (field) => {
        if (!analyticsData.currentSort || analyticsData.currentSort.field !== field) {
            return '<span style="opacity: 0.3">↕</span>';
        }
        return analyticsData.currentSort.direction === 'asc' ? '↑' : '↓';
    };

    const totalAmount = results.reduce((sum, tx) => sum + tx.parsedAmount, 0);

    const html = `
        <div class="search-results-header-bar">
            <h3>Found ${results.length} transaction${results.length === 1 ? '' : 's'} totaling $${totalAmount.toFixed(2)}</h3>
            <button class="btn btn-secondary btn-sm" onclick="exportSearchResults()">Export Results</button>
        </div>
        <div class="search-results-table">
            <div class="search-results-header">
                <div class="sortable" onclick="sortSearchResults('date')">
                    Date ${sortIndicator('date')}
                </div>
                <div class="sortable" onclick="sortSearchResults('description')">
                    Description ${sortIndicator('description')}
                </div>
                <div class="sortable" onclick="sortSearchResults('month')">
                    Month ${sortIndicator('month')}
                </div>
                <div class="sortable" onclick="sortSearchResults('amount')">
                    Amount ${sortIndicator('amount')}
                </div>
            </div>
            ${results
                .map((transaction) => {
                    const description = transaction.Description || transaction.description || '';
                    const highlightedDesc = highlightText(description, searchTerm);
                    const amount = Math.abs(parseFloat(transaction.Amount) || 0);
                    const date =
                        transaction['Transaction Date'] || transaction.Date || transaction.date;

                    return `
                    <div class="search-result-item">
                        <div data-label="Date">${new Date(date).toLocaleDateString()}</div>
                        <div data-label="Description" title="${description}">${highlightedDesc}</div>
                        <div data-label="Month">${transaction.monthName}</div>
                        <div data-label="Amount">$${amount.toFixed(2)}</div>
                    </div>
                `;
                })
                .join('')}
        </div>
    `;

    container.innerHTML = html;
}

function exportSearchResults() {
    if (!analyticsData.searchResults || analyticsData.searchResults.length === 0) {
        alert('No search results to export');
        return;
    }

    let csvContent = 'Date,Description,Month,Amount\n';

    analyticsData.searchResults.forEach((transaction) => {
        const date = transaction['Transaction Date'] || transaction.Date || transaction.date;
        const description = transaction.Description || transaction.description || '';
        const amount = Math.abs(parseFloat(transaction.Amount) || 0);

        // Escape commas and quotes
        const escapedDesc =
            description.includes(',') || description.includes('"')
                ? `"${description.replace(/"/g, '""')}"`
                : description;

        csvContent += `${date},${escapedDesc},${transaction.monthName},${amount.toFixed(2)}\n`;
    });

    downloadFile(csvContent, `search-results-${Date.now()}.csv`, 'text/csv');
}

// Highlight text helper
function highlightText(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Helper functions
function analyzeMonthTransactions(transactions) {
    const categoryTotals = {};
    Object.keys(analyticsData.categoryConfig).forEach((cat) => {
        categoryTotals[cat] = 0;
    });

    transactions.forEach((transaction) => {
        const amount = Math.abs(parseFloat(transaction.Amount) || 0);
        const description = transaction.Description || transaction.description || '';
        const category = categorizeTransactionForAnalytics(description, transaction._id);

        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += amount;
    });

    return {
        categoryTotals,
        totalExpenses: Object.values(categoryTotals).reduce((a, b) => a + b, 0),
    };
}

function categorizeTransactionForAnalytics(description, transactionId) {
    // Check for overrides
    for (const [monthKey, overrides] of Object.entries(analyticsData.transactionOverrides)) {
        if (overrides[transactionId]) {
            return overrides[transactionId];
        }
    }

    const upperDesc = description.toUpperCase();
    for (const [category, config] of Object.entries(analyticsData.categoryConfig)) {
        if (category === 'Others') continue;
        if (config.keywords && config.keywords.length > 0) {
            for (const keyword of config.keywords) {
                if (upperDesc.includes(keyword)) {
                    return category;
                }
            }
        }
    }

    return 'Others';
}

function getChartColor(index, alpha = 1) {
    const colors = [
        `rgba(8, 145, 178, ${alpha})`, // primary cyan
        `rgba(139, 92, 246, ${alpha})`, // violet
        `rgba(236, 72, 153, ${alpha})`, // pink
        `rgba(16, 185, 129, ${alpha})`, // green
        `rgba(245, 158, 11, ${alpha})`, // yellow
        `rgba(239, 68, 68, ${alpha})`, // red
        `rgba(59, 130, 246, ${alpha})`, // blue
        `rgba(99, 102, 241, ${alpha})`, // indigo
        `rgba(107, 114, 128, ${alpha})`, // gray
        `rgba(251, 146, 60, ${alpha})`, // orange
    ];
    return colors[index % colors.length];
}

// Update stats functions
function updateTrendsStats(totals, labels) {
    const average = totals.reduce((a, b) => a + b, 0) / totals.length;
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    const maxIndex = totals.indexOf(max);
    const minIndex = totals.indexOf(min);

    const html = `
        <div class="stat-card">
            <h4>Average Monthly</h4>
            <div class="value">$${average.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <h4>Highest Month</h4>
            <div class="value">$${max.toFixed(2)}</div>
            <div class="change">${labels[maxIndex]}</div>
        </div>
        <div class="stat-card">
            <h4>Lowest Month</h4>
            <div class="value">$${min.toFixed(2)}</div>
            <div class="change">${labels[minIndex]}</div>
        </div>
        <div class="stat-card">
            <h4>Total Spending</h4>
            <div class="value">$${totals.reduce((a, b) => a + b, 0).toFixed(2)}</div>
        </div>
    `;

    document.getElementById('trendsStats').innerHTML = html;
}

function updateMerchantList(merchants) {
    const html = `
        <h3>All Merchants</h3>
        ${merchants
            .map(
                ([name, data]) => `
            <div class="merchant-item">
                <div class="merchant-info">
                    <h4>${name}</h4>
                    <span>${data.count} transaction${data.count === 1 ? '' : 's'}</span>
                </div>
                <div class="merchant-amount">
                    <div class="total">$${data.total.toFixed(2)}</div>
                    <div class="count">Avg: $${(data.total / data.count).toFixed(2)}</div>
                </div>
            </div>
        `
            )
            .join('')}
    `;

    document.getElementById('merchantList').innerHTML = html;
}
