// Trends View - Multi-month analysis and comparison
class TrendsView {
    constructor() {
        this.monthlyData = null;
        this.analysis = null;
        this.charts = new Map();
    }

    /**
     * Update trends view with monthly data
     */
    update(monthlyData) {
        this.monthlyData = monthlyData;
        this.analysis = this.analyzeTrends();

        if (!this.analysis.canAnalyze) {
            this.showError('Need at least 2 months of data for trends analysis');
            return;
        }

        this.displayTrends();
    }

    /**
     * Analyze trends across months
     */
    analyzeTrends() {
        if (!this.monthlyData || this.monthlyData.size < 2) {
            return { canAnalyze: false };
        }

        const months = Array.from(this.monthlyData.keys()).sort();
        const monthlyAnalysis = new Map();

        // Analyze each month
        months.forEach((monthKey) => {
            const monthData = this.monthlyData.get(monthKey);
            const analyzer = new ExpenseAnalyzer();
            analyzer.setCategoryConfig(userManager.getCategoryConfig());
            analyzer.processData(monthData.transactions);

            monthlyAnalysis.set(monthKey, {
                total: analyzer.getTotalExpenses(),
                categories: analyzer.categoryTotals,
                transactionCount: monthData.transactions.length,
                stats: analyzer.getStats(),
            });
        });

        return {
            canAnalyze: true,
            months: months,
            monthlyAnalysis: monthlyAnalysis,
            summary: this.calculateSummary(monthlyAnalysis),
            categoryTrends: this.calculateCategoryTrends(monthlyAnalysis),
            insights: this.generateInsights(monthlyAnalysis),
        };
    }

    /**
     * Calculate summary statistics
     */
    calculateSummary(monthlyAnalysis) {
        const totals = Array.from(monthlyAnalysis.values()).map((m) => m.total);
        const transactions = Array.from(monthlyAnalysis.values()).map((m) => m.transactionCount);

        return {
            monthsAnalyzed: monthlyAnalysis.size,
            totalSpent: totals.reduce((a, b) => a + b, 0),
            averageMonthly: totals.reduce((a, b) => a + b, 0) / totals.length,
            highestMonth: Math.max(...totals),
            lowestMonth: Math.min(...totals),
            totalTransactions: transactions.reduce((a, b) => a + b, 0),
            trend: this.calculateTrend(totals),
            volatility: this.calculateVolatility(totals),
        };
    }

    /**
     * Calculate category trends
     */
    calculateCategoryTrends(monthlyAnalysis) {
        const categoryData = {};
        const categories = new Set();

        // Collect all categories
        monthlyAnalysis.forEach((analysis) => {
            Object.keys(analysis.categories).forEach((cat) => categories.add(cat));
        });

        // Track each category over time
        categories.forEach((category) => {
            const monthlyValues = [];

            this.analysis.months.forEach((month) => {
                const analysis = monthlyAnalysis.get(month);
                monthlyValues.push(analysis.categories[category] || 0);
            });

            categoryData[category] = {
                values: monthlyValues,
                total: monthlyValues.reduce((a, b) => a + b, 0),
                average: monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length,
                trend: this.calculateTrend(monthlyValues),
                volatility: this.calculateVolatility(monthlyValues.filter((v) => v > 0)),
            };
        });

        return categoryData;
    }

    /**
     * Generate insights
     */
    generateInsights(monthlyAnalysis) {
        const insights = [];
        const summary = this.analysis.summary;
        const categoryTrends = this.analysis.categoryTrends;

        // Overall spending trend
        if (summary.trend === 'increasing') {
            insights.push({
                type: 'trend',
                icon: '📈',
                title: 'Spending Increasing',
                message: `Your spending has been trending upward over the past ${summary.monthsAnalyzed} months.`,
                priority: 'high',
            });
        } else if (summary.trend === 'decreasing') {
            insights.push({
                type: 'trend',
                icon: '📉',
                title: 'Spending Decreasing',
                message: `Good job! Your spending has been decreasing over the past ${summary.monthsAnalyzed} months.`,
                priority: 'positive',
            });
        }

        // High volatility
        if (summary.volatility > 30) {
            insights.push({
                type: 'volatility',
                icon: '⚡',
                title: 'Inconsistent Spending',
                message: `Your monthly spending varies by ${summary.volatility.toFixed(
                    1
                )}%. Consider more consistent budgeting.`,
                priority: 'medium',
            });
        }

        // Category-specific insights
        const risingCategories = Object.entries(categoryTrends)
            .filter(([_, data]) => data.trend === 'increasing' && data.total > 100)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 3);

        if (risingCategories.length > 0) {
            insights.push({
                type: 'categories',
                icon: '📊',
                title: 'Rising Categories',
                message: `These categories are trending up: ${risingCategories
                    .map((c) => c[0])
                    .join(', ')}`,
                priority: 'medium',
            });
        }

