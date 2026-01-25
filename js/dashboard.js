// js/dashboard.js - Dashboard View Functions

// Update dashboard
function updateDashboard(analyzer) {
    // Check if we have the necessary DOM elements
    const summaryCards = document.getElementById('summaryCards');
    const categoryDetails = document.getElementById('categoryDetails');
    const chartsContainer = document.querySelector('.charts-container');

    if (!summaryCards || !categoryDetails || !chartsContainer) {
        console.warn('Dashboard DOM elements not found');
        return;
    }

    if (!analyzer || analyzer.transactionCount === 0) {
        showDashboardEmptyState();
        return;
    }

    // Show the "Detailed Breakdown" heading
    const headings = document.querySelectorAll('h3');
    headings.forEach((h) => {
        if (h.textContent.trim() === 'Detailed Breakdown') {
            h.style.display = 'block';
        }
    });

    // Update summary cards
    const avgTransaction =
        analyzer.transactionCount > 0 ? analyzer.totalExpenses / analyzer.transactionCount : 0;

    // Calculate income and net if tracking is enabled
    const incomeTotal = analyzer.categoryTotals['Income'] || 0;
    const expensesWithoutIncome = analyzer.totalExpenses - incomeTotal;
    const netAmount = incomeTotal - expensesWithoutIncome;
    const trackIncome = window.incomeSettings?.trackIncome === true;

    let cardsHTML = '';

    // Show income cards if tracking is enabled and there's income data
    if (trackIncome && incomeTotal > 0) {
        cardsHTML = `
            <div class="card income-card">
                <h3>Total Income</h3>
                <p>$${incomeTotal.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Total Expenses</h3>
                <p>$${expensesWithoutIncome.toFixed(2)}</p>
            </div>
            <div class="card ${netAmount >= 0 ? 'net-positive' : 'net-negative'}">
                <h3>Net ${netAmount >= 0 ? 'Savings' : 'Deficit'}</h3>
                <p>$${Math.abs(netAmount).toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Transactions</h3>
                <p>${analyzer.transactionCount}</p>
            </div>
        `;
    } else {
        cardsHTML = `
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
    }
    summaryCards.innerHTML = cardsHTML;

    // Update category details
    updateCategoryDetails(analyzer);

    // Update charts
    updateCharts(analyzer);
}

function showDashboardEmptyState() {
    // Don't show empty state if we actually have data
    if (monthlyData && monthlyData.size > 0) {
        return;
    }

    const emptyStateHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--gray); grid-column: 1 / -1;">
            <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
            <h2 style="color: var(--dark); margin-bottom: 10px; font-size: 24px;">Welcome to Sahab Budget!</h2>
            <p style="font-size: 15px; text-align: center; max-width: 500px; margin-bottom: 30px; line-height: 1.6;">
                Get started by uploading your bank transaction CSV files. The app will automatically categorize your expenses and show you detailed insights.
            </p>
            <div style="background: var(--light); padding: 20px; border-radius: 8px; max-width: 400px; text-align: left;">
                <h3 style="font-size: 16px; margin-bottom: 10px; color: var(--dark);">Quick Steps:</h3>
                <ol style="margin-left: 20px; font-size: 14px; line-height: 2;">
                    <li>Export transactions from your bank as CSV</li>
                    <li>Click "Upload CSV Files" button above</li>
                    <li>View your categorized expenses instantly</li>
                </ol>
            </div>
        </div>
    `;

    // Clear and show empty state
    document.getElementById('summaryCards').innerHTML = '';
    document.getElementById('categoryDetails').innerHTML = '';

    // Hide the "Detailed Breakdown" heading
    const breakdownHeading = document.querySelector('h3[style*="margin: 20px 0 10px"]');
    if (!breakdownHeading) {
        // Find it by text content if style selector doesn't work
        const headings = document.querySelectorAll('h3');
        headings.forEach((h) => {
            if (h.textContent.trim() === 'Detailed Breakdown') {
                h.style.display = 'none';
            }
        });
    } else {
        breakdownHeading.style.display = 'none';
    }

    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) {
        chartsContainer.innerHTML = emptyStateHTML;
    }
}

// Get current sort preference from localStorage
function getCategorySortPreference() {
    return localStorage.getItem('sahabBudget_categorySort') || 'alphabetical';
}

// Save sort preference to localStorage
function setCategorySortPreference(sortType) {
    localStorage.setItem('sahabBudget_categorySort', sortType);
}

// Sort categories based on preference
function sortCategories(categories, categoryTotals, sortType) {
    // Separate Income and Others from the rest
    const income = categories.filter(c => c === 'Income');
    const others = categories.filter(c => c === 'Others');
    const rest = categories.filter(c => c !== 'Income' && c !== 'Others');

    // Sort the rest based on preference
    switch (sortType) {
        case 'high-to-low':
            rest.sort((a, b) => (categoryTotals[b] || 0) - (categoryTotals[a] || 0));
            break;
        case 'low-to-high':
            rest.sort((a, b) => (categoryTotals[a] || 0) - (categoryTotals[b] || 0));
            break;
        case 'alphabetical':
        default:
            rest.sort((a, b) => a.localeCompare(b));
            break;
    }

    // Combine: Income first, sorted rest, Others last
    return [...income, ...rest, ...others];
}

// Get transaction sort preference for a category from localStorage
function getTransactionSortPreference(category) {
    return localStorage.getItem(`sahabBudget_transactionSort_${category}`) || 'default';
}

// Save transaction sort preference for a category to localStorage
function setTransactionSortPreference(category, sortType) {
    localStorage.setItem(`sahabBudget_transactionSort_${category}`, sortType);
}

// Sort transactions based on preference
function sortTransactions(transactions, sortType) {
    const sorted = [...transactions];
    switch (sortType) {
        case 'high-to-low':
            sorted.sort((a, b) => b.amount - a.amount);
            break;
        case 'low-to-high':
            sorted.sort((a, b) => a.amount - b.amount);
            break;
        case 'default':
        default:
            // Default chronological order (already sorted by date from analyzer)
            break;
    }
    return sorted;
}

