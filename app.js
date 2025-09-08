let pieChart, barChart, trendsLineChart, categoryTrendsChart, monthlyComparisonChart;
let loadedFiles = new Map(); // Store all loaded file data
let currentFileId = null;
let currentView = 'dashboard'; // 'dashboard', 'trends', or 'category-deep'
let currentCategoryAnalysis = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // Navigation buttons
    document.getElementById('dashboardBtn').addEventListener('click', () => switchView('dashboard'));
    document.getElementById('trendsBtn').addEventListener('click', () => switchView('trends'));

    // File upload handler
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
}

function switchView(view) {
    currentView = view;
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(view + 'Btn').classList.add('active');
    
    // Hide category analysis view if it exists
    const categoryView = document.getElementById('categoryAnalysisView');
    if (categoryView) categoryView.style.display = 'none';
    
    // Show/hide views
    if (view === 'dashboard') {
        document.getElementById('dashboard').style.display = loadedFiles.size > 0 ? 'block' : 'none';
        document.getElementById('trendsView').style.display = 'none';
    } else if (view === 'trends') {
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('trendsView').style.display = loadedFiles.size >= 2 ? 'block' : 'none';
        
        if (loadedFiles.size >= 2) {
            updateTrendsView();
        } else {
            showTrendsError();
        }
    }
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    document.getElementById('loading').style.display = 'block';

    try {
        for (const file of files) {
            const fileId = `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const text = await file.text();
            const analyzer = new ExpenseAnalyzer();
            const data = await analyzer.parseCSV(text);
            analyzer.processData(data);
            
            loadedFiles.set(fileId, {
                filename: file.name,
                analyzer: analyzer,
                uploadDate: new Date()
            });
            
            if (!currentFileId) {
                currentFileId = fileId;
            }
        }
        
        updateFileTabs();
        if (currentFileId && currentView === 'dashboard') {
            switchToFile(currentFileId);
        } else if (currentView === 'trends') {
            updateTrendsView();
        }
    } catch (error) {
        alert('Error processing file: ' + error.message);
        console.error(error);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function updateFileTabs() {
    const tabsContainer = document.getElementById('fileTabs');
    const label = tabsContainer.querySelector('div:first-child');
    tabsContainer.innerHTML = '';
    if (label) tabsContainer.appendChild(label);
    
    const tabsWrapper = document.createElement('div');
    tabsWrapper.style.display = 'flex';
    tabsWrapper.style.flexWrap = 'wrap';
    tabsWrapper.style.gap = '10px';
    tabsWrapper.style.justifyContent = 'center';
    
    loadedFiles.forEach((data, fileId) => {
        const tab = document.createElement('div');
        tab.className = `file-tab ${fileId === currentFileId ? 'active' : ''}`;
        tab.innerHTML = `
            ${data.filename}
            <span class="remove-file" onclick="removeFile('${fileId}')">×</span>
        `;
        tab.onclick = (e) => {
            if (!e.target.classList.contains('remove-file')) {
                switchToFile(fileId);
            }
        };
        tabsWrapper.appendChild(tab);
    });
    
    tabsContainer.appendChild(tabsWrapper);
    tabsContainer.style.display = loadedFiles.size > 0 ? 'block' : 'none';
}

function switchToFile(fileId) {
    if (loadedFiles.has(fileId)) {
        currentFileId = fileId;
        const data = loadedFiles.get(fileId);
        updateDashboard(data.analyzer);
        updateFileTabs();
    }
}

function removeFile(fileId) {
    loadedFiles.delete(fileId);
    if (currentFileId === fileId) {
        currentFileId = loadedFiles.keys().next().value || null;
        if (currentFileId && currentView === 'dashboard') {
            switchToFile(currentFileId);
        } else if (currentView === 'dashboard') {
            document.getElementById('dashboard').style.display = 'none';
        }
    }
    updateFileTabs();
    
    // Update trends view if currently viewing trends
    if (currentView === 'trends') {
        if (loadedFiles.size >= 2) {
            updateTrendsView();
        } else {
            showTrendsError();
        }
    }
}

function updateDashboard(analyzer) {
    const totalExpenses = analyzer.getTotalExpenses();
    const nonZeroCategories = Object.entries(analyzer.categoryTotals)
        .filter(([_, value]) => value > 0);
    const stats = analyzer.getStats();

    // Update summary cards
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('dateRange').textContent = analyzer.getDateRange();
    document.getElementById('transactionCount').textContent = analyzer.processedData.length;
    document.getElementById('categoryCount').textContent = nonZeroCategories.length;
    
    // Update new stats
    document.getElementById('highestCategory').textContent = `${stats.highest.name}: $${stats.highest.amount.toFixed(2)}`;
    document.getElementById('lowestCategory').textContent = `${stats.lowest.name}: $${stats.lowest.amount.toFixed(2)}`;
    document.getElementById('avgPerDay').textContent = `$${stats.avgPerDay.toFixed(2)}`;
    document.getElementById('largestTransaction').textContent = `$${stats.largestTransaction.toFixed(2)}`;
    document.getElementById('mostFrequent').textContent = `${stats.mostFrequent.name} (${stats.mostFrequent.count}x)`;
    document.getElementById('smartCategorized').textContent = `${stats.smartCategorized} transactions`;

    // Create charts
    createDashboardCharts(nonZeroCategories, totalExpenses);

    // Update detailed breakdown
    updateCategoryDetails(analyzer.categoryDetails);

    // Show dashboard
    document.getElementById('dashboard').style.display = 'block';
}

function createDashboardCharts(categories, totalExpenses) {
    const labels = categories.map(([name]) => name);
    const values = categories.map(([_, value]) => value);
    
    // Colors for charts
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
        '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
    ];

    // Destroy existing charts
    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();

    // Pie Chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const percentage = ((context.parsed / totalExpenses) * 100).toFixed(1);
                            return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Bar Chart
    const barCtx = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount ($)',
                data: values,
                backgroundColor: colors.slice(0, labels.length).map(color => color + '80'),
                borderColor: colors.slice(0, labels.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `$${value.toFixed(0)}`
                    }
                }
            }
        }
    });
}

function updateCategoryDetails(categoryDetails) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    Object.entries(categoryDetails).forEach(([category, transactions]) => {
        if (transactions.length === 0) return;

        const card = document.createElement('div');
        card.className = 'category-card';

        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4>${category}</h4>
                <button class="deep-analysis-btn" onclick="showCategoryDeepAnalysis('${category}')" 
                        style="background: #667eea; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                    📊 Deep Analysis
                </button>
            </div>
            ${transactions.map(t => `
                <div class="transaction">
                    <div class="transaction-name">${t.name}</div>
                    <div class="transaction-amount ${t.amount < 0 ? 'return' : ''}">
                        $${Math.abs(t.amount).toFixed(2)}${t.amount < 0 ? ' (Return)' : ''}
                    </div>
                </div>
            `).join('')}
            <div class="transaction">
                <div class="transaction-name">Total</div>
                <div class="transaction-amount">$${total.toFixed(2)}</div>
            </div>
        `;

        container.appendChild(card);
    });
}

