// js/comparison.js - Month over month comparison modal

let comparisonCharts = {};

// ---------------------------------------------------------------------------
// Shared spending helpers (used by the comparison, budget goals, and date
// range modals, which all load together on the dashboard page).
// ---------------------------------------------------------------------------

// A category counts as spending unless it is excluded from totals or marked
// as income (by flag or by the reserved "Income" name).
window.isSpendingCategory = function (category) {
    const config = categoryConfig[category] || {};
    return config._isExcluded !== true && config._isIncome !== true && category !== 'Income';
};

// Spending-only totals: income categories, income-flagged transactions, and
// excluded categories are left out. Refunds reduce their category total.
// Returns { analyzer, byCategory, total, count }.
window.computeSpendingSummary = function (transactions) {
    const analyzer = analyzeTransactions(transactions);
    const byCategory = {};
    let total = 0;
    let count = 0;

    Object.entries(analyzer.categoryDetails).forEach(([category, items]) => {
        if (!window.isSpendingCategory(category)) return;
        let categoryTotal = 0;
        items.forEach((item) => {
            if (item.isIncome) return;
            categoryTotal += item.isRefund ? -item.amount : item.amount;
            count += 1;
        });
        if (categoryTotal < 0) categoryTotal = 0;
        byCategory[category] = categoryTotal;
        total += categoryTotal;
    });

    return { analyzer, byCategory, total, count };
};

