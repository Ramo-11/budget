// js/main.js - Main App Controller and Event Handlers

// Load saved data on startup
window.addEventListener('DOMContentLoaded', () => {
    if (!window.merchantRules) {
        window.merchantRules = {};
    }

    loadSavedData();
    if (monthlyData.size > 0) {
        updateMonthSelector();
        document.getElementById('monthDropdown').value = 'ALL_DATA';
        switchToMonth('ALL_DATA');
    }

    // Initialize quick stats widget
    initializeWidget();
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
        initializeWidget();

        // Show detailed upload result
        let message = `Processed ${allTransactions.length} transactions`;
        if (processResult.rulesApplied > 0) {
            message += ` (${processResult.rulesApplied} removed by custom rules)`;
        }
        if (processResult.skipped > 0) {
            message += ` (${processResult.skipped} income/credits skipped)`;
        }
        if (processResult.duplicates > 0) {
            message += ` (${processResult.duplicates} duplicates skipped)`;
        }
        if (processResult.added > 0) {
            message += ` - ${processResult.added} new expenses added`;
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

// Switch view
function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(viewName + 'View').classList.add('active');
    event.target.classList.add('active');

    if (viewName === 'settings') {
        // Filter out ALL_DATA option for settings view
        const dropdown = document.getElementById('monthDropdown');
        const currentValue = dropdown.value;

        // Temporarily remove ALL_DATA option
        const allDataOption = dropdown.querySelector('option[value="ALL_DATA"]');
        if (allDataOption) {
            allDataOption.style.display = 'none';
        }

        // If currently on ALL_DATA, switch to most recent month
        if (currentMonth === 'ALL_DATA') {
            const months = Array.from(monthlyData.keys()).sort().reverse();
            if (months.length > 0) {
                dropdown.value = months[0];
                switchToMonth(months[0]);
            }
        } else if (currentMonth) {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateBudgetView(analyzer);
            }
        }
        updateMerchantRulesDisplay();
    } else {
        // Show ALL_DATA option for other views
        const dropdown = document.getElementById('monthDropdown');
        const allDataOption = dropdown.querySelector('option[value="ALL_DATA"]');
        if (allDataOption) {
            allDataOption.style.display = '';
        }
    }
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
