// Settings View Manager
class SettingsView {
    constructor() {
        this.currentTab = 'profile';
    }

    open() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'flex';

        // Load current settings
        this.loadProfileSettings();
        this.loadCategorySettings();
        this.loadBudgetSettings();
    }

    close() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    loadProfileSettings() {
        document.getElementById('settingsUserName').value = userManager.getUserName();
        document.getElementById('settingsMonthlyBudget').value = userManager.getDefaultBudget();
    }

    loadCategorySettings() {
        const container = document.getElementById('categoryConfigEditor');
        const config = userManager.getCategoryConfig();

        let html = '<div class="category-config-list">';

        Object.entries(config).forEach(([category, settings]) => {
            const keywords = settings.keywords || [];
            html += `
                <div class="category-config-item" data-category="${category}">
                    <div class="config-header">
                        <span class="category-icon">${settings.icon || '📦'}</span>
                        <input type="text" value="${category}" class="category-name-input" 
                               onchange="settingsView.updateCategoryName('${category}', this.value)">
                        <button class="btn-remove" onclick="settingsView.removeCategory('${category}')">×</button>
                    </div>
                    <div class="config-body">
                        <label>Keywords (comma-separated):</label>
                        <textarea class="keywords-input" 
                                  data-category="${category}"
                                  placeholder="e.g., AMAZON, WALMART, TARGET">${keywords.join(
                                      ', '
                                  )}</textarea>
                        <label>Icon:</label>
                        <input type="text" value="${settings.icon || '📦'}" 
                               class="icon-input" data-category="${category}">
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    loadBudgetSettings() {
        const container = document.createElement('div');
        container.id = 'budgetSettings';
        container.className = 'tab-content';

        const categories = Object.keys(userManager.getCategoryConfig());
        const defaultBudget = userManager.getDefaultBudget();

        container.innerHTML = `
            <h3>Default Monthly Budget</h3>
            <div class="form-group">
                <label>Total Monthly Budget</label>
                <input type="number" id="defaultMonthlyBudget" value="${defaultBudget}" 
                       class="form-input" placeholder="e.g., 3000">
                <small>This will be used as default for new months</small>
            </div>
            
            <h3>Category Budget Limits (Optional)</h3>
            <div class="category-budgets-grid">
                ${categories
                    .map((category) => {
                        const budget = budgetManager.budgets.categories[category] || '';
                        return `
                        <div class="category-budget-item">
                            <label>${category}</label>
                            <input type="number" 
                                   id="catBudget_${category.replace(/\s+/g, '_')}"
                                   value="${budget}"
                                   placeholder="No limit"
                                   class="form-input">
                        </div>
                    `;
                    })
                    .join('')}
            </div>
            <button class="btn-primary" onclick="settingsView.saveBudgetSettings()">
                Save Budget Settings
            </button>
        `;

        document.querySelector('.settings-content').appendChild(container);
    }

    saveBudgetSettings() {
        const defaultBudget = parseFloat(document.getElementById('defaultMonthlyBudget').value);
        if (!isNaN(defaultBudget) && defaultBudget > 0) {
            userManager.updateProfile({ defaultBudget });
        }

        // Save category budgets
        const categories = Object.keys(userManager.getCategoryConfig());
        categories.forEach((category) => {
            const input = document.getElementById(`catBudget_${category.replace(/\s+/g, '_')}`);
            if (input) {
                const value = parseFloat(input.value);
                if (!isNaN(value) && value > 0) {
                    budgetManager.setDefaultCategoryBudget(category, value);
                } else if (input.value === '') {
                    delete budgetManager.budgets.categories[category];
                }
            }
        });

        budgetManager.saveBudgets();
        notificationManager.show('Budget settings saved', 'success');

        // Refresh current view if needed
        if (app.currentMonth) {
            app.switchToMonth(app.currentMonth);
        }
    }

    updateCategoryName(oldName, newName) {
        if (oldName === newName) return;

        const config = userManager.getCategoryConfig();
        if (config[newName]) {
            notificationManager.show('Category name already exists', 'error');
            this.loadCategorySettings();
            return;
        }

        config[newName] = config[oldName];
        delete config[oldName];
        userManager.setCategoryConfig(config);
    }

    removeCategory(category) {
        if (confirm(`Remove category "${category}"? Transactions will be moved to "Others".`)) {
            const config = userManager.getCategoryConfig();
            delete config[category];
            userManager.setCategoryConfig(config);
            this.loadCategorySettings();
            notificationManager.show(`Category "${category}" removed`, 'success');
        }
    }

    addNewCategory() {
        const name = prompt('Enter new category name:');
        if (!name) return;

        const config = userManager.getCategoryConfig();
        if (config[name]) {
            notificationManager.show('Category already exists', 'error');
            return;
        }

        config[name] = {
            keywords: [],
            icon: '📦',
            color: '#95A5A6',
            description: '',
        };

        userManager.setCategoryConfig(config);
        this.loadCategorySettings();
        notificationManager.show(`Category "${name}" added`, 'success');
    }

    saveCategoryConfig() {
        const config = userManager.getCategoryConfig();
        const items = document.querySelectorAll('.category-config-item');

        items.forEach((item) => {
            const category = item.dataset.category;
            const keywordsInput = item.querySelector('.keywords-input');
            const iconInput = item.querySelector('.icon-input');

            if (config[category]) {
                // Parse keywords
                const keywords = keywordsInput.value
                    .split(',')
                    .map((k) => k.trim())
                    .filter((k) => k.length > 0);

                config[category].keywords = keywords;
                config[category].icon = iconInput.value || '📦';
            }
        });

        userManager.setCategoryConfig(config);
        notificationManager.show('Category configuration saved', 'success');

        // Reprocess current month if loaded
        if (app.currentMonth) {
            app.switchToMonth(app.currentMonth);
        }
    }
}

// Create global instance
const settingsView = new SettingsView();

// Global functions for settings
function switchSettingsTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.remove('active');
    });

    // Remove active from all tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const tabContent = document.getElementById(tab + 'Settings');
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Mark button as active
    event.target.classList.add('active');

    // Load budget settings if needed
    if (tab === 'budget' && !document.getElementById('budgetSettings')) {
        settingsView.loadBudgetSettings();
        document.getElementById('budgetSettings').classList.add('active');
    }
}

function updateProfile() {
    const name = document.getElementById('settingsUserName').value.trim();
    const budget = parseFloat(document.getElementById('settingsMonthlyBudget').value);

    if (!name) {
        notificationManager.show('Please enter a name', 'error');
        return;
    }

    userManager.updateProfile({
        name: name,
        defaultBudget: budget || 3000,
    });

    // Update display
    document.getElementById('userNameDisplay').textContent = name;

    notificationManager.show('Profile updated', 'success');
}

function clearAllData() {
    if (
        confirm(
            'This will delete all your data including transactions, budgets, and settings. Are you sure?'
        )
    ) {
        if (confirm('This action cannot be undone. Please confirm again.')) {
            // Clear all localStorage
            localStorage.clear();

            notificationManager.show('All data cleared. Refreshing...', 'info');

            // Reload the page
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    }
}

function exportData() {
    const exportData = {
        userData: userManager.userData,
        budgets: budgetManager.budgets,
        appData: {
            monthlyData: Array.from(app.monthlyData.entries()),
            exportDate: new Date().toISOString(),
        },
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `sahab-budget-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    notificationManager.show('Data exported successfully', 'success');
}
