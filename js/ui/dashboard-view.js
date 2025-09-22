// Dashboard View Manager
class DashboardView {
    constructor() {
        this.charts = {
            pie: null,
            bar: null,
        };
    }

    update(analyzer, monthName) {
        this.updateSummaryCards(analyzer);
        this.updateCharts(analyzer);
        this.updateCategoryDetails(analyzer);

        // Show dashboard
        document.getElementById('dashboard').style.display = 'block';
    }

    updateSummaryCards(analyzer) {
        const stats = analyzer.getStats();
        const totalExpenses = analyzer.getTotalExpenses();

        const cardsHTML = `
            <div class="card">
                <h3>Total Expenses</h3>
                <p>$${totalExpenses.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Date Range</h3>
                <p>${analyzer.getDateRange()}</p>
            </div>
            <div class="card">
                <h3>Transactions</h3>
                <p>${stats.transactionCount}</p>
            </div>
            <div class="card">
                <h3>Highest Category</h3>
                <p>${stats.highest.name}: $${stats.highest.amount.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Lowest Category</h3>
                <p>${stats.lowest.name}: $${stats.lowest.amount.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Daily Average</h3>
                <p>$${stats.avgPerDay.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Largest Transaction</h3>
                <p>$${stats.largestTransaction.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Smart Categorized</h3>
                <p>${stats.smartCategorized} items</p>
            </div>
        `;

        document.getElementById('summaryCards').innerHTML = cardsHTML;
    }

    updateCharts(analyzer) {
        const nonZeroCategories = Object.entries(analyzer.categoryTotals)
            .filter(([_, value]) => value > 0)
            .sort((a, b) => b[1] - a[1]);

        const labels = nonZeroCategories.map(([name]) => name);
        const values = nonZeroCategories.map(([_, value]) => value);
        const colors = this.getChartColors(labels.length);

        // Destroy existing charts
        if (this.charts.pie) this.charts.pie.destroy();
        if (this.charts.bar) this.charts.bar.destroy();

        // Create Pie Chart
        const pieCtx = document.getElementById('pieChart').getContext('2d');
        this.charts.pie = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#ffffff',
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: $${context.parsed.toFixed(
                                    2
                                )} (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });

        // Create Bar Chart
        const barCtx = document.getElementById('barChart').getContext('2d');
        this.charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Amount ($)',
                        data: values,
                        backgroundColor: colors.map((color) => color + '80'),
                        borderColor: colors,
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `$${value.toFixed(0)}`,
                        },
                    },
                },
            },
        });
    }

    updateCategoryDetails(analyzer) {
        const container = document.getElementById('categoryDetails');
        container.innerHTML = '';

        const sortedCategories = Object.entries(analyzer.categoryDetails).sort((a, b) => {
            const totalA = analyzer.categoryTotals[a[0]] || 0;
            const totalB = analyzer.categoryTotals[b[0]] || 0;
            return totalB - totalA;
        });

        sortedCategories.forEach(([category, transactions]) => {
            if (transactions.length === 0) return;

            const total = analyzer.categoryTotals[category] || 0;
            const categoryConfig = userManager.getCategoryConfig()[category] || {};

            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = category;

            card.innerHTML = `
                <div class="category-header">
                    <div class="category-title">
                        <span class="category-icon">${categoryConfig.icon || '📦'}</span>
                        <h4>${category}</h4>
                        <span class="category-total">$${total.toFixed(2)}</span>
                    </div>
                    <button class="category-menu-btn" onclick="showCategoryMenu('${category}')">⋮</button>
                </div>
                <div class="category-transactions">
                    ${transactions
                        .slice(0, 5)
                        .map(
                            (t) => `
                        <div class="transaction-item" data-amount="${t.amount}" data-date="${
                                t.date
                            }">
                            <span class="transaction-name">${t.name}</span>
                            <span class="transaction-amount ${t.amount < 0 ? 'return' : ''}">
                                $${Math.abs(t.amount).toFixed(2)}${t.amount < 0 ? ' ↩' : ''}
                            </span>
                        </div>
                    `
                        )
                        .join('')}
                    ${
                        transactions.length > 5
                            ? `
                        <div class="show-more">
                            <button onclick="showAllTransactions('${category}')">
                                Show ${transactions.length - 5} more...
                            </button>
                        </div>
                    `
                            : ''
                    }
                </div>
            `;

            container.appendChild(card);
        });
    }

    updateBudgetStatus(budgetStatus, monthName) {
        const overviewDiv = document.getElementById('budgetOverview');

        if (!budgetStatus) {
            overviewDiv.style.display = 'none';
            return;
        }

        // Update budget display
        document.getElementById('currentMonthName').textContent = monthName;
        document.getElementById('monthBudget').textContent = `$${budgetStatus.budget.toFixed(2)}`;
        document.getElementById('monthSpent').textContent = `$${budgetStatus.spent.toFixed(2)}`;
        document.getElementById('monthRemaining').textContent = `$${Math.abs(
            budgetStatus.remaining
        ).toFixed(2)}`;

        // Update progress bar
        const progressBar = document.getElementById('budgetProgressBar');
        const percentage = Math.min(100, budgetStatus.percentage);
        progressBar.style.width = `${percentage}%`;

        // Set color based on status
        if (budgetStatus.percentage > 100) {
            progressBar.style.backgroundColor = 'var(--danger)';
        } else if (budgetStatus.percentage > 80) {
            progressBar.style.backgroundColor = 'var(--warning)';
        } else {
            progressBar.style.backgroundColor = 'var(--success)';
        }

        // Update message
        document.getElementById('budgetMessage').textContent = budgetStatus.message;

        overviewDiv.style.display = 'block';
    }

    getChartColors(count) {
        const baseColors = [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF',
            '#4BC0C0',
            '#FF6384',
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }
}

// Create global instance
const dashboardView = new DashboardView();

// Global functions for onclick handlers
function showCategoryMenu(category) {
    // Implementation for category menu
    console.log('Show menu for:', category);
}

function showAllTransactions(category) {
    // Implementation to show all transactions in a modal
    console.log('Show all transactions for:', category);
}
