// js/main.js - Main App Controller and Event Handlers

// Load saved data on startup
window.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    if (monthlyData.size > 0) {
        const months = Array.from(monthlyData.keys()).sort().reverse();
        switchToMonth(months[0]);
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

        const months = Array.from(monthlyData.keys()).sort().reverse();
        if (months.length > 0) {
            switchToMonth(months[0]);
        }

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
    if (!monthKey || !monthlyData.has(monthKey)) return;

    currentMonth = monthKey;
    const monthData = monthlyData.get(monthKey);

    const analyzer = analyzeTransactions(monthData.transactions);
    updateDashboard(analyzer);

    if (document.getElementById('settingsView').classList.contains('active')) {
        updateBudgetView(analyzer);
    }
}

// Switch view
function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(viewName + 'View').classList.add('active');
    event.target.classList.add('active');

    if (viewName === 'settings' && currentMonth) {
        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
            updateCategoriesView();
            updateSettingsView();
        }
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