function updateTrendsView() {
    if (loadedFiles.size < 2) {
        showTrendsError();
        return;
    }

    const trendsAnalyzer = new TrendsAnalyzer(loadedFiles);
    const analysis = trendsAnalyzer.generateTrendsAnalysis();
    
    if (!analysis.canAnalyze) {
        showTrendsError();
        return;
    }

    // Update trends summary
    updateTrendsSummary(analysis.summary);
    
    // Create trends charts
    createTrendsCharts(trendsAnalyzer);
    
    // Update insights
    updateTrendsInsights(analysis.insights);
    
    document.getElementById('trendsView').style.display = 'block';
}

function updateTrendsSummary(summary) {
    const container = document.getElementById('trendsSummary');
    
    const getTrendIcon = (trend) => {
        switch(trend) {
            case 'increasing': return '📈';
            case 'decreasing': return '📉';
            default: return '➡️';
        }
    };
    
    container.innerHTML = `
        <div class="card">
            <h3>Files Analyzed</h3>
            <p>${summary.totalFiles}</p>
        </div>
        <div class="card">
            <h3>Average Monthly</h3>
            <p>$${summary.averageMonthlySpending.toFixed(2)}</p>
        </div>
        <div class="card">
            <h3>Highest Month</h3>
            <p>$${summary.highestMonth.toFixed(2)}</p>
        </div>
        <div class="card">
            <h3>Lowest Month</h3>
            <p>$${summary.lowestMonth.toFixed(2)}</p>
        </div>
        <div class="card">
            <h3>Spending Trend</h3>
            <p>${getTrendIcon(summary.spendingTrend)} ${summary.spendingTrend}</p>
        </div>
        <div class="card">
            <h3>Total Transactions</h3>
            <p>${summary.totalTransactions}</p>
        </div>
    `;
}

