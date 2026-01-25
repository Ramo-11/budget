// js/core.js - Core Data Management and State

let customRules = {
    delete: [], // Rules for deleting transactions
    categorize: [], // Future: rules for custom categorization
};

// Global state
let currentMonth = null;
let monthlyData = new Map();
let categoryConfig = {
    Transfers: {
        keywords: ['ZELLE', 'ONLINE TRANSFER', 'ACCT_XFER', 'WIRE', 'QUICKPAY', 'VENMO', 'CASHAPP'],
        icon: '💸',
    },
    Banking: {
        keywords: ['FEE', 'INTEREST', 'OVERDRAFT', 'SERVICE CHARGE', 'ATM'],
        icon: '🏦',
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
    Income: {
        keywords: [],
        icon: '💰',
        _isIncome: true,
    },
    Others: {
        keywords: [],
        icon: '📦',
    },
};

let budgets = {};
let charts = {};
window.merchantRules = {};

// Income tracking settings
window.incomeSettings = {
    trackIncome: true,
    incomePatterns: [
        'PAYROLL',
        'SALARY',
        'DIRECT DEP',
        'DEPOSIT',
        'ACH_CREDIT',
        'WIRE_INCOMING',
        'QUICKPAY_CREDIT',
        'ZELLE PAYMENT FROM',
        'ONLINE TRANSFER FROM',
        'INTEREST PAID',
        'DIVIDEND',
        'TAX REFUND',
    ],
};

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
            window.unifiedRules = data.unifiedRules || [];

            // Load income settings
            if (data.incomeSettings) {
                window.incomeSettings = { ...window.incomeSettings, ...data.incomeSettings };
            }

            // Initialize rules system if available
            if (
                typeof initializeRules === 'function' &&
                (!window.unifiedRules || window.unifiedRules.length === 0)
            ) {
                initializeRules();
            }

            // Only update month selector if we're on a page that has it
            if (document.getElementById('monthDropdown')) {
                updateMonthSelector();
            }
            if (typeof initializeWidget === 'function' && monthlyData.size > 0) {
                initializeWidget();
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
            unifiedRules: window.unifiedRules || [],
            incomeSettings: window.incomeSettings || {},
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
    let skipped = 0;
    let rulesApplied = 0;
    let incomeAdded = 0;

    // Load unified rules if available
    if (typeof loadRules === 'function') {
        loadRules();
    }

    // Check if income tracking is enabled
    const trackIncome = window.incomeSettings?.trackIncome === true;

    // Ensure Income category exists if tracking is enabled
    if (trackIncome && !categoryConfig['Income']) {
        categoryConfig['Income'] = {
            keywords: [],
            icon: '💰',
            _isIncome: true,
        };
    }

    // Income patterns for detection (pattern-based only, no positive amount auto-detection)
    const incomePatterns = window.incomeSettings?.incomePatterns || [
        'PAYROLL',
        'SALARY',
        'DIRECT DEP',
        'DEPOSIT',
        'ACH_CREDIT',
        'WIRE_INCOMING',
        'QUICKPAY_CREDIT',
        'ZELLE PAYMENT FROM',
        'ONLINE TRANSFER FROM',
        'INTEREST PAID',
        'DIVIDEND',
        'TAX REFUND',
    ];

    transactions.forEach((transaction) => {
        // Detect CSV format and normalize fields
        let description, amount, dateField;
        let isFirstFinancialCredit = false;

        // First Financial Bank format
        if (transaction.nickname || transaction.original_name) {
            description = transaction.nickname || transaction.original_name || '';
            amount = parseFloat(transaction.amount || 0);
            dateField = transaction.posted_at;

            // First Financial uses positive amounts for debits (expenses)
            // and negative amounts for credits (income)
            if (transaction.transaction_type === 'Credit' || amount < 0) {
                isFirstFinancialCredit = true;
                amount = Math.abs(amount); // Make positive for income
            } else {
                // Convert debit amount to negative for consistency (expense)
                amount = -Math.abs(amount);
            }
        }
        // Chase/Standard format
        else {
            description = (transaction.Description || transaction.description || '').toUpperCase();
            amount = parseFloat(transaction.Amount || transaction.Debit || transaction.Credit || 0);
            dateField =
                transaction['Transaction Date'] ||
                transaction['Posting Date'] ||
                transaction['Post Date'] ||
                transaction.Date ||
                transaction.date ||
                transaction['Trans Date'] ||
                transaction['Trans. Date'] ||
                transaction['Posted Date'];
        }

        // Apply unified rules
        if (typeof applyRulesToTransaction === 'function' && window.unifiedRules) {
            const result = applyRulesToTransaction({
                Description: description,
                description: description,
            });
            if (result && result.action === 'delete') {
                rulesApplied++;
                return;
            }
        }

        // Check if this is an income transaction (pattern-based only)
        // Positive amounts (refunds/cashback) are NOT automatically classified as income
        // They will be categorized normally and reduce the category total
        const isIncomePattern = incomePatterns.some((pattern) => description.includes(pattern));
        const isIncome = isIncomePattern || isFirstFinancialCredit;

        // Skip payment thank you (credit card payments)
        if (description.includes('PAYMENT THANK YOU')) {
            skipped++;
            return;
        }

        // Handle income vs expense
        if (isIncome) {
            if (trackIncome) {
                // Process as income transaction
                if (!dateField) return;
                const incomeAmount = Math.abs(amount);
                if (incomeAmount === 0) return;

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

                const normalizedTransaction = {
                    'Transaction Date': dateField,
                    Description: description,
                    Amount: incomeAmount, // Positive for income
                    _originalFormat: transaction.nickname ? 'FirstFinancial' : 'Chase',
                    _rawCsvData: { ...transaction },
                    _isIncome: true,
                };

                if (isDuplicateTransaction(normalizedTransaction, monthData.transactions)) {
                    duplicates++;
                } else {
                    normalizedTransaction._id = Math.random().toString(36).substr(2, 9);
                    monthData.transactions.push(normalizedTransaction);
                    incomeAdded++;

                    // Auto-assign to Income category
                    if (!window.transactionOverrides) {
                        window.transactionOverrides = {};
                    }
                    if (!window.transactionOverrides[monthKey]) {
                        window.transactionOverrides[monthKey] = {};
                    }
                    window.transactionOverrides[monthKey][normalizedTransaction._id] = 'Income';
                }
            } else {
                skipped++;
            }
            return;
        }

        if (!dateField) return;
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

        // Normalize transaction object to standard format
        const normalizedTransaction = {
            'Transaction Date': dateField,
            Description: description,
            Amount: amount,
            _originalFormat: transaction.nickname ? 'FirstFinancial' : 'Chase',
            _rawCsvData: { ...transaction }, // Store the original raw CSV row
        };

        // Check for duplicate
        if (isDuplicateTransaction(normalizedTransaction, monthData.transactions)) {
            duplicates++;
        } else {
            // Add unique ID
            normalizedTransaction._id = Math.random().toString(36).substr(2, 9);
            monthData.transactions.push(normalizedTransaction);
            added++;
        }
    });

    return { added, duplicates, skipped, rulesApplied, incomeAdded };
}

// Check if a transaction is a duplicate
function isDuplicateTransaction(newTransaction, existingTransactions) {
    const newDate = newTransaction['Transaction Date'];
    const newDesc = (newTransaction.Description || newTransaction.description || '')
        .trim()
        .toUpperCase();
    const newAmount = parseFloat(newTransaction.Amount || 0);

    // Check for exact duplicates (same date, description, and amount)
    return existingTransactions.some((existing) => {
        const existingDate = existing['Transaction Date'];
        const existingDesc = (existing.Description || existing.description || '')
            .trim()
            .toUpperCase();
        const existingAmount = parseFloat(existing.Amount || 0);

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
    if (transactionId && window.transactionOverrides) {
        // Check currentMonth first (most common case)
        if (
            window.transactionOverrides[currentMonth] &&
            window.transactionOverrides[currentMonth][transactionId]
        ) {
            return window.transactionOverrides[currentMonth][transactionId];
        }

        // If not found, search through all months (needed for ALL_DATA view and cross-month rules)
        for (const monthKey of Object.keys(window.transactionOverrides)) {
            if (window.transactionOverrides[monthKey][transactionId]) {
                return window.transactionOverrides[monthKey][transactionId];
            }
        }
    }

    // Check unified rules
    if (typeof applyRulesToTransaction === 'function' && window.unifiedRules) {
        const mockTransaction = { Description: description, description: description };
        const result = applyRulesToTransaction(mockTransaction);
        if (result && result.action === 'categorize') {
            return result.value;
        }
    }

    const upperDesc = description.toUpperCase();

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
        const rawAmount = parseFloat(transaction.Amount) || 0;
        const description = transaction.Description || transaction.description || '';
        const category = categorizeTransaction(description, transaction._id); // Pass the ID
        const isIncomeCategory = category === 'Income' || categoryConfig[category]?._isIncome;

        // For income: use absolute value (income is stored as positive)
        // For expenses: negative amounts add to total, positive amounts (refunds) subtract
        let displayAmount;
        let effectOnTotal;

        if (isIncomeCategory || transaction._isIncome) {
            // Income transactions - always positive display and addition
            displayAmount = Math.abs(rawAmount);
            effectOnTotal = Math.abs(rawAmount);
        } else {
            // Expense transactions
            // Negative = expense (add to total), Positive = refund (subtract from total)
            displayAmount = Math.abs(rawAmount);
            effectOnTotal = rawAmount < 0 ? Math.abs(rawAmount) : -Math.abs(rawAmount);
        }

        categoryTotals[category] += effectOnTotal;
        categoryDetails[category].push({
            name: description,
            amount: displayAmount,
            isRefund: rawAmount > 0 && !isIncomeCategory && !transaction._isIncome,
            date:
                transaction['Transaction Date'] ||
                transaction['Posting Date'] ||
                transaction['Post Date'] ||
                transaction.Date ||
                transaction.date ||
                transaction['Trans Date'] ||
                transaction['Trans. Date'] ||
                transaction['Posted Date'],
            id: transaction._id,
            originalData: transaction,
        });
    });

    // Ensure no negative totals (can happen if refunds exceed purchases)
    Object.keys(categoryTotals).forEach((cat) => {
        if (categoryTotals[cat] < 0) {
            categoryTotals[cat] = 0;
        }
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

        // Only update dashboard if the function exists and we're on the dashboard
        if (typeof updateDashboard === 'function' && document.getElementById('dashboardView')) {
            updateDashboard(analyzer);
        }
        return;
    }

    if (monthKey === 'CUSTOM_RANGE_SELECT') {
        openDateRangeSelector();
        // Reset dropdown to previous value
        const dropdown = document.getElementById('monthDropdown');
        if (dropdown) {
            dropdown.value = currentMonth || 'ALL_DATA';
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
        if (typeof updateDashboard === 'function' && document.getElementById('dashboardView')) {
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
    if (typeof updateDashboard === 'function' && document.getElementById('dashboardView')) {
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
    allOption.textContent = 'All Months Combined';
    dropdown.appendChild(allOption);

    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    dropdown.appendChild(separator);

    const customRangeOption = document.createElement('option');
    customRangeOption.value = 'CUSTOM_RANGE_SELECT';
    customRangeOption.textContent = 'Custom Date Range';
    dropdown.appendChild(customRangeOption);

    const separator2 = document.createElement('option');
    separator2.disabled = true;
    separator2.textContent = '──────────';
    dropdown.appendChild(separator2);

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

// Set active navigation button based on current page
function setActiveNavButton() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach((btn) => {
        btn.classList.remove('active');

        const btnText = btn.textContent.trim().toLowerCase();

        if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
            if (btnText === 'dashboard') btn.classList.add('active');
        } else if (currentPage === 'analytics.html' && btnText === 'analytics') {
            btn.classList.add('active');
        } else if (currentPage === 'settings.html' && btnText === 'settings') {
            btn.classList.add('active');
        } else if (currentPage === 'about.html' && btnText === 'about') {
            btn.classList.add('active');
        }
    });
}

// Call this on page load
window.addEventListener('DOMContentLoaded', setActiveNavButton);
