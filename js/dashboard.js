// js/dashboard.js - Dashboard View Functions

// Last rendered analyzer, kept so charts can re-theme without recomputing data
let lastDashboardAnalyzer = null;

// Small inline UI icons (Feather style) not covered by getIcon()
const DASHBOARD_UI_ICONS = {
    list: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    trendingDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>',
    arrowUpRight: '<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>',
    arrowDownRight: '<line x1="7" y1="7" x2="17" y2="17"></line><polyline points="17 7 17 17 7 17"></polyline>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    target: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
    pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
};

function dashboardIcon(key, size) {
    const inner = DASHBOARD_UI_ICONS[key];
    if (!inner) return '';
    const s = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        inner + '</svg>';
}

function formatDashboardMoney(amount) {
    const n = Number(amount) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Previous calendar month key for a YYYY-MM key, or null
function getPreviousMonthKey(monthKey) {
    const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
    return monthKeyFromDate(d);
}

// Analyzer + name for the month before the currently viewed month, or null
function getPreviousMonthContext() {
    if (!currentMonth || currentMonth === 'ALL_DATA' || currentMonth === 'CUSTOM_RANGE') return null;
    const prevKey = getPreviousMonthKey(currentMonth);
    if (!prevKey || !monthlyData.has(prevKey)) return null;
    const prevData = monthlyData.get(prevKey);
    if (!prevData.transactions || prevData.transactions.length === 0) return null;
    return {
        monthKey: prevKey,
        monthName: prevData.monthName,
        analyzer: analyzeTransactions(prevData.transactions),
    };
}

// Expense total excluding income (mirrors the summary-card calculation)
function expenseTotalOf(analyzer) {
    const income = (!categoryConfig['Income']?._isExcluded) ? (analyzer.categoryTotals['Income'] || 0) : 0;
    return analyzer.totalExpenses - income;
}

// Re-show the sections that search or an empty state may have hidden
function restoreDashboardSections() {
    const summaryCards = document.getElementById('summaryCards');
    const chartsContainer = document.querySelector('.charts-container');
    const breakdownHeader = document.querySelector('.breakdown-header');
    const sectionHeader = document.querySelector('.section-header');
    if (summaryCards) summaryCards.style.display = '';
    if (chartsContainer) chartsContainer.style.display = '';
    if (breakdownHeader) breakdownHeader.style.display = '';
    if (sectionHeader) sectionHeader.style.display = '';
    // A normal render replaces any search-results view, so reset the box
    const searchInput = document.getElementById('dashboardSearch');
    if (searchInput && searchInput.value) searchInput.value = '';
}

function buildStatCard(options) {
    const accent = options.accent ? ' stat-accent-' + options.accent : '';
    return `
        <div class="card stat-card${accent}">
            <div class="stat-top">
                <span class="stat-label">${options.label}</span>
                <span class="stat-icon">${options.icon || ''}</span>
            </div>
            <p class="stat-value">${options.value}</p>
            ${options.trendHTML || ''}
        </div>
    `;
}

// Trend chip comparing this month's expenses with the previous month
function buildExpenseTrend(currentExpenses, prevContext) {
    if (!prevContext) return '';
    const prevExpenses = expenseTotalOf(prevContext.analyzer);
    if (!(prevExpenses > 0)) return '';
    const pct = ((currentExpenses - prevExpenses) / prevExpenses) * 100;
    if (!isFinite(pct) || Math.abs(pct) < 0.5) return '';
    const up = pct > 0;
    return `
        <span class="stat-trend ${up ? 'trend-up' : 'trend-down'}">
            ${dashboardIcon(up ? 'arrowUpRight' : 'arrowDownRight', 14)}
            ${Math.abs(pct).toFixed(0)}% vs ${escapeHtml(prevContext.monthName.split(' ')[0])}
        </span>
    `;
}

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

    lastDashboardAnalyzer = analyzer;
    restoreDashboardSections();

    const prevContext = getPreviousMonthContext();

    // Update summary cards
    const avgTransaction =
        analyzer.transactionCount > 0 ? analyzer.totalExpenses / analyzer.transactionCount : 0;

    // Calculate income and net if tracking is enabled (respect excluded categories)
    const incomeTotal = (!categoryConfig['Income']?._isExcluded) ? (analyzer.categoryTotals['Income'] || 0) : 0;
    const expensesWithoutIncome = analyzer.totalExpenses - incomeTotal;
    const netAmount = incomeTotal - expensesWithoutIncome;
    const trackIncome = window.incomeSettings?.trackIncome === true;

    const expenseTrendHTML = buildExpenseTrend(expensesWithoutIncome, prevContext);

    let cardsHTML = '';

    // Show income cards if tracking is enabled and there's income data
    if (trackIncome && incomeTotal > 0) {
        cardsHTML =
            buildStatCard({
                label: 'Total Income',
                value: formatDashboardMoney(incomeTotal),
                icon: getIcon('trendup', 18),
                accent: 'success',
            }) +
            buildStatCard({
                label: 'Total Expenses',
                value: formatDashboardMoney(expensesWithoutIncome),
                icon: getIcon('wallet', 18),
                accent: 'brand',
                trendHTML: expenseTrendHTML,
            }) +
            buildStatCard({
                label: netAmount >= 0 ? 'Net Savings' : 'Net Deficit',
                value: formatDashboardMoney(Math.abs(netAmount)),
                icon: dashboardIcon('activity', 18),
                accent: netAmount >= 0 ? 'success' : 'danger',
            }) +
            buildStatCard({
                label: 'Transactions',
                value: String(analyzer.transactionCount),
                icon: dashboardIcon('list', 18),
            });
    } else {
        const activeCategories = Object.keys(analyzer.categoryTotals).filter(
            (c) => analyzer.categoryTotals[c] > 0
        ).length;
        cardsHTML =
            buildStatCard({
                label: 'Total Expenses',
                value: formatDashboardMoney(analyzer.totalExpenses),
                icon: getIcon('wallet', 18),
                accent: 'brand',
                trendHTML: expenseTrendHTML,
            }) +
            buildStatCard({
                label: 'Transactions',
                value: String(analyzer.transactionCount),
                icon: dashboardIcon('list', 18),
            }) +
            buildStatCard({
                label: 'Categories',
                value: String(activeCategories),
                icon: getIcon('grid', 18),
            }) +
            buildStatCard({
                label: 'Average',
                value: formatDashboardMoney(avgTransaction),
                icon: dashboardIcon('activity', 18),
            });
    }
    summaryCards.innerHTML = cardsHTML;

    // Smart insight cards
    renderDashboardInsights(analyzer, prevContext);

    // Update category details
    updateCategoryDetails(analyzer);

    // Update charts
    updateCharts(analyzer);
}