// Format a dollar amount (absolute value, thousands separators, 2 decimals).
window.formatMoney = function (value) {
    return (
        '$' +
        Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
};

// Resolve a CSS custom property to its current computed value (theme-aware).
function comparisonToken(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

// Hex color -> rgba string with the given alpha (for Chart.js fills).
function comparisonTokenAlpha(name, alpha, fallback) {
    const hex = comparisonToken(name, fallback);
    const match = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(match)) return hex;
    const r = parseInt(match.slice(0, 2), 16);
    const g = parseInt(match.slice(2, 4), 16);
    const b = parseInt(match.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

const COMPARISON_ARROW_UP =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
const COMPARISON_ARROW_DOWN =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>';
const COMPARISON_ARROW_FLAT =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

// Open comparison view
function openComparison() {
    const modal = document.getElementById('comparisonModal');
    const months = Array.from(monthlyData.keys()).sort().reverse();

    if (months.length < 2) {
        showNotification('Need at least 2 months of data for comparison', 'error');
        return;
    }

    const monthOptions = months
        .map((monthKey) => {
            const data = monthlyData.get(monthKey);
            return (
                '<option value="' +
                escapeHtml(monthKey) +
                '">' +
                escapeHtml(data.monthName) +
                '</option>'
            );
        })
        .join('');

    modal.innerHTML = `
        <div class="modal-content" style="width: 92%; max-width: 1100px;">
            <div class="modal-header">
                <h2>Compare Months</h2>
                <button class="close-btn" onclick="closeComparisonModal()" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="comparison-controls">
                    <div class="month-selectors">
                        <div class="month-selector-group">
                            <label for="compareMonth1">From</label>
                            <select id="compareMonth1" onchange="updateComparison()">
                                ${monthOptions}
                            </select>
                        </div>
                        <div class="vs-divider">vs</div>
                        <div class="month-selector-group">
                            <label for="compareMonth2">To</label>
                            <select id="compareMonth2" onchange="updateComparison()">
                                ${monthOptions}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="comparison-overview" id="comparisonOverview"></div>
                <div class="comparison-charts">
                    <div class="comparison-chart-container">
                        <canvas id="comparisonBarChart"></canvas>
                    </div>
                    <div class="comparison-chart-container" id="comparisonRadarWrap">
                        <canvas id="comparisonRadarChart"></canvas>
                    </div>
                </div>
                <div class="comparison-details" id="comparisonDetails"></div>
            </div>
        </div>
    `;

    modal.classList.add('show');
    modal.onclick = (event) => {
        if (event.target === modal) closeComparisonModal();
    };

    // Default to the two most recent months, read chronologically:
    // From = the older of the two, To = the newest.
    document.getElementById('compareMonth1').value = months[1];
    document.getElementById('compareMonth2').value = months[0];

    setTimeout(() => updateComparison(), 50);
}

// Update comparison. Whatever the user picks, the older month is always the
// baseline so an increase in spending always reads as an increase.
function updateComparison() {
    const selectedA = document.getElementById('compareMonth1').value;
    const selectedB = document.getElementById('compareMonth2').value;

    if (selectedA === selectedB) {
        showNotification('Please select two different months', 'error');
        return;
    }

    // Month keys are YYYY-MM, so string order is chronological order.
    const earlierKey = selectedA < selectedB ? selectedA : selectedB;
    const laterKey = selectedA < selectedB ? selectedB : selectedA;

    const earlierData = monthlyData.get(earlierKey);
    const laterData = monthlyData.get(laterKey);
    if (!earlierData || !laterData) return;

    const earlier = window.computeSpendingSummary(earlierData.transactions);
    const later = window.computeSpendingSummary(laterData.transactions);

    updateComparisonOverview(earlier, later, earlierData.monthName, laterData.monthName);
    updateComparisonCharts(earlier, later, earlierData.monthName, laterData.monthName);
    updateComparisonDetails(earlier, later, earlierData.monthName, laterData.monthName);
}

// Overview: older month, change indicator, newer month (chronological order).
function updateComparisonOverview(earlier, later, earlierName, laterName) {
    const diff = later.total - earlier.total;
    const percentChange = earlier.total > 0 ? (diff / earlier.total) * 100 : 0;

    let changeClass = '';
    let arrow = COMPARISON_ARROW_FLAT;
    if (diff > 0.005) {
        changeClass = 'increase';
        arrow = COMPARISON_ARROW_UP;
    } else if (diff < -0.005) {
        changeClass = 'decrease';
        arrow = COMPARISON_ARROW_DOWN;
    }

    const html = `
        <div class="overview-card">
            <div class="overview-month">
                <h4>${escapeHtml(earlierName)}</h4>
                <div class="overview-amount">${formatMoney(earlier.total)}</div>
                <div class="overview-transactions">${earlier.count} transactions</div>
            </div>
        </div>

        <div class="overview-change ${changeClass}">
            <div class="change-arrow">${arrow}</div>
            <div class="change-amount">${diff > 0.005 ? '+' : diff < -0.005 ? '-' : ''}${formatMoney(diff)}</div>
            <div class="change-percent">${Math.abs(percentChange).toFixed(1)}%</div>
        </div>

        <div class="overview-card">
            <div class="overview-month">
                <h4>${escapeHtml(laterName)}</h4>
                <div class="overview-amount">${formatMoney(later.total)}</div>
                <div class="overview-transactions">${later.count} transactions</div>
            </div>
        </div>
    `;

    document.getElementById('comparisonOverview').innerHTML = html;
}

// Categories present in either month, ordered by combined spend.
function comparisonCategories(earlier, later) {
    return [...new Set([...Object.keys(earlier.byCategory), ...Object.keys(later.byCategory)])]
        .filter((cat) => (earlier.byCategory[cat] || 0) > 0 || (later.byCategory[cat] || 0) > 0)
        .sort(
            (a, b) =>
                (later.byCategory[b] || 0) +
                (earlier.byCategory[b] || 0) -
                ((later.byCategory[a] || 0) + (earlier.byCategory[a] || 0))
        );
}

// Update comparison charts (theme-aware colors resolved at render time)
function updateComparisonCharts(earlier, later, earlierName, laterName) {
    if (comparisonCharts.bar) comparisonCharts.bar.destroy();
    if (comparisonCharts.radar) comparisonCharts.radar.destroy();

    const categories = comparisonCategories(earlier, later);
    const barCategories = categories.slice(0, 10);

    const earlierColor = comparisonToken('--cat-2', '#8b5cf6');
    const laterColor = comparisonToken('--brand', '#0891b2');
    const textMuted = comparisonToken('--text-muted', '#55617a');
    const gridColor = comparisonTokenAlpha('--border-strong', 0.45, '#d3dbe6');

    const barCtx = document.getElementById('comparisonBarChart').getContext('2d');
    comparisonCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: barCategories,
            datasets: [
                {
                    label: earlierName,
                    data: barCategories.map((cat) => earlier.byCategory[cat] || 0),
                    backgroundColor: comparisonTokenAlpha('--cat-2', 0.75, '#8b5cf6'),
                    borderRadius: 5,
                    maxBarThickness: 22,
                },
                {
                    label: laterName,
                    data: barCategories.map((cat) => later.byCategory[cat] || 0),
                    backgroundColor: comparisonTokenAlpha('--brand', 0.8, '#0891b2'),
                    borderRadius: 5,
                    maxBarThickness: 22,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textMuted, boxWidth: 12, boxHeight: 12, usePointStyle: true },
                },
            },
            scales: {
                x: {
                    ticks: { color: textMuted, font: { size: 11 } },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textMuted,
                        font: { size: 11 },
                        callback: (value) => '$' + Number(value).toFixed(0),
                    },
                    grid: { color: gridColor },
                },
            },
        },
    });

    // Radar needs at least 3 axes to be readable
    const radarWrap = document.getElementById('comparisonRadarWrap');
    if (categories.length < 3) {
        radarWrap.style.display = 'none';
        return;
    }
    radarWrap.style.display = '';

    const radarCategories = categories.slice(0, 8);
    const radarCtx = document.getElementById('comparisonRadarChart').getContext('2d');
    comparisonCharts.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: radarCategories,
            datasets: [
                {
                    label: earlierName,
                    data: radarCategories.map((cat) => earlier.byCategory[cat] || 0),
                    borderColor: earlierColor,
                    backgroundColor: comparisonTokenAlpha('--cat-2', 0.18, '#8b5cf6'),
                    pointBackgroundColor: earlierColor,
                    pointRadius: 2.5,
                },
                {
                    label: laterName,
                    data: radarCategories.map((cat) => later.byCategory[cat] || 0),
                    borderColor: laterColor,
                    backgroundColor: comparisonTokenAlpha('--brand', 0.18, '#0891b2'),
                    pointBackgroundColor: laterColor,
                    pointRadius: 2.5,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textMuted, boxWidth: 12, boxHeight: 12, usePointStyle: true },
                },
            },
            scales: {
                r: {
                    angleLines: { color: gridColor },
                    grid: { color: gridColor },
                    pointLabels: { color: textMuted, font: { size: 11 } },
                    ticks: { display: false },
                },
            },
        },
    });
}

