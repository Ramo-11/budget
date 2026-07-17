// js/utils.js - Utility Functions

// Canonical HTML escaper. Encodes &, <, >, ", ' so untrusted strings (CSV
// descriptions, category names, rule fields, restored backups) are safe in both
// text and quoted-attribute contexts. Use everywhere before interpolating
// untrusted data into innerHTML.
window.escapeHtml = function (value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
// Alias for readability when escaping specifically for an attribute value.
window.escapeAttr = window.escapeHtml;

// Collect the transactions currently in view, honoring ALL_DATA / CUSTOM_RANGE.
function getTransactionsForCurrentView() {
    if (currentMonth === 'ALL_DATA') {
        const all = [];
        monthlyData.forEach((m) => all.push(...m.transactions));
        return all;
    }
    if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
        const start = new Date(window.customDateRange.start);
        const end = new Date(window.customDateRange.end);
        end.setHours(23, 59, 59, 999);
        const out = [];
        monthlyData.forEach((m) => {
            m.transactions.forEach((t) => {
                const d = new Date(t['Transaction Date'] || t.Date || t.date);
                if (d >= start && d <= end) out.push(t);
            });
        });
        return out;
    }
    if (currentMonth && monthlyData.has(currentMonth)) {
        return monthlyData.get(currentMonth).transactions;
    }
    return null;
}

// Export to CSV
function exportToCSV() {
    const transactions = getTransactionsForCurrentView();
    if (!transactions) {
        showNotification('No data to export', 'error');
        return;
    }

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
    const label = (currentMonth || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `budget_${label}.csv`;
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

// Populate export month dropdown. Default option ("All transactions") is preserved
// so the unified Export CSV control can choose between all-data and a single month.
function populateExportMonthDropdown() {
    const select = document.getElementById('exportMonthSelect');
    if (!select) return;

    select.innerHTML = '<option value="all">All transactions</option>';

    const months = Array.from(monthlyData.keys()).sort().reverse();
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthData.monthName;
        select.appendChild(option);
    });
}
