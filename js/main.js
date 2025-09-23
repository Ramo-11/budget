// js/main.js - Main App Controller and Event Handlers

// Load saved data on startup
window.addEventListener('DOMContentLoaded', () => {
    // Initialize merchantRules if not already done
    if (!window.merchantRules) {
        window.merchantRules = {};
    }

    loadSavedData();
    if (monthlyData.size > 0) {
        updateMonthSelector();
        document.getElementById('monthDropdown').value = 'ALL_DATA';
        switchToMonth('ALL_DATA');
    }
});

// Handle file upload
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    document.getElementById('loading').style.display = 'block';

    try {
        const allTransactions = [];

        for (const file of files) {
            const text = await file.text();
            const result = Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
            });

            if (result.errors.length > 0) {
                console.warn('CSV parsing warnings:', result.errors);
            }

            allTransactions.push(...result.data);
        }

        if (allTransactions.length === 0) {
            throw new Error('No valid transactions found in files');
        }

        // Process and detect duplicates
        const processResult = splitByMonth(allTransactions);
        updateMonthSelector();

        // Always add ALL_DATA as option
        const dropdown = document.getElementById('monthDropdown');
        if (![...dropdown.options].some((opt) => opt.value === 'ALL_DATA')) {
            const opt = document.createElement('option');
            opt.value = 'ALL_DATA';
            opt.textContent = 'All Data';
            dropdown.prepend(opt);
        }

        // Default to ALL_DATA after upload
        document.getElementById('monthDropdown').value = 'ALL_DATA';
        switchToMonth('ALL_DATA');

        saveData();

        // Show detailed upload result
        let message = `Processed ${allTransactions.length} transactions`;
        if (processResult.duplicates > 0) {
            message += ` (${processResult.duplicates} duplicates skipped)`;
        }
        if (processResult.added > 0) {
            message += ` - ${processResult.added} new added`;
        }
        showNotification(message, 'success');
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Error processing files: ' + error.message, 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
        event.target.value = ''; // Reset file input
    }
}

// Update month selector
function updateMonthSelector() {
    const selector = document.getElementById('monthSelector');
    const dropdown = document.getElementById('monthDropdown');

    dropdown.innerHTML = '';
    const months = Array.from(monthlyData.keys()).sort().reverse();

    // Add "All Data" option first
    const allOption = document.createElement('option');
    allOption.value = 'ALL_DATA';
    allOption.textContent = '📊 All Months Combined';
    dropdown.appendChild(allOption);

    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    dropdown.appendChild(separator);

    // Add individual months
    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthData.monthName;
        dropdown.appendChild(option);
    });

    selector.style.display = months.length > 0 ? 'block' : 'none';
}

// Switch to month
function switchToMonth(monthKey) {
    if (!monthKey) return;

    // Handle "All Data" option
    if (monthKey === 'ALL_DATA') {
        currentMonth = 'ALL_DATA';

        // Combine all transactions
        const allTransactions = [];
        monthlyData.forEach((monthData) => {
            allTransactions.push(...monthData.transactions);
        });

        const analyzer = analyzeTransactions(allTransactions);
        updateDashboard(analyzer);

        if (document.getElementById('settingsView').classList.contains('active')) {
            // Settings view doesn't make sense for "All Data", so switch to dashboard
            switchView('dashboard');
        }
        return;
    }

    // Regular month handling
    if (!monthlyData.has(monthKey)) return;

    currentMonth = monthKey;
    const monthData = monthlyData.get(monthKey);

    const analyzer = analyzeTransactions(monthData.transactions);
    updateDashboard(analyzer);

    if (document.getElementById('settingsView').classList.contains('active')) {
        updateBudgetView(analyzer);
    }
}

// Switch view
// Switch view
function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(viewName + 'View').classList.add('active');
    event.target.classList.add('active');

    if (viewName === 'settings') {
        // Can't set budgets for "All Data" - switch to most recent month
        if (currentMonth === 'ALL_DATA') {
            const months = Array.from(monthlyData.keys()).sort().reverse();
            if (months.length > 0) {
                // Switch dropdown to most recent month
                document.getElementById('monthDropdown').value = months[0];
                switchToMonth(months[0]);
                showNotification(
                    'Switched to ' + monthlyData.get(months[0]).monthName + ' for budget settings',
                    'info'
                );
            }
        } else if (currentMonth) {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateBudgetView(analyzer);
                updateCategoriesView();
                updateSettingsView();
            }
        }

        updateMerchantRulesDisplay();
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove any existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach((n) => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Apply merchant rules to all data when viewing "All Data"
function applyMerchantRulesToAllData() {
    if (!window.merchantRules || Object.keys(window.merchantRules).length === 0) return;

    let rulesApplied = 0;

    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((transaction) => {
            // Skip if already has an override
            if (
                window.transactionOverrides &&
                window.transactionOverrides[monthKey] &&
                window.transactionOverrides[monthKey][transaction._id]
            ) {
                return;
            }

            const description = (
                transaction.Description ||
                transaction.description ||
                ''
            ).toUpperCase();

            // Check if any merchant rule applies
            for (const [merchant, category] of Object.entries(window.merchantRules)) {
                if (description.includes(merchant)) {
                    rulesApplied++;
                    break;
                }
            }
        });
    });

    if (rulesApplied > 0) {
        console.log(`Applied merchant rules to ${rulesApplied} transactions`);
    }
}