// Detailed table: per-category change, biggest movers first.
function updateComparisonDetails(earlier, later, earlierName, laterName) {
    const categories = comparisonCategories(earlier, later).sort(
        (a, b) =>
            Math.abs((later.byCategory[b] || 0) - (earlier.byCategory[b] || 0)) -
            Math.abs((later.byCategory[a] || 0) - (earlier.byCategory[a] || 0))
    );

    const rows = categories
        .map((cat) => {
            const earlierVal = earlier.byCategory[cat] || 0;
            const laterVal = later.byCategory[cat] || 0;
            const diff = laterVal - earlierVal;
            const diffClass = diff > 0.005 ? 'negative' : diff < -0.005 ? 'positive' : '';
            const diffLabel =
                Math.abs(diff) < 0.005 ? '$0.00' : (diff > 0 ? '+' : '-') + formatMoney(diff);

            return `
            <tr>
                <td class="cat-cell">
                    ${getCategoryIconChip(cat, { size: 28, icon: 14 })}
                    <span>${escapeHtml(cat)}</span>
                </td>
                <td class="amount">${formatMoney(earlierVal)}</td>
                <td class="amount">${formatMoney(laterVal)}</td>
                <td class="difference ${diffClass}">${diffLabel}</td>
            </tr>
        `;
        })
        .join('');

    const html = `
        <h3>By Category</h3>
        <div class="table-scroll">
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th class="cat-col">Category</th>
                        <th>${escapeHtml(earlierName)}</th>
                        <th>${escapeHtml(laterName)}</th>
                        <th>Change</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="4" class="table-empty">No spending in either month</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('comparisonDetails').innerHTML = html;
}

// Close comparison modal
function closeComparisonModal() {
    if (comparisonCharts.bar) comparisonCharts.bar.destroy();
    if (comparisonCharts.radar) comparisonCharts.radar.destroy();
    comparisonCharts = {};

    document.getElementById('comparisonModal').classList.remove('show');
}
