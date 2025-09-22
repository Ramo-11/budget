// Category View - Detailed category analysis and management
class CategoryView {
    constructor() {
        this.currentCategory = null;
        this.currentAnalysis = null;
    }

    /**
     * Show category analysis for a specific category
     */
    showCategoryAnalysis(categoryName, monthKey) {
        const monthData = app.monthlyData.get(monthKey);
        if (!monthData) return;

        // Create analyzer for this month
        const analyzer = new ExpenseAnalyzer();
        analyzer.setCategoryConfig(userManager.getCategoryConfig());
        analyzer.processData(monthData.transactions);

        // Get category details
        const categoryDetails = analyzer.categoryDetails[categoryName] || [];
        const categoryTotal = analyzer.categoryTotals[categoryName] || 0;

        this.currentCategory = categoryName;
        this.currentAnalysis = this.analyzeCategoryDeep(categoryDetails, categoryTotal);

        // Display the analysis
        this.displayCategoryView();
    }

    /**
     * Analyze category in depth
     */
    analyzeCategoryDeep(transactions, total) {
        if (transactions.length === 0) {
            return {
                hasData: false,
                error: 'No transactions found for this category',
            };
        }

        const analysis = {
            hasData: true,
            summary: this.getCategorySummary(transactions, total),
            merchants: this.getMerchantAnalysis(transactions),
            patterns: this.getSpendingPatterns(transactions),
            temporal: this.getTemporalAnalysis(transactions),
            insights: this.generateInsights(transactions, total),
        };

        return analysis;
    }

    /**
     * Get category summary
     */
    getCategorySummary(transactions, total) {
        const amounts = transactions.map((t) => Math.abs(t.amount));

        return {
            total: total,
            count: transactions.length,
            average: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
            median: this.calculateMedian(amounts),
            min: amounts.length > 0 ? Math.min(...amounts) : 0,
            max: amounts.length > 0 ? Math.max(...amounts) : 0,
            returns: transactions.filter((t) => t.amount < 0).length,
            returnsAmount: Math.abs(
                transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
            ),
        };
    }

    /**
     * Analyze merchants
     */
    getMerchantAnalysis(transactions) {
        const merchants = {};

        transactions.forEach((t) => {
            const merchant = this.extractMerchantName(t.name);

            if (!merchants[merchant]) {
                merchants[merchant] = {
                    name: merchant,
                    count: 0,
                    total: 0,
                    transactions: [],
                };
            }

            merchants[merchant].count++;
            merchants[merchant].total += Math.abs(t.amount);
            merchants[merchant].transactions.push(t);
        });

        // Sort and rank merchants
        const sortedMerchants = Object.values(merchants).sort((a, b) => b.total - a.total);

        return {
            unique: sortedMerchants.length,
            top5: sortedMerchants.slice(0, 5),
            all: sortedMerchants,
        };
    }

    /**
     * Get spending patterns
     */
    getSpendingPatterns(transactions) {
        const amounts = transactions.map((t) => Math.abs(t.amount));

        // Define spending ranges
        const ranges = {
            'Under $10': { min: 0, max: 10, count: 0, total: 0 },
            '$10-25': { min: 10, max: 25, count: 0, total: 0 },
            '$25-50': { min: 25, max: 50, count: 0, total: 0 },
            '$50-100': { min: 50, max: 100, count: 0, total: 0 },
            '$100-250': { min: 100, max: 250, count: 0, total: 0 },
            'Over $250': { min: 250, max: Infinity, count: 0, total: 0 },
        };

        // Categorize transactions
        amounts.forEach((amount) => {
            for (const [label, range] of Object.entries(ranges)) {
                if (amount >= range.min && amount < range.max) {
                    range.count++;
                    range.total += amount;
                    break;
                }
            }
        });

        return ranges;
    }

