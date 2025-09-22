// Application Constants
const CONSTANTS = {
    // App Info
    APP_NAME: 'Sahab Budget',
    APP_VERSION: '1.0.0',
    COMPANY_NAME: 'Sahab Solutions',

    // Storage Keys
    STORAGE_KEYS: {
        USER_DATA: 'sahabBudget_userData',
        BUDGETS: 'sahabBudget_budgets',
        APP_DATA: 'sahabBudget_data',
        SETTINGS: 'sahabBudget_settings',
        CACHE: 'sahabBudget_cache',
    },

    // File Limits
    FILE: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        SUPPORTED_TYPES: ['.csv'],
        BATCH_LIMIT: 10, // Max files per upload
    },

    // Chart Settings
    CHART: {
        MAX_CATEGORIES: 15,
        DEFAULT_TYPE: 'pie',
        ANIMATION_DURATION: 750,
        COLORS: {
            PRIMARY: '#6366F1',
            SECONDARY: '#8B5CF6',
            SUCCESS: '#10B981',
            WARNING: '#F59E0B',
            DANGER: '#EF4444',
            INFO: '#3B82F6',
        },
    },

    // Transaction Limits
    TRANSACTION: {
        MIN_AMOUNT: 0.01,
        MAX_AMOUNT: 1000000,
        DESCRIPTION_MAX_LENGTH: 500,
    },

    // Budget Ranges
    BUDGET: {
        MIN: 0,
        MAX: 100000,
        DEFAULT: 3000,
        TEMPLATES: ['Conservative', 'Moderate', 'Comfortable', 'Custom'],
    },

    // Date Formats
    DATE: {
        DISPLAY: 'MMM DD, YYYY',
        INPUT: 'YYYY-MM-DD',
        MONTH: 'MMMM YYYY',
        SHORT_MONTH: 'MMM YY',
        EXPORT: 'YYYY-MM-DD_HHmmss',
    },

    // Currency
    CURRENCY: {
        SYMBOL: '$',
        CODE: 'USD',
        DECIMAL_PLACES: 2,
        THOUSAND_SEPARATOR: ',',
        DECIMAL_SEPARATOR: '.',
    },

    // Notification Durations (ms)
    NOTIFICATION: {
        SUCCESS: 3000,
        ERROR: 5000,
        WARNING: 4000,
        INFO: 3000,
        PERMANENT: 0,
    },

    // API Endpoints (if backend is added later)
    API: {
        BASE_URL: '',
        ENDPOINTS: {
            AUTH: '/auth',
            DATA: '/data',
            EXPORT: '/export',
            SYNC: '/sync',
        },
    },

    // Validation Rules
    VALIDATION: {
        NAME: {
            MIN_LENGTH: 1,
            MAX_LENGTH: 50,
            PATTERN: /^[a-zA-Z\s'-]+$/,
        },
        EMAIL: {
            PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        CATEGORY: {
            MIN_LENGTH: 1,
            MAX_LENGTH: 30,
            PATTERN: /^[a-zA-Z0-9\s&'-]+$/,
        },
        KEYWORD: {
            MIN_LENGTH: 1,
            MAX_LENGTH: 50,
        },
    },

    // Performance
    PERFORMANCE: {
        DEBOUNCE_DELAY: 300,
        THROTTLE_DELAY: 100,
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        CACHE_DURATION: 3600000, // 1 hour
    },

    // Feature Flags
    FEATURES: {
        TRENDS_MIN_MONTHS: 2,
        CATEGORY_ANALYSIS_MIN_TRANSACTIONS: 5,
        SMART_CATEGORIZATION: true,
        AUTO_BACKUP: true,
        EXPORT_FORMATS: ['CSV', 'JSON', 'PDF'],
        MULTI_CURRENCY: false,
    },

    // Error Messages
    ERRORS: {
        FILE_TOO_LARGE: 'File size exceeds 10MB limit',
        INVALID_FILE_TYPE: 'Please upload a CSV file',
        INVALID_CSV_FORMAT: 'Invalid CSV format. Please check your file',
        NO_DATA: 'No data found in the file',
        NETWORK_ERROR: 'Network error. Please check your connection',
        SAVE_ERROR: 'Failed to save data. Please try again',
        LOAD_ERROR: 'Failed to load data. Please refresh the page',
    },

    // Success Messages
    SUCCESS: {
        FILE_UPLOADED: 'File uploaded successfully',
        DATA_SAVED: 'Data saved successfully',
        BUDGET_SET: 'Budget updated successfully',
        CATEGORY_ADDED: 'Category added successfully',
        SETTINGS_UPDATED: 'Settings updated successfully',
        EXPORT_COMPLETE: 'Export completed successfully',
    },

    // Info Messages
    INFO: {
        LOADING: 'Loading...',
        PROCESSING: 'Processing your data...',
        NO_TRANSACTIONS: 'No transactions found',
        SELECT_MONTH: 'Please select a month to view',
        UPLOAD_HINT: 'Upload CSV files to get started',
    },
};

// Freeze the constants to prevent modification
Object.freeze(CONSTANTS);

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
