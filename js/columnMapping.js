// js/columnMapping.js - CSV Column Mapping for Unknown Bank Formats

// Store pending CSV data and parsed results for mapping
window.pendingCsvData = null;
window.pendingCsvFiles = null;
window.savedBankMappings = {};

// Load saved bank mappings from localStorage
function loadBankMappings() {
    try {
        const saved = localStorage.getItem('sahabBudget_bankMappings');
        if (saved) {
            window.savedBankMappings = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading bank mappings:', error);
    }
}

// Save bank mappings to localStorage
function saveBankMappings() {
    try {
        localStorage.setItem('sahabBudget_bankMappings', JSON.stringify(window.savedBankMappings));
    } catch (error) {
        console.error('Error saving bank mappings:', error);
    }
}

// Known bank format detection patterns
const knownBankFormats = {
    chase: {
        name: 'Chase',
        detect: (headers) => {
            const h = headers.map(h => h.toLowerCase());
            return (h.includes('transaction date') || h.includes('post date')) &&
                   (h.includes('description') || h.includes('original description')) &&
                   h.includes('amount');
        },
        mapping: {
            date: ['Transaction Date', 'Post Date', 'Posting Date'],
            description: ['Description', 'Original Description'],
            amount: ['Amount']
        },
        negativeIsExpense: true
    },
    firstFinancial: {
        name: 'First Financial',
        detect: (headers) => {
            const h = headers.map(h => h.toLowerCase());
            return h.includes('posted_at') &&
                   (h.includes('nickname') || h.includes('original_name')) &&
                   h.includes('amount');
        },
        mapping: {
            date: ['posted_at'],
            description: ['nickname', 'original_name'],
            amount: ['amount']
        },
        negativeIsExpense: false // First Financial uses positive for expenses
    }
};

// Detect if CSV matches a known bank format
function detectBankFormat(headers) {
    // First check saved custom mappings
    for (const [bankId, mapping] of Object.entries(window.savedBankMappings)) {
        if (mapping.headers && arraysEqual(mapping.headers.sort(), headers.sort())) {
            return {
                type: 'custom',
                name: mapping.bankName,
                mapping: mapping
            };
        }
    }

    // Check known formats
    for (const [bankId, format] of Object.entries(knownBankFormats)) {
        if (format.detect(headers)) {
            return {
                type: 'known',
                name: format.name,
                mapping: format.mapping,
                negativeIsExpense: format.negativeIsExpense
            };
        }
    }

    return null;
}

// Helper to compare arrays
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
}

// Find the matching column from possible options
function findColumn(headers, possibleNames) {
    for (const name of possibleNames) {
        const found = headers.find(h => h.toLowerCase() === name.toLowerCase());
        if (found) return found;
    }
    return null;
}

