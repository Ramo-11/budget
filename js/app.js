// Main Application Entry Point for Sahab Budget
class SahabBudgetApp {
    constructor() {
        this.currentMonth = null;
        this.monthlyData = new Map();
        this.currentView = 'dashboard';
        this.initialized = false;
    }

    async init() {
        // Check if first time user
        if (userManager.isFirstTimeUser()) {
            this.showWelcomeModal();
        } else {
            this.startApp();
        }

        // Initialize event listeners
        this.initializeEventListeners();

        // Load saved data if exists
        this.loadSavedData();
    }

    showWelcomeModal() {
        const modal = document.getElementById('welcomeModal');
        modal.style.display = 'flex';
    }

    startApp() {
        // Hide welcome modal
        document.getElementById('welcomeModal').style.display = 'none';

        // Show user name
        const userSection = document.getElementById('userSection');
        const userNameDisplay = document.getElementById('userNameDisplay');
        userSection.style.display = 'flex';
        userNameDisplay.textContent = userManager.getUserName();

        this.initialized = true;

        // Initialize components
        notificationManager.show(`Welcome back, ${userManager.getUserName()}!`, 'success');
    }

    initializeEventListeners() {
        // Navigation
        document
            .getElementById('dashboardBtn')
            .addEventListener('click', () => this.switchView('dashboard'));
        document
            .getElementById('budgetBtn')
            .addEventListener('click', () => this.switchView('budget'));
        document
            .getElementById('trendsBtn')
            .addEventListener('click', () => this.switchView('trends'));
        document
            .getElementById('categoriesBtn')
            .addEventListener('click', () => this.switchView('categories'));

        // File upload
        document
            .getElementById('csvFile')
            .addEventListener('change', (e) => this.handleFileUpload(e));
    }

    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        document.getElementById('loading').style.display = 'block';