// ==========================================
// SMART INSIGHTS
// ==========================================
function renderDashboardInsights(analyzer, prevContext) {
    const summaryCards = document.getElementById('summaryCards');
    if (!summaryCards) return;

    let strip = document.getElementById('dashboardInsights');
    if (!strip) {
        strip = document.createElement('div');
        strip.id = 'dashboardInsights';
        strip.className = 'insight-strip';
        summaryCards.insertAdjacentElement('afterend', strip);
    }

    const insights = [];

    if (analyzer && analyzer.transactionCount > 0) {
        // 1. Biggest category this period
        const expenseCategories = Object.entries(analyzer.categoryTotals)
            .filter(([cat, v]) => v > 0 && cat !== 'Income' && !categoryConfig[cat]?._isExcluded)
            .sort((a, b) => b[1] - a[1]);
        const spendTotal = expenseCategories.reduce((sum, [, v]) => sum + v, 0);

        if (expenseCategories.length > 0) {
            const [topName, topValue] = expenseCategories[0];
            const share = spendTotal > 0 ? Math.round((topValue / spendTotal) * 100) : 0;
            insights.push({
                iconHTML: getCategoryIconChip(topName, { size: 36, icon: 18 }),
                label: 'Top category',
                value: escapeHtml(topName),
                sub: `${formatDashboardMoney(topValue)}${share > 0 ? ' (' + share + '% of spend)' : ''}`,
            });
        }

        // 2. Largest single transaction (expenses only)
        let largest = null;
        Object.entries(analyzer.categoryDetails).forEach(([cat, items]) => {
            if (cat === 'Income' || categoryConfig[cat]?._isExcluded) return;
            items.forEach((t) => {
                if (t.isIncome || t.isRefund) return;
                if (!largest || t.amount > largest.amount) largest = t;
            });
        });
        if (largest && largest.amount > 0) {
            insights.push({
                iconHTML: `<span class="insight-icon insight-icon-brand">${getIcon('zap', 18)}</span>`,
                label: 'Largest transaction',
                value: `<span class="insight-truncate" title="${escapeHtml(largest.name)}">${escapeHtml(largest.name)}</span>`,
                sub: formatDashboardMoney(largest.amount),
            });
        }

        // 3. Change vs previous month
        if (prevContext) {
            const prevExpenses = expenseTotalOf(prevContext.analyzer);
            const currExpenses = expenseTotalOf(analyzer);
            if (prevExpenses > 0) {
                const pct = ((currExpenses - prevExpenses) / prevExpenses) * 100;
                if (isFinite(pct)) {
                    const up = pct >= 0;
                    insights.push({
                        iconHTML: `<span class="insight-icon ${up ? 'insight-icon-danger' : 'insight-icon-success'}">${up ? getIcon('trendup', 18) : dashboardIcon('trendingDown', 18)}</span>`,
                        label: `vs ${escapeHtml(prevContext.monthName.split(' ')[0])}`,
                        value: `<span class="${up ? 'insight-value-danger' : 'insight-value-success'}">${up ? '+' : '-'}${Math.abs(pct).toFixed(0)}%</span>`,
                        sub: `${formatDashboardMoney(Math.abs(currExpenses - prevExpenses))} ${up ? 'more' : 'less'} spent`,
                    });
                }
            }
        }

        // 4. Budget status for the viewed month
        const monthBudgets =
            currentMonth && currentMonth !== 'ALL_DATA' && currentMonth !== 'CUSTOM_RANGE'
                ? budgets[currentMonth]
                : null;
        if (monthBudgets) {
            let totalBudget = 0;
            let budgetedSpend = 0;
            let overCount = 0;
            let worstCategory = null;
            let worstOverage = 0;
            Object.entries(monthBudgets).forEach(([cat, amount]) => {
                const budgetAmount = parseFloat(amount) || 0;
                if (budgetAmount <= 0) return;
                const spent = analyzer.categoryTotals[cat] || 0;
                totalBudget += budgetAmount;
                budgetedSpend += spent;
                if (spent > budgetAmount) {
                    overCount++;
                    if (spent - budgetAmount > worstOverage) {
                        worstOverage = spent - budgetAmount;
                        worstCategory = cat;
                    }
                }
            });
            if (overCount > 0) {
                insights.push({
                    iconHTML: `<span class="insight-icon insight-icon-danger">${dashboardIcon('alert', 18)}</span>`,
                    label: 'Over budget',
                    value: `<span class="insight-value-danger">${overCount} categor${overCount === 1 ? 'y' : 'ies'}</span>`,
                    sub: worstCategory
                        ? `${escapeHtml(worstCategory)} by ${formatDashboardMoney(worstOverage)}`
                        : '',
                });
            } else if (totalBudget > 0) {
                const usedPct = Math.round((budgetedSpend / totalBudget) * 100);
                const warn = usedPct >= 85;
                insights.push({
                    iconHTML: `<span class="insight-icon ${warn ? 'insight-icon-warning' : 'insight-icon-success'}">${dashboardIcon('target', 18)}</span>`,
                    label: 'Budget used',
                    value: `${usedPct}%`,
                    sub: `${formatDashboardMoney(budgetedSpend)} of ${formatDashboardMoney(totalBudget)}`,
                });
            }
        }
    }

    if (insights.length < 2) {
        strip.innerHTML = '';
        strip.style.display = 'none';
        return;
    }

    strip.style.display = '';
    strip.innerHTML = insights
        .slice(0, 4)
        .map(
            (i) => `
        <div class="insight-card">
            ${i.iconHTML}
            <div class="insight-body">
                <span class="insight-label">${i.label}</span>
                <span class="insight-value">${i.value}</span>
                ${i.sub ? `<span class="insight-sub">${i.sub}</span>` : ''}
            </div>
        </div>
    `
        )
        .join('');
}