    /**
     * Get temporal analysis
     */
    getTemporalAnalysis(transactions) {
        const byWeekday = Array(7)
            .fill(null)
            .map(() => ({ count: 0, total: 0 }));
        const byWeek = {};
        const byDay = {};

        transactions.forEach((t) => {
            const date = new Date(t.date);

            // By weekday
            const weekday = date.getDay();
            byWeekday[weekday].count++;
            byWeekday[weekday].total += Math.abs(t.amount);

            // By week
            const weekKey = this.getWeekKey(date);
            if (!byWeek[weekKey]) {
                byWeek[weekKey] = { count: 0, total: 0 };
            }
            byWeek[weekKey].count++;
            byWeek[weekKey].total += Math.abs(t.amount);

            // By day
            const dayKey = t.date;
            if (!byDay[dayKey]) {
                byDay[dayKey] = { count: 0, total: 0 };
            }
            byDay[dayKey].count++;
            byDay[dayKey].total += Math.abs(t.amount);
        });

        const weekdayNames = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
        ];
        const weekdayAnalysis = byWeekday.map((data, index) => ({
            day: weekdayNames[index],
            ...data,
        }));

        return {
            byWeekday: weekdayAnalysis,
            byWeek: byWeek,
            byDay: byDay,
            mostActiveDay: weekdayAnalysis.reduce((max, day) =>
                day.count > max.count ? day : max
            ),
            frequency: this.calculateFrequency(transactions),
        };
    }

    /**
     * Generate insights
     */
    generateInsights(transactions, total) {
        const insights = [];
        const summary = this.getCategorySummary(transactions, total);
        const merchants = this.getMerchantAnalysis(transactions);

        // High average spending
        if (summary.average > 50) {
            insights.push({
                type: 'spending',
                icon: '💰',
                title: 'High Average Transaction',
                message: `Your average transaction is $${summary.average.toFixed(
                    2
                )}, which is relatively high.`,
            });
        }

        // Merchant concentration
        if (merchants.top5.length > 0) {
            const topMerchantPercent = (merchants.top5[0].total / total) * 100;
            if (topMerchantPercent > 40) {
                insights.push({
                    type: 'merchant',
                    icon: '🏪',
                    title: 'Merchant Concentration',
                    message: `${topMerchantPercent.toFixed(1)}% of spending is at ${
                        merchants.top5[0].name
                    }.`,
                });
            }
        }

        // Return rate
        if (summary.returns > 0) {
            const returnRate = (summary.returns / summary.count) * 100;
            insights.push({
                type: 'returns',
                icon: '↩️',
                title: 'Returns Detected',
                message: `${returnRate.toFixed(
                    1
                )}% return rate with $${summary.returnsAmount.toFixed(2)} refunded.`,
            });
        }

        return insights;
    }

    /**
     * Display category view
     */
    displayCategoryView() {
        if (!this.currentAnalysis || !this.currentAnalysis.hasData) {
            notificationManager.show('No data available for this category', 'info');
            return;
        }

        // Create view container
        const container = document.createElement('div');
        container.className = 'category-analysis-modal';
        container.innerHTML = this.generateViewHTML();

        // Add to page
        document.body.appendChild(container);

        // Create charts
        this.createCategoryCharts();

        // Add event listeners
        this.attachEventListeners();
    }

    /**
     * Generate view HTML
     */
    generateViewHTML() {
        const analysis = this.currentAnalysis;
        const config = userManager.getCategoryConfig()[this.currentCategory] || {};

        return `
            <div class="modal-overlay" onclick="categoryView.close()"></div>
            <div class="modal-content category-modal">
                <div class="modal-header">
                    <h2>
                        <span class="category-icon">${config.icon || '📦'}</span>
                        ${this.currentCategory} Analysis
                    </h2>
                    <button class="close-btn" onclick="categoryView.close()">×</button>
                </div>
                
                <div class="modal-body">
                    <!-- Summary Cards -->
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h4>Total Spent</h4>
                            <p class="value">$${analysis.summary.total.toFixed(2)}</p>
                        </div>
                        <div class="summary-card">
                            <h4>Transactions</h4>
                            <p class="value">${analysis.summary.count}</p>
                        </div>
                        <div class="summary-card">
                            <h4>Average</h4>
                            <p class="value">$${analysis.summary.average.toFixed(2)}</p>
                        </div>
                        <div class="summary-card">
                            <h4>Highest</h4>
                            <p class="value">$${analysis.summary.max.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <!-- Charts Section -->
                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Spending by Merchant</h3>
                            <canvas id="merchantChart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Spending Pattern</h3>
                            <canvas id="patternChart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Weekly Distribution</h3>
                            <canvas id="weekdayChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Merchants List -->
                    <div class="merchants-section">
                        <h3>Top Merchants</h3>
                        <div class="merchants-list">
                            ${analysis.merchants.top5
                                .map(
                                    (m) => `
                                <div class="merchant-item">
                                    <span class="merchant-name">${m.name}</span>
                                    <span class="merchant-count">${m.count} transactions</span>
                                    <span class="merchant-total">$${m.total.toFixed(2)}</span>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                    
                    <!-- Insights -->
                    <div class="insights-section">
                        <h3>Insights</h3>
                        ${analysis.insights
                            .map(
                                (insight) => `
                            <div class="insight-item">
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
                </div>
                
                <div class="modal-footer">
                    <button class="btn-export" onclick="categoryView.exportAnalysis()">Export Analysis</button>
                    <button class="btn-close" onclick="categoryView.close()">Close</button>
                </div>
            </div>
        `;
    }

    /**
     * Create category charts
     */
    createCategoryCharts() {
        const analysis = this.currentAnalysis;

        // Merchant pie chart
        if (analysis.merchants.top5.length > 0) {
            const labels = analysis.merchants.top5.map((m) => m.name);
            const data = analysis.merchants.top5.map((m) => m.total);

            chartManager.createPieChart(
                'merchantChart',
                chartManager.formatChartData(labels, data, 'pie')
            );
        }

        // Pattern bar chart
        const patternLabels = Object.keys(analysis.patterns);
        const patternData = Object.values(analysis.patterns).map((p) => p.total);

        chartManager.createBarChart(
            'patternChart',
            chartManager.formatChartData(patternLabels, patternData, 'bar')
        );

        // Weekday chart
        const weekdayLabels = analysis.temporal.byWeekday.map((w) => w.day.substr(0, 3));
        const weekdayData = analysis.temporal.byWeekday.map((w) => w.total);

        chartManager.createLineChart(
            'weekdayChart',
            chartManager.formatChartData(weekdayLabels, weekdayData, 'line')
        );
    }

    /**
     * Export analysis
     */
    exportAnalysis() {
        const filename = `${this.currentCategory}_analysis_${
            new Date().toISOString().split('T')[0]
        }.json`;
        fileManager.exportToJSON(this.currentAnalysis, filename);
        notificationManager.show('Analysis exported successfully', 'success');
    }

    /**
     * Close view
     */
    close() {
        const modal = document.querySelector('.category-analysis-modal');
        if (modal) {
            modal.remove();
        }

        // Destroy charts
        chartManager.destroyChart('merchantChart');
        chartManager.destroyChart('patternChart');
        chartManager.destroyChart('weekdayChart');
    }

    /**
     * Helper functions
     */
    extractMerchantName(description) {
        return description
            .replace(/^(TST\*|SQ \*|AMZN |Amazon |BP#)/i, '')
            .replace(/\s+#\d+.*$/, '')
            .replace(/\s+\d{4,}.*$/, '')
            .split(' ')
            .slice(0, 3)
            .join(' ')
            .toUpperCase();
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    getWeekKey(date) {
        const year = date.getFullYear();
        const firstDay = new Date(year, 0, 1);
        const weekNumber = Math.ceil(((date - firstDay) / 86400000 + firstDay.getDay() + 1) / 7);
        return `${year}-W${weekNumber}`;
    }

    calculateFrequency(transactions) {
        if (transactions.length < 2) return 'N/A';

        const dates = transactions.map((t) => new Date(t.date)).sort((a, b) => a - b);

        const daysDiff = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        const avgDaysBetween = daysDiff / (transactions.length - 1);

        if (avgDaysBetween <= 1) return 'Daily';
        if (avgDaysBetween <= 3) return 'Every few days';
        if (avgDaysBetween <= 7) return 'Weekly';
        if (avgDaysBetween <= 14) return 'Bi-weekly';
        if (avgDaysBetween <= 30) return 'Monthly';
        return 'Occasional';
    }

    attachEventListeners() {
        // Add any specific event listeners for the category view
    }
}

// Create global instance
const categoryView = new CategoryView();
