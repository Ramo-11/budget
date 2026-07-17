// js/analytics.js - Analytics page: Overview, Cashflow, Trends, Categories, Merchants.
// Accounting semantics mirror core.js analyzeTransactions exactly: refunds subtract
// from spending, categories flagged _isExcluded are omitted everywhere, and any
// category flagged _isIncome (not only the literal "Income" name) counts as income.

const ANALYTICS_VIEWS = ['overview', 'cashflow', 'trends', 'categories', 'merchants'];

const VIEW_CHART_KEYS = {
    overview: [],
    cashflow: ['cashflow'],
    trends: ['trends'],
    categories: ['categories'],
    merchants: ['merchants'],
};

let analyticsData = {
    charts: {},
    currentDateRange: null,
    currentView: 'overview',
    dirty: { overview: true, cashflow: true, trends: true, categories: true, merchants: true },
};

let analyticsRangeCache = { key: null, result: null };

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    bindTabKeyboardNav();
    observeThemeChanges();
    switchView('overview');
});

// Load data through core.js so overrides, income settings, and category config
// stay in sync with the dashboard. sync.js calls this on cross-tab updates.
function loadDataFromStorage() {
    try {
        loadSavedData();
        analyticsData.monthlyData = monthlyData;
        analyticsData.categoryConfig = categoryConfig;
        analyticsData.transactionOverrides = window.transactionOverrides || {};
        analyticsRangeCache = { key: null, result: null };
        invalidateAllViews();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function hasAnalyticsData() {
    return typeof monthlyData !== 'undefined' && monthlyData && monthlyData.size > 0;
}

function isIncomeCategory(category) {
    return category === 'Income' || categoryConfig[category]?._isIncome === true;
}

function isExcludedCategory(category) {
    return categoryConfig[category]?._isExcluded === true;
}

function invalidateAllViews() {
    ANALYTICS_VIEWS.forEach((view) => {
        analyticsData.dirty[view] = true;
    });
}

// Re-render charts with fresh token colors when the theme flips.
function observeThemeChanges() {
    if (!window.MutationObserver) return;
    const observer = new MutationObserver(() => {
        if (!hasAnalyticsData()) return;
        invalidateAllViews();
        renderView(analyticsData.currentView);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// ==========================================
// DATE RANGE
// ==========================================
function initializeDateRangeSelectors() {
    if (!hasAnalyticsData()) return;
    const months = Array.from(monthlyData.keys()).sort();
    const start = document.getElementById('startMonth');
    const end = document.getElementById('endMonth');
    const range = analyticsData.currentDateRange;
    if (start) start.value = range ? range.start : months[0];
    if (end) end.value = range ? range.end : months[months.length - 1];
}

function applyDateRange() {
    const start = document.getElementById('startMonth')?.value;
    const end = document.getElementById('endMonth')?.value;

    if (!start || !end) {
        showNotification('Select both start and end months', 'error');
        return;
    }
    if (start > end) {
        showNotification('Start month must be on or before the end month', 'error');
        return;
    }

    analyticsData.currentDateRange = { start, end };
    invalidateAllViews();
    renderView(analyticsData.currentView);
}

function resetDateRange() {
    analyticsData.currentDateRange = null;
    initializeDateRangeSelectors();
    invalidateAllViews();
    renderView(analyticsData.currentView);
}

function getFilteredMonths() {
    if (!hasAnalyticsData()) return [];
    let months = Array.from(monthlyData.keys()).sort();
    if (analyticsData.currentDateRange) {
        months = months.filter(
            (month) =>
                month >= analyticsData.currentDateRange.start &&
                month <= analyticsData.currentDateRange.end
        );
    }
    return months;
}

// ==========================================
// VIEW SWITCHING (tabs)
// ==========================================
function switchView(viewName) {
    const view = ANALYTICS_VIEWS.includes(viewName) ? viewName : 'overview';
    analyticsData.currentView = view;

    document.querySelectorAll('#analyticsTabs .tab-btn').forEach((btn) => {
        const active = btn.dataset.view === view;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
    });

    renderView(view);
}

function bindTabKeyboardNav() {
    const tablist = document.getElementById('analyticsTabs');
    if (!tablist) return;
    tablist.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const tabs = Array.from(tablist.querySelectorAll('.tab-btn'));
        const current = tabs.findIndex((tab) => tab.classList.contains('active'));
        if (current === -1) return;
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = (current + delta + tabs.length) % tabs.length;
        tabs[next].focus();
        switchView(tabs[next].dataset.view);
    });
}

function setElementHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
}

function applyActiveViewClass() {
    document.querySelectorAll('.analytics-view').forEach((view) => {
        view.classList.toggle('active', view.id === analyticsData.currentView + 'View');
    });
}

// Global empty state: shown without destroying any structural container, so
// recovery (data arriving via sync or another tab) always re-renders cleanly.
function showAnalyticsGlobalEmptyState() {
    setElementHidden('analyticsControls', true);
    setElementHidden('analyticsTabs', true);
    setElementHidden('rangeEmpty', true);
    document.querySelectorAll('.analytics-view').forEach((view) => view.classList.remove('active'));
    setElementHidden('analyticsEmpty', false);
}

// Range empty state: tabs and controls stay usable so the user can recover.
function showRangeEmptyState() {
    document.querySelectorAll('.analytics-view').forEach((view) => view.classList.remove('active'));
    setElementHidden('rangeEmpty', false);
}

function hideRangeEmptyState() {
    setElementHidden('rangeEmpty', true);
}

// Returns false (and shows the global empty state) when there is no data.
function ensurePageChrome() {
    if (!hasAnalyticsData()) {
        showAnalyticsGlobalEmptyState();
        return false;
    }
    setElementHidden('analyticsEmpty', true);
    setElementHidden('analyticsControls', false);
    setElementHidden('analyticsTabs', false);
    const start = document.getElementById('startMonth');
    if (start && !start.value) initializeDateRangeSelectors();
    return true;
}

function renderView(viewName) {
    if (!ensurePageChrome()) return;

    const months = getFilteredMonths();
    if (months.length === 0) {
        showRangeEmptyState();
        return;
    }
    hideRangeEmptyState();
    applyActiveViewClass();

    if (!analyticsData.dirty[viewName]) {
        resizeChartsForView(viewName);
        return;
    }

    const data = computeRangeAnalytics(months);
    switch (viewName) {
        case 'overview':
            loadOverviewView(data);
            break;
        case 'cashflow':
            loadCashflowView(data);
            break;
        case 'trends':
            loadTrendsView(data);
            break;
        case 'categories':
            loadCategoriesView(data);
            break;
        case 'merchants':
            loadMerchantsView(data);
            break;
    }
    analyticsData.dirty[viewName] = false;
}

function resizeChartsForView(viewName) {
    (VIEW_CHART_KEYS[viewName] || []).forEach((key) => {
        const chart = analyticsData.charts[key];
        if (chart) chart.resize();
    });
}

// ==========================================
// RANGE ANALYTICS (single source of truth)
// ==========================================
function computeRangeAnalytics(months) {
    const cacheKey = months.join('|');
    if (analyticsRangeCache.key === cacheKey && analyticsRangeCache.result) {
        return analyticsRangeCache.result;
    }

    const result = {
        monthCount: months.length,
        monthly: [],
        expenseByCategory: {},
        categoryCounts: {},
        merchants: {},
        transactions: [],
        totalExpenses: 0,
        totalIncome: 0,
        expenseCount: 0,
        transactionCount: 0,
    };

    months.forEach((monthKey) => {
        const monthData = monthlyData.get(monthKey);
        if (!monthData) return;

        const analyzer = analyzeTransactions(monthData.transactions);
        const byCategory = {};
        let monthExpenses = 0;
        let monthIncome = 0;

        Object.entries(analyzer.categoryTotals).forEach(([category, total]) => {
            if (isExcludedCategory(category)) return;
            if (isIncomeCategory(category)) {
                monthIncome += total;
                return;
            }
            if (total > 0) {
                byCategory[category] = total;
                result.expenseByCategory[category] =
                    (result.expenseByCategory[category] || 0) + total;
                monthExpenses += total;
            }
        });

        Object.entries(analyzer.categoryDetails).forEach(([category, details]) => {
            if (isExcludedCategory(category)) return;
            const categoryIsIncome = isIncomeCategory(category);

            details.forEach((detail) => {
                result.transactionCount += 1;
                const isIncomeTx = categoryIsIncome || detail.isIncome === true;
                result.transactions.push({
                    description: detail.name || 'Unknown',
                    category,
                    amount: detail.amount,
                    isIncome: isIncomeTx,
                    isRefund: detail.isRefund === true,
                    date: parseLocalDate(detail.date),
                    monthName: monthData.monthName,
                });
                if (isIncomeTx) return;

                result.expenseCount += 1;
                result.categoryCounts[category] = (result.categoryCounts[category] || 0) + 1;
                const merchantName = detail.name || 'Unknown';
                if (!result.merchants[merchantName]) {
                    result.merchants[merchantName] = { total: 0, count: 0 };
                }
                result.merchants[merchantName].total += detail.isRefund
                    ? -detail.amount
                    : detail.amount;
                result.merchants[merchantName].count += 1;
            });
        });

        result.monthly.push({
            key: monthKey,
            name: monthData.monthName,
            byCategory,
            expenses: monthExpenses,
            income: monthIncome,
            net: monthIncome - monthExpenses,
        });
        result.totalExpenses += monthExpenses;
        result.totalIncome += monthIncome;
    });

    result.transactions.sort((a, b) => {
        const timeA = a.date instanceof Date && !isNaN(a.date.getTime()) ? a.date.getTime() : 0;
        const timeB = b.date instanceof Date && !isNaN(b.date.getTime()) ? b.date.getTime() : 0;
        return timeB - timeA;
    });
    result.sortedCategories = Object.entries(result.expenseByCategory).sort((a, b) => b[1] - a[1]);
    result.sortedMerchants = Object.entries(result.merchants).sort(
        (a, b) => b[1].total - a[1].total
    );

    analyticsRangeCache = { key: cacheKey, result };
    return result;
}

// ==========================================
// FORMATTING + CHART THEME HELPERS
// ==========================================
function fmtMoney(value) {
    const sign = value < 0 ? '-' : '';
    return (
        sign +
        '$' +
        Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

function fmtMoneySigned(value) {
    return (value < 0 ? '-' : '+') + fmtMoney(Math.abs(value));
}

function fmtMoneyShort(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return sign + '$' + Math.round(abs);
}

function shortMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
    });
}

function cssToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(color, alpha) {
    if (color && color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
}

function resolvedCategoryColor(name) {
    return cssToken('--cat-' + window.getCategoryColorIndex(name));
}

function applyChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family =
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = cssToken('--text-muted');
}

function chartGridColor() {
    return withAlpha(cssToken('--border-strong') || '#d3dbe6', 0.35);
}

function themedTooltip() {
    return {
        backgroundColor: cssToken('--surface-3'),
        titleColor: cssToken('--text'),
        bodyColor: cssToken('--text-muted'),
        borderColor: cssToken('--border-color'),
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
    };
}

function destroyChart(key) {
    if (analyticsData.charts[key]) {
        analyticsData.charts[key].destroy();
        delete analyticsData.charts[key];
    }
}

// Toggles the one-line "no data" note inside a chart card.
function setChartCardEmpty(canvasId, isEmpty) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrap = canvas.closest('.chart-canvas');
    const card = canvas.closest('.chart-card');
    const note = card ? card.querySelector('.chart-empty') : null;
    if (wrap) wrap.hidden = isEmpty;
    if (note) note.hidden = !isEmpty;
}