function showDashboardEmptyState() {
    const summaryCards = document.getElementById('summaryCards');
    const categoryDetails = document.getElementById('categoryDetails');
    if (!summaryCards || !categoryDetails) return;

    lastDashboardAnalyzer = null;

    const hasAnyData = monthlyData && monthlyData.size > 0;

    // Tear down charts safely (canvases stay in the DOM for the next render)
    destroyDashboardCharts();
    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) chartsContainer.style.display = 'none';

    const breakdownHeader = document.querySelector('.breakdown-header');
    if (breakdownHeader) breakdownHeader.style.display = 'none';

    const sortControls = document.getElementById('sortControls');
    if (sortControls) sortControls.innerHTML = '';

    const insights = document.getElementById('dashboardInsights');
    if (insights) {
        insights.innerHTML = '';
        insights.style.display = 'none';
    }

    summaryCards.innerHTML = '';
    summaryCards.style.display = '';

    const line = hasAnyData
        ? 'No transactions in this period.'
        : 'Upload a bank CSV to see your spending, categorized.';

    categoryDetails.innerHTML = `
        <div class="dashboard-empty">
            <span class="dashboard-empty-icon">${dashboardIcon(hasAnyData ? 'inbox' : 'upload', 26)}</span>
            <p class="dashboard-empty-line">${line}</p>
            <button class="btn btn-primary" onclick="document.getElementById('csvFile')?.click()">
                Upload CSV Files
            </button>
        </div>
    `;
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

