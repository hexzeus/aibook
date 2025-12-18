/**
 * Premium Theme Management
 * Themes: "sepia" (Sepia Scholar) & "midnight" (Midnight Ink)
 */
import { storage } from './storage.js';

/**
 * Available themes
 */
const THEMES = {
    SEPIA: 'sepia',
    MIDNIGHT: 'midnight'
};

/**
 * Initialize theme on app load
 */
export function initTheme() {
    const savedTheme = storage.getTheme() || THEMES.SEPIA;
    applyTheme(savedTheme);
}

/**
 * Apply theme with smooth transition
 */
export function applyTheme(theme) {
    // Validate theme
    if (!Object.values(THEMES).includes(theme)) {
        theme = THEMES.SEPIA;
    }

    // Add transition class for smooth theme change
    document.documentElement.classList.add('theme-transitioning');

    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);
    storage.setTheme(theme);

    // Remove transition class after animation
    setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
    }, 300);

    return theme;
}

/**
 * Toggle between themes
 */
export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === THEMES.MIDNIGHT ? THEMES.SEPIA : THEMES.MIDNIGHT;
    return applyTheme(newTheme);
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || THEMES.SEPIA;
}

/**
 * Get theme display name
 */
export function getThemeDisplayName(theme) {
    return theme === THEMES.MIDNIGHT ? 'Midnight Ink' : 'Sepia Scholar';
}

/**
 * Export theme constants
 */
export { THEMES };