// Draws the range total in the middle of the category doughnut.
const doughnutCenterPlugin = {
    id: 'doughnutCenter',
    afterDraw(chart) {
        const opts = chart.options.plugins && chart.options.plugins.doughnutCenter;
        if (!opts || !opts.display) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        const { x, y } = meta.data[0];
        const ctx = chart.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "700 20px 'Inter', sans-serif";
        ctx.fillStyle = cssToken('--text');
        ctx.fillText(opts.value, x, y - 9);
        ctx.font = "500 11px 'Inter', sans-serif";
        ctx.fillStyle = cssToken('--text-subtle');
        ctx.fillText(opts.label, x, y + 12);
        ctx.restore();
    },
};

// ==========================================
// OVERVIEW VIEW
// ==========================================
function loadOverviewView(data) {
    if (!data) {
        // Called without data by sync.js: route through the guarded renderer.
        analyticsData.dirty.overview = true;
        renderView('overview');
        return;
    }
    renderQuickStats(data);
    renderSpendingSummary(data);
    renderRecentActivity(data);
}

function renderQuickStats(data) {
    const container = document.getElementById('quickStats');
    if (!container) return;

    const avgMonthly = data.monthCount > 0 ? data.totalExpenses / data.monthCount : 0;
    const avgExpense = data.expenseCount > 0 ? data.totalExpenses / data.expenseCount : 0;
    const monthsLabel = data.monthCount === 1 ? '1 month' : `${data.monthCount} months`;
    const expensesLabel =
        data.expenseCount === 1 ? '1 expense' : `${data.expenseCount.toLocaleString()} expenses`;

    container.innerHTML = `
        <div class="quick-stat">
            <div class="quick-stat-head">
                <span class="quick-stat-icon brand">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                </span>
                <h4>Total Spending</h4>
            </div>
            <div class="value">${fmtMoney(data.totalExpenses)}</div>
            <div class="subtext">${monthsLabel}</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-head">
                <span class="quick-stat-icon success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </span>
                <h4>Monthly Average</h4>
            </div>
            <div class="value">${fmtMoney(avgMonthly)}</div>
            <div class="subtext">per month</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-head">
                <span class="quick-stat-icon info">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </span>
                <h4>Transactions</h4>
            </div>
            <div class="value">${data.transactionCount.toLocaleString()}</div>
            <div class="subtext">${expensesLabel}</div>
        </div>
        <div class="quick-stat">
            <div class="quick-stat-head">
                <span class="quick-stat-icon warning">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </span>
                <h4>Avg Expense</h4>
            </div>
            <div class="value">${fmtMoney(avgExpense)}</div>
            <div class="subtext">per transaction</div>
        </div>
    `;
}