// Change transaction sort for a category
function changeTransactionSort(category, sortType) {
    setTransactionSortPreference(category, sortType);

    // Re-render dashboard
    if (currentMonth) {
        if (currentMonth === 'ALL_DATA') {
            const allTransactions = [];
            monthlyData.forEach((monthData) => {
                allTransactions.push(...monthData.transactions);
            });
            const analyzer = analyzeTransactions(allTransactions);
            updateCategoryDetails(analyzer);
        } else if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
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
            updateCategoryDetails(analyzer);
        } else {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateCategoryDetails(analyzer);
            }
        }
    }
}

// Toggle transaction sort menu visibility
function toggleTransactionSortMenu(category) {
    const menuId = `sortMenu_${category.replace(/\s+/g, '_')}`;
    const menu = document.getElementById(menuId);

    if (!menu) return;

    // Close all other menus first
    document.querySelectorAll('.transaction-sort-menu.show').forEach(m => {
        if (m.id !== menuId) {
            m.classList.remove('show');
        }
    });

    menu.classList.toggle('show');

    // Close menu when clicking outside
    if (menu.classList.contains('show')) {
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && !e.target.closest('.transaction-sort-btn')) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    }
}

// Change category sort
function changeCategorySort(sortType) {
    setCategorySortPreference(sortType);

    // Update button states
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.sort-btn[data-sort="${sortType}"]`)?.classList.add('active');

    // Re-render dashboard
    if (currentMonth) {
        if (currentMonth === 'ALL_DATA') {
            const allTransactions = [];
            monthlyData.forEach((monthData) => {
                allTransactions.push(...monthData.transactions);
            });
            const analyzer = analyzeTransactions(allTransactions);
            updateCategoryDetails(analyzer);
        } else if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
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
            updateCategoryDetails(analyzer);
        } else {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateCategoryDetails(analyzer);
            }
        }
    }
}

// Get show empty categories preference from localStorage
function getShowEmptyCategoriesPreference() {
    return localStorage.getItem('sahabBudget_showEmptyCategories') !== 'false'; // Default to true
}

// Save show empty categories preference to localStorage
function setShowEmptyCategoriesPreference(show) {
    localStorage.setItem('sahabBudget_showEmptyCategories', show ? 'true' : 'false');
}

// Toggle show empty categories
function toggleShowEmptyCategories() {
    const currentPref = getShowEmptyCategoriesPreference();
    setShowEmptyCategoriesPreference(!currentPref);

    // Re-render dashboard
    if (currentMonth) {
        if (currentMonth === 'ALL_DATA') {
            const allTransactions = [];
            monthlyData.forEach((monthData) => {
                allTransactions.push(...monthData.transactions);
            });
            const analyzer = analyzeTransactions(allTransactions);
            updateCategoryDetails(analyzer);
        } else if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
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
            updateCategoryDetails(analyzer);
        } else {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateCategoryDetails(analyzer);
            }
        }
    }
}

// Render sort controls
function renderSortControls() {
    const sortType = getCategorySortPreference();
    const showEmpty = getShowEmptyCategoriesPreference();
    return `
        <div class="sort-controls">
            <span class="sort-label">Sort by:</span>
            <div class="sort-buttons">
                <button class="sort-btn ${sortType === 'alphabetical' ? 'active' : ''}"
                        data-sort="alphabetical"
                        onclick="changeCategorySort('alphabetical')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M3 12h12M3 18h6"/>
                    </svg>
                    A-Z
                </button>
                <button class="sort-btn ${sortType === 'high-to-low' ? 'active' : ''}"
                        data-sort="high-to-low"
                        onclick="changeCategorySort('high-to-low')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 4h18M3 10h14M3 16h10M3 22h6"/>
                    </svg>
                    High-Low
                </button>
                <button class="sort-btn ${sortType === 'low-to-high' ? 'active' : ''}"
                        data-sort="low-to-high"
                        onclick="changeCategorySort('low-to-high')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 4h6M3 10h10M3 16h14M3 22h18"/>
                    </svg>
                    Low-High
                </button>
            </div>
            <div class="empty-toggle">
                <button class="sort-btn ${showEmpty ? 'active' : ''}"
                        onclick="toggleShowEmptyCategories()"
                        title="${showEmpty ? 'Hide categories with no transactions' : 'Show categories with no transactions'}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${showEmpty
                            ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
                            : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
                        }
                    </svg>
                    ${showEmpty ? 'All' : 'Active'}
                </button>
            </div>
        </div>
    `;
}

// Update category details
function updateCategoryDetails(analyzer) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    // Add sort controls
    const sortControlsContainer = document.getElementById('sortControls');
    if (sortControlsContainer) {
        sortControlsContainer.innerHTML = renderSortControls();
    }

    // Get all categories and sort based on preference
    const sortType = getCategorySortPreference();
    const showEmpty = getShowEmptyCategoriesPreference();
    let allCategories = sortCategories(
        Object.keys(categoryConfig),
        analyzer.categoryTotals,
        sortType
    );

    // Filter out empty categories if preference is set
    let hiddenCount = 0;
    if (!showEmpty) {
        const filteredCategories = allCategories.filter((category) => {
            const transactions = analyzer.categoryDetails[category] || [];
            if (transactions.length === 0) {
                hiddenCount++;
                return false;
            }
            return true;
        });
        allCategories = filteredCategories;
    }

    // Show hidden count indicator if categories are hidden
    if (hiddenCount > 0) {
        const hiddenIndicator = document.createElement('div');
        hiddenIndicator.className = 'hidden-categories-indicator';
        hiddenIndicator.innerHTML = `
            <button class="hidden-categories-btn" onclick="toggleShowEmptyCategories()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                ${hiddenCount} empty categor${hiddenCount === 1 ? 'y' : 'ies'} hidden
            </button>
        `;
        container.appendChild(hiddenIndicator);
    }

    allCategories.forEach((category) => {
        const transactions = analyzer.categoryDetails[category] || [];
        const total = analyzer.categoryTotals[category] || 0;
        const config = categoryConfig[category] || { icon: '📦' };

        // Get budget info for current month
        const budget = (budgets[currentMonth] && budgets[currentMonth][category]) || 0;
        const remaining = budget - total;
        const percentage = budget > 0 ? (total / budget) * 100 : 0;

        const card = document.createElement('div');
        const isIncomeCategory = category === 'Income' || categoryConfig[category]?._isIncome;
        card.className = 'category-card' + (isIncomeCategory ? ' income-category' : '');
        card.dataset.category = category;
        card.dataset.expanded = 'false'; // Track expansion state

        // Check if this category is expanded (from localStorage or default)
        const isExpanded = window.expandedCategories && window.expandedCategories[category];
        if (isExpanded) {
            card.dataset.expanded = 'true';
        }

        // Apply transaction sort preference
        const transactionSortType = getTransactionSortPreference(category);
        const sortedTransactions = sortTransactions(transactions, transactionSortType);

        const displayedTransactions = isExpanded ? sortedTransactions : sortedTransactions.slice(0, 5);
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
                <div class="category-transactions-list ${isExpanded ? 'expanded' : ''}">
                    ${displayedTransactions
                        .map(
                            (t) => `
                        <div class="transaction-item ${t.isRefund ? 'refund-transaction' : ''}"
                             draggable="true"
                             data-transaction-id="${t.id}"
                             data-category="${category}">
                            <span class="transaction-name clickable-transaction"
                                  title="Click to view raw data"
                                  onclick="event.stopPropagation(); showRawTransactionData('${t.id}', '${category}')">${t.name}${t.isRefund ? ' <span class="refund-badge">Refund</span>' : ''}</span>
                            <span style="display: flex; align-items: center;">
                                <span class="transaction-amount ${t.isRefund ? 'refund-amount' : ''}">$${t.amount.toFixed(2)}</span>
                                <button class="btn-icon" onclick="deleteTransaction('${category}', '${
                                t.id
                            }')">×</button>
                            </span>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                ${
                    remainingCount > 0 && !isExpanded
                        ? `
                    <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" 
                            onclick="toggleCategoryExpansion('${category}')">
                        Show ${remainingCount} more
                    </button>
                `
                        : ''
                }
                ${
                    isExpanded && transactions.length > 5
                        ? `
                    <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" 
                            onclick="toggleCategoryExpansion('${category}')">
                        Show less
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
                    <button class="analysis-btn ${!localStorage.getItem('sahabBudget_seenAnalysis') ? 'first-use' : ''}" onclick="event.stopPropagation(); markAnalysisSeen(); showCategoryAnalysis('${category}')" title="View category trends">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </button>
                    ${transactions.length > 1 ? `
                        <div class="transaction-sort-dropdown">
                            <button class="transaction-sort-btn ${transactionSortType !== 'default' ? 'active' : ''}"
                                    onclick="event.stopPropagation(); toggleTransactionSortMenu('${category}')"
                                    title="Sort transactions">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M3 12h12M3 18h6"/>
                                </svg>
                            </button>
                            <div class="transaction-sort-menu" id="sortMenu_${category.replace(/\s+/g, '_')}">
                                <button class="${transactionSortType === 'default' ? 'active' : ''}"
                                        onclick="event.stopPropagation(); changeTransactionSort('${category}', 'default')">
                                    Default (Date)
                                </button>
                                <button class="${transactionSortType === 'high-to-low' ? 'active' : ''}"
                                        onclick="event.stopPropagation(); changeTransactionSort('${category}', 'high-to-low')">
                                    High to Low
                                </button>
                                <button class="${transactionSortType === 'low-to-high' ? 'active' : ''}"
                                        onclick="event.stopPropagation(); changeTransactionSort('${category}', 'low-to-high')">
                                    Low to High
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    ${
                        transactions.length > 5
                            ? `<button class="btn-text" onclick="toggleCategoryExpansion('${category}')">${
                                  isExpanded ? 'Collapse' : 'Expand'
                              }</button>`
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

// Toggle category expansion
function toggleCategoryExpansion(category) {
    // Initialize expanded categories tracking if not exists
    if (!window.expandedCategories) {
        window.expandedCategories = {};
    }

    // Toggle the state
    window.expandedCategories[category] = !window.expandedCategories[category];

    // Refresh the dashboard to show/hide transactions
    if (currentMonth) {
        if (currentMonth === 'ALL_DATA') {
            const allTransactions = [];
            monthlyData.forEach((monthData) => {
                allTransactions.push(...monthData.transactions);
            });
            const analyzer = analyzeTransactions(allTransactions);
            updateDashboard(analyzer);
        } else if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
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
            updateDashboard(analyzer);
        } else {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateDashboard(analyzer);
            }
        }
    }
}

