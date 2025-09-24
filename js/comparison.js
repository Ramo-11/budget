// js/comparison.js - Monthly Comparison Module

let comparisonCharts = {};

// Open comparison view
function openComparison() {
    const modal = document.getElementById('comparisonModal');
    const months = Array.from(monthlyData.keys()).sort().reverse();

    if (months.length < 2) {
        showNotification('Need at least 2 months of data for comparison', 'error');
        return;
    }

    const monthOptions = months
        .map((m) => {
            const data = monthlyData.get(m);
            return `<option value="${m}">${data.monthName}</option>`;
        })
        .join('');

    modal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 1200px;">
            <div class="modal-header">
                <h2>Monthly Comparison</h2>
                <button class="close-btn" onclick="closeComparisonModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="comparison-controls">
                    <div class="month-selectors">
                        <div class="month-selector-group">
                            <label>First Month:</label>
                            <select id="compareMonth1" onchange="updateComparison()">
                                ${monthOptions}
                            </select>
                        </div>
                        <div class="vs-divider">VS</div>
                        <div class="month-selector-group">
                            <label>Second Month:</label>
                            <select id="compareMonth2" onchange="updateComparison()">
                                ${monthOptions}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="comparison-content">
                    <div class="comparison-overview" id="comparisonOverview"></div>
                    <div class="comparison-charts">
                        <div class="comparison-chart-container">
                            <canvas id="comparisonBarChart"></canvas>
                        </div>
                        <div class="comparison-chart-container">
                            <canvas id="comparisonRadarChart"></canvas>
                        </div>
                    </div>
                    <div class="comparison-details" id="comparisonDetails"></div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('show');

    // Set default selections
    document.getElementById('compareMonth2').selectedIndex = 1;

    // Load comparison
    setTimeout(() => updateComparison(), 100);
}

// Update comparison
function updateComparison() {
    const month1Key = document.getElementById('compareMonth1').value;
    const month2Key = document.getElementById('compareMonth2').value;

    if (month1Key === month2Key) {
        showNotification('Please select different months', 'error');
        return;
    }

    const month1Data = monthlyData.get(month1Key);
    const month2Data = monthlyData.get(month2Key);

    const analyzer1 = analyzeTransactions(month1Data.transactions);
    const analyzer2 = analyzeTransactions(month2Data.transactions);

    // Update overview
    updateComparisonOverview(analyzer1, analyzer2, month1Data.monthName, month2Data.monthName);

    // Update charts
    updateComparisonCharts(analyzer1, analyzer2, month1Data.monthName, month2Data.monthName);

    // Update details
    updateComparisonDetails(analyzer1, analyzer2, month1Data.monthName, month2Data.monthName);
}

// Update comparison overview
function updateComparisonOverview(analyzer1, analyzer2, name1, name2) {
    const diff = analyzer2.totalExpenses - analyzer1.totalExpenses;
    const percentChange = analyzer1.totalExpenses > 0 ? (diff / analyzer1.totalExpenses) * 100 : 0;

    const html = `
        <div class="overview-card">
            <div class="overview-month">
                <h4>${name1}</h4>
                <div class="overview-amount">$${analyzer1.totalExpenses.toFixed(2)}</div>
                <div class="overview-transactions">${analyzer1.transactionCount} transactions</div>
            </div>
        </div>
        
        <div class="overview-change">
            <div class="change-arrow ${diff > 0 ? 'increase' : 'decrease'}">
                ${diff > 0 ? '→' : '←'}
            </div>
            <div class="change-amount ${diff > 0 ? 'negative' : 'positive'}">
                ${diff > 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)}
            </div>
            <div class="change-percent ${diff > 0 ? 'negative' : 'positive'}">
                ${diff > 0 ? '↑' : '↓'} ${Math.abs(percentChange).toFixed(1)}%
            </div>
        </div>
        
        <div class="overview-card">
            <div class="overview-month">
                <h4>${name2}</h4>
                <div class="overview-amount">$${analyzer2.totalExpenses.toFixed(2)}</div>
                <div class="overview-transactions">${analyzer2.transactionCount} transactions</div>
            </div>
        </div>
    `;

    document.getElementById('comparisonOverview').innerHTML = html;
}

// Update comparison charts
function updateComparisonCharts(analyzer1, analyzer2, name1, name2) {
    // Destroy existing charts
    if (comparisonCharts.bar) comparisonCharts.bar.destroy();
    if (comparisonCharts.radar) comparisonCharts.radar.destroy();

    // Get all categories
    const allCategories = [
        ...new Set([
            ...Object.keys(analyzer1.categoryTotals),
            ...Object.keys(analyzer2.categoryTotals),
        ]),
    ].sort();

    // Bar chart
    const barCtx = document.getElementById('comparisonBarChart').getContext('2d');
    comparisonCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: allCategories,
            datasets: [
                {
                    label: name1,
                    data: allCategories.map((cat) => analyzer1.categoryTotals[cat] || 0),
                    backgroundColor: 'rgba(79, 70, 229, 0.6)',
                },
                {
                    label: name2,
                    data: allCategories.map((cat) => analyzer2.categoryTotals[cat] || 0),
                    backgroundColor: 'rgba(236, 72, 153, 0.6)',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Category Comparison',
                },
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

    // Radar chart
    const radarCtx = document.getElementById('comparisonRadarChart').getContext('2d');
    comparisonCharts.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: allCategories.slice(0, 8), // Limit to 8 for readability
            datasets: [
                {
                    label: name1,
                    data: allCategories
                        .slice(0, 8)
                        .map((cat) => analyzer1.categoryTotals[cat] || 0),
                    borderColor: 'rgba(79, 70, 229, 1)',
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                },
                {
                    label: name2,
                    data: allCategories
                        .slice(0, 8)
                        .map((cat) => analyzer2.categoryTotals[cat] || 0),
                    borderColor: 'rgba(236, 72, 153, 1)',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Spending Pattern',
                },
            },
        },
    });
}

// Update comparison details
function updateComparisonDetails(analyzer1, analyzer2, name1, name2) {
    const allCategories = [
        ...new Set([
            ...Object.keys(analyzer1.categoryTotals),
            ...Object.keys(analyzer2.categoryTotals),
        ]),
    ].sort();

    const rows = allCategories
        .map((cat) => {
            const val1 = analyzer1.categoryTotals[cat] || 0;
            const val2 = analyzer2.categoryTotals[cat] || 0;
            const diff = val2 - val1;
            const icon = categoryConfig[cat]?.icon || '📦';

            return `
            <tr>
                <td><span class="category-icon">${icon}</span> ${cat}</td>
                <td class="amount">$${val1.toFixed(2)}</td>
                <td class="amount">$${val2.toFixed(2)}</td>
                <td class="difference ${diff > 0 ? 'negative' : diff < 0 ? 'positive' : ''}">
                    ${diff > 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)}
                </td>
            </tr>
        `;
        })
        .join('');

    const html = `
        <h3>Detailed Comparison</h3>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>${name1}</th>
                    <th>${name2}</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;

    document.getElementById('comparisonDetails').innerHTML = html;
}

// Close comparison modal
function closeComparisonModal() {
    // Destroy charts
    if (comparisonCharts.bar) comparisonCharts.bar.destroy();
    if (comparisonCharts.radar) comparisonCharts.radar.destroy();
    comparisonCharts = {};

    document.getElementById('comparisonModal').classList.remove('show');
}