function createTrendsCharts(trendsAnalyzer) {
    const chartData = trendsAnalyzer.getChartData();
    if (!chartData) return;

    // Destroy existing charts
    if (trendsLineChart) trendsLineChart.destroy();
    if (categoryTrendsChart) categoryTrendsChart.destroy();
    if (monthlyComparisonChart) monthlyComparisonChart.destroy();

    // Monthly trends line chart
    const lineCtx = document.getElementById('trendsLineChart').getContext('2d');
    trendsLineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: chartData.monthlyTrends.labels,
            datasets: [{
                label: 'Monthly Spending',
                data: chartData.monthlyTrends.values,
                borderColor: '#667eea',
                backgroundColor: '#667eea20',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `$${value.toFixed(0)}`
                    }
                }
            }
        }
    });

    // Category trends chart
    const catCtx = document.getElementById('categoryTrendsChart').getContext('2d');
    categoryTrendsChart = new Chart(catCtx, {
        type: 'bar',
        data: {
            labels: chartData.categoryTrends.labels,
            datasets: [
                {
                    label: 'Current',
                    data: chartData.categoryTrends.current,
                    backgroundColor: '#667eea80',
                    borderColor: '#667eea',
                    borderWidth: 1
                },
                {
                    label: 'Average',
                    data: chartData.categoryTrends.average,
                    backgroundColor: '#f093fb80',
                    borderColor: '#f093fb',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `$${value.toFixed(0)}`
                    }
                }
            }
        }
    });

    // Monthly comparison chart
    if (chartData.comparison) {
        const compCtx = document.getElementById('monthlyComparisonChart').getContext('2d');
        monthlyComparisonChart = new Chart(compCtx, {
            type: 'bar',
            data: {
                labels: chartData.comparison.labels,
                datasets: [
                    {
                        label: chartData.comparison.latestLabel,
                        data: chartData.comparison.latest,
                        backgroundColor: '#667eea80',
                        borderColor: '#667eea',
                        borderWidth: 1
                    },
                    {
                        label: chartData.comparison.previousLabel,
                        data: chartData.comparison.previous,
                        backgroundColor: '#764ba280',
                        borderColor: '#764ba2',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => `$${value.toFixed(0)}`
                        }
                    }
                }
            }
        });
    }
}