// Toggle transaction sort menu visibility (takes the menu element itself so
// category names never travel through element ids or inline handlers)
function toggleTransactionSortMenu(menu) {
    if (!menu) return;

    // Close all other menus first
    document.querySelectorAll('.transaction-sort-menu.show').forEach(m => {
        if (m !== menu) {
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
            <div class="collapse-toggle">
                <button class="sort-btn" onclick="collapseAllCategories()" title="Collapse all categories" aria-label="Collapse all categories">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                </button>
                <button class="sort-btn" onclick="expandAllCategories()" title="Expand all categories" aria-label="Expand all categories">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
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

        // Get budget info for current month
        const budget = (budgets[currentMonth] && budgets[currentMonth][category]) || 0;
        const remaining = budget - total;
        const percentage = budget > 0 ? (total / budget) * 100 : 0;

        const card = document.createElement('div');
        const isIncomeCategory = categoryConfig[category]?._isIncome === true || category === 'Income';
        const isExcluded = categoryConfig[category]?._isExcluded === true;
        card.className = 'category-card' + (isIncomeCategory ? ' income-category' : '') + (isExcluded ? ' excluded-category' : '');
        card.dataset.category = category;
        card.style.setProperty('--cat', getCategoryColorVar(category));

        // Tri-state view: 'collapsed' | 'default' | 'expanded'
        if (!window.categoryViewState) window.categoryViewState = {};
        const viewState = window.categoryViewState[category] || 'default';
        const isCollapsed = viewState === 'collapsed';
        const isExpanded = viewState === 'expanded';

        if (isCollapsed) {
            card.classList.add('collapsed');
        }

        // Apply transaction sort preference
        const transactionSortType = getTransactionSortPreference(category);
        const sortedTransactions = sortTransactions(transactions, transactionSortType);

        const displayedTransactions = isExpanded ? sortedTransactions : sortedTransactions.slice(0, 5);
        const remainingCount = transactions.length - 5;

        let transactionsHTML = '';

        if (transactions.length === 0) {
            transactionsHTML = '<div class="category-empty-row">No transactions</div>';
        } else {
            transactionsHTML = `
                <div class="category-transactions-list ${isExpanded ? 'expanded' : ''}">
                    ${displayedTransactions
                        .map(
                            (t) => `
                        <div class="transaction-item ${t.isRefund ? 'refund-transaction' : ''}"
                             draggable="true"
                             data-transaction-id="${escapeHtml(t.id || '')}"
                             data-category="${escapeHtml(category)}">
                            <span class="transaction-name clickable-transaction"
                                  title="${escapeHtml(t.name)}"
                                  data-action="view-raw">${escapeHtml(t.name)}${t.isRefund ? ' <span class="refund-badge">Refund</span>' : ''}${t.isIncome && !isIncomeCategory ? ' <span class="income-badge">Income</span>' : ''}</span>
                            <span class="transaction-side">
                                <span class="transaction-amount ${t.isRefund ? 'refund-amount' : ''}">${formatDashboardMoney(t.amount)}</span>
                                <button class="btn-icon transaction-delete" data-action="delete-transaction" title="Delete transaction" aria-label="Delete transaction">&times;</button>
                            </span>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                ${
                    remainingCount > 0 && !isExpanded
                        ? `
                    <button class="btn btn-secondary show-more-btn" data-action="expand-category">
                        Show ${remainingCount} more
                    </button>
                `
                        : ''
                }
                ${
                    isExpanded && transactions.length > 5
                        ? `
                    <button class="btn btn-secondary show-more-btn" data-action="collapse-category">
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
            const over = remaining < 0;
            const progressClass = percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : '';

            budgetStatusHTML = `
                <div class="category-budget">
                    <div class="category-budget-meta">
                        <span class="category-budget-label">Budget ${formatDashboardMoney(budget)}</span>
                        <span class="category-budget-status ${over ? 'over' : 'under'}">
                            ${over ? 'Over by' : 'Left'} ${formatDashboardMoney(Math.abs(remaining))}
                        </span>
                    </div>
                    <div class="budget-progress">
                        <div class="budget-progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
            `;
        }

        // Collapse chevron
        const chevronSvg = isCollapsed
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        card.innerHTML = `
            <div class="category-header">
                <div class="category-title" data-action="toggle-collapse" role="button" tabindex="0" aria-expanded="${!isCollapsed}">
                    <span class="collapse-chevron">${chevronSvg}</span>
                    ${getCategoryIconChip(category, { size: 36, icon: 18 })}
                    <h4>${escapeHtml(category)}</h4>
                    <span class="collapse-count">(${transactions.length})</span>
                </div>
                <div class="category-header-actions">
                    <span class="category-total">${formatDashboardMoney(total)}</span>
                    <button class="analysis-btn collapse-hide ${!localStorage.getItem('sahabBudget_seenAnalysis') ? 'first-use' : ''}" data-action="show-analysis" title="View category trends" aria-label="View category trends">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </button>
                    ${transactions.length > 1 ? `
                        <div class="transaction-sort-dropdown collapse-hide">
                            <button class="transaction-sort-btn ${transactionSortType !== 'default' ? 'active' : ''}"
                                    data-action="toggle-sort-menu"
                                    title="Sort transactions" aria-label="Sort transactions">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M3 12h12M3 18h6"/>
                                </svg>
                            </button>
                            <div class="transaction-sort-menu">
                                <button class="${transactionSortType === 'default' ? 'active' : ''}"
                                        data-action="set-transaction-sort" data-sort="default">
                                    Default (Date)
                                </button>
                                <button class="${transactionSortType === 'high-to-low' ? 'active' : ''}"
                                        data-action="set-transaction-sort" data-sort="high-to-low">
                                    High to Low
                                </button>
                                <button class="${transactionSortType === 'low-to-high' ? 'active' : ''}"
                                        data-action="set-transaction-sort" data-sort="low-to-high">
                                    Low to High
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${budgetStatusHTML}
            <div class="category-transactions">
                ${transactionsHTML}
            </div>
        `;

        container.appendChild(card);
    });

    // Event delegation for card and transaction actions (no inline onclick with
    // user-controlled strings). Remove previous listener to prevent stacking.
    if (container._categoryClickHandler) {
        container.removeEventListener('click', container._categoryClickHandler);
    }
    container._categoryClickHandler = function (e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const card = actionEl.closest('.category-card');
        const category = card ? card.dataset.category : '';

        switch (actionEl.dataset.action) {
            case 'toggle-collapse': {
                e.preventDefault();
                if (!category) return;
                const currentState = (window.categoryViewState || {})[category] || 'default';
                setCategoryViewState(category, currentState === 'collapsed' ? 'default' : 'collapsed');
                return;
            }
            case 'view-raw': {
                e.stopPropagation();
                const item = actionEl.closest('.transaction-item');
                if (item) showRawTransactionData(item.dataset.transactionId, item.dataset.category);
                return;
            }
            case 'delete-transaction': {
                e.stopPropagation();
                const item = actionEl.closest('.transaction-item');
                if (item) deleteTransaction(item.dataset.category, item.dataset.transactionId);
                return;
            }
            case 'show-analysis': {
                e.stopPropagation();
                markAnalysisSeen();
                if (category) showCategoryAnalysis(category);
                return;
            }
            case 'toggle-sort-menu': {
                e.stopPropagation();
                const dropdown = actionEl.closest('.transaction-sort-dropdown');
                toggleTransactionSortMenu(dropdown ? dropdown.querySelector('.transaction-sort-menu') : null);
                return;
            }
            case 'set-transaction-sort': {
                e.stopPropagation();
                if (category) changeTransactionSort(category, actionEl.dataset.sort || 'default');
                return;
            }
            case 'expand-category': {
                if (category) setCategoryViewState(category, 'expanded');
                return;
            }
            case 'collapse-category': {
                if (category) setCategoryViewState(category, 'default');
                return;
            }
        }
    };
    container.addEventListener('click', container._categoryClickHandler);

    // Keyboard activation for the collapsible header
    if (container._categoryKeyHandler) {
        container.removeEventListener('keydown', container._categoryKeyHandler);
    }
    container._categoryKeyHandler = function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target.closest('[data-action="toggle-collapse"]');
        if (!target) return;
        e.preventDefault();
        target.click();
    };
    container.addEventListener('keydown', container._categoryKeyHandler);

    // Initialize drag and drop
    initializeDragDrop();
}

// Set category view state and persist
function setCategoryViewState(category, state) {
    if (!window.categoryViewState) window.categoryViewState = {};
    const prevState = window.categoryViewState[category] || 'default';
    window.categoryViewState[category] = state;
    localStorage.setItem('sahabBudget_categoryViewState', JSON.stringify(window.categoryViewState));

    // Lightweight DOM toggle for collapsed <-> default/expanded (CSS handles hiding)
    const isCollapseToggle = (state === 'collapsed' || prevState === 'collapsed') && state !== 'expanded' && prevState !== 'expanded';
    if (isCollapseToggle) {
        const container = document.getElementById('categoryDetails');
        if (container) {
            const cards = container.querySelectorAll('.category-card');
            for (const card of cards) {
                if (card.dataset.category === category) {
                    const isCollapsed = state === 'collapsed';
                    card.classList.toggle('collapsed', isCollapsed);

                    // Update chevron
                    const chevronBtn = card.querySelector('.collapse-chevron');
                    if (chevronBtn) {
                        chevronBtn.innerHTML = isCollapsed
                            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
                            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                    }

                    const title = card.querySelector('[data-action="toggle-collapse"]');
                    if (title) title.setAttribute('aria-expanded', String(!isCollapsed));

                    return;
                }
            }
        }
    }

    // Full re-render for expanded/default transitions (need to add/remove transaction DOM elements)
    if (currentMonth) switchToMonth(currentMonth);
}

// Legacy compat
function toggleCategoryExpansion(category) {
    const current = (window.categoryViewState || {})[category] || 'default';
    setCategoryViewState(category, current === 'expanded' ? 'default' : 'expanded');
}

// Collapse all categories
function collapseAllCategories() {
    if (!window.categoryViewState) window.categoryViewState = {};
    Object.keys(categoryConfig).forEach(cat => {
        window.categoryViewState[cat] = 'collapsed';
    });
    localStorage.setItem('sahabBudget_categoryViewState', JSON.stringify(window.categoryViewState));
    if (currentMonth) switchToMonth(currentMonth);
}

// Expand all categories
function expandAllCategories() {
    if (!window.categoryViewState) window.categoryViewState = {};
    Object.keys(categoryConfig).forEach(cat => {
        window.categoryViewState[cat] = 'default';
    });
    localStorage.setItem('sahabBudget_categoryViewState', JSON.stringify(window.categoryViewState));
    if (currentMonth) switchToMonth(currentMonth);
}

// Destroy dashboard chart instances (never removes the canvas elements)
function destroyDashboardCharts() {
    if (charts.pie) {
        charts.pie.destroy();
        charts.pie = null;
    }
    if (charts.bar) {
        charts.bar.destroy();
        charts.bar = null;
    }
}

// Resolve a CSS custom property to its concrete value (Chart.js needs real colors)
function resolveCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback || '#94a3b8';
}

// Build an rgba() tint from a #rrggbb hex token
function hexTint(hex, alpha) {
    const m = String(hex).trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) return 'rgba(8, 145, 178, ' + alpha + ')';
    const int = parseInt(m[1], 16);
    return 'rgba(' + ((int >> 16) & 255) + ', ' + ((int >> 8) & 255) + ', ' + (int & 255) + ', ' + alpha + ')';
}

// Toggle a chart wrapper between its canvas and an empty-state overlay.
// The canvas is only hidden, never removed, so charts can always come back.
function setChartEmptyState(canvas, show) {
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    let overlay = wrapper.querySelector('.chart-empty-state');
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'chart-empty-state';
            overlay.innerHTML = `
                <span class="chart-empty-icon">${dashboardIcon('pie', 22)}</span>
                <p>No expense data for this period</p>
            `;
            wrapper.appendChild(overlay);
        }
        overlay.style.display = '';
        canvas.style.display = 'none';
    } else {
        if (overlay) overlay.style.display = 'none';
        canvas.style.display = '';
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
        .filter(([category, value]) => value > 0 && category !== 'Income' && !categoryConfig[category]?._isExcluded)
        .sort((a, b) => b[1] - a[1]);

    // Always tear down previous instances before deciding what to draw
    destroyDashboardCharts();

    // Show empty state if no expense data (e.g. income/refund-only months)
    if (categories.length === 0) {
        setChartEmptyState(pieCanvas, true);
        setChartEmptyState(barCanvas, true);
        return;
    }

    setChartEmptyState(pieCanvas, false);
    setChartEmptyState(barCanvas, false);

    const labels = categories.map(([name]) => name);
    const values = categories.map(([, value]) => value);

    // Colors follow the category color system so charts match the cards
    const colors = labels.map((name) =>
        resolveCssVar('--cat-' + getCategoryColorIndex(name))
    );
    const textMuted = resolveCssVar('--text-muted', '#55617a');
    const textSubtle = resolveCssVar('--text-subtle', '#8a97ad');
    const gridColor = resolveCssVar('--divider', '#eef2f7');
    const surface = resolveCssVar('--surface', '#ffffff');

    const moneyTooltip = {
        callbacks: {
            label: (context) => {
                const v = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                return ' ' + formatDashboardMoney(v);
            },
        },
    };

    // Create pie chart
    const pieCtx = pieCanvas.getContext('2d');
    charts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: colors,
                    borderColor: surface,
                    borderWidth: 2,
                    hoverOffset: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            cutout: '58%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 14,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: textMuted,
                        font: { size: 12, family: "'Inter', sans-serif" },
                    },
                },
                tooltip: moneyTooltip,
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
                    backgroundColor: colors.map((c) => hexTint(c, 0.75)),
                    hoverBackgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 42,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: moneyTooltip,
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        color: textSubtle,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        maxRotation: 45,
                        minRotation: 0,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textSubtle,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        callback: (value) => '$' + Number(value).toLocaleString('en-US'),
                    },
                },
            },
        },
    });
}

