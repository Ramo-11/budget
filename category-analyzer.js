class CategoryAnalyzer {
    constructor(categoryDetails, categoryTotals) {
        this.categoryDetails = categoryDetails;
        this.categoryTotals = categoryTotals;
    }

    // Analyze a specific category in depth
    analyzeCategoryDeep(categoryName) {
        const transactions = this.categoryDetails[categoryName] || [];
        const validTransactions = transactions.filter(t => t.name && t.amount !== undefined);
        
        if (validTransactions.length === 0) {
            return {
                categoryName,
                error: "No transactions found for this category",
                hasData: false
            };
        }

        return {
            categoryName,
            hasData: true,
            summary: this.getCategorySummary(validTransactions),
            merchants: this.getMerchantAnalysis(validTransactions),
            spending: this.getSpendingAnalysis(validTransactions),
            temporal: this.getTemporalAnalysis(validTransactions),
            insights: this.generateCategoryInsights(categoryName, validTransactions)
        };
    }

    // Get basic summary stats for category
    getCategorySummary(transactions) {
        const amounts = transactions.map(t => Math.abs(t.amount));
        const total = this.categoryTotals[transactions[0]?.name?.split(' ')[0]] || amounts.reduce((a, b) => a + b, 0);
        
        return {
            totalTransactions: transactions.length,
            totalAmount: total,
            averageTransaction: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
            largestTransaction: amounts.length > 0 ? Math.max(...amounts) : 0,
            smallestTransaction: amounts.length > 0 ? Math.min(...amounts) : 0,
            returnsCount: transactions.filter(t => t.amount < 0).length,
            returnsAmount: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
        };
    }

    // Analyze merchants/vendors for this category
    getMerchantAnalysis(transactions) {
        const merchantStats = {};
        
        transactions.forEach(t => {
            // Extract merchant name (first few words before numbers/special chars)
            const merchant = this.extractMerchantName(t.name);
            
            if (!merchantStats[merchant]) {
                merchantStats[merchant] = {
                    name: merchant,
                    count: 0,
                    total: 0,
                    amounts: [],
                    dates: []
                };
            }
            
            merchantStats[merchant].count++;
            merchantStats[merchant].total += Math.abs(t.amount);
            merchantStats[merchant].amounts.push(Math.abs(t.amount));
            merchantStats[merchant].dates.push(new Date(t.date));
        });

        // Calculate additional stats for each merchant
        Object.values(merchantStats).forEach(merchant => {
            merchant.average = merchant.total / merchant.count;
            merchant.frequency = this.calculateFrequency(merchant.dates);
            merchant.trend = this.calculateMerchantTrend(merchant.amounts, merchant.dates);
        });

        // Sort by different criteria
        const bySpending = Object.values(merchantStats).sort((a, b) => b.total - a.total);
        const byFrequency = Object.values(merchantStats).sort((a, b) => b.count - a.count);
        const byAverage = Object.values(merchantStats).sort((a, b) => b.average - a.average);

        return {
            totalMerchants: Object.keys(merchantStats).length,
            topBySpending: bySpending.slice(0, 5),
            topByFrequency: byFrequency.slice(0, 5),
            topByAverage: byAverage.slice(0, 5),
            leastFrequent: byFrequency.slice(-3).reverse(),
            allMerchants: merchantStats
        };
    }

    // Analyze spending patterns
    getSpendingAnalysis(transactions) {
        const amounts = transactions.map(t => Math.abs(t.amount));
        const sortedAmounts = amounts.sort((a, b) => a - b);
        
        // Calculate percentiles
        const percentiles = {
            p25: this.getPercentile(sortedAmounts, 25),
            p50: this.getPercentile(sortedAmounts, 50), // median
            p75: this.getPercentile(sortedAmounts, 75),
            p90: this.getPercentile(sortedAmounts, 90),
            p95: this.getPercentile(sortedAmounts, 95)
        };

        // Spending ranges
        const ranges = this.categorizeBySpendingRange(amounts);
        
        // Volatility analysis
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
        const standardDeviation = Math.sqrt(variance);
        const volatility = (standardDeviation / mean) * 100;

        return {
            percentiles,
            ranges,
            volatility: {
                standardDeviation,
                coefficientOfVariation: volatility,
                isHighlyVolatile: volatility > 50
            },
            outliers: this.detectOutliers(amounts)
        };
    }

    // Analyze temporal patterns
    getTemporalAnalysis(transactions) {
        const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d));
        const amounts = transactions.map(t => Math.abs(t.amount));
        
        if (dates.length === 0) return { error: "No valid dates found" };

        // Group by different time periods
        const byMonth = this.groupByTimePeriod(transactions, 'month');
        const byWeekday = this.groupByTimePeriod(transactions, 'weekday');
        const byWeek = this.groupByTimePeriod(transactions, 'week');

        // Calculate frequency patterns
        const daysBetweenTransactions = this.calculateDaysBetween(dates);
        const averageFrequency = daysBetweenTransactions.length > 0 
            ? daysBetweenTransactions.reduce((a, b) => a + b, 0) / daysBetweenTransactions.length 
            : 0;

        // Trend analysis
        const trend = this.calculateTemporalTrend(transactions);

        return {
            dateRange: {
                first: new Date(Math.min(...dates)).toLocaleDateString(),
                last: new Date(Math.max(...dates)).toLocaleDateString(),
                span: Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24))
            },
            frequency: {
                averageDaysBetween: averageFrequency,
                pattern: this.classifyFrequencyPattern(averageFrequency)
            },
            byMonth,
            byWeekday,
            byWeek,
            trend,
            seasonality: this.detectSeasonality(byMonth)
        };
    }

    // Generate AI-like insights for the category
    generateCategoryInsights(categoryName, transactions) {
        const insights = [];
        const summary = this.getCategorySummary(transactions);
        const merchants = this.getMerchantAnalysis(transactions);
        const spending = this.getSpendingAnalysis(transactions);
        const temporal = this.getTemporalAnalysis(transactions);

        // Spending behavior insights
        if (summary.averageTransaction > 50) {
            insights.push({
                type: 'spending',
                icon: '💰',
                title: 'High Average Spending',
                message: `Your average ${categoryName.toLowerCase()} transaction is $${summary.averageTransaction.toFixed(2)}, which suggests premium choices or bulk purchases.`
            });
        }

        // Frequency insights
        if (temporal.frequency && temporal.frequency.averageDaysBetween < 3) {
            insights.push({
                type: 'frequency',
                icon: '🔄',
                title: 'Very Frequent Category',
                message: `You spend on ${categoryName.toLowerCase()} every ${temporal.frequency.averageDaysBetween.toFixed(1)} days on average. Consider if this frequency aligns with your budget goals.`
            });
        }

        // Merchant loyalty insights
        const topMerchant = merchants.topBySpending[0];
        if (topMerchant && topMerchant.count >= 3) {
            const loyaltyPercentage = (topMerchant.total / summary.totalAmount) * 100;
            if (loyaltyPercentage > 40) {
                insights.push({
                    type: 'loyalty',
                    icon: '🏪',
                    title: 'High Merchant Loyalty',
                    message: `${loyaltyPercentage.toFixed(1)}% of your ${categoryName.toLowerCase()} spending goes to ${topMerchant.name}. You're quite loyal to this merchant!`
                });
            }
        }

        // Volatility insights
        if (spending.volatility.isHighlyVolatile) {
            insights.push({
                type: 'volatility',
                icon: '📊',
                title: 'Inconsistent Spending',
                message: `Your ${categoryName.toLowerCase()} spending varies significantly (${spending.volatility.coefficientOfVariation.toFixed(1)}% volatility). Consider budgeting more consistently.`
            });
        }

        // Trend insights
        if (temporal.trend && temporal.trend.direction !== 'stable') {
            const direction = temporal.trend.direction === 'increasing' ? 'rising' : 'declining';
            insights.push({
                type: 'trend',
                icon: temporal.trend.direction === 'increasing' ? '📈' : '📉',
                title: `${direction === 'rising' ? 'Rising' : 'Declining'} Trend`,
                message: `Your ${categoryName.toLowerCase()} spending has been ${direction} over time. ${direction === 'rising' ? 'Consider reviewing if this increase is intentional.' : 'Great job reducing spending in this category!'}`
            });
        }

        // Returns insights
        if (summary.returnsCount > 0) {
            const returnRate = (summary.returnsCount / summary.totalTransactions) * 100;
            if (returnRate > 15) {
                insights.push({
                    type: 'returns',
                    icon: '↩️',
                    title: 'High Return Rate',
                    message: `You have a ${returnRate.toFixed(1)}% return rate in ${categoryName.toLowerCase()}. Consider reviewing purchase decisions to reduce returns.`
                });
            }
        }

        return insights;
    }

    // Helper methods
    extractMerchantName(description) {
        // Clean up merchant name by removing common prefixes and suffixes
        let merchant = description
            .replace(/^(TST\*|SQ \*|AMZN |Amazon |BP#)/i, '')
            .replace(/\s+#\d+.*$/, '') // Remove store numbers and everything after
            .replace(/\s+\d{4,}.*$/, '') // Remove long numbers and everything after
            .replace(/\s*-.*$/, '') // Remove dashes and everything after
            .replace(/\s*&.*$/, '') // Remove & and everything after
            .trim();
        
        // Take first 2-3 words max
        const words = merchant.split(' ').slice(0, 3);
        return words.join(' ').toUpperCase();
    }

    getPercentile(sortedArray, percentile) {
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }

    categorizeBySpendingRange(amounts) {
        const ranges = {
            'Under $10': 0,
            '$10-$25': 0,
            '$25-$50': 0,
            '$50-$100': 0,
            'Over $100': 0
        };
        
        amounts.forEach(amount => {
            if (amount < 10) ranges['Under $10']++;
            else if (amount < 25) ranges['$10-$25']++;
            else if (amount < 50) ranges['$25-$50']++;
            else if (amount < 100) ranges['$50-$100']++;
            else ranges['Over $100']++;
        });
        
        return ranges;
    }

    detectOutliers(amounts) {
        const sorted = amounts.sort((a, b) => a - b);
        const q1 = this.getPercentile(sorted, 25);
        const q3 = this.getPercentile(sorted, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        return {
            lower: amounts.filter(a => a < lowerBound),
            upper: amounts.filter(a => a > upperBound),
            count: amounts.filter(a => a < lowerBound || a > upperBound).length
        };
    }

    groupByTimePeriod(transactions, period) {
        const groups = {};
        
        transactions.forEach(t => {
            const date = new Date(t.date);
            if (isNaN(date)) return;
            
            let key;
            switch(period) {
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'weekday':
                    key = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
                    break;
                case 'week':
                    const startOfYear = new Date(date.getFullYear(), 0, 1);
                    const weekNumber = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                    key = `${date.getFullYear()}-W${weekNumber}`;
                    break;
            }
            
            if (!groups[key]) {
                groups[key] = { count: 0, total: 0, transactions: [] };
            }
            
            groups[key].count++;
            groups[key].total += Math.abs(t.amount);
            groups[key].transactions.push(t);
        });
        
        return groups;
    }

    calculateDaysBetween(dates) {
        const sorted = dates.sort((a, b) => a - b);
        const daysBetween = [];
        
        for (let i = 1; i < sorted.length; i++) {
            const diff = (sorted[i] - sorted[i-1]) / (1000 * 60 * 60 * 24);
            daysBetween.push(diff);
        }
        
        return daysBetween;
    }

    calculateFrequency(dates) {
        const daysBetween = this.calculateDaysBetween(dates);
        return daysBetween.length > 0 
            ? daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length 
            : 0;
    }

    calculateMerchantTrend(amounts, dates) {
        if (amounts.length < 3) return { direction: 'insufficient_data' };
        
        // Simple linear trend calculation
        const sortedData = amounts.map((amount, i) => ({ amount, date: dates[i] }))
                                 .sort((a, b) => a.date - b.date);
        
        const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
        const secondHalf = sortedData.slice(Math.ceil(sortedData.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, item) => sum + item.amount, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, item) => sum + item.amount, 0) / secondHalf.length;
        
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (changePercent > 20) return { direction: 'increasing', change: changePercent };
        if (changePercent < -20) return { direction: 'decreasing', change: changePercent };
        return { direction: 'stable', change: changePercent };
    }

    calculateTemporalTrend(transactions) {
        const sorted = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        const amounts = sorted.map(t => Math.abs(t.amount));
        
        if (amounts.length < 4) return { direction: 'insufficient_data' };
        
        const firstQuarter = amounts.slice(0, Math.floor(amounts.length / 4));
        const lastQuarter = amounts.slice(-Math.floor(amounts.length / 4));
        
        const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
        const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
        
        const changePercent = ((lastAvg - firstAvg) / firstAvg) * 100;
        
        if (changePercent > 15) return { direction: 'increasing', change: changePercent };
        if (changePercent < -15) return { direction: 'decreasing', change: changePercent };
        return { direction: 'stable', change: changePercent };
    }

    classifyFrequencyPattern(averageDays) {
        if (averageDays <= 1) return 'Daily';
        if (averageDays <= 3) return 'Very Frequent';
        if (averageDays <= 7) return 'Weekly';
        if (averageDays <= 14) return 'Bi-weekly';
        if (averageDays <= 30) return 'Monthly';
        return 'Infrequent';
    }

    detectSeasonality(monthlyData) {
        const months = Object.keys(monthlyData);
        if (months.length < 6) return { detected: false, reason: 'insufficient_data' };
        
        const monthlyTotals = months.map(month => monthlyData[month].total);
        const average = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;
        
        // Simple seasonality detection - check if any month is significantly higher/lower
        const highMonths = monthlyTotals.filter(total => total > average * 1.5);
        const lowMonths = monthlyTotals.filter(total => total < average * 0.5);
        
        return {
            detected: highMonths.length > 0 || lowMonths.length > 0,
            pattern: {
                high: highMonths.length,
                low: lowMonths.length,
                average: average
            }
        };
    }

    // Get analysis for all categories
    analyzeAllCategories() {
        const analyses = {};
        
        Object.keys(this.categoryDetails).forEach(categoryName => {
            if (this.categoryTotals[categoryName] > 0) {
                analyses[categoryName] = this.analyzeCategoryDeep(categoryName);
            }
        });
        
        return analyses;
    }

    // Get comparative analysis between categories
    getComparativeAnalysis() {
        const categories = Object.keys(this.categoryDetails)
            .filter(cat => this.categoryTotals[cat] > 0);
        
        const comparison = categories.map(cat => {
            const analysis = this.analyzeCategoryDeep(cat);
            return {
                name: cat,
                total: this.categoryTotals[cat],
                avgTransaction: analysis.summary?.averageTransaction || 0,
                frequency: analysis.temporal?.frequency?.averageDaysBetween || 0,
                volatility: analysis.spending?.volatility?.coefficientOfVariation || 0,
                merchantCount: analysis.merchants?.totalMerchants || 0
            };
        });
        
        return {
            bySpending: comparison.sort((a, b) => b.total - a.total),
            byFrequency: comparison.sort((a, b) => a.frequency - b.frequency),
            byVolatility: comparison.sort((a, b) => b.volatility - a.volatility),
            byMerchantDiversity: comparison.sort((a, b) => b.merchantCount - a.merchantCount)
        };
    }
}