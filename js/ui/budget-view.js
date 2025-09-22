// Budget View Manager
class BudgetView {
    constructor() {
        this.currentEditMonth = null;
    }

    refresh() {
        this.displayMonthlyBudgets();
        this.displayCategoryBudgets();
    }

    displayMonthlyBudgets() {
        const container = document.getElementById('monthlyBudgetList');
        const history = budgetManager.getBudgetHistory();

        // Get all available months from the app
        const availableMonths = app.monthlyData
            ? Array.from(app.monthlyData.keys()).sort().reverse()
            : [];

        let html = `
            <div class="budget-list">
                ${availableMonths
                    .map((monthKey) => {
                        const monthData = app.monthlyData.get(monthKey);
                        const budget = budgetManager.getMonthlyBudget(monthKey);
                        const isSet = budgetManager.budgets.monthly[monthKey] ? true : false;

                        return `
                        <div class="budget-item">
                            <div class="budget-info">
                                <span class="budget-month">${monthData.monthName}</span>
                                <span class="budget-amount ${!isSet ? 'default' : ''}">
                                    $${budget.toFixed(2)}
                                    ${!isSet ? ' (default)' : ''}
                                </span>
                            </div>
                            <div class="budget-actions">
                                <button class="btn-edit" onclick="budgetView.editMonthBudget('${monthKey}')">
                                    Edit
                                </button>
                                ${
                                    history.length > 0
                                        ? `
                                    <button class="btn-copy" onclick="budgetView.showCopyOptions('${monthKey}')">
                                        Copy from
                                    </button>
                                `
                                        : ''
                                }
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
            
            <div class="budget-templates">
                <h4>Quick Templates</h4>
                <div class="template-buttons">
                    <button onclick="budgetView.applyTemplate('Conservative')">
                        Conservative ($2,500)
                    </button>
                    <button onclick="budgetView.applyTemplate('Moderate')">
                        Moderate ($3,500)
                    </button>
                    <button onclick="budgetView.applyTemplate('Comfortable')">
                        Comfortable ($5,000)
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    displayCategoryBudgets() {
        const container = document.getElementById('categoryBudgetList');
        const categories = Object.keys(userManager.getCategoryConfig());

        let html = `
            <div class="category-budget-grid">
                ${categories
                    .map((category) => {
                        const defaultBudget = budgetManager.budgets.categories[category];
                        const config = userManager.getCategoryConfig()[category];

                        return `
                        <div class="category-budget-item">
                            <div class="category-header">
                                <span class="category-icon">${config.icon || '📦'}</span>
                                <span class="category-name">${category}</span>
                            </div>
                            <div class="budget-input-group">
                                <input type="number" 
                                       id="cat-budget-${category.replace(/\s+/g, '-')}"
                                       value="${defaultBudget || ''}"
                                       placeholder="No limit"
                                       class="budget-input">
                                <button onclick="budgetView.saveCategoryBudget('${category}')">
                                    Set
                                </button>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    editMonthBudget(monthKey) {
        const currentBudget = budgetManager.getMonthlyBudget(monthKey);
        const monthData = app.monthlyData.get(monthKey);

        const newBudget = prompt(`Enter budget for ${monthData.monthName}:`, currentBudget);

        if (newBudget && !isNaN(parseFloat(newBudget))) {
            budgetManager.setMonthlyBudget(monthKey, parseFloat(newBudget));
            this.refresh();
            notificationManager.show(`Budget updated for ${monthData.monthName}`, 'success');

            // If this is the current month, update dashboard
            if (app.currentMonth === monthKey) {
                app.switchToMonth(monthKey);
            }
        }
    }

    saveCategoryBudget(category) {
        const input = document.getElementById(`cat-budget-${category.replace(/\s+/g, '-')}`);
        const value = parseFloat(input.value);

        if (!isNaN(value) && value > 0) {
            budgetManager.setDefaultCategoryBudget(category, value);
            notificationManager.show(`Default budget set for ${category}`, 'success');
        } else if (input.value === '') {
            // Remove budget limit
            delete budgetManager.budgets.categories[category];
            budgetManager.saveBudgets();
            notificationManager.show(`Budget limit removed for ${category}`, 'info');
        }
    }

    applyTemplate(templateName) {
        const template = DEFAULT_BUDGET_TEMPLATES[templateName];
        if (!template) return;

        const months = Array.from(app.monthlyData.keys());

        if (confirm(`Apply ${templateName} template to all ${months.length} months?`)) {
            budgetManager.applyBudgetTemplate(template, months);
            this.refresh();
            notificationManager.show(`${templateName} template applied to all months`, 'success');

            // Update current month display
            if (app.currentMonth) {
                app.switchToMonth(app.currentMonth);
            }
        }
    }

    showCopyOptions(targetMonth) {
        const history = budgetManager.getBudgetHistory();
        const options = history
            .filter((h) => h.month !== targetMonth)
            .map((h) => `${h.month}: $${h.budget}`)
            .join('\n');

        const sourceMonth = prompt(
            `Copy budget to ${targetMonth} from:\n\n${options}\n\nEnter month (YYYY-MM):`
        );

        if (sourceMonth && budgetManager.budgets.monthly[sourceMonth]) {
            budgetManager.copyMonthBudget(sourceMonth, targetMonth);
            this.refresh();
            notificationManager.show(`Budget copied from ${sourceMonth}`, 'success');
        }
    }
}

// Create global instance
const budgetView = new BudgetView();
