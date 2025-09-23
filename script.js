// Global state
let currentMonth = null;
let monthlyData = new Map();
let categoryConfig = {
    'Food & Dining': { keywords: ['RESTAURANT', 'PIZZA', 'BURGER', 'CAFE', 'COFFEE'], icon: '🍕' },
    Groceries: { keywords: ['KROGER', 'WALMART', 'TARGET', 'WHOLE FOODS'], icon: '🛒' },
    Shopping: { keywords: ['AMAZON', 'AMZN'], icon: '🛍️' },
    Transportation: { keywords: ['BP', 'GAS', 'UBER', 'LYFT'], icon: '🚗' },
    Entertainment: { keywords: ['MOVIE', 'NETFLIX', 'SPOTIFY'], icon: '🎬' },
    Others: { keywords: [], icon: '📦' },
};
let budgets = {};
let charts = {};

// Load saved data on startup
window.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    if (monthlyData.size > 0) {
        const months = Array.from(monthlyData.keys()).sort().reverse();
        switchToMonth(months[0]);
    }
});

// Load saved data
function loadSavedData() {
    try {
        const saved = localStorage.getItem('sahabBudget_data');
        if (saved) {
            const data = JSON.parse(saved);
            monthlyData = new Map(data.monthlyData || []);
            categoryConfig = data.categoryConfig || categoryConfig;
            budgets = data.budgets || {};
            window.transactionOverrides = data.transactionOverrides || {};
            updateMonthSelector();
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

// Save data
function saveData() {
    try {
        const data = {
            monthlyData: Array.from(monthlyData.entries()),
            categoryConfig: categoryConfig,
            budgets: budgets,
            transactionOverrides: window.transactionOverrides || {},
        };
        localStorage.setItem('sahabBudget_data', JSON.stringify(data));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

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

// Split transactions by month
function splitByMonth(transactions) {
    let added = 0;
    let duplicates = 0;

    transactions.forEach((transaction) => {
        // Skip payment thank you transactions
        if (
            (transaction.Description || transaction.description || '')
                .toUpperCase()
                .includes('PAYMENT THANK YOU')
        ) {
            return;
        }

        const dateField = transaction['Transaction Date'] || transaction.Date || transaction.date;
        if (!dateField) return;

        const amount = parseFloat(transaction.Amount) || 0;
        if (amount === 0) return;

        const date = new Date(dateField);
        if (isNaN(date.getTime())) return;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                transactions: [],
                monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            });
        }

        const monthData = monthlyData.get(monthKey);

        // Check for duplicate
        if (isDuplicateTransaction(transaction, monthData.transactions)) {
            duplicates++;
        } else {
            // Add unique ID
            transaction._id = Math.random().toString(36).substr(2, 9);
            monthData.transactions.push(transaction);
            added++;
        }
    });

    return { added, duplicates };
}

// Reprocess all transactions with current category configuration
function reprocessAllTransactions() {
    let totalMoved = 0;

    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((transaction) => {
            const description = transaction.Description || transaction.description || '';
            const oldCategory = categorizeTransaction(description, transaction._id);

            // Check if there's an override for this transaction
            if (
                window.transactionOverrides &&
                window.transactionOverrides[monthKey] &&
                window.transactionOverrides[monthKey][transaction._id]
            ) {
                // Skip transactions with manual overrides
                return;
            }

            // Re-categorize based on current keywords
            const newCategory = categorizeTransactionByKeywords(description);

            // If category changed, we'll count it as moved
            if (oldCategory !== newCategory) {
                totalMoved++;
                // Note: The actual category change happens through the categorizeTransaction function
                // which will now return the new category based on updated keywords
            }
        });
    });

    return totalMoved;
}

// Helper function to categorize only by keywords (ignoring overrides)
function categorizeTransactionByKeywords(description) {
    const upperDesc = description.toUpperCase();

    for (const [category, config] of Object.entries(categoryConfig)) {
        if (category === 'Others') continue; // Check Others last

        if (config.keywords && config.keywords.length > 0) {
            for (const keyword of config.keywords) {
                if (keyword.toUpperCase() === 'WELL') {
                    console.log(`upperDesc: ${upperDesc}`);
                }
                if (upperDesc.includes(keyword.toUpperCase())) {
                    return category;
                }
            }
        }
    }

    return 'Others';
}