// Show column mapping modal
function showColumnMappingModal(parsedData, files) {
    window.pendingCsvData = parsedData;
    window.pendingCsvFiles = files;

    const headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];

    // Populate preview table
    const previewTable = document.getElementById('csvPreviewTable');
    let tableHtml = '<thead><tr>';
    headers.forEach(h => {
        tableHtml += `<th>${escapeHtml(h)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Show first 5 rows
    const previewRows = parsedData.slice(0, 5);
    previewRows.forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(h => {
            tableHtml += `<td>${escapeHtml(String(row[h] || ''))}</td>`;
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody>';
    previewTable.innerHTML = tableHtml;

    // Populate dropdowns
    const dateSelect = document.getElementById('dateColumnSelect');
    const descSelect = document.getElementById('descriptionColumnSelect');
    const amountSelect = document.getElementById('amountColumnSelect');

    [dateSelect, descSelect, amountSelect].forEach(select => {
        select.innerHTML = '<option value="">-- Select column --</option>';
        headers.forEach(h => {
            select.innerHTML += `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`;
        });
    });

    // Try to auto-select likely columns based on common patterns
    autoSelectColumns(headers, dateSelect, descSelect, amountSelect);

    // Show modal
    document.getElementById('columnMappingModal').classList.add('show');
    document.getElementById('loading').style.display = 'none';
}

// Auto-select columns based on common naming patterns
function autoSelectColumns(headers, dateSelect, descSelect, amountSelect) {
    const lowerHeaders = headers.map(h => ({ original: h, lower: h.toLowerCase() }));

    // Date patterns
    const datePatterns = ['date', 'posted', 'trans', 'transaction'];
    for (const header of lowerHeaders) {
        if (datePatterns.some(p => header.lower.includes(p))) {
            dateSelect.value = header.original;
            break;
        }
    }

    // Description patterns
    const descPatterns = ['description', 'merchant', 'name', 'payee', 'memo', 'detail'];
    for (const header of lowerHeaders) {
        if (descPatterns.some(p => header.lower.includes(p))) {
            descSelect.value = header.original;
            break;
        }
    }

    // Amount patterns
    const amountPatterns = ['amount', 'debit', 'credit', 'sum', 'total', 'value'];
    for (const header of lowerHeaders) {
        if (amountPatterns.some(p => header.lower.includes(p))) {
            amountSelect.value = header.original;
            break;
        }
    }
}

// Cancel column mapping
function cancelColumnMapping() {
    document.getElementById('columnMappingModal').classList.remove('show');
    window.pendingCsvData = null;
    window.pendingCsvFiles = null;

    // Reset file input
    const fileInput = document.getElementById('csvFile');
    if (fileInput) fileInput.value = '';
}

// Apply column mapping and process transactions
function applyColumnMapping() {
    const dateColumn = document.getElementById('dateColumnSelect').value;
    const descColumn = document.getElementById('descriptionColumnSelect').value;
    const amountColumn = document.getElementById('amountColumnSelect').value;
    const negativeIsExpense = document.getElementById('amountNegativeExpense').checked;
    const bankName = document.getElementById('bankNameInput').value.trim();

    // Validate required fields
    if (!dateColumn || !descColumn || !amountColumn) {
        showNotification('Please select all required columns', 'error');
        return;
    }

    // Save mapping if bank name provided
    if (bankName) {
        const headers = Object.keys(window.pendingCsvData[0]);
        const mappingId = bankName.toLowerCase().replace(/\s+/g, '_');
        window.savedBankMappings[mappingId] = {
            bankName: bankName,
            headers: headers,
            dateColumn: dateColumn,
            descriptionColumn: descColumn,
            amountColumn: amountColumn,
            negativeIsExpense: negativeIsExpense
        };
        saveBankMappings();
    }

    // Process transactions with the mapping
    const mapping = {
        dateColumn,
        descriptionColumn: descColumn,
        amountColumn,
        negativeIsExpense
    };

    processTransactionsWithMapping(window.pendingCsvData, mapping);

    // Close modal
    document.getElementById('columnMappingModal').classList.remove('show');
    window.pendingCsvData = null;
    window.pendingCsvFiles = null;
}

// Process transactions using custom column mapping
function processTransactionsWithMapping(transactions, mapping) {
    const normalizedTransactions = [];

    transactions.forEach(row => {
        const dateValue = row[mapping.dateColumn];
        const descValue = row[mapping.descriptionColumn];
        let amountValue = parseFloat(row[mapping.amountColumn]) || 0;

        // Skip if missing required fields
        if (!dateValue || !descValue) return;

        // Handle amount sign based on bank convention
        if (mapping.negativeIsExpense) {
            // Standard: negative = expense, positive = income
            if (amountValue >= 0) return; // Skip income
        } else {
            // Reversed: positive = expense, negative = income
            if (amountValue <= 0) return; // Skip income
            amountValue = -Math.abs(amountValue); // Convert to negative for consistency
        }

        // Create normalized transaction
        normalizedTransactions.push({
            'Transaction Date': dateValue,
            Description: String(descValue).toUpperCase(),
            Amount: amountValue,
            _originalFormat: 'CustomMapping'
        });
    });

    if (normalizedTransactions.length === 0) {
        showNotification('No valid expense transactions found', 'error');
        const fileInput = document.getElementById('csvFile');
        if (fileInput) fileInput.value = '';
        return;
    }

    // Use the existing splitByMonth function to process
    const processResult = splitByMonth(normalizedTransactions);

    saveData();

    // Show result
    let message = `Processed ${normalizedTransactions.length} transactions`;
    if (processResult.rulesApplied > 0) {
        message += ` (${processResult.rulesApplied} removed by custom rules)`;
    }
    if (processResult.skipped > 0) {
        message += ` (${processResult.skipped} skipped)`;
    }
    if (processResult.duplicates > 0) {
        message += ` (${processResult.duplicates} duplicates skipped)`;
    }
    if (processResult.added > 0) {
        message += ` - ${processResult.added} new expenses added`;
    }
    showNotification(message, 'success');

    // Reload after short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    loadBankMappings();
});

// Export for use in main.js
window.detectBankFormat = detectBankFormat;
window.showColumnMappingModal = showColumnMappingModal;
window.findColumn = findColumn;
