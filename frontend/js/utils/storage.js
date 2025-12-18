/**
 * LocalStorage utilities
 */
import { CONFIG } from '../config.js';

export const storage = {
    /**
     * Get license key
     */
    getLicenseKey() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.LICENSE_KEY);
    },

    /**
     * Set license key
     */
    setLicenseKey(key) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LICENSE_KEY, key);
    },

    /**
     * Remove license key
     */
    removeLicenseKey() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LICENSE_KEY);
    },

    /**
     * Get theme preference
     */
    getTheme() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    },

    /**
     * Set theme preference
     */
    setTheme(theme) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
    },

    /**
     * Get user preferences
     */
    getPreferences() {
        try {
            const prefs = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES);
            return prefs ? JSON.parse(prefs) : {};
        } catch {
            return {};
        }
    },

    /**
     * Set user preferences
     */
    setPreferences(preferences) {
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER_PREFERENCES,
            JSON.stringify(preferences)
        );
    },

    /**
     * Clear all app data
     */
    clearAll() {
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
};
