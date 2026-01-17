// js/utils.js - Utility Functions

// Export to CSV
function exportToCSV() {
    if (!currentMonth || !monthlyData.has(currentMonth)) {
        showNotification('No data to export', 'error');
        return;
    }

    const monthData = monthlyData.get(currentMonth);
    const transactions = monthData.transactions;

    if (transactions.length === 0) {
        showNotification('No transactions to export', 'error');
        return;
    }

    // Build CSV content
    let csvContent = 'Date,Description,Amount,Category\n';

    transactions.forEach((transaction) => {
        const date =
            transaction['Transaction Date'] ||
            transaction['Posting Date'] ||
            transaction['Post Date'] ||
            transaction.Date ||
            transaction.date ||
            transaction['Trans Date'] ||
            transaction['Trans. Date'] ||
            transaction['Posted Date'];
        const description = transaction.Description || transaction.description || '';
        const amount = parseFloat(
            transaction.Amount || transaction.Debit || transaction.Credit || 0
        );
        const category = categorizeTransaction(description, transaction._id);

        // Escape commas and quotes in description
        const escapedDesc =
            description.includes(',') || description.includes('"')
                ? `"${description.replace(/"/g, '""')}"`
                : description;

        csvContent += `${date},${escapedDesc},${amount},${category}\n`;
    });

    // Download file
    const fileName = `budget_${currentMonth}.csv`;
    downloadFile(csvContent, fileName, 'text/csv');
}

// Export to JSON
function exportToJSON() {
    if (monthlyData.size === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    const exportData = {
        monthlyData: Array.from(monthlyData.entries()),
        categoryConfig: categoryConfig,
        budgets: budgets,
        transactionOverrides: window.transactionOverrides || {},
        unifiedRules: window.unifiedRules || [],
        exportDate: new Date().toISOString(),
        version: '1.0',
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const fileName = `budget_backup_${Date.now()}.json`;
    downloadFile(jsonContent, fileName, 'application/json');

    showNotification('Backup created successfully', 'success');
}

// Export all transactions with categories to CSV
function exportCategorizedCSV() {
    if (monthlyData.size === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    const rows = [];

    // Header row
    rows.push(['Date', 'Description', 'Amount', 'Category', 'Icon', 'Month', 'Type']);

    // Process all months
    const months = Array.from(monthlyData.keys()).sort();

    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);

        monthData.transactions.forEach((transaction) => {
            const date =
                transaction['Transaction Date'] ||
                transaction['Posting Date'] ||
                transaction['Post Date'] ||
                transaction.Date ||
                transaction.date ||
                '';
            const description = transaction.Description || transaction.description || '';
            const amount = parseFloat(transaction.Amount) || 0;
            const category = categorizeTransaction(description, transaction._id);
            const icon = categoryConfig[category]?.icon || '';
            const isIncome = category === 'Income' || (categoryConfig[category]?._isIncome === true);

            rows.push([
                date,
                description,
                amount.toFixed(2),
                category,
                icon,
                monthData.monthName,
                isIncome ? 'Income' : 'Expense',
            ]);
        });
    });

    // Convert to CSV string
    const csvContent = rows
        .map((row) => {
            return row
                .map((cell) => {
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return '"' + cellStr.replace(/"/g, '""') + '"';
                    }
                    return cellStr;
                })
                .join(',');
        })
        .join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const today = new Date().toISOString().split('T')[0];
    const fileName = `sahab_budget_all_transactions_${today}.csv`;

    downloadFile(BOM + csvContent, fileName, 'text/csv;charset=utf-8');

    const totalTransactions = rows.length - 1;
    showNotification(`Exported ${totalTransactions} transactions from ${months.length} months`, 'success');
}

// Export single month transactions with categories
function exportMonthCSV() {
    const monthSelect = document.getElementById('exportMonthSelect');
    const selectedMonth = monthSelect?.value;

    if (!selectedMonth || !monthlyData.has(selectedMonth)) {
        showNotification('Please select a valid month to export', 'error');
        return;
    }

    const monthData = monthlyData.get(selectedMonth);
    const rows = [];

    // Header row
    rows.push(['Date', 'Description', 'Amount', 'Category', 'Icon', 'Type']);

    monthData.transactions.forEach((transaction) => {
        const date =
            transaction['Transaction Date'] ||
            transaction['Posting Date'] ||
            transaction['Post Date'] ||
            transaction.Date ||
            transaction.date ||
            '';
        const description = transaction.Description || transaction.description || '';
        const amount = parseFloat(transaction.Amount) || 0;
        const category = categorizeTransaction(description, transaction._id);
        const icon = categoryConfig[category]?.icon || '';
        const isIncome = category === 'Income' || (categoryConfig[category]?._isIncome === true);

        rows.push([
            date,
            description,
            amount.toFixed(2),
            category,
            icon,
            isIncome ? 'Income' : 'Expense',
        ]);
    });

    // Convert to CSV string
    const csvContent = rows
        .map((row) => {
            return row
                .map((cell) => {
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return '"' + cellStr.replace(/"/g, '""') + '"';
                    }
                    return cellStr;
                })
                .join(',');
        })
        .join('\n');

    const BOM = '\uFEFF';
    const fileName = `sahab_budget_${selectedMonth}_categorized.csv`;

    downloadFile(BOM + csvContent, fileName, 'text/csv;charset=utf-8');

    showNotification(`Exported ${monthData.transactions.length} transactions from ${monthData.monthName}`, 'success');
}

// Populate export month dropdown
function populateExportMonthDropdown() {
    const select = document.getElementById('exportMonthSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select a month...</option>';

    const months = Array.from(monthlyData.keys()).sort().reverse();
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthData.monthName;
        select.appendChild(option);
    });
}
