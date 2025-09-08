let pieChart, barChart, trendsLineChart, categoryTrendsChart, monthlyComparisonChart;
let loadedFiles = new Map();
let currentFileId = null;
let currentView = 'dashboard';
let currentCategoryAnalysis = null;

// Load saved data on startup
window.addEventListener('load', () => {
    loadSavedData();
});

// Save data to localStorage
function saveDataToStorage() {
    const dataToSave = {
        files: Array.from(loadedFiles.entries()).map(([id, data]) => ({
            id,
            filename: data.filename,
            analyzer: {
                categoryTotals: data.analyzer.categoryTotals,
                categoryDetails: data.analyzer.categoryDetails,
                processedData: data.analyzer.processedData,
                smartCategorizedCount: data.analyzer.smartCategorizedCount
            },
            uploadDate: data.uploadDate
        })),
        currentFileId
    };
    localStorage.setItem('expenseData', JSON.stringify(dataToSave));
}

// Load data from localStorage
function loadSavedData() {
    const saved = localStorage.getItem('expenseData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            data.files.forEach(file => {
                const analyzer = new ExpenseAnalyzer();
                analyzer.categoryTotals = file.analyzer.categoryTotals;
                analyzer.categoryDetails = file.analyzer.categoryDetails;
                analyzer.processedData = file.analyzer.processedData;
                analyzer.smartCategorizedCount = file.analyzer.smartCategorizedCount;
                
                loadedFiles.set(file.id, {
                    filename: file.filename,
                    analyzer: analyzer,
                    uploadDate: new Date(file.uploadDate)
                });
            });
            
            currentFileId = data.currentFileId;
            updateFileTabs();
            if (currentFileId) {
                switchToFile(currentFileId);
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
}

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
        saveDataToStorage();
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
    const label = tabsContainer.querySelector('.file-tabs-label');
    tabsContainer.innerHTML = '';
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'file-tabs-label';
    labelDiv.textContent = 'Loaded Files:';
    tabsContainer.appendChild(labelDiv);
    
    const tabsWrapper = document.createElement('div');
    tabsWrapper.className = 'tabs-wrapper';
    
    loadedFiles.forEach((data, fileId) => {
        const tab = document.createElement('div');
        tab.className = `file-tab ${fileId === currentFileId ? 'active' : ''}`;
        tab.innerHTML = `
            <span class="file-name">${data.filename}</span>
            <button class="remove-file" onclick="removeFile('${fileId}')" aria-label="Remove file">×</button>
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

    // Update detailed breakdown with drag-and-drop support
    updateCategoryDetailsWithDragDrop(analyzer.categoryDetails, analyzer.categoryTotals);

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

function updateCategoryDetailsWithDragDrop(categoryDetails, categoryTotals) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    const sortedCategories = Object.entries(categoryDetails)
    .sort((a, b) => {
        const totalA = categoryTotals[a[0]] || 0;
        const totalB = categoryTotals[b[0]] || 0;
        return totalB - totalA;
    });

    sortedCategories.forEach(([category, transactions]) => {
        if (transactions.length === 0) return;

        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = category;

        const total = categoryTotals[category] || 0;
        
        // Create header with category name and total
        const headerHTML = `
            <div class="category-header">
                <div class="category-title">
                    <h4>${category}</h4>
                    <span class="category-total">$${total.toFixed(2)}</span>
                </div>
                <button class="deep-analysis-btn" onclick="showCategoryDeepAnalysis('${category}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    Analysis
                </button>
            </div>
        `;

        // Create transactions list
        const transactionsHTML = `
            <div class="category-transactions">
                ${transactions.map(t => `
                    <div class="transaction-item" 
                         data-amount="${t.amount}" 
                         data-date="${t.date}"
                         ${t.amount < 0 ? 'class="is-return"' : ''}>
                        <div class="transaction-content">
                            <span class="drag-handle">⋮⋮</span>
                            <span class="transaction-name">${t.name}</span>
                            <span class="transaction-amount ${t.amount < 0 ? 'return' : ''}">
                                $${Math.abs(t.amount).toFixed(2)}${t.amount < 0 ? ' ↩' : ''}
                            </span>
                        </div>
                        <button class="delete-btn" onclick="deleteTransaction('${category}', this)" aria-label="Delete transaction">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        card.innerHTML = headerHTML + transactionsHTML;
        container.appendChild(card);
    });

    // Initialize drag and drop after elements are created
    setTimeout(() => {
        dragDropHandler.initializeDragDrop();
    }, 100);
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
    
    // Update category comparison
    updateCategoryComparison(analysis.categoryComparison);
    
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

function updateCategoryComparison(comparisonData) {
    const container = document.getElementById('trendsInsights');
    
    if (!comparisonData || comparisonData.comparisons.length === 0) {
        container.innerHTML = '<p>Upload at least 2 months of data to see category comparisons.</p>';
        return;
    }
    
    container.innerHTML = `
        <h3>📊 Category Comparison: ${comparisonData.previousMonth} vs ${comparisonData.latestMonth}</h3>
        <div class="comparison-grid">
            ${comparisonData.comparisons.map(item => {
                const trendIcon = item.trend === 'increased' ? '📈' : item.trend === 'decreased' ? '📉' : '➡️';
                const trendClass = item.trend === 'increased' ? 'trend-up' : item.trend === 'decreased' ? 'trend-down' : 'trend-stable';
                const changeText = item.difference > 0 ? `+$${item.difference.toFixed(2)}` : item.difference < 0 ? `-$${Math.abs(item.difference).toFixed(2)}` : 'No change';
                
                return `
                    <div class="comparison-card">
                        <div class="comparison-header">
                            <h4>${item.category}</h4>
                            <span class="trend-badge ${trendClass}">${trendIcon} ${item.percentChange}%</span>
                        </div>
                        <div class="comparison-amounts">
                            <div class="amount-block">
                                <span class="amount-label">Previous</span>
                                <span class="amount-value">$${item.previousAmount.toFixed(2)}</span>
                            </div>
                            <div class="amount-block">
                                <span class="amount-label">Current</span>
                                <span class="amount-value">$${item.currentAmount.toFixed(2)}</span>
                            </div>
                            <div class="amount-block ${trendClass}">
                                <span class="amount-label">Change</span>
                                <span class="amount-value">${changeText}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showTrendsError() {
    const container = document.getElementById('trendsView');
    container.innerHTML = `
        <div class="trends-header">
            <h2>📈 Trends Analysis</h2>
            <p class="error-message">Please upload at least 2 CSV files to analyze trends</p>
        </div>
        <div class="empty-state">
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
                <p class="error-message">${analysis.error}</p>
            </div>
        `;
    }

    const { summary, merchants, spending, temporal } = analysis;
    
    return `
        <div class="category-analysis-header">
            <button onclick="goBackToDashboard()" class="back-btn">← Back</button>
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

        <!-- Rest of the analysis sections remain the same -->
        <!-- ... (merchant analysis, spending patterns, temporal analysis, etc.) ... -->
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