// Check if a transaction is a duplicate
function isDuplicateTransaction(newTransaction, existingTransactions) {
    const newDate =
        newTransaction['Transaction Date'] || newTransaction.Date || newTransaction.date;
    const newDesc = (newTransaction.Description || newTransaction.description || '').trim();
    const newAmount = parseFloat(newTransaction.Amount) || 0;

    // Check for exact duplicates (same date, description, and amount)
    return existingTransactions.some((existing) => {
        const existingDate = existing['Transaction Date'] || existing.Date || existing.date;
        const existingDesc = (existing.Description || existing.description || '').trim();
        const existingAmount = parseFloat(existing.Amount) || 0;

        // Compare date strings (to avoid timezone issues)
        const sameDate = new Date(newDate).toDateString() === new Date(existingDate).toDateString();
        const sameDesc = newDesc === existingDesc;
        const sameAmount = Math.abs(newAmount - existingAmount) < 0.01; // Handle floating point

        return sameDate && sameDesc && sameAmount;
    });
}

// Find and merge duplicate transactions
function findAndMergeDuplicates() {
    let totalDuplicates = 0;

    monthlyData.forEach((monthData, monthKey) => {
        const uniqueTransactions = [];
        const seen = new Set();

        monthData.transactions.forEach((transaction) => {
            const date = transaction['Transaction Date'] || transaction.Date || transaction.date;
            const desc = (transaction.Description || transaction.description || '').trim();
            const amount = parseFloat(transaction.Amount) || 0;

            // Create a unique key for this transaction
            const key = `${new Date(date).toDateString()}_${desc}_${amount.toFixed(2)}`;

            if (!seen.has(key)) {
                seen.add(key);
                uniqueTransactions.push(transaction);
            } else {
                totalDuplicates++;
            }
        });

        monthData.transactions = uniqueTransactions;
    });

    if (totalDuplicates > 0) {
        saveData();
        switchToMonth(currentMonth);
        showNotification(`Removed ${totalDuplicates} duplicate transactions`, 'success');
    } else {
        showNotification('No duplicate transactions found', 'success');
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

// Analyze transactions
function analyzeTransactions(transactions) {
    const categoryTotals = {};
    const categoryDetails = {};

    // Initialize categories
    Object.keys(categoryConfig).forEach((cat) => {
        categoryTotals[cat] = 0;
        categoryDetails[cat] = [];
    });

    transactions.forEach((transaction) => {
        const amount = Math.abs(parseFloat(transaction.Amount) || 0);
        const description = transaction.Description || transaction.description || '';
        const category = categorizeTransaction(description, transaction._id); // Pass the ID

        categoryTotals[category] += amount;
        categoryDetails[category].push({
            name: description,
            amount: amount,
            date: transaction['Transaction Date'] || transaction.Date || transaction.date,
            id: transaction._id,
            originalData: transaction,
        });
    });

    return {
        categoryTotals,
        categoryDetails,
        totalExpenses: Object.values(categoryTotals).reduce((a, b) => a + b, 0),
        transactionCount: transactions.length,
    };
}

// Categorize transaction
function categorizeTransaction(description, transactionId = null) {
    // First check if this specific transaction has an override
    if (
        transactionId &&
        window.transactionOverrides &&
        window.transactionOverrides[currentMonth] &&
        window.transactionOverrides[currentMonth][transactionId]
    ) {
        return window.transactionOverrides[currentMonth][transactionId];
    }

    const upperDesc = description.toUpperCase();

    for (const [category, config] of Object.entries(categoryConfig)) {
        if (category === 'Others') continue; // Check Others last

        if (config.keywords && config.keywords.length > 0) {
            for (const keyword of config.keywords) {
                if (keyword.toUpperCase() === 'WELL') {
                    console.log(`upperDesc: ${upperDesc}`);
                }
                if (upperDesc.includes(keyword.toUpperCase())) {
                    return category;
                }
            }
        }
    }

    return 'Others';
}

// Update dashboard
function updateDashboard(analyzer) {
    // Update summary cards
    const avgTransaction =
        analyzer.transactionCount > 0 ? analyzer.totalExpenses / analyzer.transactionCount : 0;

    const cardsHTML = `
        <div class="card">
            <h3>Total Expenses</h3>
            <p>$${analyzer.totalExpenses.toFixed(2)}</p>
        </div>
        <div class="card">
            <h3>Transactions</h3>
            <p>${analyzer.transactionCount}</p>
        </div>
        <div class="card">
            <h3>Categories</h3>
            <p>${
                Object.keys(analyzer.categoryTotals).filter((c) => analyzer.categoryTotals[c] > 0)
                    .length
            }</p>
        </div>
        <div class="card">
            <h3>Average</h3>
            <p>$${avgTransaction.toFixed(2)}</p>
        </div>
    `;
    document.getElementById('summaryCards').innerHTML = cardsHTML;

    // Update category details
    updateCategoryDetails(analyzer);

    // Update charts
    updateCharts(analyzer);
}

// Update category details
function updateCategoryDetails(analyzer) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    allCategories.forEach((category) => {
        const transactions = analyzer.categoryDetails[category] || [];
        const total = analyzer.categoryTotals[category] || 0;
        const config = categoryConfig[category] || { icon: '📦' };

        // Get budget info for current month
        const budget = (budgets[currentMonth] && budgets[currentMonth][category]) || 0;
        const remaining = budget - total;
        const percentage = budget > 0 ? (total / budget) * 100 : 0;

        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = category;

        const displayedTransactions = transactions.slice(0, 5);
        const remainingCount = transactions.length - 5;

        let transactionsHTML = '';

        if (transactions.length === 0) {
            transactionsHTML = `
                <div style="padding: 20px; text-align: center; color: var(--gray); font-size: 13px;">
                    No transactions
                </div>
            `;
        } else {
            transactionsHTML = `
                ${displayedTransactions
                    .map(
                        (t) => `
                    <div class="transaction-item" 
                         draggable="true" 
                         data-transaction-id="${t.id}"
                         data-category="${category}">
                        <span class="transaction-name">${t.name}</span>
                        <span style="display: flex; align-items: center;">
                            <span class="transaction-amount">$${t.amount.toFixed(2)}</span>
                            <button class="btn-icon" onclick="deleteTransaction('${category}', '${
                            t.id
                        }')">×</button>
                        </span>
                    </div>
                `
                    )
                    .join('')}
                ${
                    remainingCount > 0
                        ? `
                    <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" 
                            onclick="showAllTransactions('${category}')">
                        Show ${remainingCount} more
                    </button>
                `
                        : ''
                }
            `;
        }

        // Build budget status HTML
        let budgetStatusHTML = '';
        if (budget > 0) {
            const statusColor = remaining >= 0 ? 'var(--success)' : 'var(--danger)';
            const progressClass = percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : '';

            budgetStatusHTML = `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                        <span style="color: var(--gray);">Budget: $${budget.toFixed(2)}</span>
                        <span style="color: ${statusColor}; font-weight: 600;">
                            ${remaining >= 0 ? 'Remaining: ' : 'Over by: '}$${Math.abs(
                remaining
            ).toFixed(2)}
                        </span>
                    </div>
                    <div class="budget-progress" style="height: 4px; background: var(--light); border-radius: 2px; overflow: hidden;">
                        <div class="budget-progress-fill ${progressClass}" 
                             style="width: ${Math.min(
                                 percentage,
                                 100
                             )}%; height: 100%; transition: all 0.3s;
                                    background: ${
                                        progressClass === 'danger'
                                            ? 'var(--danger)'
                                            : progressClass === 'warning'
                                            ? 'var(--warning)'
                                            : 'var(--success)'
                                    }"></div>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="category-header">
                <div class="category-title">
                    <span>${config.icon}</span>
                    <h4>${category}</h4>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="category-total">$${total.toFixed(2)}</span>
                    ${
                        transactions.length > 0
                            ? `<button class="btn-text" onclick="showAllTransactions('${category}')">View all</button>`
                            : ''
                    }
                </div>
            </div>
            ${budgetStatusHTML}
            <div class="category-transactions">
                ${transactionsHTML}
            </div>
        `;

        container.appendChild(card);
    });

    // Initialize drag and drop
    initializeDragDrop();
}

// Initialize drag and drop
function initializeDragDrop() {
    const items = document.querySelectorAll('.transaction-item');
    const cards = document.querySelectorAll('.category-card');

    let draggedElement = null;
    let draggedId = null;
    let draggedCategory = null;

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedId = item.dataset.transactionId;
            draggedCategory = item.dataset.category;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedElement = null;
            draggedId = null;
            draggedCategory = null;
        });
    });

    cards.forEach((card) => {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');

            const targetCategory = card.dataset.category;
            if (draggedId && draggedCategory && draggedCategory !== targetCategory) {
                moveTransaction(draggedId, draggedCategory, targetCategory);
            }
        });
    });
}