function renderSpendingSummary(data) {
    const container = document.getElementById('spendingSummary');
    if (!container) return;

    const avgMonthly = data.monthCount > 0 ? data.totalExpenses / data.monthCount : 0;
    const monthsLabel = data.monthCount === 1 ? '1 month' : `${data.monthCount} months`;
    const top = data.sortedCategories.slice(0, 5);
    const maxAmount = top.length > 0 ? top[0][1] : 1;

    const categoryRows = top
        .map(([name, amount]) => {
            const color = window.getCategoryColorVar(name);
            const width = Math.max(4, Math.round((amount / maxAmount) * 100));
            return `
                <div class="summary-cat-row">
                    <span class="cat-dot" style="--cat:${color}"></span>
                    <span class="summary-cat-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                    <span class="summary-cat-bar"><span class="summary-cat-fill" style="width:${width}%;background:${color}"></span></span>
                    <span class="summary-cat-amount">${fmtMoney(amount)}</span>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="spending-summary-grid">
            <div class="summary-item">
                <h5>Total Spent</h5>
                <div class="amount">${fmtMoney(data.totalExpenses)}</div>
                <div class="period">${monthsLabel}</div>
            </div>
            <div class="summary-item">
                <h5>Monthly Average</h5>
                <div class="amount">${fmtMoney(avgMonthly)}</div>
                <div class="period">per month</div>
            </div>
        </div>
        ${
            top.length > 0
                ? `<div class="summary-cats"><h5 class="summary-cats-title">Top Categories</h5>${categoryRows}</div>`
                : '<p class="empty-line">No expenses in this range</p>'
        }
    `;
}

function renderRecentActivity(data) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const recent = data.transactions.slice(0, 8);
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-line">Nothing to show</p>';
        return;
    }

    const rows = recent
        .map((tx) => {
            const validDate = tx.date instanceof Date && !isNaN(tx.date.getTime());
            const dateStr = validDate
                ? tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : tx.monthName;
            const catColor = window.getCategoryColorVar(tx.category);

            let amountClass = '';
            let amountText = fmtMoney(tx.amount);
            let flag = '';
            if (tx.isIncome) {
                amountClass = ' income';
                amountText = '+' + fmtMoney(tx.amount);
                // Flag only adds information when the category itself is not an income category
                if (!isIncomeCategory(tx.category)) {
                    flag = '<span class="activity-flag income">Income</span>';
                }
            } else if (tx.isRefund) {
                amountClass = ' refund';
                amountText = '-' + fmtMoney(tx.amount);
                flag = '<span class="activity-flag refund">Refund</span>';
            }

            return `
                <div class="activity-item">
                    ${window.getCategoryIconChip(tx.category, { size: 40, icon: 20 })}
                    <div class="activity-details">
                        <h5 title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</h5>
                        <div class="activity-meta">
                            <span class="activity-date">${escapeHtml(dateStr)}</span>
                            <span class="activity-cat" style="color:${catColor}">${escapeHtml(tx.category)}</span>
                            ${flag}
                        </div>
                    </div>
                    <div class="activity-amount${amountClass}">${amountText}</div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `<div class="activity-list">${rows}</div>`;
}

// ==========================================
// CASHFLOW VIEW (net cashflow + savings rate)
// ==========================================
function loadCashflowView(data) {
    if (!data) {
        analyticsData.dirty.cashflow = true;
        renderView('cashflow');
        return;
    }
    renderCashflowHero(data);
    renderCashflowChart(data);
}

function renderCashflowHero(data) {
    const container = document.getElementById('cashflowHero');
    if (!container) return;

    const net = data.totalIncome - data.totalExpenses;
    const hasIncome = data.totalIncome > 0;
    const savingsRate = hasIncome ? Math.round((net / data.totalIncome) * 100) : null;

    const first = data.monthly[0];
    const last = data.monthly[data.monthly.length - 1];
    const rangeLabel =
        first && last && first.key !== last.key ? `${first.name} to ${last.name}` : first ? first.name : '';

    let rateClass = '';
    let rateText = 'n/a';
    if (savingsRate !== null) {
        rateClass = savingsRate >= 0 ? ' income' : ' negative';
        rateText = savingsRate + '%';
    }

    container.innerHTML = `
        <div class="cashflow-net">
            <span class="cashflow-label">Net Cashflow</span>
            <div class="cashflow-value ${net >= 0 ? 'positive' : 'negative'}">${fmtMoneySigned(net)}</div>
            <span class="cashflow-range">${escapeHtml(rangeLabel)}</span>
            ${hasIncome ? '' : '<span class="cashflow-note">No income recorded in this range</span>'}
        </div>
        <div class="cashflow-tiles">
            <div class="cashflow-tile">
                <h5>Income</h5>
                <div class="cashflow-tile-value income">${fmtMoney(data.totalIncome)}</div>
            </div>
            <div class="cashflow-tile">
                <h5>Spending</h5>
                <div class="cashflow-tile-value">${fmtMoney(data.totalExpenses)}</div>
            </div>
            <div class="cashflow-tile">
                <h5>Savings Rate</h5>
                <div class="cashflow-tile-value${rateClass}">${rateText}</div>
            </div>
        </div>
    `;
}

function renderCashflowChart(data) {
    const canvas = document.getElementById('cashflowChart');
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart('cashflow');
    applyChartDefaults();

    const labels = data.monthly.map((m) => shortMonthLabel(m.key));
    const success = cssToken('--success');
    const danger = cssToken('--danger');
    const brand = cssToken('--brand');

    analyticsData.charts.cashflow = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Net',
                    data: data.monthly.map((m) => m.net),
                    borderColor: brand,
                    backgroundColor: brand,
                    pointBackgroundColor: brand,
                    pointBorderColor: cssToken('--surface'),
                    pointBorderWidth: 1.5,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: data.monthly.length === 1 ? 5 : 3.5,
                    order: 0,
                },
                {
                    label: 'Income',
                    data: data.monthly.map((m) => m.income),
                    backgroundColor: withAlpha(success, 0.75),
                    hoverBackgroundColor: success,
                    borderRadius: 6,
                    maxBarThickness: 28,
                    order: 1,
                },
                {
                    label: 'Spending',
                    data: data.monthly.map((m) => m.expenses),
                    backgroundColor: withAlpha(danger, 0.65),
                    hoverBackgroundColor: danger,
                    borderRadius: 6,
                    maxBarThickness: 28,
                    order: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16 },
                },
                tooltip: {
                    ...themedTooltip(),
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => fmtMoneyShort(value) },
                    grid: { color: chartGridColor(), drawBorder: false },
                },
                x: {
                    grid: { display: false, drawBorder: false },
                },
            },
        },
    });
}

// ==========================================
// TRENDS VIEW
// ==========================================
function loadTrendsView(data) {
    if (!data) {
        analyticsData.dirty.trends = true;
        renderView('trends');
        return;
    }
    updateTrendsStats(data);
    renderTrendsChart(data);
}

function updateTrendsStats(data) {
    const container = document.getElementById('trendsStats');
    if (!container) return;

    const totals = data.monthly.map((m) => m.expenses);
    const average = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const max = totals.length > 0 ? Math.max(...totals) : 0;
    const min = totals.length > 0 ? Math.min(...totals) : 0;
    const maxName = totals.length > 0 ? data.monthly[totals.indexOf(max)].name : '';
    const minName = totals.length > 0 ? data.monthly[totals.indexOf(min)].name : '';

    container.innerHTML = `
        <div class="stat-card">
            <h4>Monthly Average</h4>
            <div class="value">${fmtMoney(average)}</div>
        </div>
        <div class="stat-card">
            <h4>Highest Month</h4>
            <div class="value">${fmtMoney(max)}</div>
            <div class="change">${escapeHtml(maxName)}</div>
        </div>
        <div class="stat-card">
            <h4>Lowest Month</h4>
            <div class="value">${fmtMoney(min)}</div>
            <div class="change">${escapeHtml(minName)}</div>
        </div>
        <div class="stat-card">
            <h4>Total Spending</h4>
            <div class="value">${fmtMoney(data.totalExpenses)}</div>
        </div>
    `;
}

function renderTrendsChart(data) {
    const canvas = document.getElementById('trendsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart('trends');

    const categories = data.sortedCategories.map(([name]) => name);
    if (categories.length === 0) {
        setChartCardEmpty('trendsChart', true);
        return;
    }
    setChartCardEmpty('trendsChart', false);
    applyChartDefaults();

    const labels = data.monthly.map((m) => shortMonthLabel(m.key));
    const topCategories = categories.slice(0, 6);
    const restCategories = categories.slice(6);
    const pointRadius = data.monthly.length === 1 ? 4 : 2.5;

    const datasets = topCategories.map((category) => {
        const color = resolvedCategoryColor(category);
        return {
            label: category,
            data: data.monthly.map((m) => m.byCategory[category] || 0),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            tension: 0.35,
            pointRadius,
            pointHoverRadius: 5,
            fill: false,
        };
    });

    if (restCategories.length > 0) {
        const neutral = cssToken('--cat-16');
        datasets.push({
            label: 'Other categories',
            data: data.monthly.map((m) =>
                restCategories.reduce((sum, category) => sum + (m.byCategory[category] || 0), 0)
            ),
            borderColor: neutral,
            backgroundColor: neutral,
            borderDash: [5, 4],
            borderWidth: 2,
            tension: 0.35,
            pointRadius,
            pointHoverRadius: 5,
            fill: false,
        });
    }

    analyticsData.charts.trends = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16 },
                },
                tooltip: {
                    ...themedTooltip(),
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => fmtMoneyShort(value) },
                    grid: { color: chartGridColor(), drawBorder: false },
                },
                x: {
                    grid: { display: false, drawBorder: false },
                },
            },
        },
    });
}

// ==========================================
// CATEGORIES VIEW
// ==========================================
function loadCategoriesView(data) {
    if (!data) {
        analyticsData.dirty.categories = true;
        renderView('categories');
        return;
    }
    renderCategoryChart(data);
    updateCategoryBreakdown(data);
}

function renderCategoryChart(data) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart('categories');

    if (data.sortedCategories.length === 0) {
        setChartCardEmpty('categoryChart', true);
        return;
    }
    setChartCardEmpty('categoryChart', false);
    applyChartDefaults();

    const labels = data.sortedCategories.map(([name]) => name);
    const values = data.sortedCategories.map(([, total]) => total);
    const colors = data.sortedCategories.map(([name]) => resolvedCategoryColor(name));

    analyticsData.charts.categories = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: colors,
                    borderColor: cssToken('--surface'),
                    borderWidth: 2,
                    hoverOffset: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...themedTooltip(),
                    callbacks: {
                        label: (ctx) => {
                            const percent =
                                data.totalExpenses > 0
                                    ? ((ctx.parsed / data.totalExpenses) * 100).toFixed(1)
                                    : '0.0';
                            return ` ${fmtMoney(ctx.parsed)} (${percent}%)`;
                        },
                    },
                },
                doughnutCenter: {
                    display: true,
                    value: '$' + Math.round(data.totalExpenses).toLocaleString('en-US'),
                    label: 'total spent',
                },
            },
        },
        plugins: [doughnutCenterPlugin],
    });
}

function updateCategoryBreakdown(data) {
    const container = document.getElementById('categoryBreakdown');
    if (!container) return;

    if (data.sortedCategories.length === 0) {
        container.innerHTML =
            '<h3>Category Breakdown</h3><p class="empty-line">No expenses in this range</p>';
        return;
    }

    const maxAmount = data.sortedCategories[0][1];
    const rows = data.sortedCategories
        .map(([name, total]) => {
            const count = data.categoryCounts[name] || 0;
            const percent =
                data.totalExpenses > 0 ? ((total / data.totalExpenses) * 100).toFixed(1) : '0.0';
            const width = Math.max(3, Math.round((total / maxAmount) * 100));
            const color = window.getCategoryColorVar(name);
            return `
                <div class="breakdown-item">
                    ${window.getCategoryIconChip(name, { size: 36, icon: 18 })}
                    <div class="breakdown-info">
                        <div class="breakdown-top">
                            <h4 title="${escapeHtml(name)}">${escapeHtml(name)}</h4>
                            <div class="breakdown-amount">${fmtMoney(total)}</div>
                        </div>
                        <div class="breakdown-bar"><span style="width:${width}%;background:${color}"></span></div>
                        <div class="breakdown-meta">
                            <span>${count === 1 ? '1 transaction' : count.toLocaleString() + ' transactions'}</span>
                            <span>${percent}%</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `<h3>Category Breakdown</h3><div class="breakdown-list">${rows}</div>`;
}

// ==========================================
// MERCHANTS VIEW
// ==========================================
function loadMerchantsView(data) {
    if (!data) {
        analyticsData.dirty.merchants = true;
        renderView('merchants');
        return;
    }
    renderMerchantChart(data);
    updateMerchantList(data);
}

function renderMerchantChart(data) {
    const canvas = document.getElementById('merchantChart');
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart('merchants');

    const top = data.sortedMerchants.filter(([, m]) => m.total > 0).slice(0, 10);
    if (top.length === 0) {
        setChartCardEmpty('merchantChart', true);
        return;
    }
    setChartCardEmpty('merchantChart', false);
    applyChartDefaults();

    const wrap = document.getElementById('merchantCanvasWrap');
    if (wrap) wrap.style.height = Math.max(240, top.length * 36 + 48) + 'px';

    const fullNames = top.map(([name]) => name);
    const labels = fullNames.map((name) =>
        name.length > 24 ? name.substring(0, 24) + '...' : name
    );
    const brand = cssToken('--brand');

    analyticsData.charts.merchants = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    data: top.map(([, m]) => m.total),
                    backgroundColor: withAlpha(brand, 0.8),
                    hoverBackgroundColor: brand,
                    borderRadius: 6,
                    maxBarThickness: 22,
                },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...themedTooltip(),
                    callbacks: {
                        title: (items) => fullNames[items[0].dataIndex],
                        label: (ctx) => {
                            const merchant = top[ctx.dataIndex][1];
                            const countLabel =
                                merchant.count === 1
                                    ? '1 transaction'
                                    : merchant.count + ' transactions';
                            return ` ${fmtMoney(ctx.parsed.x)} (${countLabel})`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: (value) => fmtMoneyShort(value) },
                    grid: { color: chartGridColor(), drawBorder: false },
                },
                y: {
                    ticks: { color: cssToken('--text'), autoSkip: false },
                    grid: { display: false, drawBorder: false },
                },
            },
        },
    });
}

