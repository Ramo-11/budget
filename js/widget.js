// js/widget.js - Quick Stats Dashboard Widget

let widgetUpdateInterval = null;

// Initialize widget
function initializeWidget() {
    // if (!monthlyData || monthlyData.size === 0) {
    //     return;
    // }
    // console.log('monthlyData:', JSON.stringify([...monthlyData], null, 2));
    // const existingWidget = document.getElementById('quickStatsWidget');
    // if (existingWidget) {
    //     existingWidget.remove();
    // }
    // const widget = document.createElement('div');
    // widget.id = 'quickStatsWidget';
    // widget.className = 'quick-stats-widget collapsed';
    // widget.innerHTML = `
    //     <div class="widget-toggle" onclick="toggleWidget()">
    //         <span class="widget-icon">📊</span>
    //         <span class="widget-label">Quick Stats</span>
    //     </div>
    //     <div class="widget-content">
    //         <div class="widget-header">
    //             <h3>Quick Stats</h3>
    //             <button class="widget-close" onclick="toggleWidget()">×</button>
    //         </div>
    //         <div class="widget-body">
    //             <div class="widget-tabs">
    //                 <button class="widget-tab active" onclick="switchWidgetTab('today')">Today</button>
    //                 <button class="widget-tab" onclick="switchWidgetTab('week')">This Week</button>
    //                 <button class="widget-tab" onclick="switchWidgetTab('month')">This Month</button>
    //             </div>
    //             <div class="widget-stats" id="widgetStats">
    //                 <!-- Stats will be loaded here -->
    //             </div>
    //         </div>
    //     </div>
    // `;
    // document.body.appendChild(widget);
    // // Update widget when data changes
    // if (monthlyData.size > 0) {
    //     updateWidgetStats('today');
    // }
}

// Toggle widget
function toggleWidget() {
    const widget = document.getElementById('quickStatsWidget');
    widget.classList.toggle('collapsed');

    if (!widget.classList.contains('collapsed')) {
        updateWidgetStats(getCurrentWidgetTab());
        // Auto-update every minute when open
        widgetUpdateInterval = setInterval(() => {
            updateWidgetStats(getCurrentWidgetTab());
        }, 60000);
    } else {
        clearInterval(widgetUpdateInterval);
    }
}

// Get current widget tab
function getCurrentWidgetTab() {
    const activeTab = document.querySelector('.widget-tab.active');
    return activeTab
        ? activeTab.textContent.toLowerCase().replace('this ', '').replace(' ', '')
        : 'today';
}

// Switch widget tab
function switchWidgetTab(period) {
    document.querySelectorAll('.widget-tab').forEach((tab) => tab.classList.remove('active'));
    event.target.classList.add('active');
    updateWidgetStats(period);
}

// Update widget stats
function updateWidgetStats(period) {
    const now = new Date();
    let startDate, endDate;
    let periodLabel;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            periodLabel = 'Today';
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek;
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59);
            periodLabel = 'This Week';
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            break;
    }

    // Filter transactions for period
    const transactions = [];
    monthlyData.forEach((data) => {
        data.transactions.forEach((t) => {
            const date = new Date(t['Transaction Date'] || t.Date || t.date);
            if (date >= startDate && date <= endDate) {
                transactions.push(t);
            }
        });
    });

    const analyzer = analyzeTransactions(transactions);

    // Find top category
    let topCategory = 'None';
    let topAmount = 0;
    Object.entries(analyzer.categoryTotals).forEach(([cat, amount]) => {
        if (amount > topAmount) {
            topCategory = cat;
            topAmount = amount;
        }
    });

    // Calculate daily average
    const daysInPeriod = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const dailyAvg = analyzer.totalExpenses / daysInPeriod;

    // Get budget progress if monthly view
    let budgetHtml = '';
    if (period === 'month') {
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthBudgets = budgets[monthKey] || {};
        const totalBudget = Object.values(monthBudgets).reduce((a, b) => a + b, 0);

        if (totalBudget > 0) {
            const remaining = totalBudget - analyzer.totalExpenses;
            const percentage = (analyzer.totalExpenses / totalBudget) * 100;

            budgetHtml = `
                <div class="widget-stat">
                    <span class="stat-label">Budget Progress</span>
                    <div class="widget-progress">
                        <div class="widget-progress-fill ${
                            percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : ''
                        }" 
                             style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <span class="stat-value ${remaining >= 0 ? 'positive' : 'negative'}">
                        ${remaining >= 0 ? 'Remaining' : 'Over'}: $${Math.abs(remaining).toFixed(2)}
                    </span>
                </div>
            `;
        }
    }

    const html = `
        <div class="widget-period">${periodLabel}</div>
        
        <div class="widget-stat highlight">
            <span class="stat-label">Total Spent</span>
            <span class="stat-value large">$${analyzer.totalExpenses.toFixed(2)}</span>
        </div>
        
        <div class="widget-stat">
            <span class="stat-label">Transactions</span>
            <span class="stat-value">${analyzer.transactionCount}</span>
        </div>
        
        <div class="widget-stat">
            <span class="stat-label">Daily Average</span>
            <span class="stat-value">$${dailyAvg.toFixed(2)}</span>
        </div>
        
        <div class="widget-stat">
            <span class="stat-label">Top Category</span>
            <span class="stat-value">
                ${categoryConfig[topCategory]?.icon || '📦'} ${topCategory}
                ${topAmount > 0 ? `($${topAmount.toFixed(2)})` : ''}
            </span>
        </div>
        
        ${budgetHtml}
    `;

    document.getElementById('widgetStats').innerHTML = html;
}