// Move transaction between categories
function moveTransaction(transactionId, fromCategory, toCategory) {
    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    // Find the specific transaction
    const transaction = monthData.transactions.find((t) => t._id === transactionId);
    if (!transaction) return;

    // Get the exact description
    const description = (transaction.Description || transaction.description || '').trim();

    if (!window.transactionOverrides) {
        window.transactionOverrides = {};
    }

    if (!window.transactionOverrides[currentMonth]) {
        window.transactionOverrides[currentMonth] = {};
    }

    // Store this specific transaction's category override
    window.transactionOverrides[currentMonth][transactionId] = toCategory;

    saveData();
    switchToMonth(currentMonth);
    showNotification(`Moved to ${toCategory}`, 'success');
}

// Delete transaction
function deleteTransaction(category, transactionId) {
    if (!confirm('Delete this transaction?')) return;

    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    console.log('All transactions:', monthData.transactions);
    console.log('Looking for ID:', transactionId);

    const transaction = monthData.transactions.find((t) => t._id === transactionId);
    console.log('Matched transaction:', transaction);

    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }

    const targetDescription = (transaction.Description || transaction.description || '').trim();
    const targetAmount = Math.abs(parseFloat(transaction.Amount) || 0);

    const index = monthData.transactions.findIndex((t) => {
        const desc = (t.Description || t.description || '').trim();
        const amount = Math.abs(parseFloat(t.Amount) || 0);
        return desc === targetDescription && Math.abs(amount - targetAmount) < 0.01;
    });

    console.log('Match index:', index);

    if (index > -1) {
        monthData.transactions.splice(index, 1);
        saveData();
        switchToMonth(currentMonth);
        showNotification('Transaction deleted', 'success');
    } else {
        showNotification('Transaction not found', 'error');
    }
}