function updateMerchantList(data) {
    const container = document.getElementById('merchantList');
    if (!container) return;

    const merchants = data.sortedMerchants;
    if (merchants.length === 0) {
        container.innerHTML = `
            <div class="merchant-list-head"><h3>All Merchants</h3></div>
            <p class="empty-line">No expenses in this range</p>
        `;
        return;
    }

    const rows = merchants
        .map(([name, m], index) => {
            const countLabel =
                m.count === 1 ? '1 transaction' : m.count.toLocaleString() + ' transactions';
            return `
                <div class="merchant-item">
                    <span class="merchant-rank${index === 0 ? ' top' : ''}">${index + 1}</span>
                    <div class="merchant-info">
                        <h4 title="${escapeHtml(name)}">${escapeHtml(name)}</h4>
                        <span>${countLabel}</span>
                    </div>
                    <div class="merchant-amount">
                        <div class="total${m.total < 0 ? ' refund' : ''}">${fmtMoney(m.total)}</div>
                        <div class="count">avg ${fmtMoney(m.total / m.count)}</div>
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="merchant-list-head">
            <h3>All Merchants</h3>
            <span class="merchant-count">${merchants.length.toLocaleString()}</span>
        </div>
        <div class="merchant-rows">${rows}</div>
    `;
}
