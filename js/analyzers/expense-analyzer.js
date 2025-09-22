// Enhanced Expense Analyzer with dynamic category configuration
class ExpenseAnalyzer {
    constructor() {
        this.categoryConfig = {};
        this.categoryTotals = {};
        this.categoryDetails = {};
        this.processedData = [];
        this.smartCategorizedCount = 0;
    }

    setCategoryConfig(config) {
        this.categoryConfig = config;
        // Initialize category totals
        Object.keys(config).forEach((category) => {
            this.categoryTotals[category] = 0;
            this.categoryDetails[category] = [];
        });
    }

    parseCSV(csvText) {
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    resolve(results.data);
                },
            });
        });
    }

    categorizeTransaction(description) {
        const upperDesc = description.toUpperCase();

        // Check each category's keywords
        for (const [category, config] of Object.entries(this.categoryConfig)) {
            if (config.keywords && config.keywords.length > 0) {
                for (const keyword of config.keywords) {
                    if (upperDesc.includes(keyword.toUpperCase())) {
                        return category;
                    }
                }
            }
        }

        // If no match, try smart categorization
        this.smartCategorizedCount++;
        return this.smartCategorize(description);
    }

    smartCategorize(description) {
        const upperDesc = description.toUpperCase();

        // Smart patterns for common transaction types
        const patterns = {
            'Food & Dining': [/RESTAURANT/, /PIZZA/, /BURGER/, /CAFE/, /COFFEE/],
            Groceries: [/GROCERY/, /MARKET/, /SUPERMARKET/],
            Transportation: [/GAS/, /FUEL/, /PARKING/, /UBER/, /LYFT/],
            Shopping: [/AMAZON/, /STORE/, /SHOP/, /MALL/],
        };

        for (const [category, categoryPatterns] of Object.entries(patterns)) {
            for (const pattern of categoryPatterns) {
                if (pattern.test(upperDesc)) {
                    return category;
                }
            }
        }

        return 'Others';
    }

    processData(data) {
        // Reset
        Object.keys(this.categoryTotals).forEach((key) => {
            this.categoryTotals[key] = 0;
        });
        this.categoryDetails = {};
        this.smartCategorizedCount = 0;

        // Filter out invalid entries
        const validData = data.filter(
            (row) =>
                row.Description &&
                !row.Description.toLowerCase().includes('payment thank') &&
                row.Amount !== null &&
                row.Amount !== undefined
        );

        validData.forEach((row) => {
            const category = this.categorizeTransaction(row.Description);
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const isReturn = row.Type === 'Return';
            const finalAmount = isReturn ? -amount : amount;

            // Update totals
            if (!this.categoryTotals[category]) {
                this.categoryTotals[category] = 0;
                this.categoryDetails[category] = [];
            }

            this.categoryTotals[category] += finalAmount;
            this.categoryTotals[category] = Math.round(this.categoryTotals[category] * 100) / 100;

            // Add to details
            this.categoryDetails[category].push({
                name: row.Description,
                date: this.formatDate(row['Transaction Date'] || row.Date),
                amount: finalAmount,
            });
        });

        this.processedData = validData;
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    }

    getDateRange() {
        if (this.processedData.length === 0) return '-';

        const dates = this.processedData
            .map((row) => new Date(row['Transaction Date'] || row.Date))
            .filter((date) => !isNaN(date));

        if (dates.length === 0) return '-';

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        return `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
    }

    getTotalExpenses() {
        return Object.values(this.categoryTotals).reduce((sum, val) => sum + val, 0);
    }

    getStats() {
        const nonZeroCategories = Object.entries(this.categoryTotals)
            .filter(([_, value]) => value > 0)
            .sort(([, a], [, b]) => b - a);

        const highest = nonZeroCategories[0] || ['-', 0];
        const lowest = nonZeroCategories[nonZeroCategories.length - 1] || ['-', 0];

        // Calculate days between first and last transaction
        const dates = this.processedData
            .map((row) => new Date(row['Transaction Date'] || row.Date))
            .filter((date) => !isNaN(date));

        const daysDiff =
            dates.length > 0
                ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) + 1)
                : 1;

        // Find largest single transaction
        const amounts = this.processedData.map((row) => Math.abs(parseFloat(row.Amount) || 0));
        const largestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0;

        return {
            highest: { name: highest[0], amount: highest[1] },
            lowest: { name: lowest[0], amount: lowest[1] },
            avgPerDay: this.getTotalExpenses() / daysDiff,
            largestTransaction,
            transactionCount: this.processedData.length,
            smartCategorized: this.smartCategorizedCount,
        };
    }
}
