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
    loadTrendsView();

    // Hide search box initially
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.style.display = 'none';
    }
});

function showAnalyticsGlobalEmptyState() {
    const emptyStateHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; color: var(--gray);">
            <div style="font-size: 64px; margin-bottom: 20px;">📈</div>
            <h2 style="color: var(--dark); margin-bottom: 10px; font-size: 24px;">No Analytics Data Available</h2>
            <p style="font-size: 15px; text-align: center; max-width: 500px; margin-bottom: 30px;">
                Upload your transaction data on the Dashboard first to see detailed analytics and spending insights.
            </p>
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

    // Show empty state only in the trends view (first/default view)
    const trendsView = document.getElementById('trendsView');
    if (trendsView) {
        trendsView.innerHTML = emptyStateHTML;
        trendsView.style.display = 'block';
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
    document.querySelectorAll('.analytics-view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(tab + 'View').classList.add('active');
    event.target.classList.add('active');

    // Hide/show search box based on tab
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.style.display = tab === 'search' ? 'block' : 'none';
    }

    // Load the appropriate view
    switch (tab) {
        case 'trends':
            loadTrendsView();
            break;
        case 'yearOverYear':
            loadYearOverYearView();
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
        <div style="text-align: center; padding: 60px 20px; color: var(--gray);">
            <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
            <h3 style="color: var(--dark); margin-bottom: 10px;">Search Your Transactions</h3>
            <p style="font-size: 14px; margin-bottom: 20px;">
                Type in the search box above to find transactions by description or amount
            </p>
            <div style="background: var(--light); padding: 15px; border-radius: 8px; display: inline-block;">
                <p style="font-size: 13px; margin: 5px 0;">
                    <strong>Try searching for:</strong>
                </p>
                <p style="font-size: 12px; color: var(--gray); margin: 5px 0;">
                    • Merchant names (e.g., "Amazon", "Walmart")<br>
                    • Transaction amounts (e.g., "25.99")<br>
                    • Keywords (e.g., "food", "gas")
                </p>
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
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabName = activeTab.textContent.trim();
        if (tabName.includes('Trends')) loadTrendsView();
        else if (tabName.includes('Year')) loadYearOverYearView();
        else if (tabName.includes('Merchant')) loadMerchantsView();
    }
}

// Reset date range
function resetDateRange() {
    analyticsData.currentDateRange = null;
    initializeDateRangeSelectors();

    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabName = activeTab.textContent.trim();
        if (tabName.includes('Trends')) loadTrendsView();
        else if (tabName.includes('Year')) loadYearOverYearView();
        else if (tabName.includes('Merchant')) loadMerchantsView();
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
                },
            },
        },
    });

    // Update stats
    updateTrendsStats(totals, labels);
}

function showAnalyticsEmptyState(viewId, title) {
    const view = document.getElementById(viewId);
    const emptyHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--gray);">
            <div style="font-size: 64px; margin-bottom: 20px;">📈</div>
            <h3 style="color: var(--dark); margin-bottom: 10px;">No Data for ${title}</h3>
            <p style="font-size: 14px; text-align: center; max-width: 400px;">
                Upload your transaction data to see detailed analytics and insights about your spending patterns
            </p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="window.location.href='index.html'">
                Go to Dashboard
            </button>
        </div>
    `;

    const statsGrid = view.querySelector('.stats-grid');
    const chartContainer = view.querySelector('.chart-container');

    if (statsGrid) statsGrid.style.display = 'none';
    if (chartContainer) chartContainer.innerHTML = emptyHTML;
}

// Load year over year view
function loadYearOverYearView() {
    const months = getFilteredMonths();

    if (months.length === 0) {
        showAnalyticsEmptyState('yearOverYearView', 'Year Over Year Comparison');
        return;
    }

    // Group by month (ignoring year)
    const yearData = {};

    months.forEach((monthKey) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(monthKey + '-01').toLocaleDateString('en-US', {
            month: 'short',
        });

        if (!yearData[monthName]) {
            yearData[monthName] = {};
        }

        const monthData = analyticsData.monthlyData.get(monthKey);
        const analyzer = analyzeMonthTransactions(monthData.transactions);
        yearData[monthName][year] = analyzer.totalExpenses;
    });

    // Prepare chart data
    const labels = Object.keys(yearData).sort((a, b) => {
        const monthOrder = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];
        return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });

    const years = [...new Set(months.map((m) => m.split('-')[0]))].sort();
    const datasets = years.map((year, index) => ({
        label: year,
        data: labels.map((month) => yearData[month][year] || 0),
        borderColor: getChartColor(index),
        backgroundColor: getChartColor(index, 0.1),
    }));

    // Destroy existing chart
    if (analyticsData.charts.yoy) {
        analyticsData.charts.yoy.destroy();
    }

    // Create chart
    const ctx = document.getElementById('yoyChart').getContext('2d');
    analyticsData.charts.yoy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            plugins: {
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

    // Update stats
    updateYoYStats(yearData, years);
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
        // Show the search prompt instead of hiding the view
        showSearchPrompt();
        return;
    }

    // Switch to search view
    document.querySelectorAll('.analytics-view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById('searchView').classList.add('active');
    document.querySelectorAll('.tab-btn')[3].classList.add('active');

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
        container.innerHTML = '<p>No transactions found matching your search.</p>';
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3>Found ${results.length} transaction${results.length === 1 ? '' : 's'}
            totaling $${totalAmount.toFixed(2)}</h3>
            <button class="btn btn-secondary" onclick="exportSearchResults()">Export Results</button>
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
                        <div>${new Date(date).toLocaleDateString()}</div>
                        <div title="${description}">${highlightedDesc}</div>
                        <div>${transaction.monthName}</div>
                        <div>$${amount.toFixed(2)}</div>
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
        `rgba(79, 70, 229, ${alpha})`, // purple
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

function updateYoYStats(yearData, years) {
    if (years.length < 2) {
        document.getElementById('yoyStats').innerHTML =
            '<p>Need at least 2 years of data for comparison</p>';
        return;
    }

    const currentYear = years[years.length - 1];
    const previousYear = years[years.length - 2];

    let currentTotal = 0;
    let previousTotal = 0;

    Object.values(yearData).forEach((monthData) => {
        currentTotal += monthData[currentYear] || 0;
        previousTotal += monthData[previousYear] || 0;
    });

    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 ? (change / previousTotal) * 100 : 0;

    const html = `
        <div class="stat-card">
            <h4>${currentYear} Total</h4>
            <div class="value">$${currentTotal.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <h4>${previousYear} Total</h4>
            <div class="value">$${previousTotal.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <h4>YoY Change</h4>
            <div class="value">$${Math.abs(change).toFixed(2)}</div>
            <div class="change ${change >= 0 ? 'negative' : 'positive'}">
                ${change >= 0 ? '↑' : '↓'} ${Math.abs(changePercent).toFixed(1)}%
            </div>
        </div>
    `;

    document.getElementById('yoyStats').innerHTML = html;
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
