// Storage Manager - Handles all localStorage operations with encryption and compression
class StorageManager {
    constructor() {
        this.prefix = 'sahabBudget_';
        this.encryptionEnabled = false; // Can be enabled if needed
        this.compressionEnabled = false; // Can be enabled for large datasets
    }

    /**
     * Set item in storage
     */
    set(key, value) {
        try {
            const prefixedKey = this.prefix + key;
            let data = JSON.stringify(value);

            // Apply compression if enabled and data is large
            if (this.compressionEnabled && data.length > 10000) {
                data = this.compress(data);
            }

            // Apply encryption if enabled
            if (this.encryptionEnabled) {
                data = this.encrypt(data);
            }

            localStorage.setItem(prefixedKey, data);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);

            // Handle quota exceeded error
            if (error.name === 'QuotaExceededError') {
                this.handleQuotaExceeded();
            }

            return false;
        }
    }

    /**
     * Get item from storage
     */
    get(key, defaultValue = null) {
        try {
            const prefixedKey = this.prefix + key;
            let data = localStorage.getItem(prefixedKey);

            if (data === null) {
                return defaultValue;
            }

            // Decrypt if encryption is enabled
            if (this.encryptionEnabled) {
                data = this.decrypt(data);
            }

            // Decompress if needed
            if (this.compressionEnabled && this.isCompressed(data)) {
                data = this.decompress(data);
            }

            return JSON.parse(data);
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    /**
     * Remove item from storage
     */
    remove(key) {
        try {
            const prefixedKey = this.prefix + key;
            localStorage.removeItem(prefixedKey);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    /**
     * Clear all app storage
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        const prefixedKey = this.prefix + key;
        return localStorage.getItem(prefixedKey) !== null;
    }

    /**
     * Get storage size
     */
    getSize() {
        let totalSize = 0;
        const keys = Object.keys(localStorage);

        keys.forEach((key) => {
            if (key.startsWith(this.prefix)) {
                const item = localStorage.getItem(key);
                totalSize += item.length;
            }
        });

        return {
            bytes: totalSize,
            kb: (totalSize / 1024).toFixed(2),
            mb: (totalSize / 1024 / 1024).toFixed(2),
        };
    }

    /**
     * Get all app keys
     */
    getAllKeys() {
        const keys = Object.keys(localStorage);
        return keys
            .filter((key) => key.startsWith(this.prefix))
            .map((key) => key.replace(this.prefix, ''));
    }

    /**
     * Backup all data
     */
    backup() {
        const backup = {};
        const keys = this.getAllKeys();

        keys.forEach((key) => {
            backup[key] = this.get(key);
        });

        return {
            version: CONSTANTS.APP_VERSION,
            timestamp: new Date().toISOString(),
            data: backup,
        };
    }

    /**
     * Restore from backup
     */
    restore(backup) {
        try {
            if (!backup.data) {
                throw new Error('Invalid backup format');
            }

            // Clear existing data
            this.clear();

            // Restore each item
            Object.entries(backup.data).forEach(([key, value]) => {
                this.set(key, value);
            });

            return true;
        } catch (error) {
            console.error('Storage restore error:', error);
            return false;
        }
    }

    /**
     * Handle quota exceeded error
     */
    handleQuotaExceeded() {
        console.warn('Storage quota exceeded. Attempting cleanup...');

        // Remove old cache data
        const cacheKeys = this.getAllKeys().filter((key) => key.includes('cache'));
        cacheKeys.forEach((key) => this.remove(key));

        // Notify user
        if (typeof notificationManager !== 'undefined') {
            notificationManager.show(
                'Storage space is running low. Some cached data has been cleared.',
                'warning'
            );
        }
    }

    /**
     * Simple compression using LZ-string (would need library)
     */
    compress(data) {
        // Placeholder - would use LZ-string or similar library
        return data;
    }

    /**
     * Simple decompression
     */
    decompress(data) {
        // Placeholder - would use LZ-string or similar library
        return data;
    }

    /**
     * Check if data is compressed
     */
    isCompressed(data) {
        // Placeholder - would check for compression header
        return false;
    }

    /**
     * Simple encryption (would need proper implementation)
     */
    encrypt(data) {
        // Placeholder - would use proper encryption library
        return btoa(data);
    }

    /**
     * Simple decryption
     */
    decrypt(data) {
        // Placeholder - would use proper encryption library
        return atob(data);
    }

    /**
     * Storage statistics
     */
    getStatistics() {
        const size = this.getSize();
        const keys = this.getAllKeys();

        return {
            totalKeys: keys.length,
            size: size,
            usage: this.getStorageUsage(),
            available: this.getAvailableSpace(),
        };
    }

    /**
     * Get storage usage percentage
     */
    getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return navigator.storage.estimate().then((estimate) => {
                const percentage = ((estimate.usage / estimate.quota) * 100).toFixed(2);
                return percentage;
            });
        }
        return Promise.resolve('N/A');
    }

    /**
     * Get available storage space
     */
    getAvailableSpace() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return navigator.storage.estimate().then((estimate) => {
                const available = estimate.quota - estimate.usage;
                return {
                    bytes: available,
                    mb: (available / 1024 / 1024).toFixed(2),
                };
            });
        }
        return Promise.resolve({ bytes: 0, mb: '0' });
    }
}

// Create global instance
const storageManager = new StorageManager();
