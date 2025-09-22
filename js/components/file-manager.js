// File Manager - Handles file operations and data management
class FileManager {
    constructor() {
        this.loadedFiles = new Map();
        this.supportedFormats = ['.csv'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * Validate file before processing
     */
    validateFile(file) {
        // Check file extension
        const extension = file.name.toLowerCase().substr(file.name.lastIndexOf('.'));
        if (!this.supportedFormats.includes(extension)) {
            throw new Error(`Unsupported file format. Please upload a CSV file.`);
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            throw new Error(`File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB.`);
        }

        return true;
    }

    /**
     * Process uploaded files
     */
    async processFiles(files) {
        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                this.validateFile(file);
                const content = await this.readFile(file);
                const data = await this.parseCSV(content);

                results.push({
                    filename: file.name,
                    data: data,
                    size: file.size,
                    uploadDate: new Date(),
                });
            } catch (error) {
                errors.push({
                    filename: file.name,
                    error: error.message,
                });
            }
        }

        return { results, errors };
    }

    /**
     * Read file content
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = (e) => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Parse CSV content
     */
    parseCSV(content) {
        return new Promise((resolve, reject) => {
            Papa.parse(content, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                transformHeader: (header) => {
                    // Clean up header names
                    return header.trim();
                },
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }

                    // Validate required columns
                    const requiredColumns = this.detectRequiredColumns(results.data[0]);
                    if (!requiredColumns.date || !requiredColumns.amount) {
                        reject(new Error('CSV must contain date and amount columns'));
                        return;
                    }

                    resolve(results.data);
                },
                error: (error) => {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                },
            });
        });
    }

    /**
     * Detect required columns in CSV
     */
    detectRequiredColumns(sampleRow) {
        if (!sampleRow) return { date: null, amount: null, description: null };

        const dateColumns = ['Date', 'Transaction Date', 'date', 'transaction_date', 'Trans Date'];
        const amountColumns = ['Amount', 'amount', 'Value', 'Total', 'Debit', 'Credit'];
        const descColumns = ['Description', 'description', 'Name', 'Merchant', 'Details'];

        const result = {
            date: null,
            amount: null,
            description: null,
        };

        // Find date column
        for (const col of dateColumns) {
            if (sampleRow.hasOwnProperty(col)) {
                result.date = col;
                break;
            }
        }

        // Find amount column
        for (const col of amountColumns) {
            if (sampleRow.hasOwnProperty(col)) {
                result.amount = col;
                break;
            }
        }

        // Find description column
        for (const col of descColumns) {
            if (sampleRow.hasOwnProperty(col)) {
                result.description = col;
                break;
            }
        }

        return result;
    }

    /**
     * Merge multiple CSV datasets
     */
    mergeDatasets(datasets) {
        const merged = [];
        const seen = new Set();

        for (const dataset of datasets) {
            for (const row of dataset) {
                // Create unique key for deduplication
                const key = this.createTransactionKey(row);

                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(row);
                }
            }
        }

        // Sort by date
        merged.sort((a, b) => {
            const dateA = new Date(a.Date || a['Transaction Date']);
            const dateB = new Date(b.Date || b['Transaction Date']);
            return dateB - dateA;
        });

        return merged;
    }

    /**
     * Create unique key for transaction deduplication
     */
    createTransactionKey(transaction) {
        const date = transaction.Date || transaction['Transaction Date'] || '';
        const amount = transaction.Amount || 0;
        const desc = transaction.Description || '';
        return `${date}_${amount}_${desc.substring(0, 20)}`;
    }

    /**
     * Export data to CSV
     */
    exportToCSV(data, filename = 'export.csv') {
        const csv = Papa.unparse(data, {
            header: true,
            skipEmptyLines: true,
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Export data to JSON
     */
    exportToJSON(data, filename = 'export.json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Import settings from JSON
     */
    async importSettings(file) {
        try {
            const content = await this.readFile(file);
            const settings = JSON.parse(content);

            // Validate settings structure
            if (!settings.userData && !settings.budgets && !settings.categories) {
                throw new Error('Invalid settings file format');
            }

            return settings;
        } catch (error) {
            throw new Error(`Failed to import settings: ${error.message}`);
        }
    }

    /**
     * Calculate file statistics
     */
    getFileStats(data) {
        const stats = {
            totalRows: data.length,
            dateRange: this.getDateRange(data),
            uniqueMerchants: this.getUniqueMerchants(data),
            totalAmount: this.getTotalAmount(data),
            averageTransaction: 0,
        };

        if (stats.totalRows > 0) {
            stats.averageTransaction = stats.totalAmount / stats.totalRows;
        }

        return stats;
    }

    /**
     * Get date range from data
     */
    getDateRange(data) {
        const dates = data
            .map((row) => new Date(row.Date || row['Transaction Date']))
            .filter((date) => !isNaN(date))
            .sort((a, b) => a - b);

        if (dates.length === 0) {
            return { start: null, end: null };
        }

        return {
            start: dates[0],
            end: dates[dates.length - 1],
        };
    }

    /**
     * Get unique merchants
     */
    getUniqueMerchants(data) {
        const merchants = new Set();

        data.forEach((row) => {
            if (row.Description) {
                // Extract merchant name (simplified)
                const merchant = row.Description.split(' ')[0];
                merchants.add(merchant);
            }
        });

        return merchants.size;
    }

    /**
     * Get total amount
     */
    getTotalAmount(data) {
        return data.reduce((total, row) => {
            const amount = parseFloat(row.Amount) || 0;
            return total + Math.abs(amount);
        }, 0);
    }

    /**
     * Clear all loaded files
     */
    clearAll() {
        this.loadedFiles.clear();
    }
}

// Create global instance
const fileManager = new FileManager();
