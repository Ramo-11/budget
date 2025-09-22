// User Manager - Handles user profile and preferences
class UserManager {
    constructor() {
        this.userData = {
            name: '',
            defaultBudget: 3000,
            categoryConfig: null,
            createdAt: null,
            lastLogin: null,
        };
        this.loadUserData();
    }

    loadUserData() {
        const saved = localStorage.getItem('sahabBudget_userData');
        if (saved) {
            this.userData = { ...this.userData, ...JSON.parse(saved) };
            this.userData.lastLogin = new Date().toISOString();
            this.saveUserData();
            return true;
        }
        return false;
    }

    saveUserData() {
        localStorage.setItem('sahabBudget_userData', JSON.stringify(this.userData));
    }

    isFirstTimeUser() {
        return !this.userData.name || !this.userData.createdAt;
    }

    setUserProfile(name, defaultBudget) {
        this.userData.name = name;
        this.userData.defaultBudget = defaultBudget || 3000;
        if (!this.userData.createdAt) {
            this.userData.createdAt = new Date().toISOString();
        }
        this.saveUserData();
    }

    getUserName() {
        return this.userData.name || 'Guest';
    }

    getDefaultBudget() {
        return this.userData.defaultBudget;
    }

    getCategoryConfig() {
        if (this.userData.categoryConfig) {
            return this.userData.categoryConfig;
        }
        // Return default config if not set
        return DEFAULT_CATEGORY_CONFIG;
    }

    setCategoryConfig(config) {
        this.userData.categoryConfig = config;
        this.saveUserData();
    }

    updateProfile(updates) {
        this.userData = { ...this.userData, ...updates };
        this.saveUserData();
    }

    clearUserData() {
        localStorage.removeItem('sahabBudget_userData');
        this.userData = {
            name: '',
            defaultBudget: 3000,
            categoryConfig: null,
            createdAt: null,
            lastLogin: null,
        };
    }
}

// Export for use in other modules
const userManager = new UserManager();
