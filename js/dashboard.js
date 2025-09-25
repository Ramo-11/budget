// js/dashboard.js - Dashboard View Functions

// Update dashboard
function updateDashboard(analyzer) {
    // Update summary cards
    const avgTransaction =
        analyzer.transactionCount > 0 ? analyzer.totalExpenses / analyzer.transactionCount : 0;

    const cardsHTML = `
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
    document.getElementById('summaryCards').innerHTML = cardsHTML;

    // Update category details
    updateCategoryDetails(analyzer);

    // Update charts
    updateCharts(analyzer);
}

// Update category details
function updateCategoryDetails(analyzer) {
    const container = document.getElementById('categoryDetails');
    container.innerHTML = '';

    // Get all categories sorted alphabetically (Others at the end)
    const allCategories = Object.keys(categoryConfig).sort((a, b) => {
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
        card.className = 'category-card';
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
                            <span class="transaction-name" title="${t.name}">${t.name}</span>
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
    const categories = Object.entries(analyzer.categoryTotals)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) return;

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

    // Pie chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
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

    // Bar chart
    const barCtx = document.getElementById('barChart').getContext('2d');
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
    const items = document.querySelectorAll('.transaction-item');
    const cards = document.querySelectorAll('.category-card');

    let draggedElement = null;
    let draggedId = null;
    let draggedCategory = null;
    let animationFrame = null;
    let lastEvent = null;

    function autoScroll(e) {
        if (!draggedElement || !e) return;

        const scrollZone = 100; // px from edge
        const maxSpeed = 15; // px per frame

        const viewportHeight = window.innerHeight;

        // Distance from edges
        const distTop = e.clientY;
        const distBottom = viewportHeight - e.clientY;

        let scrollY = 0;

        if (distTop < scrollZone) {
            scrollY = -((scrollZone - distTop) / scrollZone) * maxSpeed;
        } else if (distBottom < scrollZone) {
            scrollY = ((scrollZone - distBottom) / scrollZone) * maxSpeed;
        }

        if (scrollY !== 0) {
            window.scrollBy(0, scrollY);
        }

        // Container scrolling
        const container = document.querySelector('.container');
        if (container) {
            const rect = container.getBoundingClientRect();
            const distTopContainer = e.clientY - rect.top;
            const distBottomContainer = rect.bottom - e.clientY;

            if (distTopContainer < scrollZone && container.scrollTop > 0) {
                container.scrollTop -= ((scrollZone - distTopContainer) / scrollZone) * maxSpeed;
            } else if (
                distBottomContainer < scrollZone &&
                container.scrollTop < container.scrollHeight - container.clientHeight
            ) {
                container.scrollTop += ((scrollZone - distBottomContainer) / scrollZone) * maxSpeed;
            }
        }

        animationFrame = requestAnimationFrame(() => autoScroll(lastEvent));
    }

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedId = item.dataset.transactionId;
            draggedCategory = item.dataset.category;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            lastEvent = e;
            animationFrame = requestAnimationFrame(() => autoScroll(lastEvent));
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedElement = null;
            draggedId = null;
            draggedCategory = null;
            cancelAnimationFrame(animationFrame);
        });

        item.addEventListener('drag', (e) => {
            if (e.clientY > 0) lastEvent = e;
        });
    });

    document.addEventListener('dragover', (e) => {
        if (draggedElement) {
            e.preventDefault();
            lastEvent = e;
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
        if (typeof createRuleFromDragDrop === 'function') {
            const description = (
                actualTransaction.Description ||
                actualTransaction.description ||
                ''
            ).trim();
            const rule = createRuleFromDragDrop(description, toCategory);
            if (rule) {
                console.log(`Created automatic rule: "${rule.pattern}" → ${toCategory}`);
            }
        }

        // Save BOTH the data and rules
        saveData();

        // Force a complete refresh
        setTimeout(() => {
            switchToMonth('ALL_DATA');
        }, 100);

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
    if (typeof createRuleFromDragDrop === 'function') {
        const rule = createRuleFromDragDrop(description, toCategory);
        if (rule) {
            console.log(`Created automatic rule: "${rule.pattern}" → ${toCategory}`);
        }
    }

    saveData();
    switchToMonth(currentMonth);
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