// Update charts
function updateCharts(analyzer) {
    // Check if canvas elements exist
    const pieCanvas = document.getElementById('pieChart');
    const barCanvas = document.getElementById('barChart');

    if (!pieCanvas || !barCanvas) {
        console.warn('Chart canvas elements not found');
        return;
    }

    const categories = Object.entries(analyzer.categoryTotals)
        .filter(([category, value]) => value > 0 && category !== 'Income')
        .sort((a, b) => b[1] - a[1]);

    // Show empty state if no data
    if (categories.length === 0) {
        const emptyStateHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--gray);">
                <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                <h3 style="color: var(--dark); margin-bottom: 8px;">No Transaction Data</h3>
                <p style="font-size: 14px; text-align: center;">Upload CSV files to see your expense distribution and category breakdown</p>
            </div>
        `;

        pieCanvas.parentElement.innerHTML = emptyStateHTML;
        barCanvas.parentElement.innerHTML = emptyStateHTML;
        return;
    }

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

    // Create pie chart
    const pieCtx = pieCanvas.getContext('2d');
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
            aspectRatio: 1.5,
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

    // Create bar chart
    const barCtx = barCanvas.getContext('2d');
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

// Initialize drag and drop
function initializeDragDrop() {
    if (window.innerWidth <= 768) {
        enableMobileCategoryChange();
        return;
    }

    const items = document.querySelectorAll('.transaction-item');
    const cards = document.querySelectorAll('.category-card');

    let draggedElement = null;
    let draggedId = null;
    let draggedCategory = null;
    let lastEvent = null;
    let animationFrame = null;
    let lastValidY = 0;
    let isScrolling = false;

    function autoScroll() {
        if (!draggedElement || !isScrolling) return;

        const scrollZone = 100; // px from edge
        const maxSpeed = 15; // px per frame

        const viewportHeight = window.innerHeight;
        const mouseY = lastValidY;

        // Distance from edges
        const distTop = mouseY;
        const distBottom = viewportHeight - mouseY;

        let scrollY = 0;

        if (distTop < scrollZone && distTop > 0) {
            scrollY = -((scrollZone - distTop) / scrollZone) * maxSpeed;
        } else if (distBottom < scrollZone && distBottom > 0) {
            scrollY = ((scrollZone - distBottom) / scrollZone) * maxSpeed;
        }

        if (scrollY !== 0) {
            window.scrollBy(0, scrollY);
        }

        // Container scrolling
        const container = document.querySelector('.container');
        if (container) {
            const rect = container.getBoundingClientRect();
            const distTopContainer = mouseY - rect.top;
            const distBottomContainer = rect.bottom - mouseY;

            if (distTopContainer < scrollZone && distTopContainer > 0 && container.scrollTop > 0) {
                container.scrollTop -= ((scrollZone - distTopContainer) / scrollZone) * maxSpeed;
            } else if (
                distBottomContainer < scrollZone &&
                distBottomContainer > 0 &&
                container.scrollTop < container.scrollHeight - container.clientHeight
            ) {
                container.scrollTop += ((scrollZone - distBottomContainer) / scrollZone) * maxSpeed;
            }
        }

        if (isScrolling) {
            animationFrame = requestAnimationFrame(autoScroll);
        }
    }

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedId = item.dataset.transactionId;
            draggedCategory = item.dataset.category;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            lastValidY = e.clientY;
            isScrolling = true;
            animationFrame = requestAnimationFrame(autoScroll);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedElement = null;
            draggedId = null;
            draggedCategory = null;
            isScrolling = false;
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        });

        item.addEventListener('drag', (e) => {
            if (e.clientY > 0) {
                lastValidY = e.clientY;
            }
        });
    });

    document.addEventListener('dragover', (e) => {
        if (draggedElement) {
            e.preventDefault();
            // Always update position on dragover as it's more reliable
            lastValidY = e.clientY;
        }
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

function enableMobileCategoryChange() {
    const items = document.querySelectorAll('.transaction-item');

    items.forEach((item) => {
        // Remove draggable attribute
        item.removeAttribute('draggable');
        item.style.cursor = 'pointer';

        item.addEventListener('click', () => {
            const transactionId = item.dataset.transactionId;
            const currentCategory = item.dataset.category;
            showMobileCategorySelector(transactionId, currentCategory, item);
        });
    });
}

function showMobileCategorySelector(transactionId, currentCategory, element) {
    const categories = Object.keys(categoryConfig).filter((c) => c !== currentCategory);

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 400px;">
            <div class="modal-header">
                <h2>Move Transaction</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 13px; color: var(--gray); margin-bottom: 15px;">
                    Current category: <strong>${currentCategory}</strong>
                </p>
                <div style="display: grid; gap: 10px;">
                    ${categories
                        .map(
                            (cat) => `
                        <button class="btn btn-secondary" 
                                style="text-align: left; padding: 12px; display: flex; align-items: center; gap: 10px;"
                                onclick="moveTransaction('${transactionId}', '${currentCategory}', '${cat}'); this.closest('.modal').remove();">
                            <span style="font-size: 20px;">${categoryConfig[cat].icon}</span>
                            <span>${cat}</span>
                        </button>
                    `
                        )
                        .join('')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Show move confirmation modal
function showMoveConfirmationModal(transactionId, fromCategory, toCategory, transaction, monthKey) {
    const description = (transaction.Description || transaction.description || '').trim();
    const amount = Math.abs(parseFloat(transaction.Amount) || 0);

    // Extract merchant name for pattern suggestion
    const merchantName = description
        .toUpperCase()
        .split(/[\s#\*]/)[0]
        .trim();

    const fromIcon = categoryConfig[fromCategory]?.icon || '📦';
    const toIcon = categoryConfig[toCategory]?.icon || '📦';

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'moveConfirmModal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>Move Transaction</h2>
                <button class="close-btn" onclick="closeMoveConfirmModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="move-preview">
                    <div class="move-transaction-info">
                        <p class="move-description">${escapeHtmlDashboard(description)}</p>
                        <p class="move-amount">$${amount.toFixed(2)}</p>
                    </div>
                    <div class="move-flow">
                        <div class="move-category from">
                            <span class="category-icon">${fromIcon}</span>
                            <span class="category-name">${fromCategory}</span>
                        </div>
                        <div class="move-arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </div>
                        <div class="move-category to">
                            <span class="category-icon">${toIcon}</span>
                            <span class="category-name">${toCategory}</span>
                        </div>
                    </div>
                </div>

                <div class="rule-creation-section">
                    <h4>Create a rule for future transactions?</h4>
                    <p class="rule-hint">A rule will automatically categorize similar transactions.</p>

                    <div class="pattern-input-group">
                        <label for="rulePatternInput">Pattern to match:</label>
                        <input type="text" id="rulePatternInput" value="${escapeHtmlDashboard(merchantName)}"
                               placeholder="Enter pattern..." class="pattern-input">
                        <span class="pattern-hint">Transactions containing this text will be moved to ${toCategory}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer move-modal-footer">
                <button class="btn btn-secondary" onclick="closeMoveConfirmModal()">Cancel</button>
                <button class="btn btn-secondary" onclick="executeMoveOnly('${transactionId}', '${toCategory}', '${monthKey}')">
                    Move Only
                </button>
                <button class="btn btn-primary" onclick="executeMoveWithRule('${transactionId}', '${toCategory}', '${monthKey}')">
                    Move & Create Rule
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMoveConfirmModal();
        }
    });

    // Focus on pattern input
    setTimeout(() => {
        document.getElementById('rulePatternInput')?.focus();
    }, 100);
}

// Close move confirmation modal
function closeMoveConfirmModal() {
    const modal = document.getElementById('moveConfirmModal');
    if (modal) {
        modal.remove();
    }
}

// Execute move without creating a rule
function executeMoveOnly(transactionId, toCategory, monthKey) {
    // Set the override
    if (!window.transactionOverrides) {
        window.transactionOverrides = {};
    }
    if (!window.transactionOverrides[monthKey]) {
        window.transactionOverrides[monthKey] = {};
    }
    window.transactionOverrides[monthKey][transactionId] = toCategory;

    saveData();
    closeMoveConfirmModal();

    // Refresh view
    switchToMonth(currentMonth);
    showNotification(`Transaction moved to ${toCategory}`, 'success');
}

// Execute move and create a rule
function executeMoveWithRule(transactionId, toCategory, monthKey) {
    const patternInput = document.getElementById('rulePatternInput');
    const pattern = patternInput?.value?.trim()?.toUpperCase();

    if (!pattern) {
        showNotification('Please enter a pattern for the rule', 'error');
        return;
    }

    // Load existing rules
    if (typeof loadRules === 'function') {
        loadRules();
    }

    // Check if rule already exists
    const existingRule = window.unifiedRules?.find(
        (r) => r.pattern === pattern && r.type === 'categorize' && r.active
    );

    let ruleAction = 'created';

    if (existingRule) {
        if (existingRule.action !== toCategory) {
            // Update existing rule to new category
            existingRule.action = toCategory;
            existingRule.name = `Auto: "${pattern}" → ${toCategory}`;
            existingRule.updatedAt = new Date().toISOString();
            ruleAction = 'updated';
        }
        // If rule exists with same action, we still apply it below
        saveRules();
    } else {
        // Create new rule
        const newRule = {
            id: generateRuleId(),
            name: `Auto: "${pattern}" → ${toCategory}`,
            type: 'categorize',
            pattern: pattern,
            matchType: 'contains',
            action: toCategory,
            isAutomatic: true,
            active: true,
            createdAt: new Date().toISOString(),
        };
        window.unifiedRules.push(newRule);
        saveRules();
    }

    // Apply rule to ALL existing matching transactions (including the clicked one)
    const appliedCount = applyCategorizationRuleToExisting(pattern, toCategory);

    // Build notification message
    if (appliedCount > 1) {
        showNotification(`Rule ${ruleAction}: "${pattern}" → ${toCategory} (applied to ${appliedCount} transactions)`, 'success');
    } else if (appliedCount === 1) {
        showNotification(`Rule ${ruleAction}: "${pattern}" → ${toCategory}`, 'success');
    } else {
        // No transactions matched (shouldn't happen but handle gracefully)
        // Still set override for the clicked transaction manually
        if (!window.transactionOverrides) {
            window.transactionOverrides = {};
        }
        if (!window.transactionOverrides[monthKey]) {
            window.transactionOverrides[monthKey] = {};
        }
        window.transactionOverrides[monthKey][transactionId] = toCategory;
        showNotification(`Rule ${ruleAction}: "${pattern}" → ${toCategory}`, 'success');
    }

    saveData();
    closeMoveConfirmModal();

    // Refresh view
    switchToMonth(currentMonth);
}

// Move transaction between categories
function moveTransaction(transactionId, fromCategory, toCategory) {
    // Handle "All Data" view differently
    if (currentMonth === 'ALL_DATA') {
        // Find which month contains this transaction
        let actualMonth = null;
        let actualTransaction = null;

        for (const [monthKey, monthData] of monthlyData.entries()) {
            const trans = monthData.transactions.find((t) => t._id === transactionId);
            if (trans) {
                actualMonth = monthKey;
                actualTransaction = trans;
                break;
            }
        }

        if (!actualMonth || !actualTransaction) {
            showNotification('Transaction not found', 'error');
            return;
        }

        // Show confirmation modal
        showMoveConfirmationModal(transactionId, fromCategory, toCategory, actualTransaction, actualMonth);
        return;
    }

    // Single month view
    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    const transaction = monthData.transactions.find((t) => t._id === transactionId);
    if (!transaction) return;

    // Show confirmation modal
    showMoveConfirmationModal(transactionId, fromCategory, toCategory, transaction, currentMonth);
}

// Count similar transactions by pattern
function countSimilarTransactions(pattern) {
    const upperPattern = pattern.toUpperCase();
    let count = 0;

    monthlyData.forEach((monthData) => {
        monthData.transactions.forEach((t) => {
            const desc = (t.Description || t.description || '').toUpperCase();
            if (desc.includes(upperPattern)) {
                count++;
            }
        });
    });

    return count;
}

// Apply categorization rule to all matching transactions and return count
function applyCategorizationRuleToExisting(pattern, toCategory) {
    const upperPattern = pattern.toUpperCase();
    let count = 0;

    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((t) => {
            const desc = (t.Description || t.description || '').toUpperCase();
            if (desc.includes(upperPattern)) {
                // Apply category override
                if (!window.transactionOverrides) {
                    window.transactionOverrides = {};
                }
                if (!window.transactionOverrides[monthKey]) {
                    window.transactionOverrides[monthKey] = {};
                }
                // Check if not already overridden to this category
                if (window.transactionOverrides[monthKey][t._id] !== toCategory) {
                    window.transactionOverrides[monthKey][t._id] = toCategory;
                    count++;
                }
            }
        });
    });

    return count;
}

// Show delete confirmation modal
function showDeleteConfirmationModal(category, transactionId, transaction, monthKey) {
    const description = (transaction.Description || transaction.description || '').trim();
    const amount = Math.abs(parseFloat(transaction.Amount) || 0);

    // Extract merchant name for pattern
    const merchantName = description
        .toUpperCase()
        .split(/[\s#\*]/)[0]
        .trim();

    // Count similar transactions
    const similarCount = countSimilarTransactions(merchantName);
    const categoryIcon = categoryConfig[category]?.icon || '📦';

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'deleteConfirmModal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 480px;">
            <div class="modal-header" style="background: var(--danger-subtle); border-bottom-color: rgba(239, 68, 68, 0.2);">
                <h2 style="color: var(--danger);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete Transaction
                </h2>
                <button class="close-btn" onclick="closeDeleteConfirmModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="delete-preview">
                    <div class="transaction-info">
                        <p class="transaction-desc">${escapeHtmlDashboard(description)}</p>
                        <div class="transaction-meta">
                            <span>${categoryIcon} ${category}</span>
                            <span>$${amount.toFixed(2)}</span>
                        </div>
                    </div>
                    ${similarCount > 1 ? `
                        <div class="similar-count">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            ${similarCount - 1} other similar transaction${similarCount > 2 ? 's' : ''} found
                        </div>
                    ` : ''}
                </div>

                <div class="delete-options">
                    <label class="delete-option selected" onclick="selectDeleteOption(this, 'single')">
                        <input type="radio" name="deleteOption" value="single" checked>
                        <div class="delete-option-content">
                            <div class="delete-option-title">Delete this transaction only</div>
                            <div class="delete-option-desc">Remove just this one transaction</div>
                        </div>
                    </label>

                    <label class="delete-option" onclick="selectDeleteOption(this, 'rule')">
                        <input type="radio" name="deleteOption" value="rule">
                        <div class="delete-option-content">
                            <div class="delete-option-title">Delete & create rule for future</div>
                            <div class="delete-option-desc">Also auto-delete similar transactions when imported</div>
                            <div class="delete-pattern-input">
                                <label for="deletePatternInput">Pattern to match:</label>
                                <input type="text" id="deletePatternInput" value="${escapeHtmlDashboard(merchantName)}"
                                       class="pattern-input" placeholder="Enter pattern...">
                            </div>
                        </div>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeDeleteConfirmModal()">Cancel</button>
                <button class="btn btn-danger" onclick="executeDelete('${category}', '${transactionId}', '${monthKey}', '${escapeHtmlDashboard(merchantName)}')">
                    Delete
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeDeleteConfirmModal();
        }
    });
}

// Select delete option
function selectDeleteOption(element, option) {
    document.querySelectorAll('.delete-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    element.querySelector('input[type="radio"]').checked = true;
}

// Close delete confirmation modal
function closeDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.remove();
    }
}

// Execute delete
function executeDelete(category, transactionId, monthKey, merchantPattern) {
    const selectedOption = document.querySelector('input[name="deleteOption"]:checked')?.value || 'single';

    // Read pattern from input if rule option selected
    const patternInput = document.getElementById('deletePatternInput');
    const pattern = patternInput?.value?.trim()?.toUpperCase() || merchantPattern;

    // Handle "All Data" view
    if (currentMonth === 'ALL_DATA') {
        let deleted = false;

        monthlyData.forEach((monthData, key) => {
            const index = monthData.transactions.findIndex((t) => t._id === transactionId);
            if (index > -1) {
                monthData.transactions.splice(index, 1);
                deleted = true;
            }
        });

        if (!deleted) {
            showNotification('Transaction not found', 'error');
            closeDeleteConfirmModal();
            return;
        }
    } else {
        // Single month view
        const monthData = monthlyData.get(monthKey);
        if (!monthData) {
            showNotification('Transaction not found', 'error');
            closeDeleteConfirmModal();
            return;
        }

        const index = monthData.transactions.findIndex((t) => t._id === transactionId);
        if (index === -1) {
            showNotification('Transaction not found', 'error');
            closeDeleteConfirmModal();
            return;
        }

        monthData.transactions.splice(index, 1);
    }

    // Create deletion rule if requested
    if (selectedOption === 'rule' && pattern) {
        if (typeof loadRules === 'function') {
            loadRules();
        }

        // Check if rule already exists
        const existingRule = window.unifiedRules?.find(
            (r) => r.pattern === pattern && r.type === 'delete' && r.active
        );

        if (!existingRule) {
            const newRule = {
                id: generateRuleId(),
                name: `Delete: "${pattern}"`,
                type: 'delete',
                pattern: pattern,
                matchType: 'contains',
                action: null,
                isAutomatic: true,
                active: true,
                createdAt: new Date().toISOString(),
            };
            window.unifiedRules.push(newRule);
            saveRules();

            // Apply delete rule to all matching transactions immediately
            let deletedCount = 0;
            monthlyData.forEach((monthData, monthKey) => {
                const initialLength = monthData.transactions.length;
                monthData.transactions = monthData.transactions.filter((t) => {
                    const desc = (t.Description || t.description || '').toUpperCase();
                    if (desc.includes(pattern) && t._id !== transactionId) {
                        deletedCount++;
                        return false; // Remove from array
                    }
                    return true;
                });
            });

            if (deletedCount > 0) {
                showNotification(`Deleted ${deletedCount + 1} transaction(s) matching "${pattern}" (rule created for future imports)`, 'success');
            } else {
                showNotification(`Transaction deleted and rule created for "${pattern}"`, 'success');
            }
        } else {
            // Rule exists - still apply it to existing matching transactions
            let deletedCount = 0;
            monthlyData.forEach((monthData, monthKey) => {
                monthData.transactions = monthData.transactions.filter((t) => {
                    const desc = (t.Description || t.description || '').toUpperCase();
                    if (desc.includes(pattern) && t._id !== transactionId) {
                        deletedCount++;
                        return false;
                    }
                    return true;
                });
            });

            if (deletedCount > 0) {
                showNotification(`Deleted ${deletedCount + 1} transaction(s) matching "${pattern}" (rule already exists)`, 'success');
            } else {
                showNotification('Transaction deleted (rule already exists)', 'success');
            }
        }
    } else {
        showNotification('Transaction deleted', 'success');
    }

    saveData();
    closeDeleteConfirmModal();
    switchToMonth(currentMonth);
}

// Delete transaction
function deleteTransaction(category, transactionId) {
    // Find the transaction
    let transaction = null;
    let monthKey = currentMonth;

    if (currentMonth === 'ALL_DATA') {
        for (const [key, monthData] of monthlyData.entries()) {
            const found = monthData.transactions.find((t) => t._id === transactionId);
            if (found) {
                transaction = found;
                monthKey = key;
                break;
            }
        }
    } else {
        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            transaction = monthData.transactions.find((t) => t._id === transactionId);
        }
    }

    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }

    // Show confirmation modal
    showDeleteConfirmationModal(category, transactionId, transaction, monthKey);
}

// Delete from modal
function deleteTransactionFromModal(category, transactionId) {
    deleteTransaction(category, transactionId);
    closeModal('transactionsModal');
}

// Show raw transaction data in a modal
function showRawTransactionData(transactionId, category) {
    let transaction = null;

    // Find the transaction across all months if viewing all data
    if (currentMonth === 'ALL_DATA') {
        for (const [monthKey, monthData] of monthlyData.entries()) {
            const found = monthData.transactions.find((t) => t._id === transactionId);
            if (found) {
                transaction = found;
                break;
            }
        }
    } else if (currentMonth === 'CUSTOM_RANGE' && window.customDateRange) {
        // Search in custom range
        for (const [monthKey, monthData] of monthlyData.entries()) {
            const found = monthData.transactions.find((t) => t._id === transactionId);
            if (found) {
                transaction = found;
                break;
            }
        }
    } else {
        const monthData = monthlyData.get(currentMonth);
        if (monthData) {
            transaction = monthData.transactions.find((t) => t._id === transactionId);
        }
    }

    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }

    const rawData = transaction._rawCsvData;

    // Build the raw data display
    let rawDataHTML = '';
    if (rawData && Object.keys(rawData).length > 0) {
        rawDataHTML = `
            <div class="raw-data-table">
                <table>
                    <thead>
                        <tr>
                            ${Object.keys(rawData)
                                .map((key) => `<th>${escapeHtmlDashboard(key)}</th>`)
                                .join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${Object.values(rawData)
                                .map((val) => `<td>${escapeHtmlDashboard(String(val ?? ''))}</td>`)
                                .join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="raw-data-csv-line">
                <h4>CSV Line:</h4>
                <code>${Object.values(rawData)
                    .map((v) => {
                        const val = String(v ?? '');
                        // Quote if contains comma or quotes
                        if (val.includes(',') || val.includes('"')) {
                            return '"' + val.replace(/"/g, '""') + '"';
                        }
                        return val;
                    })
                    .join(',')}</code>
            </div>
        `;
    } else {
        rawDataHTML = `
            <div class="raw-data-notice">
                <p>Raw CSV data is not available for this transaction.</p>
                <p>This may be because the transaction was imported before this feature was added.</p>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'rawDataModal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 800px;">
            <div class="modal-header">
                <h2>Transaction Details</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="transaction-summary">
                    <p><strong>Description:</strong> ${escapeHtmlDashboard(transaction.Description || '')}</p>
                    <p><strong>Amount:</strong> $${Math.abs(transaction.Amount || 0).toFixed(2)}</p>
                    <p><strong>Date:</strong> ${transaction['Transaction Date'] || ''}</p>
                    <p><strong>Category:</strong> ${category}</p>
                </div>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
                <h3 style="margin-bottom: 15px;">Original CSV Data</h3>
                ${rawDataHTML}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Helper function to escape HTML for dashboard display
function escapeHtmlDashboard(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show all transactions for a category
function showAllTransactions(category) {
    let transactions;

    if (currentMonth === 'ALL_DATA') {
        // Combine all transactions for this category
        const allTransactions = [];
        monthlyData.forEach((monthData) => {
            allTransactions.push(...monthData.transactions);
        });
        const analyzer = analyzeTransactions(allTransactions);
        transactions = analyzer.categoryDetails[category] || [];
    } else {
        const monthData = monthlyData.get(currentMonth);
        if (!monthData) return;
        const analyzer = analyzeTransactions(monthData.transactions);
        transactions = analyzer.categoryDetails[category] || [];
    }

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

// Get monthly data for a specific category
function getCategoryMonthlyData(category) {
    const monthlyStats = [];
    const months = Array.from(monthlyData.keys()).sort();

    months.forEach(monthKey => {
        const monthData = monthlyData.get(monthKey);
        const analyzer = analyzeTransactions(monthData.transactions);
        const total = analyzer.categoryTotals[category] || 0;
        const count = analyzer.categoryDetails[category]?.length || 0;

        monthlyStats.push({
            monthKey,
            monthName: monthData.monthName,
            total,
            count
        });
    });

    return monthlyStats;
}

// Show category analysis modal
function showCategoryAnalysis(category) {
    const config = categoryConfig[category] || { icon: '📦' };
    const monthlyStats = getCategoryMonthlyData(category);

    if (monthlyStats.length === 0) {
        showNotification('No data available for analysis', 'info');
        return;
    }

    // Calculate statistics
    const totals = monthlyStats.map(m => m.total);
    const nonZeroTotals = totals.filter(t => t > 0);

    const stats = {
        average: nonZeroTotals.length > 0 ? nonZeroTotals.reduce((a, b) => a + b, 0) / nonZeroTotals.length : 0,
        highest: Math.max(...totals),
        lowest: Math.min(...nonZeroTotals.length > 0 ? nonZeroTotals : [0]),
        highestMonth: monthlyStats.find(m => m.total === Math.max(...totals))?.monthName || 'N/A',
        lowestMonth: monthlyStats.find(m => m.total === Math.min(...(nonZeroTotals.length > 0 ? nonZeroTotals : totals)))?.monthName || 'N/A',
        totalTransactions: monthlyStats.reduce((sum, m) => sum + m.count, 0)
    };

    // Get current month total for comparison
    let currentTotal = 0;
    if (currentMonth && currentMonth !== 'ALL_DATA' && currentMonth !== 'CUSTOM_RANGE') {
        const currentMonthData = monthlyData.get(currentMonth);
        if (currentMonthData) {
            const analyzer = analyzeTransactions(currentMonthData.transactions);
            currentTotal = analyzer.categoryTotals[category] || 0;
        }
    }

    // Calculate comparison
    const vsAverage = stats.average > 0 ? ((currentTotal - stats.average) / stats.average) * 100 : 0;
    const comparisonClass = vsAverage >= 0 ? 'above' : 'below';
    const comparisonText = vsAverage >= 0 ? 'above' : 'below';

    // Top transactions
    let topTransactions = [];
    monthlyData.forEach((monthData, monthKey) => {
        const analyzer = analyzeTransactions(monthData.transactions);
        const categoryTrans = analyzer.categoryDetails[category] || [];
        categoryTrans.forEach(t => {
            topTransactions.push({
                ...t,
                monthName: monthData.monthName
            });
        });
    });
    topTransactions.sort((a, b) => b.amount - a.amount);
    topTransactions = topTransactions.slice(0, 5);

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'categoryAnalysisModal';
    modal.innerHTML = `
        <div class="modal-content analysis-modal">
            <div class="modal-header">
                <h2>
                    <span class="analysis-category-icon">${config.icon}</span>
                    ${category} - Trends & Analysis
                </h2>
                <button class="close-btn" onclick="closeCategoryAnalysisModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="analysis-chart-container">
                    <canvas id="categoryTrendChart"></canvas>
                </div>

                <div class="analysis-stats-grid">
                    <div class="analysis-stat">
                        <div class="stat-label">Monthly Average</div>
                        <div class="stat-value">$${stats.average.toFixed(2)}</div>
                    </div>
                    <div class="analysis-stat">
                        <div class="stat-label">Highest Month</div>
                        <div class="stat-value">$${stats.highest.toFixed(2)}</div>
                        <div class="stat-sublabel">${stats.highestMonth}</div>
                    </div>
                    <div class="analysis-stat">
                        <div class="stat-label">Lowest Month</div>
                        <div class="stat-value">$${stats.lowest.toFixed(2)}</div>
                        <div class="stat-sublabel">${stats.lowestMonth}</div>
                    </div>
                    <div class="analysis-stat">
                        <div class="stat-label">Total Transactions</div>
                        <div class="stat-value">${stats.totalTransactions}</div>
                    </div>
                </div>

                ${currentMonth && currentMonth !== 'ALL_DATA' && currentMonth !== 'CUSTOM_RANGE' ? `
                    <div class="analysis-comparison">
                        <h4>Current Month vs Average</h4>
                        <div class="comparison-bar-container">
                            <div class="comparison-bar">
                                <div class="comparison-fill ${comparisonClass}"
                                     style="width: ${Math.min(100, (currentTotal / (stats.average || 1)) * 100)}%"></div>
                                <div class="comparison-average-line"
                                     style="left: ${Math.min(100, 100)}%"></div>
                            </div>
                            <div class="comparison-labels">
                                <span>$${currentTotal.toFixed(2)}</span>
                                <span class="comparison-vs ${comparisonClass}">
                                    ${Math.abs(vsAverage).toFixed(1)}% ${comparisonText} average
                                </span>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${topTransactions.length > 0 ? `
                    <div class="analysis-top-transactions">
                        <h4>Top Transactions</h4>
                        <div class="top-transactions-list">
                            ${topTransactions.map(t => `
                                <div class="top-transaction-item">
                                    <div class="top-transaction-info">
                                        <span class="top-transaction-name">${escapeHtmlDashboard(t.name)}</span>
                                        <span class="top-transaction-month">${t.monthName}</span>
                                    </div>
                                    <span class="top-transaction-amount">$${t.amount.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeCategoryAnalysisModal()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCategoryAnalysisModal();
        }
    });

    // Create the chart
    setTimeout(() => {
        const ctx = document.getElementById('categoryTrendChart');
        if (ctx) {
            new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: monthlyStats.map(m => m.monthName.split(' ')[0]), // Just month name
                    datasets: [{
                        label: category,
                        data: monthlyStats.map(m => m.total),
                        borderColor: '#0891b2',
                        backgroundColor: 'rgba(8, 145, 178, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#0891b2',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }, {
                        label: 'Average',
                        data: monthlyStats.map(() => stats.average),
                        borderColor: '#94a3b8',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `$${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value;
                                }
                            }
                        }
                    }
                }
            });
        }
    }, 100);
}

// Close category analysis modal
function closeCategoryAnalysisModal() {
    const modal = document.getElementById('categoryAnalysisModal');
    if (modal) {
        modal.remove();
    }
}

// Mark analysis feature as seen (removes first-use animation)
function markAnalysisSeen() {
    localStorage.setItem('sahabBudget_seenAnalysis', 'true');
    document.querySelectorAll('.analysis-btn.first-use').forEach(btn => {
        btn.classList.remove('first-use');
    });
}

// Global keyboard event listener for modals
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Close modals in order of priority (most recent first)
        const modals = [
            'categoryAnalysisModal',
            'deleteConfirmModal',
            'moveConfirmModal',
            'rawDataModal',
            'transactionsModal',
            'comparisonModal',
            'dateRangeModal'
        ];

        for (const modalId of modals) {
            const modal = document.getElementById(modalId);
            if (modal && modal.classList.contains('show')) {
                // Find the appropriate close function
                if (modalId === 'categoryAnalysisModal') {
                    closeCategoryAnalysisModal();
                } else if (modalId === 'deleteConfirmModal') {
                    closeDeleteConfirmModal();
                } else if (modalId === 'moveConfirmModal') {
                    closeMoveConfirmModal();
                } else if (modalId === 'rawDataModal') {
                    modal.remove();
                } else {
                    closeModal(modalId);
                }
                break;
            }
        }
    }
});