function updateTrendsInsights(insights) {
    const container = document.getElementById('trendsInsights');
    
    if (insights.length === 0) {
        container.innerHTML = '<p>No specific insights available at this time.</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #333;">📊 AI-Generated Insights</h3>
        ${insights.map(insight => `
            <div class="insight-card">
                <h4>${insight.title}</h4>
                <p>${insight.message}</p>
            </div>
        `).join('')}
    `;
}

function showTrendsError() {
    const container = document.getElementById('trendsView');
    container.innerHTML = `
        <div class="trends-header">
            <h2>📈 Trends Analysis</h2>
            <p style="color: #e74c3c;">Please upload at least 2 CSV files to analyze trends</p>
        </div>
        <div style="text-align: center; padding: 50px; color: #666;">
            <h3>🔍 Need More Data</h3>
            <p>Upload multiple months of expense data to see spending trends, category comparisons, and AI-generated insights.</p>
        </div>
    `;
}

// Category Deep Analysis Functions
function showCategoryDeepAnalysis(categoryName) {
    if (!currentFileId || !loadedFiles.has(currentFileId)) return;
    
    const fileData = loadedFiles.get(currentFileId);
    const analyzer = new CategoryAnalyzer(fileData.analyzer.categoryDetails, fileData.analyzer.categoryTotals);
    const analysis = analyzer.analyzeCategoryDeep(categoryName);
    
    currentCategoryAnalysis = analysis;
    currentView = 'category-deep';
    
    // Hide other views
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('trendsView').style.display = 'none';
    
    // Show category analysis view
    showCategoryAnalysisView(analysis);
}

function showCategoryAnalysisView(analysis) {
    // Create or get the category analysis container
    let container = document.getElementById('categoryAnalysisView');
    if (!container) {
        container = document.createElement('div');
        container.id = 'categoryAnalysisView';
        container.className = 'category-analysis-view';
        document.querySelector('.container').appendChild(container);
    }
    
    container.style.display = 'block';
    container.innerHTML = generateCategoryAnalysisHTML(analysis);
}

function generateCategoryAnalysisHTML(analysis) {
    if (!analysis.hasData) {
        return `
            <div class="category-analysis-header">
                <button onclick="goBackToDashboard()" class="back-btn">← Back to Dashboard</button>
                <h2>📊 ${analysis.categoryName} Analysis</h2>
                <p style="color: #e74c3c;">${analysis.error}</p>
            </div>
        `;
    }

    const { summary, merchants, spending, temporal, insights } = analysis;
    
    return `
        <div class="category-analysis-header">
            <button onclick="goBackToDashboard()" class="back-btn">← Back to Dashboard</button>
            <h2>📊 ${analysis.categoryName} Deep Analysis</h2>
            <p>Comprehensive insights into your ${analysis.categoryName.toLowerCase()} spending patterns</p>
        </div>

        <!-- Summary Cards -->
        <div class="category-summary-cards">
            <div class="analysis-card">
                <h3>Total Spent</h3>
                <p class="big-number">$${summary.totalAmount.toFixed(2)}</p>
            </div>
            <div class="analysis-card">
                <h3>Transactions</h3>
                <p class="big-number">${summary.totalTransactions}</p>
            </div>
            <div class="analysis-card">
                <h3>Average Amount</h3>
                <p class="big-number">$${summary.averageTransaction.toFixed(2)}</p>
            </div>
            <div class="analysis-card">
                <h3>Largest Purchase</h3>
                <p class="big-number">$${summary.largestTransaction.toFixed(2)}</p>
            </div>
            <div class="analysis-card">
                <h3>Merchants</h3>
                <p class="big-number">${merchants.totalMerchants}</p>
            </div>
            <div class="analysis-card">
                <h3>Frequency</h3>
                <p class="big-number">${temporal.frequency?.pattern || 'N/A'}</p>
            </div>
        </div>

        <!-- AI Insights -->
        ${insights.length > 0 ? `
        <div class="insights-section">
            <h3>🤖 AI Insights</h3>
            <div class="insights-grid">
                ${insights.map(insight => `
                    <div class="insight-card">
                        <h4>${insight.icon} ${insight.title}</h4>
                        <p>${insight.message}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Merchant Analysis -->
        <div class="analysis-section">
            <h3>🏪 Merchant Analysis</h3>
            <div class="merchant-analysis-grid">
                <div class="merchant-section">
                    <h4>Top by Spending</h4>
                    ${merchants.topBySpending.slice(0, 5).map(merchant => `
                        <div class="merchant-item">
                            <span class="merchant-name">${merchant.name}</span>
                            <span class="merchant-stat">$${merchant.total.toFixed(2)} (${merchant.count}x)</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="merchant-section">
                    <h4>Most Frequent</h4>
                    ${merchants.topByFrequency.slice(0, 5).map(merchant => `
                        <div class="merchant-item">
                            <span class="merchant-name">${merchant.name}</span>
                            <span class="merchant-stat">${merchant.count} visits ($${merchant.average.toFixed(2)} avg)</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="merchant-section">
                    <h4>Highest Average</h4>
                    ${merchants.topByAverage.slice(0, 5).map(merchant => `
                        <div class="merchant-item">
                            <span class="merchant-name">${merchant.name}</span>
                            <span class="merchant-stat">$${merchant.average.toFixed(2)} avg (${merchant.count}x)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Spending Patterns -->
        <div class="analysis-section">
            <h3>💰 Spending Patterns</h3>
            <div class="spending-analysis-grid">
                <div class="spending-section">
                    <h4>Amount Distribution</h4>
                    ${Object.entries(spending.ranges).map(([range, count]) => `
                        <div class="range-item">
                            <span class="range-label">${range}</span>
                            <span class="range-count">${count} transactions</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="spending-section">
                    <h4>Statistics</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Median</span>
                            <span class="stat-value">$${spending.percentiles.p50.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">75th Percentile</span>
                            <span class="stat-value">$${spending.percentiles.p75.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Volatility</span>
                            <span class="stat-value">${spending.volatility.coefficientOfVariation.toFixed(1)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Outliers</span>
                            <span class="stat-value">${spending.outliers.count} transactions</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Temporal Analysis -->
        <div class="analysis-section">
            <h3>📅 Temporal Patterns</h3>
            <div class="temporal-analysis-grid">
                <div class="temporal-section">
                    <h4>Time Summary</h4>
                    <div class="temporal-stats">
                        <div class="temporal-stat">
                            <span class="label">Date Range</span>
                            <span class="value">${temporal.dateRange?.first || 'N/A'} - ${temporal.dateRange?.last || 'N/A'}</span>
                        </div>
                        <div class="temporal-stat">
                            <span class="label">Frequency Pattern</span>
                            <span class="value">${temporal.frequency?.pattern || 'N/A'}</span>
                        </div>
                        <div class="temporal-stat">
                            <span class="label">Trend</span>
                            <span class="value">${temporal.trend?.direction || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                ${temporal.byWeekday ? `
                <div class="temporal-section">
                    <h4>By Day of Week</h4>
                    ${Object.entries(temporal.byWeekday).map(([day, data]) => `
                        <div class="weekday-item">
                            <span class="day-name">${day}</span>
                            <span class="day-stats">${data.count} visits - $${data.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>

        ${summary.returnsCount > 0 ? `
        <!-- Returns Analysis -->
        <div class="analysis-section">
            <h3>↩️ Returns Analysis</h3>
            <div class="returns-analysis">
                <div class="returns-stat">
                    <span class="label">Total Returns</span>
                    <span class="value">${summary.returnsCount} transactions</span>
                </div>
                <div class="returns-stat">
                    <span class="label">Return Rate</span>
                    <span class="value">${((summary.returnsCount / summary.totalTransactions) * 100).toFixed(1)}%</span>
                </div>
                <div class="returns-stat">
                    <span class="label">Amount Returned</span>
                    <span class="value">$${summary.returnsAmount.toFixed(2)}</span>
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

function goBackToDashboard() {
    currentView = 'dashboard';
    document.getElementById('categoryAnalysisView').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('dashboardBtn').classList.add('active');
}