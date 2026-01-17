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

// Update category details
function updateCategoryDetails(analyzer) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    // Get all categories sorted alphabetically (Income first, Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
        if (a === 'Income') return -1;
        if (b === 'Income') return 1;
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

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

        const displayedTransactions = isExpanded ? transactions : transactions.slice(0, 5);
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
                        <div class="transaction-item"
                             draggable="true"
                             data-transaction-id="${t.id}"
                             data-category="${category}">
                            <span class="transaction-name clickable-transaction"
                                  title="Click to view raw data"
                                  onclick="event.stopPropagation(); showRawTransactionData('${t.id}', '${category}')">${t.name}</span>
                            <span style="display: flex; align-items: center;">
                                <span class="transaction-amount">$${t.amount.toFixed(2)}</span>
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
        .filter(([_, value]) => value > 0)
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

        // Initialize overrides if needed
        if (!window.transactionOverrides) {
            window.transactionOverrides = {};
        }
        if (!window.transactionOverrides[actualMonth]) {
            window.transactionOverrides[actualMonth] = {};
        }

        // Set the override
        window.transactionOverrides[actualMonth][transactionId] = toCategory;

        // Load existing rules first
        if (typeof loadRules === 'function') {
            loadRules();
        }

        // Create a unified rule from this move
        let ruleCreated = false;
        if (typeof createRuleFromDragDrop === 'function') {
            const description = (
                actualTransaction.Description ||
                actualTransaction.description ||
                ''
            ).trim();
            const rule = createRuleFromDragDrop(description, toCategory);
            if (rule) {
                console.log(`Created automatic rule: "${rule.pattern}" → ${toCategory}`);
                ruleCreated = true;
            }
        }

        // Save BOTH the data and rules
        saveData();

        // Force a complete refresh
        setTimeout(() => {
            switchToMonth('ALL_DATA');
        }, 100);

        // Show appropriate notification based on whether rule was created
        if (!ruleCreated) {
            // Notification already shown by createRuleFromDragDrop when user cancels
            // Don't show another notification
            return;
        }

        showNotification(
            `Moved to ${toCategory} (rule created for similar transactions)`,
            'success'
        );
        return;
    }

    // Original code for single month view
    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    const transaction = monthData.transactions.find((t) => t._id === transactionId);
    if (!transaction) return;

    const description = (transaction.Description || transaction.description || '').trim();

    if (!window.transactionOverrides) {
        window.transactionOverrides = {};
    }

    if (!window.transactionOverrides[currentMonth]) {
        window.transactionOverrides[currentMonth] = {};
    }

    window.transactionOverrides[currentMonth][transactionId] = toCategory;

    // Create a unified rule from this move
    let ruleCreated = false;
    if (typeof createRuleFromDragDrop === 'function') {
        const rule = createRuleFromDragDrop(description, toCategory);
        if (rule) {
            console.log(`Created automatic rule: "${rule.pattern}" → ${toCategory}`);
            ruleCreated = true;
        }
    }

    saveData();
    switchToMonth(currentMonth);

    // Show appropriate notification based on whether rule was created
    if (!ruleCreated) {
        // Notification already shown by createRuleFromDragDrop when user cancels
        // Don't show another notification
        return;
    }

    showNotification(`Moved to ${toCategory} (rule created for similar transactions)`, 'success');
}

// Delete transaction
function deleteTransaction(category, transactionId) {
    if (!confirm('Delete this transaction?')) return;

    // Handle "All Data" view
    if (currentMonth === 'ALL_DATA') {
        let deleted = false;

        monthlyData.forEach((monthData, monthKey) => {
            const index = monthData.transactions.findIndex((t) => t._id === transactionId);
            if (index > -1) {
                monthData.transactions.splice(index, 1);
                deleted = true;
            }
        });

        if (deleted) {
            saveData();
            switchToMonth('ALL_DATA');
            showNotification('Transaction deleted', 'success');
        } else {
            showNotification('Transaction not found', 'error');
        }
        return;
    }

    // Original code for single month view
    const monthData = monthlyData.get(currentMonth);
    if (!monthData) return;

    const index = monthData.transactions.findIndex((t) => t._id === transactionId);

    if (index > -1) {
        monthData.transactions.splice(index, 1);
        saveData();
        switchToMonth(currentMonth);
        showNotification('Transaction deleted', 'success');
    } else {
        showNotification('Transaction not found', 'error');
    }
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