// Delete from modal
function deleteTransactionFromModal(category, transactionId) {
    deleteTransaction(category, transactionId);
    closeModal('transactionsModal');
}

// Show all transactions for a category
function showAllTransactions(category) {
    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    const analyzer = analyzeTransactions(monthData.transactions);
    const transactions = analyzer.categoryDetails[category] || [];

    document.getElementById('modalTitle').textContent = `${category} - All Transactions`;

    const listHTML = transactions
        .map(
            (t) => `
        <div class="transaction-row">
            <div>${new Date(t.date).toLocaleDateString()}</div>
            <div>${t.name}</div>
            <div>$${t.amount.toFixed(2)}</div>
            <div>
                <button class="btn-icon" onclick="deleteTransactionFromModal('${category}', '${
                t.id
            }')">×</button>
            </div>
        </div>
    `
        )
        .join('');

    document.getElementById('transactionsList').innerHTML = listHTML || '<p>No transactions</p>';
    document.getElementById('transactionsModal').classList.add('show');
}

// Update charts
function updateCharts(analyzer) {
    const categories = Object.entries(analyzer.categoryTotals)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) return;

    const labels = categories.map(([name]) => name);
    const values = categories.map(([_, value]) => value);
    const colors = [
        '#4f46e5',
        '#8b5cf6',
        '#ec4899',
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#3b82f6',
        '#6366f1',
    ];

    // Destroy existing charts
    if (charts.pie) charts.pie.destroy();
    if (charts.bar) charts.bar.destroy();

    // Pie chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    charts.pie = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: { size: 11 },
                    },
                },
            },
        },
    });

    // Bar chart
    const barCtx = document.getElementById('barChart').getContext('2d');
    charts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Amount',
                    data: values,
                    backgroundColor: colors[0],
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + value.toFixed(0),
                    },
                },
            },
        },
    });
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

