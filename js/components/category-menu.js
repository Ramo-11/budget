// Category Menu Implementation
let currentCategoryMenu = null;

function showCategoryMenu(category) {
    // Close any existing menu
    if (currentCategoryMenu) {
        currentCategoryMenu.remove();
    }

    // Get category data
    const categoryData = getCategoryData(category);

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'category-menu-popup';
    menu.innerHTML = `
        <div class="menu-overlay" onclick="closeCategoryMenu()"></div>
        <div class="menu-content">
            <div class="menu-header">
                <h3>${category} Options</h3>
                <button class="close-btn" onclick="closeCategoryMenu()">×</button>
            </div>
            <div class="menu-options">
                <button class="menu-option" onclick="showAllTransactions('${category}')">
                    <span class="option-icon">📋</span>
                    <span class="option-text">View All Transactions</span>
                    <span class="option-badge">${categoryData.count}</span>
                </button>
                <button class="menu-option" onclick="categoryView.showCategoryAnalysis('${category}', '${app.currentMonth}')">
                    <span class="option-icon">📊</span>
                    <span class="option-text">Deep Analysis</span>
                </button>
                <button class="menu-option" onclick="setCategoryBudget('${category}')">
                    <span class="option-icon">💰</span>
                    <span class="option-text">Set Budget</span>
                </button>
                <button class="menu-option" onclick="exportCategoryData('${category}')">
                    <span class="option-icon">📥</span>
                    <span class="option-text">Export Data</span>
                </button>
                <button class="menu-option" onclick="renameCategoryInView('${category}')">
                    <span class="option-icon">✏️</span>
                    <span class="option-text">Rename Category</span>
                </button>
                <button class="menu-option danger" onclick="clearCategoryTransactions('${category}')">
                    <span class="option-icon">🗑️</span>
                    <span class="option-text">Clear All</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(menu);
    currentCategoryMenu = menu;

    // Animate in
    setTimeout(() => menu.classList.add('show'), 10);
}

function closeCategoryMenu() {
    if (currentCategoryMenu) {
        currentCategoryMenu.classList.remove('show');
        setTimeout(() => {
            currentCategoryMenu.remove();
            currentCategoryMenu = null;
        }, 300);
    }
}

function getCategoryData(category) {
    if (!app.currentMonth || !app.monthlyData.has(app.currentMonth)) {
        return { count: 0, total: 0 };
    }

    const monthData = app.monthlyData.get(app.currentMonth);
    const analyzer = new ExpenseAnalyzer();
    analyzer.setCategoryConfig(userManager.getCategoryConfig());
    analyzer.processData(monthData.transactions);

    return {
        count: analyzer.categoryDetails[category]?.length || 0,
        total: analyzer.categoryTotals[category] || 0,
    };
}

function setCategoryBudget(category) {
    const currentBudget = budgetManager.getCategoryBudget(app.currentMonth, category);
    const newBudget = prompt(`Set budget for ${category}:`, currentBudget || '');

    if (newBudget && !isNaN(parseFloat(newBudget))) {
        budgetManager.setCategoryBudget(app.currentMonth, category, parseFloat(newBudget));
        notificationManager.show(`Budget set for ${category}`, 'success');

        // Refresh view
        if (app.currentMonth) {
            app.switchToMonth(app.currentMonth);
        }
    }
}

function exportCategoryData(category) {
    const monthData = app.monthlyData.get(app.currentMonth);
    const analyzer = new ExpenseAnalyzer();
    analyzer.setCategoryConfig(userManager.getCategoryConfig());
    analyzer.processData(monthData.transactions);

    const categoryTransactions = analyzer.categoryDetails[category] || [];
    const exportData = {
        category: category,
        month: monthData.monthName,
        total: analyzer.categoryTotals[category] || 0,
        transactionCount: categoryTransactions.length,
        transactions: categoryTransactions,
        exportDate: new Date().toISOString(),
    };

    const filename = `${category}_${app.currentMonth}_export.json`;
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
    notificationManager.show(`${category} data exported`, 'success');
}

function renameCategoryInView(oldCategory) {
    const newName = prompt(`Rename category "${oldCategory}" to:`, oldCategory);

    if (newName && newName !== oldCategory) {
        // Update in all loaded data
        app.monthlyData.forEach((monthData, monthKey) => {
            monthData.transactions.forEach((transaction) => {
                if (transaction.Category === oldCategory) {
                    transaction.Category = newName;
                }
            });
        });

        // Update in user config
        const config = userManager.getCategoryConfig();
        if (config[oldCategory]) {
            config[newName] = config[oldCategory];
            delete config[oldCategory];
            userManager.setCategoryConfig(config);
        }

        // Save and refresh
        app.saveData();
        app.switchToMonth(app.currentMonth);
        notificationManager.show(`Category renamed to "${newName}"`, 'success');
    }
}

function clearCategoryTransactions(category) {
    if (
        confirm(
            `Are you sure you want to clear all transactions in ${category}? This cannot be undone.`
        )
    ) {
        const monthData = app.monthlyData.get(app.currentMonth);

        // Filter out transactions for this category
        monthData.transactions = monthData.transactions.filter((t) => {
            const analyzer = new ExpenseAnalyzer();
            analyzer.setCategoryConfig(userManager.getCategoryConfig());
            const txCategory = analyzer.categorizeTransaction(t.Description);
            return txCategory !== category;
        });

        // Save and refresh
        app.saveData();
        app.switchToMonth(app.currentMonth);
        notificationManager.show(`${category} transactions cleared`, 'success');
    }
}

// Show All Transactions Implementation
function showAllTransactions(category) {
    // Close category menu if open
    closeCategoryMenu();

    // Get transactions for this category
    const monthData = app.monthlyData.get(app.currentMonth);
    const analyzer = new ExpenseAnalyzer();
    analyzer.setCategoryConfig(userManager.getCategoryConfig());
    analyzer.processData(monthData.transactions);

    const transactions = analyzer.categoryDetails[category] || [];
    const total = analyzer.categoryTotals[category] || 0;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'transactions-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeTransactionsModal()"></div>
        <div class="modal-content large">
            <div class="modal-header">
                <h2>
                    <span class="category-icon">${
                        userManager.getCategoryConfig()[category]?.icon || '📦'
                    }</span>
                    ${category} - All Transactions
                </h2>
                <button class="close-btn" onclick="closeTransactionsModal()">×</button>
            </div>
            
            <div class="modal-subheader">
                <div class="subheader-stats">
                    <div class="stat">
                        <label>Total</label>
                        <value>$${total.toFixed(2)}</value>
                    </div>
                    <div class="stat">
                        <label>Transactions</label>
                        <value>${transactions.length}</value>
                    </div>
                    <div class="stat">
                        <label>Average</label>
                        <value>$${
                            transactions.length > 0
                                ? (total / transactions.length).toFixed(2)
                                : '0.00'
                        }</value>
                    </div>
                    <div class="stat">
                        <label>Month</label>
                        <value>${monthData.monthName}</value>
                    </div>
                </div>
                
                <div class="subheader-actions">
                    <input type="text" 
                           id="transactionSearch" 
                           placeholder="Search transactions..." 
                           onkeyup="filterTransactions('${category}')"
                           class="search-input">
                    <select id="sortBy" onchange="sortTransactions('${category}')" class="sort-select">
                        <option value="date-desc">Date (Newest)</option>
                        <option value="date-asc">Date (Oldest)</option>
                        <option value="amount-desc">Amount (High to Low)</option>
                        <option value="amount-asc">Amount (Low to High)</option>
                        <option value="name">Name (A-Z)</option>
                    </select>
                </div>
            </div>
            
            <div class="modal-body">
                <div class="transactions-list" id="transactionsList">
                    ${generateTransactionsList(transactions)}
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-export" onclick="exportTransactionsCSV('${category}')">
                    Export as CSV
                </button>
                <button class="btn-primary" onclick="categoryView.showCategoryAnalysis('${category}', '${
        app.currentMonth
    }')">
                    View Analysis
                </button>
                <button class="btn-close" onclick="closeTransactionsModal()">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Store for filtering/sorting
    window.currentTransactionsList = {
        category: category,
        transactions: transactions,
        filtered: transactions,
    };

    // Animate in
    setTimeout(() => modal.classList.add('show'), 10);
}

function generateTransactionsList(transactions) {
    if (transactions.length === 0) {
        return '<div class="empty-transactions">No transactions found</div>';
    }

    return transactions
        .map(
            (t, index) => `
        <div class="transaction-row ${t.amount < 0 ? 'is-return' : ''}" data-index="${index}">
            <div class="transaction-date">
                ${new Date(t.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })}
            </div>
            <div class="transaction-description">
                ${t.name}
            </div>
            <div class="transaction-amount ${t.amount < 0 ? 'return' : ''}">
                $${Math.abs(t.amount).toFixed(2)}
                ${t.amount < 0 ? '<span class="return-indicator">↩</span>' : ''}
            </div>
            <div class="transaction-actions">
                <button class="btn-icon" onclick="editTransaction('${
                    window.currentTransactionsList.category
                }', ${index})">
                    ✏️
                </button>
                <button class="btn-icon" onclick="deleteTransactionItem('${
                    window.currentTransactionsList.category
                }', ${index})">
                    🗑️
                </button>
            </div>
        </div>
    `
        )
        .join('');
}

function filterTransactions(category) {
    const searchTerm = document.getElementById('transactionSearch').value.toLowerCase();
    const filtered = window.currentTransactionsList.transactions.filter(
        (t) =>
            t.name.toLowerCase().includes(searchTerm) ||
            t.date.includes(searchTerm) ||
            Math.abs(t.amount).toString().includes(searchTerm)
    );

    window.currentTransactionsList.filtered = filtered;
    document.getElementById('transactionsList').innerHTML = generateTransactionsList(filtered);
}

function sortTransactions(category) {
    const sortBy = document.getElementById('sortBy').value;
    let sorted = [...window.currentTransactionsList.filtered];

    switch (sortBy) {
        case 'date-desc':
            sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'amount-desc':
            sorted.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            break;
        case 'amount-asc':
            sorted.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
            break;
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }

    window.currentTransactionsList.filtered = sorted;
    document.getElementById('transactionsList').innerHTML = generateTransactionsList(sorted);
}

function closeTransactionsModal() {
    const modal = document.querySelector('.transactions-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

function editTransaction(category, index) {
    const transaction = window.currentTransactionsList.transactions[index];
    const newDescription = prompt('Edit transaction description:', transaction.name);

    if (newDescription && newDescription !== transaction.name) {
        // Update in the actual data
        const monthData = app.monthlyData.get(app.currentMonth);
        const originalTransaction = monthData.transactions.find(
            (t) =>
                t.Description === transaction.name &&
                Math.abs(parseFloat(t.Amount) - transaction.amount) < 0.01
        );

        if (originalTransaction) {
            originalTransaction.Description = newDescription;
            app.saveData();
            app.switchToMonth(app.currentMonth);
            closeTransactionsModal();
            notificationManager.show('Transaction updated', 'success');
        }
    }
}

function deleteTransactionItem(category, index) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const transaction = window.currentTransactionsList.transactions[index];
    const monthData = app.monthlyData.get(app.currentMonth);

    // Find and remove the transaction
    const txIndex = monthData.transactions.findIndex(
        (t) =>
            t.Description === transaction.name &&
            Math.abs(parseFloat(t.Amount) - transaction.amount) < 0.01
    );

    if (txIndex !== -1) {
        monthData.transactions.splice(txIndex, 1);
        app.saveData();
        app.switchToMonth(app.currentMonth);
        closeTransactionsModal();
        notificationManager.show('Transaction deleted', 'success');
    }
}

function exportTransactionsCSV(category) {
    const transactions = window.currentTransactionsList.filtered;

    // Create CSV content
    const headers = ['Date', 'Description', 'Amount'];
    const rows = transactions.map((t) => [t.date, t.name, t.amount.toFixed(2)]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${category}_transactions_${app.currentMonth}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    notificationManager.show('Transactions exported', 'success');
}
