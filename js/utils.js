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
        const date = transaction['Transaction Date'] || transaction.Date || transaction.date;
        const description = transaction.Description || transaction.description || '';
        const amount = parseFloat(transaction.Amount) || 0;
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
        exportDate: new Date().toISOString(),
        version: '1.0',
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const fileName = `budget_backup_${Date.now()}.json`;
    downloadFile(jsonContent, fileName, 'application/json');

    showNotification('Backup created successfully', 'success');
}