// Update budget view in settings
function updateBudgetView(analyzer) {
    const container = document.getElementById('budgetGrid');
    if (!container) return;

    const monthKey = currentMonth;

    if (!budgets[monthKey]) {
        budgets[monthKey] = {};
    }

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const categoriesHTML = allCategories
        .map((category) => {
            const actual = analyzer.categoryTotals[category] || 0;
            const budget = budgets[monthKey][category] || 0;
            const remaining = budget - actual;
            const percentage = budget > 0 ? (actual / budget) * 100 : 0;
            const progressClass = percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : '';

            return `
                <div class="budget-item">
                    <div class="budget-header-title">
                        <span>${categoryConfig[category]?.icon || '📦'}</span>
                        <span>${category}</span>
                    </div>
                    <div class="budget-stats">
                        <div class="budget-stat">
                            <span class="label">Actual:</span>
                            <span class="value">$${actual.toFixed(2)}</span>
                        </div>
                        <div class="budget-stat">
                            <span class="label">Budget:</span>
                            <span class="value">${
                                budget > 0 ? '$' + budget.toFixed(2) : 'Not set'
                            }</span>
                        </div>
                        ${
                            budget > 0
                                ? `
                            <div class="budget-stat">
                                <span class="label">Remaining:</span>
                                <span class="value" style="color: ${
                                    remaining >= 0 ? 'var(--success)' : 'var(--danger)'
                                }">
                                    ${remaining >= 0 ? '+' : ''}$${remaining.toFixed(2)}
                                </span>
                            </div>
                        `
                                : ''
                        }
                    </div>
                    ${
                        budget > 0
                            ? `
                        <div class="budget-progress">
                            <div class="budget-progress-fill ${progressClass}" 
                                 style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    `
                            : ''
                    }
                    <div class="budget-input-group">
                        <input type="number" 
                               id="budget-${category.replace(/\s+/g, '-')}" 
                               placeholder="Set budget" 
                               value="${budget || ''}">
                        <button onclick="setBudget('${category}')">Set</button>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = categoriesHTML || '<p>No categories with expenses this month</p>';
}

// Set budget
function setBudget(category) {
    const inputId = `budget-${category.replace(/\s+/g, '-')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const value = parseFloat(input.value);

    if (!isNaN(value) && value > 0) {
        if (!budgets[currentMonth]) {
            budgets[currentMonth] = {};
        }
        budgets[currentMonth][category] = value;
        saveData();

        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }

        showNotification(`Budget set for ${category}`, 'success');
    } else {
        showNotification('Please enter a valid budget amount', 'error');
    }
}

// Update categories view in settings
function updateCategoriesView() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    // Sort categories alphabetically, but keep "Others" at the end
    const sortedCategories = Object.entries(categoryConfig).sort((a, b) => {
        if (a[0] === 'Others') return 1;
        if (b[0] === 'Others') return -1;
        return a[0].localeCompare(b[0]);
    });

    const html = sortedCategories
        .map(([name, config]) => {
            const nameId = name.replace(/\s+/g, '-');

            return `
                <div class="category-list-item">
                    <div class="category-list-header">
                        <div class="category-list-info">
                            <input type="text" id="icon-${nameId}" value="${
                config.icon
            }" style="width: 40px;" />
                            <h4>${name}</h4>
                        </div>
                        ${
                            name !== 'Others'
                                ? `<button class="btn btn-danger" onclick="removeCategory('${name}')">Remove</button>`
                                : ''
                        }
                    </div>
                    <div class="category-keywords">
                        <label>Keywords:</label>
                        <input type="text" id="keywords-${nameId}" value="${config.keywords.join(
                ', '
            )}" style="width: 100%;" />
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = html;
}

// Add new category with keywords
function addNewCategory() {
    const name = prompt('Enter category name:');
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();

    if (categoryConfig[trimmedName]) {
        showNotification('Category already exists', 'error');
        return;
    }

    // Ask for initial keywords
    const keywordsInput = prompt('Enter keywords for this category (comma-separated, optional):');
    const keywords = keywordsInput
        ? keywordsInput
              .split(',')
              .map((k) => k.trim().toUpperCase())
              .filter((k) => k.length > 0)
        : [];

    categoryConfig[trimmedName] = {
        keywords: keywords,
        icon: '📦',
    };

    // If keywords were added, reprocess transactions
    let message = `Category "${trimmedName}" added`;
    if (keywords.length > 0) {
        const movedCount = reprocessAllTransactions();
        if (movedCount > 0) {
            message += ` and ${movedCount} transactions categorized`;
        }
    }

    saveData();

    // Refresh the current view
    if (currentMonth) {
        switchToMonth(currentMonth);
    }

    updateCategoriesView();
    updateSettingsView();

    showNotification(message, 'success');
}

// Manually trigger recategorization
function recategorizeAll() {
    if (
        !confirm(
            'This will re-categorize all transactions based on current keywords. Manual drag-drop changes will be preserved. Continue?'
        )
    ) {
        return;
    }

    const movedCount = reprocessAllTransactions();

    saveData();

    if (currentMonth) {
        switchToMonth(currentMonth);
    }

    if (movedCount > 0) {
        showNotification(`${movedCount} transactions re-categorized`, 'success');
    } else {
        showNotification('No transactions needed re-categorization', 'success');
    }
}

// Remove category
function removeCategory(name) {
    if (!confirm(`Remove category "${name}"? Transactions will be moved to "Others".`)) return;

    delete categoryConfig[name];
    saveData();

    // Refresh views
    if (currentMonth) {
        switchToMonth(currentMonth);
        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            const analyzer = analyzeTransactions(monthData.transactions);
            updateBudgetView(analyzer);
        }
    }

    updateCategoriesView();
    updateSettingsView();

    showNotification(`Category "${name}" removed`, 'success');
}

// Update settings view
function updateSettingsView() {
    const container = document.getElementById('categoryConfig');
    if (!container) return;

    const html = Object.entries(categoryConfig)
        .map(
            ([name, config]) => `
        <div class="config-item">
            <h4>${name}</h4>
            <div class="config-inputs">
                <input type="text" 
                       id="icon-${name.replace(/\s+/g, '-')}" 
                       value="${config.icon}" 
                       placeholder="Icon">
                <input type="text" 
                       id="keywords-${name.replace(/\s+/g, '-')}" 
                       value="${config.keywords.join(', ')}" 
                       placeholder="Keywords (comma-separated)">
            </div>
        </div>
    `
        )
        .join('');

    container.innerHTML = html;
}

// Save category configuration
function saveCategoryConfig() {
    let hasChanges = false;
    const oldConfig = JSON.parse(JSON.stringify(categoryConfig)); // Deep copy for comparison

    Object.keys(categoryConfig).forEach((name) => {
        const iconId = `icon-${name.replace(/\s+/g, '-')}`;
        const keywordsId = `keywords-${name.replace(/\s+/g, '-')}`;

        const iconInput = document.getElementById(iconId);
        const keywordsInput = document.getElementById(keywordsId);

        if (iconInput && iconInput.value !== categoryConfig[name].icon) {
            categoryConfig[name].icon = iconInput.value || '📦';
            hasChanges = true;
        }

        if (keywordsInput) {
            const newKeywords = keywordsInput.value
                .split(',')
                .map((k) => k.trim().toUpperCase())
                .filter((k) => k.length > 0);

            if (JSON.stringify(newKeywords) !== JSON.stringify(categoryConfig[name].keywords)) {
                categoryConfig[name].keywords = newKeywords;
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        // Clear any transaction overrides that might conflict with new keywords
        if (
            confirm(
                'Update categories and re-categorize all transactions based on new keywords? (Manual overrides will be preserved)'
            )
        ) {
            // Reprocess all transactions
            const movedCount = reprocessAllTransactions();

            saveData();

            // Refresh current month with new categorization
            if (currentMonth) {
                switchToMonth(currentMonth);
                const monthData = monthlyData.get(currentMonth);
                if (monthData) {
                    const analyzer = analyzeTransactions(monthData.transactions);
                    updateBudgetView(analyzer);
                }
            }

            updateCategoriesView();

            let message = 'Configuration saved';
            if (movedCount > 0) {
                message += ` and ${movedCount} transactions re-categorized`;
            }
            showNotification(message, 'success');
        }
    } else {
        showNotification('No changes to save', 'success');
    }
}

// Clear all data
function clearAllData() {
    if (
        !confirm(
            'This will delete all data including transactions, budgets, and categories. Continue?'
        )
    ) {
        return;
    }

    if (confirm('Are you absolutely sure? This cannot be undone.')) {
        localStorage.removeItem('sahabBudget_data');
        window.transactionOverrides = {};
        location.reload();
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
