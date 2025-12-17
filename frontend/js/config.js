/**
 * Application configuration
 */

export const CONFIG = {
    // API Configuration
    API_BASE_URL: 'https://aibook-yzpk.onrender.com', // Production backend on Render
    API_VERSION: 'v2',

    // Credit costs
    CREDIT_COSTS: {
        BOOK_STRUCTURE: 1,
        PAGE_GENERATION: 1,
        COVER_GENERATION: 2,
        BOOK_CREATION: 2,  // structure + first page
    },

    // Storage keys
    STORAGE_KEYS: {
        LICENSE_KEY: 'aibook_license',
        THEME: 'aibook_theme',
        USER_PREFERENCES: 'aibook_prefs'
    },

    // Book configuration
    BOOK: {
        MIN_PAGES: 5,
        MAX_PAGES: 100,
        DEFAULT_PAGES: 20,
        TYPES: ['general', 'kids', 'adult', 'educational']
    },

    // UI Configuration
    UI: {
        BOOKS_PER_PAGE: 50,
        DEBOUNCE_DELAY: 300,
        AUTO_SAVE_DELAY: 2000
    },

    // Purchase links (update with your actual Gumroad links)
    PURCHASE_LINKS: {
        starter: 'https://blazestudiox.gumroad.com/l/aibook-starter',
        pro: 'https://blazestudiox.gumroad.com/l/aibook-pro',
        business: 'https://blazestudiox.gumroad.com/l/aibook-business',
        enterprise: 'https://blazestudiox.gumroad.com/l/aibook-enterprise'
    }
};

// Feature flags (for gradual rollout)
export const FEATURES = {
    ENHANCED_EPUB: true,
    CREDIT_SYSTEM: true,
    ANALYTICS: true,
    TEMPLATES: false,  // Coming soon
    COLLABORATION: false  // Coming soon
};
