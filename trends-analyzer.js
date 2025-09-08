class TrendsAnalyzer {
    constructor(loadedFiles) {
        this.loadedFiles = loadedFiles;
        this.allAnalyzers = Array.from(loadedFiles.values()).map(file => file.analyzer);
    }

    generateTrendsAnalysis() {
        if (this.allAnalyzers.length < 2) {
            return {
                error: "Need at least 2 files to analyze trends",
                canAnalyze: false
            };
        }

        const monthlyTrends = this.calculateMonthlyTrends();
        const categoryTrends = this.calculateCategoryTrends();
        const insights = this.generateInsights(monthlyTrends, categoryTrends);
        const summary = this.calculateSummaryStats();

        return {
            canAnalyze: true,
            monthlyTrends,
            categoryTrends,
            insights,
            summary
        };
    }

    calculateMonthlyTrends() {
        const allMonthlyData = {};
        
        // Collect monthly data from all files
        this.allAnalyzers.forEach((analyzer, index) => {
            const monthlyData = analyzer.getMonthlyData();
            Object.entries(monthlyData).forEach(([month, data]) => {
                if (!allMonthlyData[month]) {
                    allMonthlyData[month] = {
                        total: 0,
                        categories: {},
                        transactionCount: 0,
                        files: []
                    };
                }
                
                allMonthlyData[month].total += data.total;
                allMonthlyData[month].transactionCount += data.transactionCount;
                allMonthlyData[month].files.push(index);
                
                Object.entries(data.categories).forEach(([category, amount]) => {
                    if (!allMonthlyData[month].categories[category]) {
                        allMonthlyData[month].categories[category] = 0;
                    }
                    allMonthlyData[month].categories[category] += amount;
                });
            });
        });

        // Sort by month
        const sortedMonths = Object.keys(allMonthlyData).sort();
        
        return {
            months: sortedMonths,
            data: allMonthlyData,
            trend: this.calculateTrend(sortedMonths.map(month => allMonthlyData[month].total))
        };
    }

    calculateCategoryTrends() {
        const categoryTrends = {};
        
        // Get all unique categories
        const allCategories = new Set();
        this.allAnalyzers.forEach(analyzer => {
            Object.keys(analyzer.categoryTotals).forEach(category => {
                if (analyzer.categoryTotals[category] > 0) {
                    allCategories.add(category);
                }
            });
        });

        // Calculate trends for each category
        allCategories.forEach(category => {
            const values = this.allAnalyzers.map(analyzer => analyzer.categoryTotals[category] || 0);
            const nonZeroValues = values.filter(v => v > 0);
            
            if (nonZeroValues.length >= 2) {
                categoryTrends[category] = {
                    values,
                    average: nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length,
                    trend: this.calculateTrend(values),
                    volatility: this.calculateVolatility(nonZeroValues),
                    current: values[values.length - 1] || 0,
                    previous: values[values.length - 2] || 0
                };
            }
        });

        return categoryTrends;
    }

    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.ceil(values.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (changePercent > 10) return 'increasing';
        if (changePercent < -10) return 'decreasing';
        return 'stable';
    }

    calculateVolatility(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        return (stdDev / mean) * 100; // Coefficient of variation as percentage
    }

    calculateSummaryStats() {
        const totalExpenses = this.allAnalyzers.map(analyzer => analyzer.getTotalExpenses());
        const transactionCounts = this.allAnalyzers.map(analyzer => analyzer.processedData.length);
        
        return {
            totalFiles: this.allAnalyzers.length,
            averageMonthlySpending: totalExpenses.reduce((a, b) => a + b, 0) / totalExpenses.length,
            highestMonth: Math.max(...totalExpenses),
            lowestMonth: Math.min(...totalExpenses),
            totalTransactions: transactionCounts.reduce((a, b) => a + b, 0),
            averageTransactionsPerMonth: transactionCounts.reduce((a, b) => a + b, 0) / transactionCounts.length,
            spendingTrend: this.calculateTrend(totalExpenses),
            spendingVolatility: this.calculateVolatility(totalExpenses)
        };
    }

    generateInsights(monthlyTrends, categoryTrends) {
        const insights = [];

        // Overall spending trend insight
        const spendingTrend = monthlyTrends.trend;
        if (spendingTrend === 'increasing') {
            insights.push({
                type: 'warning',
                title: '📈 Spending Trending Up',
                message: 'Your overall spending has been increasing over time. Consider reviewing your budget and identifying areas to cut back.'
            });
        } else if (spendingTrend === 'decreasing') {
            insights.push({
                type: 'positive',
                title: '📉 Great Job Saving!',
                message: 'Your spending has been decreasing over time. Keep up the good work!'
            });
        }

        // Category-specific insights
        Object.entries(categoryTrends).forEach(([category, data]) => {
            if (data.trend === 'increasing' && data.current > data.average * 1.5) {
                insights.push({
                    type: 'warning',
                    title: `🔺 ${category} Spending Spike`,
                    message: `Your ${category} spending has increased significantly. Current: $${data.current.toFixed(2)}, Average: $${data.average.toFixed(2)}`
                });
            }

            if (data.volatility > 50) {
                insights.push({
                    type: 'info',
                    title: `📊 Volatile ${category} Spending`,
                    message: `Your ${category} spending varies quite a bit month to month. Consider budgeting more consistently for this category.`
                });
            }
        });

        // Find fastest growing categories
        const growingCategories = Object.entries(categoryTrends)
            .filter(([_, data]) => data.trend === 'increasing')
            .sort(([_, a], [__, b]) => b.current - a.current)
            .slice(0, 3);

        if (growingCategories.length > 0) {
            insights.push({
                type: 'info',
                title: '🚀 Fastest Growing Categories',
                message: `Categories with increasing spending: ${growingCategories.map(([cat, _]) => cat).join(', ')}`
            });
        }

        // Find most stable categories
        const stableCategories = Object.entries(categoryTrends)
            .filter(([_, data]) => data.volatility < 20 && data.current > 50)
            .sort(([_, a], [__, b]) => a.volatility - b.volatility)
            .slice(0, 2);

        if (stableCategories.length > 0) {
            insights.push({
                type: 'positive',
                title: '⚖️ Most Consistent Spending',
                message: `You maintain consistent spending in: ${stableCategories.map(([cat, _]) => cat).join(', ')}`
            });
        }

        return insights;
    }

    getChartData() {
        const analysis = this.generateTrendsAnalysis();
        if (!analysis.canAnalyze) return null;

        // Monthly trends line chart data
        const monthlyLabels = analysis.monthlyTrends.months.map(month => {
            const [year, monthNum] = month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const monthlyValues = analysis.monthlyTrends.months.map(month => 
            analysis.monthlyTrends.data[month].total
        );

        // Category trends comparison
        const categoryLabels = Object.keys(analysis.categoryTrends);
        const categoryCurrentValues = categoryLabels.map(cat => 
            analysis.categoryTrends[cat].current
        );
        const categoryAverageValues = categoryLabels.map(cat => 
            analysis.categoryTrends[cat].average
        );

        // Monthly comparison (latest vs previous)
        const latestMonth = analysis.monthlyTrends.months[analysis.monthlyTrends.months.length - 1];
        const previousMonth = analysis.monthlyTrends.months[analysis.monthlyTrends.months.length - 2];

        let comparisonData = null;
        if (latestMonth && previousMonth) {
            const latestCategories = analysis.monthlyTrends.data[latestMonth].categories;
            const previousCategories = analysis.monthlyTrends.data[previousMonth].categories;
            
            const comparisonCategories = [...new Set([
                ...Object.keys(latestCategories),
                ...Object.keys(previousCategories)
            ])];

            comparisonData = {
                labels: comparisonCategories,
                latest: comparisonCategories.map(cat => latestCategories[cat] || 0),
                previous: comparisonCategories.map(cat => previousCategories[cat] || 0),
                latestLabel: monthlyLabels[monthlyLabels.length - 1],
                previousLabel: monthlyLabels[monthlyLabels.length - 2]
            };
        }

        return {
            monthlyTrends: {
                labels: monthlyLabels,
                values: monthlyValues
            },
            categoryTrends: {
                labels: categoryLabels,
                current: categoryCurrentValues,
                average: categoryAverageValues
            },
            comparison: comparisonData
        };
    }
}