        return insights;
    }

    /**
     * Display trends
     */
    displayTrends() {
        this.displaySummary();
        this.createCharts();
        this.displayInsights();
        this.displayComparisons();
    }

    /**
     * Display summary cards
     */
    displaySummary() {
        const summary = this.analysis.summary;
        const container = document.getElementById('trendsSummary');

        container.innerHTML = `
            <div class="card">
                <h3>Months Analyzed</h3>
                <p>${summary.monthsAnalyzed}</p>
            </div>
            <div class="card">
                <h3>Total Spent</h3>
                <p>$${summary.totalSpent.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Monthly Average</h3>
                <p>$${summary.averageMonthly.toFixed(2)}</p>
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
                <p class="trend-${summary.trend}">
                    ${this.getTrendIcon(summary.trend)} ${summary.trend}
                </p>
            </div>
        `;
    }

    /**
     * Create trend charts
     */
    createCharts() {
        // Monthly spending line chart
        this.createMonthlyChart();

        // Category comparison chart
        this.createCategoryChart();

        // Top categories over time
        this.createTopCategoriesChart();
    }

    /**
     * Create monthly spending chart
     */
    createMonthlyChart() {
        const labels = this.analysis.months.map((month) => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
            });
        });

        const data = Array.from(this.analysis.monthlyAnalysis.values()).map((m) => m.total);

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: 'Monthly Spending',
                    data: data,
                    borderColor: '#6366F1',
                    backgroundColor: '#6366F120',
                    fill: true,
                    tension: 0.4,
                },
            ],
        };

        chartManager.createLineChart('trendsLineChart', chartData);
    }

    /**
     * Create category comparison chart
     */
    createCategoryChart() {
        const categoryTrends = this.analysis.categoryTrends;

        // Get top categories by total
        const topCategories = Object.entries(categoryTrends)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8);

        const labels = topCategories.map(([cat]) => cat);
        const datasets = [];

        // Add dataset for each month
        this.analysis.months.forEach((month, index) => {
            const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
            });

            const data = topCategories.map(([cat]) => {
                return categoryTrends[cat].values[index] || 0;
            });

            datasets.push({
                label: monthLabel,
                data: data,
                backgroundColor:
                    chartManager.getColorPalette(this.analysis.months.length)[index] + '80',
            });
        });

        const chartData = {
            labels: labels,
            datasets: datasets,
        };

        chartManager.createBarChart('categoryTrendsChart', chartData, {
            scales: {
                x: { stacked: true },
                y: { stacked: true },
            },
        });
    }

    /**
     * Create top categories over time chart
     */
    createTopCategoriesChart() {
        // Implementation for additional chart if needed
    }

    /**
     * Display insights
     */
    displayInsights() {
        const container = document.createElement('div');
        container.className = 'trends-insights';
        container.innerHTML = `
            <h3>Key Insights</h3>
            <div class="insights-grid">
                ${this.analysis.insights
                    .map(
                        (insight) => `
                    <div class="insight-card ${insight.priority}">
                        <span class="insight-icon">${insight.icon}</span>
                        <div class="insight-content">
                            <h4>${insight.title}</h4>
                            <p>${insight.message}</p>
                        </div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;

        const trendsView = document.getElementById('trendsView');
        const existingInsights = trendsView.querySelector('.trends-insights');
        if (existingInsights) {
            existingInsights.replaceWith(container);
        } else {
            trendsView.appendChild(container);
        }
    }

    /**
     * Display month comparisons
     */
    displayComparisons() {
        if (this.analysis.months.length < 2) return;

        const latest = this.analysis.months[this.analysis.months.length - 1];
        const previous = this.analysis.months[this.analysis.months.length - 2];

        const latestData = this.analysis.monthlyAnalysis.get(latest);
        const previousData = this.analysis.monthlyAnalysis.get(previous);

        const comparison = this.compareMonths(latestData, previousData);

        const container = document.createElement('div');
        container.className = 'month-comparison';
        container.innerHTML = `
            <h3>Month-over-Month Comparison</h3>
            <div class="comparison-grid">
                <div class="comparison-card">
                    <h4>Total Change</h4>
                    <p class="${comparison.totalChange > 0 ? 'increase' : 'decrease'}">
                        ${comparison.totalChange > 0 ? '+' : ''}$${comparison.totalChange.toFixed(
            2
        )}
                        (${
                            comparison.totalChangePercent > 0 ? '+' : ''
                        }${comparison.totalChangePercent.toFixed(1)}%)
                    </p>
                </div>
                <div class="comparison-card">
                    <h4>Transaction Change</h4>
                    <p>${comparison.transactionChange > 0 ? '+' : ''}${
            comparison.transactionChange
        } transactions</p>
                </div>
                <div class="comparison-card">
                    <h4>Biggest Increase</h4>
                    <p>${
                        comparison.biggestIncrease.category
                    }: +$${comparison.biggestIncrease.amount.toFixed(2)}</p>
                </div>
                <div class="comparison-card">
                    <h4>Biggest Decrease</h4>
                    <p>${comparison.biggestDecrease.category}: -$${Math.abs(
            comparison.biggestDecrease.amount
        ).toFixed(2)}</p>
                </div>
            </div>
        `;

        const trendsView = document.getElementById('trendsView');
        trendsView.appendChild(container);
    }

    /**
     * Compare two months
     */
    compareMonths(latest, previous) {
        const totalChange = latest.total - previous.total;
        const totalChangePercent = (totalChange / previous.total) * 100;
        const transactionChange = latest.transactionCount - previous.transactionCount;

        // Find biggest category changes
        const categoryChanges = [];
        const allCategories = new Set([...Object.keys(previous.categories)]);

        allCategories.forEach((category) => {
            const latestAmount = latest.categories[category] || 0;
            const previousAmount = previous.categories[category] || 0;
            const change = latestAmount - previousAmount;

            categoryChanges.push({
                category: category,
                amount: change,
                percent: previousAmount > 0 ? (change / previousAmount) * 100 : 100,
            });
        });

        const sortedChanges = categoryChanges.sort((a, b) => b.amount - a.amount);

        return {
            totalChange,
            totalChangePercent,
            transactionChange,
            biggestIncrease: sortedChanges[0] || { category: 'N/A', amount: 0 },
            biggestDecrease: sortedChanges[sortedChanges.length - 1] || {
                category: 'N/A',
                amount: 0,
            },
            categoryChanges: sortedChanges,
        };
    }

    /**
     * Calculate trend direction
     */
    calculateTrend(values) {
        if (values.length < 2) return 'stable';

        // Simple linear regression
        const n = values.length;
        const sumX = values.reduce((sum, _, i) => sum + i, 0);
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
        const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Determine trend based on slope
        const avgValue = sumY / n;
        const slopePercent = (slope / avgValue) * 100;

        if (slopePercent > 5) return 'increasing';
        if (slopePercent < -5) return 'decreasing';
        return 'stable';
    }

    /**
     * Calculate volatility (coefficient of variation)
     */
    calculateVolatility(values) {
        if (values.length < 2) return 0;

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance =
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return (stdDev / mean) * 100;
    }

    /**
     * Get trend icon
     */
    getTrendIcon(trend) {
        switch (trend) {
            case 'increasing':
                return '📈';
            case 'decreasing':
                return '📉';
            case 'stable':
                return '➡️';
            default:
                return '';
        }
    }

    /**
     * Export trends data
     */
    exportTrendsData() {
        const exportData = {
            summary: this.analysis.summary,
            monthlyData: Array.from(this.analysis.monthlyAnalysis.entries()).map(
                ([month, data]) => ({
                    month,
                    ...data,
                })
            ),
            categoryTrends: this.analysis.categoryTrends,
            insights: this.analysis.insights,
            exportDate: new Date().toISOString(),
        };

        const filename = `trends_analysis_${new Date().toISOString().split('T')[0]}.json`;
        fileManager.exportToJSON(exportData, filename);
        notificationManager.show('Trends analysis exported successfully', 'success');
    }

    /**
     * Generate PDF report
     */
    async generatePDFReport() {
        // This would require a PDF library like jsPDF
        // Placeholder for PDF generation
        notificationManager.show('PDF generation coming soon', 'info');
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('trendsView');
        container.innerHTML = `
            <div class="trends-header">
                <h2>📈 Trends Analysis</h2>
                <p class="error-message">${message}</p>
            </div>
            <div class="empty-state">
                <h3>🔍 Need More Data</h3>
                <p>Upload multiple months of expense data to see spending trends, category comparisons, and insights.</p>
                <button class="btn-primary" onclick="document.getElementById('csvFile').click()">
                    Upload Files
                </button>
            </div>
        `;
    }

    /**
     * Refresh trends view
     */
    refresh() {
        if (app && app.monthlyData && app.monthlyData.size >= 2) {
            this.update(app.monthlyData);
        }
    }

    /**
     * Clear all charts
     */
    clearCharts() {
        chartManager.destroyChart('trendsLineChart');
        chartManager.destroyChart('categoryTrendsChart');
        this.charts.clear();
    }

    /**
     * Initialize forecast feature
     */
    initializeForecast() {
        if (this.analysis.months.length < 3) {
            notificationManager.show('Need at least 3 months of data for forecasting', 'info');
            return;
        }

        const forecast = this.generateForecast();
        this.displayForecast(forecast);
    }

    /**
     * Generate forecast based on historical data
     */
    generateForecast() {
        const values = Array.from(this.analysis.monthlyAnalysis.values()).map((m) => m.total);
        const trend = this.calculateTrend(values);
        const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        // Simple moving average forecast
        const recentValues = values.slice(-3);
        const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;

        // Adjust based on trend
        let forecastValue = recentAvg;
        if (trend === 'increasing') {
            forecastValue *= 1.05; // 5% increase
        } else if (trend === 'decreasing') {
            forecastValue *= 0.95; // 5% decrease
        }

        // Generate next 3 months forecast
        const forecast = [];
        const lastMonth = this.analysis.months[this.analysis.months.length - 1];
        const [year, month] = lastMonth.split('-').map(Number);

        for (let i = 1; i <= 3; i++) {
            let forecastMonth = month + i;
            let forecastYear = year;

            if (forecastMonth > 12) {
                forecastMonth -= 12;
                forecastYear += 1;
            }

            const monthKey = `${forecastYear}-${String(forecastMonth).padStart(2, '0')}`;
            const variance = (Math.random() - 0.5) * 0.1 * forecastValue; // ±10% variance

            forecast.push({
                month: monthKey,
                predicted: forecastValue + variance,
                confidence: 'medium',
                range: {
                    low: forecastValue * 0.85,
                    high: forecastValue * 1.15,
                },
            });
        }

        return forecast;
    }

    /**
     * Display forecast
     */
    displayForecast(forecast) {
        const container = document.createElement('div');
        container.className = 'forecast-section';
        container.innerHTML = `
            <h3>📮 3-Month Forecast</h3>
            <div class="forecast-cards">
                ${forecast
                    .map(
                        (f) => `
                    <div class="forecast-card">
                        <h4>${this.formatMonth(f.month)}</h4>
                        <p class="forecast-value">$${f.predicted.toFixed(2)}</p>
                        <p class="forecast-range">Range: $${f.range.low.toFixed(
                            2
                        )} - $${f.range.high.toFixed(2)}</p>
                        <span class="confidence confidence-${f.confidence}">${
                            f.confidence
                        } confidence</span>
                    </div>
                `
                    )
                    .join('')}
            </div>
            <p class="forecast-disclaimer">
                * Forecast based on historical trends and patterns. Actual spending may vary.
            </p>
        `;

        const trendsView = document.getElementById('trendsView');
        trendsView.appendChild(container);
    }

    /**
     * Format month for display
     */
    formatMonth(monthKey) {
        const [year, month] = monthKey.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    }

    /**
     * Initialize category deep dive
     */
    initializeCategoryDeepDive(category) {
        const categoryData = this.analysis.categoryTrends[category];
        if (!categoryData) {
            notificationManager.show('No data for this category', 'error');
            return;
        }

        this.displayCategoryDeepDive(category, categoryData);
    }

    /**
     * Display category deep dive
     */
    displayCategoryDeepDive(category, data) {
        const modal = document.createElement('div');
        modal.className = 'trends-category-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${category} Trend Analysis</h2>
                    <button class="close-btn" onclick="this.closest('.trends-category-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="category-trend-stats">
                        <div class="stat">
                            <label>Total Spent</label>
                            <value>$${data.total.toFixed(2)}</value>
                        </div>
                        <div class="stat">
                            <label>Monthly Average</label>
                            <value>$${data.average.toFixed(2)}</value>
                        </div>
                        <div class="stat">
                            <label>Trend</label>
                            <value class="trend-${data.trend}">
                                ${this.getTrendIcon(data.trend)} ${data.trend}
                            </value>
                        </div>
                        <div class="stat">
                            <label>Volatility</label>
                            <value>${data.volatility.toFixed(1)}%</value>
                        </div>
                    </div>
                    
                    <canvas id="categoryTrendChart"></canvas>
                    
                    <div class="month-by-month">
                        <h4>Month by Month</h4>
                        <div class="month-list">
                            ${this.analysis.months
                                .map(
                                    (month, index) => `
                                <div class="month-item">
                                    <span>${this.formatMonth(month)}</span>
                                    <span>$${data.values[index].toFixed(2)}</span>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Create chart for this category
        setTimeout(() => {
            const labels = this.analysis.months.map((m) => this.formatMonth(m).substr(0, 3));
            const chartData = {
                labels: labels,
                datasets: [
                    {
                        label: category,
                        data: data.values,
                        borderColor: '#6366F1',
                        backgroundColor: '#6366F120',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            };

            chartManager.createLineChart('categoryTrendChart', chartData);
        }, 100);
    }
}

// Create global instance
const trendsView = new TrendsView();
