// Month Splitter - Intelligently splits transactions by month
class MonthSplitter {
    constructor() {
        this.monthlyData = new Map();
    }

    splitByMonth(rawData) {
        this.monthlyData.clear();

        rawData.forEach((transaction) => {
            const date = this.parseTransactionDate(transaction);
            if (!date) return;

            const monthKey = this.getMonthKey(date);

            if (!this.monthlyData.has(monthKey)) {
                this.monthlyData.set(monthKey, {
                    transactions: [],
                    startDate: null,
                    endDate: null,
                    monthName: this.getMonthName(date),
                });
            }

            const monthData = this.monthlyData.get(monthKey);
            monthData.transactions.push(transaction);

            // Update date range
            if (!monthData.startDate || date < monthData.startDate) {
                monthData.startDate = date;
            }
            if (!monthData.endDate || date > monthData.endDate) {
                monthData.endDate = date;
            }
        });

        return this.monthlyData;
    }

    parseTransactionDate(transaction) {
        const dateFields = ['Transaction Date', 'Date', 'date', 'transaction_date'];

        for (const field of dateFields) {
            if (transaction[field]) {
                const date = new Date(transaction[field]);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        return null;
    }

    getMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    getMonthName(date) {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    }

    getAvailableMonths() {
        return Array.from(this.monthlyData.keys()).sort().reverse();
    }

    getMonthData(monthKey) {
        return this.monthlyData.get(monthKey);
    }

    static mergeMonthlyData(dataSets) {
        const merged = new Map();

        dataSets.forEach((dataSet) => {
            dataSet.forEach((monthData, monthKey) => {
                if (!merged.has(monthKey)) {
                    merged.set(monthKey, {
                        transactions: [],
                        startDate: monthData.startDate,
                        endDate: monthData.endDate,
                        monthName: monthData.monthName,
                    });
                }

                const mergedMonth = merged.get(monthKey);
                mergedMonth.transactions.push(...monthData.transactions);

                // Update date range
                if (monthData.startDate < mergedMonth.startDate) {
                    mergedMonth.startDate = monthData.startDate;
                }
                if (monthData.endDate > mergedMonth.endDate) {
                    mergedMonth.endDate = monthData.endDate;
                }
            });
        });

        return merged;
    }

    getMonthlyStatistics() {
        const stats = [];

        this.monthlyData.forEach((data, monthKey) => {
            stats.push({
                monthKey,
                monthName: data.monthName,
                transactionCount: data.transactions.length,
                dateRange: {
                    start: data.startDate,
                    end: data.endDate,
                },
            });
        });

        return stats.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    }
}

// Export for use
const monthSplitter = new MonthSplitter();
