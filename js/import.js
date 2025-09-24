// js/import.js - Import/Export Module

// Import JSON backup
function importJSONBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // Validate the backup structure
            if (!importData.version || !importData.monthlyData) {
                throw new Error('Invalid backup file format');
            }

            // Show import options modal
            showImportOptionsModal(importData);
        } catch (error) {
            showNotification('Error reading backup file: ' + error.message, 'error');
        }
    };

    input.click();
}

// Show import options modal
function showImportOptionsModal(importData) {
    const modal = document.getElementById('importModal');
    const importDate = new Date(importData.exportDate).toLocaleString();
    const monthCount = importData.monthlyData.length;

    let transactionCount = 0;
    importData.monthlyData.forEach(([key, data]) => {
        transactionCount += data.transactions.length;
    });

    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>Import Backup</h2>
                <button class="close-btn" onclick="closeModal('importModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="import-info">
                    <h4>Backup Details:</h4>
                    <div class="import-stats">
                        <div class="import-stat">
                            <span>Created:</span>
                            <strong>${importDate}</strong>
                        </div>
                        <div class="import-stat">
                            <span>Months:</span>
                            <strong>${monthCount}</strong>
                        </div>
                        <div class="import-stat">
                            <span>Transactions:</span>
                            <strong>${transactionCount}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="import-options">
                    <label class="import-option">
                        <input type="radio" name="importMode" value="replace" checked>
                        <div>
                            <strong>Replace All Data</strong>
                            <small>Remove current data and use backup only</small>
                        </div>
                    </label>
                    <label class="import-option">
                        <input type="radio" name="importMode" value="merge">
                        <div>
                            <strong>Merge Data</strong>
                            <small>Combine backup with existing data (skip duplicates)</small>
                        </div>
                    </label>
                </div>
                
                <div class="import-warning">
                    ⚠️ This action cannot be undone. Consider exporting current data first.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('importModal')">Cancel</button>
                <button class="btn btn-primary" onclick="executeImport('${encodeURIComponent(
                    JSON.stringify(importData)
                )}')">
                    Import
                </button>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

// Execute the import
function executeImport(encodedData) {
    const importData = JSON.parse(decodeURIComponent(encodedData));
    const mode = document.querySelector('input[name="importMode"]:checked').value;

    try {
        if (mode === 'replace') {
            // Replace all data
            monthlyData = new Map(importData.monthlyData);
            categoryConfig = importData.categoryConfig || categoryConfig;
            budgets = importData.budgets || {};
            window.transactionOverrides = importData.transactionOverrides || {};
            window.merchantRules = importData.merchantRules || {};
        } else {
            // Merge data
            const existingData = new Map(monthlyData);
            const importMap = new Map(importData.monthlyData);

            importMap.forEach((monthData, monthKey) => {
                if (!existingData.has(monthKey)) {
                    existingData.set(monthKey, monthData);
                } else {
                    // Merge transactions, avoiding duplicates
                    const existing = existingData.get(monthKey);
                    monthData.transactions.forEach((transaction) => {
                        if (!isDuplicateTransaction(transaction, existing.transactions)) {
                            existing.transactions.push(transaction);
                        }
                    });
                }
            });

            monthlyData = existingData;

            // Merge other data
            Object.assign(categoryConfig, importData.categoryConfig || {});
            Object.assign(budgets, importData.budgets || {});
            Object.assign(window.transactionOverrides, importData.transactionOverrides || {});
            Object.assign(window.merchantRules, importData.merchantRules || {});
        }

        saveData();
        updateMonthSelector();

        if (monthlyData.size > 0) {
            document.getElementById('monthDropdown').value = 'ALL_DATA';
            switchToMonth('ALL_DATA');
        }

        closeModal('importModal');
        showNotification('Backup imported successfully', 'success');
    } catch (error) {
        showNotification('Import failed: ' + error.message, 'error');
    }
}