        try {
            const allTransactions = [];

            // Process each file
            for (const file of files) {
                const text = await file.text();
                const result = await this.parseCSV(text);
                allTransactions.push(...result.data);
            }

            // Split transactions by month
            const monthlyData = monthSplitter.splitByMonth(allTransactions);

            // Merge with existing data if any
            if (this.monthlyData.size > 0) {
                const merged = MonthSplitter.mergeMonthlyData([this.monthlyData, monthlyData]);
                this.monthlyData = merged;
            } else {
                this.monthlyData = monthlyData;
            }

            // Update month selector
            this.updateMonthSelector();

            // Process the most recent month by default
            const months = monthSplitter.getAvailableMonths();
            if (months.length > 0) {
                this.switchToMonth(months[0]);
            }

            // Save data
            this.saveData();

            notificationManager.show('Files uploaded successfully!', 'success');
        } catch (error) {
            console.error('Error processing files:', error);
            notificationManager.show('Error processing files. Please check the format.', 'error');
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    parseCSV(text) {
        return new Promise((resolve) => {
            Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: resolve,
            });
        });
    }

    updateMonthSelector() {
        const selector = document.getElementById('monthSelector');
        const dropdown = document.getElementById('monthDropdown');

        // Clear existing options
        dropdown.innerHTML = '';

        // Add months
        const months = Array.from(this.monthlyData.keys()).sort().reverse();
        months.forEach((monthKey) => {
            const monthData = this.monthlyData.get(monthKey);
            const option = document.createElement('option');
            option.value = monthKey;
            option.textContent = `${monthData.monthName} (${monthData.transactions.length} transactions)`;
            dropdown.appendChild(option);
        });

        // Show selector
        if (months.length > 0) {
            selector.style.display = 'block';
        }
    }

    switchToMonth(monthKey) {
        this.currentMonth = monthKey;
        const monthData = this.monthlyData.get(monthKey);

        if (!monthData) return;

        // Create analyzer for this month's data
        const analyzer = new ExpenseAnalyzer();
        analyzer.setCategoryConfig(userManager.getCategoryConfig());
        analyzer.processData(monthData.transactions);

        // Update dashboard
        dashboardView.update(analyzer, monthData.monthName);

        // Update budget status
        this.updateBudgetStatus(monthKey, analyzer);

        // Update month selector
        document.getElementById('monthDropdown').value = monthKey;
    }

    updateBudgetStatus(monthKey, analyzer) {
        const totalSpent = analyzer.getTotalExpenses();
        const categoryTotals = analyzer.categoryTotals;

        const budgetStatus = budgetManager.calculateBudgetStatus(
            monthKey,
            totalSpent,
            categoryTotals
        );

        dashboardView.updateBudgetStatus(budgetStatus, this.monthlyData.get(monthKey).monthName);
    }

    switchView(view) {
        this.currentView = view;

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
        document.getElementById(view + 'Btn').classList.add('active');

        // Hide all views
        document.querySelectorAll('.view').forEach((v) => (v.style.display = 'none'));

        // Show selected view
        switch (view) {
            case 'dashboard':
                document.getElementById('dashboard').style.display = 'block';
                if (this.currentMonth) {
                    this.switchToMonth(this.currentMonth);
                }
                break;
            case 'budget':
                document.getElementById('budgetView').style.display = 'block';
                budgetView.refresh();
                break;
            case 'trends':
                if (this.monthlyData.size >= 2) {
                    document.getElementById('trendsView').style.display = 'block';
                    trendsView.update(this.monthlyData);
                } else {
                    notificationManager.show(
                        'Need at least 2 months of data for trends analysis',
                        'info'
                    );
                    // Switch back to dashboard
                    this.switchView('dashboard');
                }
                break;
            case 'categories':
                // Show categories management view
                this.showCategoriesView();
                break;
        }
    }

    showCategoriesView() {
        // Create categories view if it doesn't exist
        let categoriesView = document.getElementById('categoriesView');
        if (!categoriesView) {
            categoriesView = document.createElement('div');
            categoriesView.id = 'categoriesView';
            categoriesView.className = 'view';
            categoriesView.innerHTML = `
                <div class="categories-header">
                    <h2>📊 Categories Overview</h2>
                    <p>Manage and analyze your expense categories</p>
                </div>
                <div class="categories-content">
                    <div class="categories-summary" id="categoriesSummary"></div>
                    <div class="categories-list" id="categoriesList"></div>
                </div>
            `;
            document.querySelector('.container').appendChild(categoriesView);
        }

        categoriesView.style.display = 'block';
        this.updateCategoriesView();
    }

    updateCategoriesView() {
        if (!this.currentMonth || !this.monthlyData.has(this.currentMonth)) {
            document.getElementById('categoriesList').innerHTML =
                '<div class="empty-state">Please select a month to view categories</div>';
            return;
        }

        const monthData = this.monthlyData.get(this.currentMonth);
        const analyzer = new ExpenseAnalyzer();
        analyzer.setCategoryConfig(userManager.getCategoryConfig());
        analyzer.processData(monthData.transactions);

        const categoriesHtml = Object.entries(analyzer.categoryTotals)
            .filter(([_, total]) => total > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([category, total]) => {
                const config = userManager.getCategoryConfig()[category] || {};
                const count = analyzer.categoryDetails[category]?.length || 0;
                const percentage = ((total / analyzer.getTotalExpenses()) * 100).toFixed(1);

                return `
                    <div class="category-overview-card">
                        <div class="category-header">
                            <span class="category-icon">${config.icon || '📦'}</span>
                            <h3>${category}</h3>
                            <span class="category-percentage">${percentage}%</span>
                        </div>
                        <div class="category-stats">
                            <div class="stat">
                                <span class="label">Total</span>
                                <span class="value">$${total.toFixed(2)}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Transactions</span>
                                <span class="value">${count}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Average</span>
                                <span class="value">$${(total / count).toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="category-actions">
                            <button onclick="categoryView.showCategoryAnalysis('${category}', '${
                    this.currentMonth
                }')" 
                                    class="btn-primary btn-sm">
                                Analyze
                            </button>
                            <button onclick="showAllTransactions('${category}')" 
                                    class="btn-secondary btn-sm">
                                View Transactions
                            </button>
                        </div>
                    </div>
                `;
            })
            .join('');

        document.getElementById('categoriesList').innerHTML = categoriesHtml;
    }

    saveData() {
        const dataToSave = {
            monthlyData: Array.from(this.monthlyData.entries()),
            currentMonth: this.currentMonth,
            lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem('sahabBudget_data', JSON.stringify(dataToSave));
    }

    loadSavedData() {
        const saved = localStorage.getItem('sahabBudget_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.monthlyData = new Map(data.monthlyData);

                if (data.currentMonth && this.monthlyData.has(data.currentMonth)) {
                    this.updateMonthSelector();
                    this.switchToMonth(data.currentMonth);
                }
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }
}

// Global functions for HTML onclick handlers
function saveUserProfile() {
    const name = document.getElementById('userName').value.trim();
    const budget = parseFloat(document.getElementById('monthlyBudget').value) || 3000;

    if (!name) {
        notificationManager.show('Please enter your name', 'error');
        return;
    }

    userManager.setUserProfile(name, budget);
    app.startApp();
}

function switchToMonth(monthKey) {
    app.switchToMonth(monthKey);
}

function openSettings() {
    settingsView.open();
}

function closeSettings() {
    settingsView.close();
}

function editMonthBudget() {
    if (app.currentMonth) {
        budgetView.editMonthBudget(app.currentMonth);
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SahabBudgetApp();
    app.init();
});
