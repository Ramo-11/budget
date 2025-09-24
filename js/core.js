// js/core.js - Core Data Management and State

// Global state
let currentMonth = null;
let monthlyData = new Map();
let categoryConfig = {
    'Once A Year': {
        keywords: ['DOMAINS', 'GYM MEMBERSHIP', 'ANNUAL FEE'],
        icon: '📅',
    },
    Groceries: {
        keywords: ['COSTCO', 'WALMART', 'KROGER', 'WHOLE FOODS', 'TARGET', 'ALDI'],
        icon: '🛒',
    },
    Gas: {
        keywords: ['BP', 'SHELL', 'EXXON', 'FUEL', 'GAS'],
        icon: '⛽',
    },
    Subscriptions: {
        keywords: [
            'GOOGLE',
            'AWS',
            'CHATGPT',
            'APPLE',
            'SPOTIFY',
            'NETFLIX',
            'DISNEY',
            'PARAMOUNT',
            'HULU',
            'CANVA',
            'MICROSOFT',
            'ADOBE',
        ],
        icon: '🔄',
    },
    'Coffee and Tea': {
        keywords: ['CAFE', 'COFFEE', 'ESPRESSO', 'TEA HOUSE', 'JAVA'],
        icon: '☕',
    },
    'Food & Drink': {
        keywords: ['RESTAURANT', 'PIZZA', 'BURGER', 'GRILL', 'TACO', 'SUSHI', 'DINER'],
        icon: '🍽️',
    },
    Shopping: {
        keywords: ['AMAZON', 'AMZN', 'TARGET', 'WALMART', 'BEST BUY'],
        icon: '🛍️',
    },
    Rent: {
        keywords: ['RENT', 'APARTMENT', 'HOUSING'],
        icon: '🏠',
    },
    Insurance: {
        keywords: ['INSURANCE', 'STATE FARM', 'ALLSTATE', 'GEICO'],
        icon: '🛡️',
    },
    Internet: {
        keywords: ['INTERNET', 'COMCAST', 'XFINITY', 'SPECTRUM', 'AT&T'],
        icon: '🌐',
    },
    Parking: {
        keywords: ['PARKING', 'GARAGE', 'METER'],
        icon: '🅿️',
    },
    Laundry: {
        keywords: ['LAUNDRY', 'DRY CLEAN'],
        icon: '🧺',
    },
    Haircut: {
        keywords: ['BARBER', 'HAIRCUT', 'SALON'],
        icon: '💇',
    },
    Car: {
        keywords: ['AUTO', 'CAR WASH', 'OIL', 'TIRE', 'MECHANIC', 'TOYOTA', 'HONDA'],
        icon: '🚙',
    },
    Phone: {
        keywords: ['PHONE', 'MOBILE', 'WIRELESS', 'VERIZON', 'AT&T', 'VISIBLE'],
        icon: '📱',
    },
    Entertainment: {
        keywords: ['MOVIE', 'CINEMA', 'MUSIC', 'CONCERT', 'GAME', 'HBO'],
        icon: '🎬',
    },
    Others: {
        keywords: [],
        icon: '📦',
    },
};

let budgets = {};
let charts = {};
window.merchantRules = {};

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
            window.merchantRules = data.merchantRules || {};

            // Only update month selector if we're on a page that has it
            if (document.getElementById('monthDropdown')) {
                updateMonthSelector();
            }
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
            merchantRules: window.merchantRules || {}, // ADD THIS LINE
        };
        localStorage.setItem('sahabBudget_data', JSON.stringify(data));
    } catch (error) {
        console.error('Error saving data:', error);
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

    // NEW: Check merchant rules BEFORE keyword matching
    if (window.merchantRules) {
        for (const [merchant, category] of Object.entries(window.merchantRules)) {
            if (upperDesc.includes(merchant)) {
                return category;
            }
        }
    }

    // Original keyword matching
    for (const [category, config] of Object.entries(categoryConfig)) {
        if (category === 'Others') continue; // Check Others last

        if (config.keywords && config.keywords.length > 0) {
            for (const keyword of config.keywords) {
                if (upperDesc.includes(keyword.toUpperCase())) {
                    return category;
                }
            }
        }
    }

    return 'Others';
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

// Switch to month
function switchToMonth(monthKey) {
    if (!monthKey) return;

    // Handle "All Data" option
    if (monthKey === 'ALL_DATA') {
        currentMonth = 'ALL_DATA';
        const allTransactions = [];
        monthlyData.forEach((monthData) => {
            allTransactions.push(...monthData.transactions);
        });
        const analyzer = analyzeTransactions(allTransactions);

        // Only update dashboard if the function exists (we're on the main page)
        if (typeof updateDashboard === 'function') {
            updateDashboard(analyzer);
        }
        return;
    }

    // Handle Custom Date Range
    if (monthKey === 'CUSTOM_RANGE' && window.customDateRange) {
        currentMonth = 'CUSTOM_RANGE';

        const start = new Date(window.customDateRange.start);
        const end = new Date(window.customDateRange.end);

        const rangeTransactions = [];
        monthlyData.forEach((data) => {
            data.transactions.forEach((t) => {
                const date = new Date(t['Transaction Date'] || t.Date || t.date);
                if (date >= start && date <= end) {
                    rangeTransactions.push(t);
                }
            });
        });

        const analyzer = analyzeTransactions(rangeTransactions);
        if (typeof updateDashboard === 'function') {
            updateDashboard(analyzer);
        }
        return;
    }

    // Regular month handling
    if (!monthlyData.has(monthKey)) return;

    currentMonth = monthKey;
    const monthData = monthlyData.get(monthKey);
    const analyzer = analyzeTransactions(monthData.transactions);

    // Update the appropriate view based on what's available
    if (typeof updateDashboard === 'function') {
        updateDashboard(analyzer);
    }
    if (typeof updateBudgetView === 'function') {
        updateBudgetView(analyzer);
    }
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

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Download file helper
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Update month selector
function updateMonthSelector() {
    const selector = document.getElementById('monthSelector');
    const dropdown = document.getElementById('monthDropdown');

    // Check if elements exist (they won't on settings page)
    if (!selector || !dropdown) {
        return;
    }

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
