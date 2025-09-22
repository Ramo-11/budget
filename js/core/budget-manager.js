// Budget Manager - Handles budget goals and tracking
class BudgetManager {
    constructor() {
        this.budgets = {
            monthly: {},
            categories: {},
        };
        this.loadBudgets();
    }

    loadBudgets() {
        const saved = localStorage.getItem('sahabBudget_budgets');
        if (saved) {
            this.budgets = JSON.parse(saved);
        }
    }

    saveBudgets() {
        localStorage.setItem('sahabBudget_budgets', JSON.stringify(this.budgets));
    }

    setMonthlyBudget(monthKey, amount) {
        if (!this.budgets.monthly[monthKey]) {
            this.budgets.monthly[monthKey] = {
                total: amount,
                categories: {},
                createdAt: new Date().toISOString(),
            };
        } else {
            this.budgets.monthly[monthKey].total = amount;
        }
        this.saveBudgets();
    }

    getMonthlyBudget(monthKey) {
        if (this.budgets.monthly[monthKey]) {
            return this.budgets.monthly[monthKey].total;
        }
        return userManager.getDefaultBudget();
    }

    setCategoryBudget(monthKey, category, amount) {
        if (!this.budgets.monthly[monthKey]) {
            this.budgets.monthly[monthKey] = {
                total: userManager.getDefaultBudget(),
                categories: {},
            };
        }
        this.budgets.monthly[monthKey].categories[category] = amount;
        this.saveBudgets();
    }

    getCategoryBudget(monthKey, category) {
        if (this.budgets.monthly[monthKey]?.categories[category]) {
            return this.budgets.monthly[monthKey].categories[category];
        }
        // Check if there's a default category budget
        if (this.budgets.categories[category]) {
            return this.budgets.categories[category];
        }
        return null;
    }

    setDefaultCategoryBudget(category, amount) {
        this.budgets.categories[category] = amount;
        this.saveBudgets();
    }

    calculateBudgetStatus(monthKey, actualSpending, categorySpending = {}) {
        const budget = this.getMonthlyBudget(monthKey);
        const remaining = budget - actualSpending;
        const percentage = (actualSpending / budget) * 100;

        const status = {
            budget,
            spent: actualSpending,
            remaining,
            percentage,
            isOverBudget: actualSpending > budget,
            message: this.getBudgetMessage(percentage),
            categoryStatus: {},
        };

        // Calculate category-wise status
        Object.entries(categorySpending).forEach(([category, spent]) => {
            const categoryBudget = this.getCategoryBudget(monthKey, category);
            if (categoryBudget) {
                status.categoryStatus[category] = {
                    budget: categoryBudget,
                    spent,
                    remaining: categoryBudget - spent,
                    percentage: (spent / categoryBudget) * 100,
                    isOverBudget: spent > categoryBudget,
                };
            }
        });

        return status;
    }

    getBudgetMessage(percentage) {
        if (percentage < 50) {
            return "Great job! You're well within budget 🎉";
        } else if (percentage < 80) {
            return 'Good progress! Keep monitoring your spending 👍';
        } else if (percentage < 100) {
            return 'Caution: Approaching budget limit ⚠️';
        } else if (percentage < 110) {
            return 'Over budget! Time to review expenses 😟';
        } else {
            return 'Significantly over budget! Immediate action needed 🚨';
        }
    }

    copyMonthBudget(fromMonth, toMonth) {
        if (this.budgets.monthly[fromMonth]) {
            this.budgets.monthly[toMonth] = {
                ...this.budgets.monthly[fromMonth],
                createdAt: new Date().toISOString(),
            };
            this.saveBudgets();
            return true;
        }
        return false;
    }

    applyBudgetTemplate(template, months) {
        months.forEach((month) => {
            this.budgets.monthly[month] = {
                ...template,
                createdAt: new Date().toISOString(),
            };
        });
        this.saveBudgets();
    }

    getBudgetHistory() {
        const history = [];
        Object.entries(this.budgets.monthly).forEach(([month, data]) => {
            history.push({
                month,
                budget: data.total,
                categories: data.categories,
                createdAt: data.createdAt,
            });
        });
        return history.sort((a, b) => b.month.localeCompare(a.month));
    }

    clearBudgets() {
        this.budgets = {
            monthly: {},
            categories: {},
        };
        this.saveBudgets();
    }
}

// Export for use
const budgetManager = new BudgetManager();