// Re-theme charts when the light/dark theme flips (colors are resolved to
// concrete values at draw time, so charts must redraw on theme change)
(function watchThemeForCharts() {
    if (!window.MutationObserver) return;
    const observer = new MutationObserver(() => {
        if (lastDashboardAnalyzer && document.getElementById('pieChart')) {
            updateCharts(lastDashboardAnalyzer);
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

// Shared drag state so document-level listeners can be registered exactly once
const dragDropState = {
    draggedElement: null,
    draggedId: null,
    draggedCategory: null,
    lastValidY: 0,
    isScrolling: false,
    animationFrame: null,
};
let dragDropGlobalBound = false;

function dragDropAutoScroll() {
    const state = dragDropState;
    if (!state.draggedElement || !state.isScrolling) return;

    const scrollZone = 100; // px from edge
    const maxSpeed = 15; // px per frame

    const viewportHeight = window.innerHeight;
    const mouseY = state.lastValidY;

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

    if (state.isScrolling) {
        state.animationFrame = requestAnimationFrame(dragDropAutoScroll);
    }
}

// Initialize drag and drop
function initializeDragDrop() {
    if (window.innerWidth <= 768) {
        enableMobileCategoryChange();
        return;
    }

    const items = document.querySelectorAll('.transaction-item');
    const cards = document.querySelectorAll('.category-card');
    const state = dragDropState;

    // Document-level listener is registered ONCE (re-renders replace the
    // items/cards, so their listeners die with the nodes, but document-level
    // listeners would otherwise stack forever)
    if (!dragDropGlobalBound) {
        document.addEventListener('dragover', (e) => {
            if (state.draggedElement) {
                e.preventDefault();
                // Always update position on dragover as it's more reliable
                state.lastValidY = e.clientY;
            }
        });
        dragDropGlobalBound = true;
    }

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            state.draggedElement = item;
            state.draggedId = item.dataset.transactionId;
            state.draggedCategory = item.dataset.category;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            state.lastValidY = e.clientY;
            state.isScrolling = true;
            state.animationFrame = requestAnimationFrame(dragDropAutoScroll);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            state.draggedElement = null;
            state.draggedId = null;
            state.draggedCategory = null;
            state.isScrolling = false;
            if (state.animationFrame) {
                cancelAnimationFrame(state.animationFrame);
                state.animationFrame = null;
            }
        });

        item.addEventListener('drag', (e) => {
            if (e.clientY > 0) {
                state.lastValidY = e.clientY;
            }
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
            if (state.draggedId && state.draggedCategory && state.draggedCategory !== targetCategory) {
                moveTransaction(state.draggedId, state.draggedCategory, targetCategory);
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

        item.addEventListener('click', (e) => {
            // Let explicit actions (view raw data, delete) win over the move UI
            if (e.target.closest('[data-action]')) return;
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
                <p class="mobile-move-current">
                    Current category: <strong>${escapeHtml(currentCategory)}</strong>
                </p>
                <div class="mobile-move-grid">
                    ${categories
                        .map(
                            (cat, index) => `
                        <button class="btn btn-secondary mobile-move-option" data-cat-index="${index}">
                            ${getCategoryIconChip(cat, { size: 32, icon: 16 })}
                            <span class="mobile-move-name">${escapeHtml(cat)}</span>
                        </button>
                    `
                        )
                        .join('')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Delegated selection: category names never pass through inline handlers
    modal.addEventListener('click', (e) => {
        const option = e.target.closest('[data-cat-index]');
        if (option) {
            const cat = categories[Number(option.dataset.catIndex)];
            modal.remove();
            if (cat) moveTransaction(transactionId, currentCategory, cat);
            return;
        }
        if (e.target === modal) modal.remove();
    });
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
                        <p class="move-description">${escapeHtml(description)}</p>
                        <p class="move-amount">${formatDashboardMoney(amount)}</p>
                    </div>
                    <div class="move-flow">
                        <div class="move-category from">
                            ${getCategoryIconChip(fromCategory, { size: 36, icon: 18 })}
                            <span class="category-name">${escapeHtml(fromCategory)}</span>
                        </div>
                        <div class="move-arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </div>
                        <div class="move-category to">
                            ${getCategoryIconChip(toCategory, { size: 36, icon: 18 })}
                            <span class="category-name">${escapeHtml(toCategory)}</span>
                        </div>
                    </div>
                </div>

                <div class="rule-creation-section">
                    <h4>Create a rule for future transactions?</h4>
                    <p class="rule-hint">A rule will automatically categorize similar transactions.</p>

                    <div class="pattern-input-group">
                        <label for="rulePatternInput">Pattern to match:</label>
                        <input type="text" id="rulePatternInput" value="${escapeHtml(merchantName)}"
                               placeholder="Enter pattern..." class="pattern-input">
                        <span class="pattern-hint">Transactions containing this text will be moved to ${escapeHtml(toCategory)}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer move-modal-footer">
                <button class="btn btn-secondary" onclick="closeMoveConfirmModal()">Cancel</button>
                <button class="btn btn-secondary" id="moveOnlyBtn">
                    Move Only
                </button>
                <button class="btn btn-primary" id="moveWithRuleBtn">
                    Move & Create Rule
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Wire up buttons via addEventListener (avoids apostrophe injection)
    document.getElementById('moveOnlyBtn').addEventListener('click', function() {
        executeMoveOnly(transactionId, toCategory, monthKey);
    });
    document.getElementById('moveWithRuleBtn').addEventListener('click', function() {
        executeMoveWithRule(transactionId, toCategory, monthKey);
    });

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
            existingRule.name = `Auto: "${pattern}" -> ${toCategory}`;
            existingRule.updatedAt = new Date().toISOString();
            ruleAction = 'updated';
        }
        // If rule exists with same action, we still apply it below
        saveRules();
    } else {
        // Create new rule
        const newRule = {
            id: generateRuleId(),
            name: `Auto: "${pattern}" -> ${toCategory}`,
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
        showNotification(`Rule ${ruleAction}: "${pattern}" -> ${toCategory} (applied to ${appliedCount} transactions)`, 'success');
    } else if (appliedCount === 1) {
        showNotification(`Rule ${ruleAction}: "${pattern}" -> ${toCategory}`, 'success');
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
        showNotification(`Rule ${ruleAction}: "${pattern}" -> ${toCategory}`, 'success');
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
    // Clean up any existing delete modal first
    closeDeleteConfirmModal();

    const description = (transaction.Description || transaction.description || '').trim();
    const amount = Math.abs(parseFloat(transaction.Amount) || 0);

    // Extract merchant name for pattern
    const merchantName = description
        .toUpperCase()
        .split(/[\s#\*]/)[0]
        .trim();

    // Count similar transactions
    const similarCount = countSimilarTransactions(merchantName);

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
                        <p class="transaction-desc">${escapeHtml(description)}</p>
                        <div class="transaction-meta">
                            <span><span class="cat-dot" style="--cat:${getCategoryColorVar(category)}"></span> ${escapeHtml(category)}</span>
                            <span>${formatDashboardMoney(amount)}</span>
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
                <button class="btn btn-danger" id="deleteConfirmBtn">
                    Delete
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Wire up delete button via addEventListener (avoids apostrophe injection)
    document.getElementById('deleteConfirmBtn').addEventListener('click', function() {
        executeDelete(category, transactionId, monthKey, merchantName);
    });

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

// Move a transaction to trash
function moveToTrash(transaction, monthKey, category, reason) {
    if (!window.deletedTransactions) {
        window.deletedTransactions = [];
    }
    window.deletedTransactions.push({
        transaction: { ...transaction },
        monthKey: monthKey,
        category: category,
        deletedAt: new Date().toISOString(),
        deleteReason: reason || 'manual',
    });

    // Save fingerprint so the transaction won't come back on re-import
    if (!window.deletedFingerprints) {
        window.deletedFingerprints = [];
    }
    const fp = transactionFingerprint(transaction);
    if (!window.deletedFingerprints.includes(fp)) {
        window.deletedFingerprints.push(fp);
    }
}

// Execute delete (soft delete to trash)
function executeDelete(category, transactionId, monthKey, merchantPattern) {
    const selectedOption = document.querySelector('input[name="deleteOption"]:checked')?.value || 'single';

    // Read pattern from input if rule option selected
    const patternInput = document.getElementById('deletePatternInput');
    const pattern = patternInput?.value?.trim()?.toUpperCase() || merchantPattern;

    // Helper: soft-delete a single transaction by ID from a month
    function softDeleteFromMonth(mk) {
        const md = monthlyData.get(mk);
        if (!md) return null;
        const index = md.transactions.findIndex((t) => t._id === transactionId);
        if (index === -1) return null;
        const removed = md.transactions.splice(index, 1)[0];
        moveToTrash(removed, mk, category, selectedOption === 'rule' ? `rule:${pattern}` : 'manual');
        return removed;
    }

    // Handle "All Data" view
    if (currentMonth === 'ALL_DATA') {
        let deleted = false;
        for (const [key] of monthlyData.entries()) {
            if (softDeleteFromMonth(key)) { deleted = true; break; }
        }
        if (!deleted) {
            showNotification('Transaction not found', 'error');
            closeDeleteConfirmModal();
            return;
        }
    } else {
        if (!softDeleteFromMonth(monthKey)) {
            showNotification('Transaction not found', 'error');
            closeDeleteConfirmModal();
            return;
        }
    }

    // Create deletion rule if requested
    if (selectedOption === 'rule' && pattern) {
        if (typeof loadRules === 'function') {
            loadRules();
        }

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
        }

        // Soft-delete all matching transactions
        let deletedCount = 0;
        monthlyData.forEach((monthData, mk) => {
            monthData.transactions = monthData.transactions.filter((t) => {
                const desc = (t.Description || t.description || '').toUpperCase();
                if (desc.includes(pattern) && t._id !== transactionId) {
                    moveToTrash(t, mk, category, `rule:${pattern}`);
                    deletedCount++;
                    return false;
                }
                return true;
            });
        });

        if (deletedCount > 0) {
            showNotification(`Moved ${deletedCount + 1} transaction(s) to trash (rule ${existingRule ? 'already exists' : 'created'})`, 'success');
        } else {
            showNotification(`Moved to trash${existingRule ? '' : ' and rule created'}`, 'success');
        }
    } else {
        showNotification('Moved to trash', 'success');
    }

    saveData();
    updateTrashBadge();
    closeDeleteConfirmModal();
    switchToMonth(currentMonth);
}

// Show trash modal
function showTrashModal() {
    const trashItems = window.deletedTransactions || [];

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'trashModal';

    let itemsHTML = '';
    if (trashItems.length === 0) {
        itemsHTML = '<div style="padding: 40px; text-align: center; color: var(--gray);"><p>Trash is empty</p></div>';
    } else {
        itemsHTML = `
            <div class="trash-list" style="max-height: 500px; overflow-y: auto;">
                ${trashItems.map((item, index) => {
                    const t = item.transaction;
                    const desc = escapeHtmlDashboard(t.Description || t.description || '');
                    const amount = Math.abs(parseFloat(t.Amount) || 0);
                    const deletedDate = new Date(item.deletedAt).toLocaleDateString();
                    return `
                        <div class="trash-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin: 4px 0; background: var(--gray-50); border-radius: 8px; font-size: 13px;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${desc}</div>
                                <div style="font-size: 12px; color: var(--gray); margin-top: 2px;">${escapeHtmlDashboard(item.category)}, deleted ${deletedDate}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-left: 12px; flex-shrink: 0;">
                                <span style="font-weight: 600;">$${amount.toFixed(2)}</span>
                                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" data-action="restore-trash" data-index="${index}">Restore</button>
                                <button class="btn-icon" style="color: var(--danger);" data-action="permanent-delete" data-index="${index}" title="Permanently delete">&times;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content" style="width: 600px;">
            <div class="modal-header">
                <h2>Trash (${trashItems.length})</h2>
                <button class="close-btn" onclick="closeTrashModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${itemsHTML}
            </div>
            <div class="modal-footer" style="justify-content: space-between;">
                ${trashItems.length > 0 ? '<button class="btn btn-danger" id="emptyTrashBtn" style="font-size: 13px;">Empty Trash</button>' : '<span></span>'}
                <button class="btn btn-secondary" onclick="closeTrashModal()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Wire up event delegation
    modal.addEventListener('click', function(e) {
        const restoreBtn = e.target.closest('[data-action="restore-trash"]');
        if (restoreBtn) {
            restoreTransaction(parseInt(restoreBtn.dataset.index));
            return;
        }
        const permDeleteBtn = e.target.closest('[data-action="permanent-delete"]');
        if (permDeleteBtn) {
            permanentlyDeleteTransaction(parseInt(permDeleteBtn.dataset.index));
            return;
        }
        if (e.target === modal) {
            closeTrashModal();
        }
    });

    const emptyBtn = document.getElementById('emptyTrashBtn');
    if (emptyBtn) {
        emptyBtn.addEventListener('click', emptyTrash);
    }
}

function closeTrashModal() {
    const modal = document.getElementById('trashModal');
    if (modal) modal.remove();
}

function restoreTransaction(index) {
    const trashItems = window.deletedTransactions || [];
    if (index < 0 || index >= trashItems.length) return;

    const item = trashItems.splice(index, 1)[0];
    const monthKey = item.monthKey;

    // Remove fingerprint so it won't be blocked on re-import
    const fp = transactionFingerprint(item.transaction);
    if (window.deletedFingerprints) {
        const fpIdx = window.deletedFingerprints.indexOf(fp);
        if (fpIdx !== -1) window.deletedFingerprints.splice(fpIdx, 1);
    }

    if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
            transactions: [],
            monthName: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        });
    }
    monthlyData.get(monthKey).transactions.push(item.transaction);

    saveData();
    updateTrashBadge();
    showNotification('Transaction restored', 'success');
    closeTrashModal();
    showTrashModal(); // Refresh trash view
    switchToMonth(currentMonth);
}

function permanentlyDeleteTransaction(index) {
    const trashItems = window.deletedTransactions || [];
    if (index < 0 || index >= trashItems.length) return;

    trashItems.splice(index, 1);
    saveData();
    updateTrashBadge();
    closeTrashModal();
    showTrashModal(); // Refresh
}

function emptyTrash() {
    if (!window.deletedTransactions || window.deletedTransactions.length === 0) return;
    if (!confirm(`Permanently delete ${window.deletedTransactions.length} item(s) from trash? This cannot be undone.`)) return;

    window.deletedTransactions = [];
    saveData();
    updateTrashBadge();
    showNotification('Trash emptied', 'success');
    closeTrashModal();
}

function updateTrashBadge() {
    const badge = document.getElementById('trashBadge');
    if (badge) {
        const count = (window.deletedTransactions || []).length;
        badge.textContent = count;
        badge.classList.toggle('visible', count > 0);
    }
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
    let foundMonthKey = currentMonth;

    // Find the transaction and its month key
    if (currentMonth === 'ALL_DATA' || currentMonth === 'CUSTOM_RANGE') {
        for (const [monthKey, monthData] of monthlyData.entries()) {
            const found = monthData.transactions.find((t) => t._id === transactionId);
            if (found) {
                transaction = found;
                foundMonthKey = monthKey;
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

    // Check income override status
    const incomeOverrides = window.transactionIncomeOverrides || {};
    let isIncomeOverridden = false;
    let incomeOverrideValue = null;
    if (incomeOverrides[foundMonthKey] && incomeOverrides[foundMonthKey][transactionId] !== undefined) {
        isIncomeOverridden = true;
        incomeOverrideValue = incomeOverrides[foundMonthKey][transactionId];
    }
    const isIncomeCategory = categoryConfig[category]?._isIncome === true || category === 'Income';
    const effectiveIsIncome = isIncomeOverridden ? incomeOverrideValue : (isIncomeCategory || transaction._isIncome || false);

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
                <code>${escapeHtml(
                    Object.values(rawData)
                        .map((v) => {
                            const val = String(v ?? '');
                            if (val.includes(',') || val.includes('"')) {
                                return '"' + val.replace(/"/g, '""') + '"';
                            }
                            return val;
                        })
                        .join(',')
                )}</code>
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
                    <p><strong>Description:</strong> ${escapeHtml(transaction.Description || '')}</p>
                    <p><strong>Amount:</strong> ${formatDashboardMoney(Math.abs(transaction.Amount || 0))}</p>
                    <p><strong>Date:</strong> ${escapeHtml(transaction['Transaction Date'] || '')}</p>
                    <p><strong>Category:</strong> ${escapeHtml(category)}</p>
                </div>
                <div class="income-toggle-section" style="margin: 16px 0; padding: 12px 16px; background: var(--gray-50); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
                        <input type="checkbox" id="transactionIncomeToggle" ${effectiveIsIncome ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                        Mark as Income
                    </label>
                    <span style="font-size: 12px; color: var(--gray);">
                        ${isIncomeCategory ? '(Category is marked as income)' : effectiveIsIncome ? '(Overridden to income)' : 'Toggle to treat as income'}
                    </span>
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

    // Wire up income toggle
    document.getElementById('transactionIncomeToggle').addEventListener('change', function() {
        toggleTransactionIncome(foundMonthKey, transactionId, this.checked);
        this.closest('.modal').remove();
    });
}

// Toggle per-transaction income override
function toggleTransactionIncome(monthKey, transactionId, isIncome) {
    if (!window.transactionIncomeOverrides) {
        window.transactionIncomeOverrides = {};
    }
    if (!window.transactionIncomeOverrides[monthKey]) {
        window.transactionIncomeOverrides[monthKey] = {};
    }
    window.transactionIncomeOverrides[monthKey][transactionId] = isIncome;
    saveData();
    switchToMonth(currentMonth);
    showNotification(isIncome ? 'Transaction marked as income' : 'Transaction marked as expense', 'success');
}

// Helper kept for backward compatibility; delegates to the canonical escaper
// (utils.js window.escapeHtml) which also encodes quotes for attribute safety.
function escapeHtmlDashboard(text) {
    return window.escapeHtml(text);
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

    document.getElementById('modalTitle').textContent = `${category}: All Transactions`;

    const listHTML = transactions
        .map(
            (t) => `
        <div class="transaction-row">
            <div>${parseLocalDate(t.date).toLocaleDateString()}</div>
            <div class="transaction-row-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
            <div>${formatDashboardMoney(t.amount)}</div>
            <div>
                <button class="btn-icon" data-action="delete-transaction-modal"
                        data-transaction-id="${escapeHtml(t.id || '')}"
                        title="Delete transaction" aria-label="Delete transaction">&times;</button>
            </div>
        </div>
    `
        )
        .join('');

    const list = document.getElementById('transactionsList');
    list.innerHTML = listHTML || '<p>No transactions</p>';
    list.dataset.category = category; // set via DOM API, safe for any characters
    if (!list._deleteHandler) {
        list._deleteHandler = function (e) {
            const btn = e.target.closest('[data-action="delete-transaction-modal"]');
            if (btn) {
                deleteTransactionFromModal(list.dataset.category, btn.dataset.transactionId);
            }
        };
        list.addEventListener('click', list._deleteHandler);
    }
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
                    ${getCategoryIconChip(category, { size: 32, icon: 16 })}
                    <span>${escapeHtml(category)} Trends</span>
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

                <div class="analysis-monthly-breakdown">
                    <h4>Monthly Breakdown</h4>
                    <div class="monthly-breakdown-list">
                        ${monthlyStats.slice().reverse().map((m, index, arr) => {
                            const prevMonth = arr[index + 1];
                            const change = prevMonth ? m.total - prevMonth.total : 0;
                            const changePercent = prevMonth && prevMonth.total > 0 ? ((m.total - prevMonth.total) / prevMonth.total) * 100 : 0;
                            const isUp = change > 0;
                            const isDown = change < 0;
                            const isHighest = m.total === stats.highest && m.total > 0;
                            const isLowest = m.total === stats.lowest && m.total > 0 && nonZeroTotals.length > 1;

                            return `
                                <div class="monthly-breakdown-item ${isHighest ? 'highest' : ''} ${isLowest ? 'lowest' : ''} ${m.total === 0 ? 'zero' : ''}">
                                    <div class="breakdown-month">
                                        <span class="breakdown-month-name">${m.monthName}</span>
                                        <span class="breakdown-count">${m.count} txn${m.count !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="breakdown-values">
                                        ${prevMonth ? `
                                            <span class="breakdown-change ${isUp ? 'up' : ''} ${isDown ? 'down' : ''}">
                                                ${isUp ? dashboardIcon('arrowUpRight', 12) : isDown ? dashboardIcon('arrowDownRight', 12) : ''}
                                                ${change !== 0 ? `$${Math.abs(change).toFixed(0)}` : 'even'}
                                            </span>
                                        ` : '<span class="breakdown-change first"></span>'}
                                        <span class="breakdown-total ${m.total === 0 ? 'zero' : ''}">${formatDashboardMoney(m.total)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
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

    // Create the chart (destroying any previous instance so repeated opens
    // never leak Chart.js objects)
    setTimeout(() => {
        const ctx = document.getElementById('categoryTrendChart');
        if (!ctx) return;

        if (charts.categoryTrend) {
            charts.categoryTrend.destroy();
            charts.categoryTrend = null;
        }

        const lineColor = resolveCssVar('--cat-' + getCategoryColorIndex(category), '#0891b2');
        const textMuted = resolveCssVar('--text-muted', '#55617a');
        const textSubtle = resolveCssVar('--text-subtle', '#8a97ad');
        const gridColor = resolveCssVar('--divider', '#eef2f7');
        const surface = resolveCssVar('--surface', '#ffffff');

        charts.categoryTrend = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthlyStats.map(m => m.monthName.split(' ')[0]), // Just month name
                datasets: [{
                    label: category,
                    data: monthlyStats.map(m => m.total),
                    borderColor: lineColor,
                    backgroundColor: hexTint(lineColor, 0.12),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: surface,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }, {
                    label: 'Average',
                    data: monthlyStats.map(() => stats.average),
                    borderColor: textSubtle,
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
                        position: 'top',
                        labels: {
                            color: textMuted,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            font: { size: 12, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ' ' + formatDashboardMoney(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            color: textSubtle,
                            font: { size: 11, family: "'Inter', sans-serif" }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor, drawBorder: false },
                        ticks: {
                            color: textSubtle,
                            font: { size: 11, family: "'Inter', sans-serif" },
                            callback: function(value) {
                                return '$' + Number(value).toLocaleString('en-US');
                            }
                        }
                    }
                }
            }
        });
    }, 100);
}

// Close category analysis modal
function closeCategoryAnalysisModal() {
    if (charts.categoryTrend) {
        charts.categoryTrend.destroy();
        charts.categoryTrend = null;
    }
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
            'trashModal',
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
                if (modalId === 'trashModal') {
                    closeTrashModal();
                } else if (modalId === 'categoryAnalysisModal') {
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
