/**
 * Main application entry point
 */
import { storage } from './utils/storage.js';
import { api } from './api/client.js';
import { initAuth } from './pages/auth.js';
import { initTheme, toggleTheme as themeToggle, getCurrentTheme, getThemeDisplayName } from './utils/theme.js';
import { initCreatePage } from './pages/create.js';
import { initLibraryPage } from './pages/library.js';
import { initEditorPage } from './pages/editor.js';
import { initCreditModal, showCreditModal } from './utils/creditModal.js';
import { initSocialProof } from './components/socialProof.js';
import { shouldShowOnboarding, startOnboarding } from './components/onboarding.js';

// Global state
window.appState = {
    currentUser: null,
    currentBook: null,
    credits: {
        total: 0,
        used: 0,
        remaining: 0
    }
};

/**
 * Initialize application
 */
async function init() {
    console.log('AI Book Generator v2.0 initializing...');

    // Initialize theme
    initTheme();
    updateThemeIcon();

    // Show loading screen (it's already visible in HTML)
    const loadingScreen = document.getElementById('appLoadingScreen');
    const loadingText = document.querySelector('.loading-text');

    // Minimum loading time for smooth UX (prevents flash)
    const minLoadingTime = 800;
    const startTime = Date.now();

    try {
        // ALWAYS show auth screen for smooth UX
        // Saved license will be pre-filled but user must click to enter
        const savedLicense = storage.getLicenseKey();

        if (savedLicense) {
            console.log('Found saved license - will pre-fill auth form');
            loadingText.textContent = 'Ready to continue...';
        } else {
            console.log('No saved license');
            loadingText.textContent = 'Ready to start...';
        }

        // Wait for minimum time, then show auth
        await ensureMinimumLoadingTime(startTime, minLoadingTime);
        hideLoadingScreen(loadingScreen);
        showAuthScreen();
        initAuth();
    } catch (error) {
        console.error('Initialization error:', error);
        await ensureMinimumLoadingTime(startTime, minLoadingTime);
        hideLoadingScreen(loadingScreen);
        showAuthScreen();
        initAuth();
    }
}

/**
 * Ensure minimum loading time for smooth UX
 */
async function ensureMinimumLoadingTime(startTime, minTime) {
    const elapsed = Date.now() - startTime;
    const remaining = minTime - elapsed;
    if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
    }
}

/**
 * Hide loading screen with smooth fade
 */
function hideLoadingScreen(loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 300);
}

/**
 * Validate license and load user
 */
async function validateAndLoadUser() {
    try {
        const response = await api.getCredits();

        if (response.success) {
            window.appState.credits = response.credits;
            window.appState.currentUser = {
                credits: response.credits,
                usage: response.usage
            };

            showMainApp();
            return true;
        }
    } catch (error) {
        throw new Error('License validation failed');
    }
}

/**
 * Show auth screen
 */
function showAuthScreen() {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');

    // Smooth fade in
    authScreen.style.display = 'flex';
    authScreen.style.opacity = '0';

    requestAnimationFrame(() => {
        authScreen.style.transition = 'opacity 0.3s ease-out';
        authScreen.style.opacity = '1';
    });

    mainApp.classList.remove('active');
}

/**
 * Show main app
 */
function showMainApp() {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');

    // Fade out auth screen
    authScreen.style.opacity = '0';

    setTimeout(() => {
        authScreen.style.display = 'none';

        // Fade in main app
        mainApp.classList.add('active');
        mainApp.style.opacity = '0';

        requestAnimationFrame(() => {
            mainApp.style.transition = 'opacity 0.3s ease-out';
            mainApp.style.opacity = '1';
        });

        // Update credits display
        updateCreditsDisplay();

        // Initialize credit modal
        initCreditModal();

        // Check if credits are low and show modal
        checkCreditsAndShowModal();

        // Initialize social proof
        initSocialProof();

        // Load initial tab
        showCreateTab();

        // Check if onboarding needed
        if (shouldShowOnboarding()) {
            setTimeout(() => startOnboarding(), 1500);
        }
    }, 300);
}

/**
 * Update credits display in header
 */
window.updateCreditsDisplay = function() {
    const credits = window.appState.credits;
    if (credits) {
        document.getElementById('creditsTotal').textContent = credits.total || 0;
        document.getElementById('creditsUsed').textContent = credits.used || 0;
        document.getElementById('creditsRemaining').textContent = credits.remaining || 0;

        // Add visual warning if low on credits
        const remainingEl = document.getElementById('creditsRemaining');
        if (credits.remaining <= 0) {
            remainingEl.style.color = 'var(--danger)';
        } else if (credits.remaining <= 10) {
            remainingEl.style.color = 'var(--warning)';
        } else {
            remainingEl.style.color = 'var(--text-primary)';
        }
    }
};

/**
 * Check credits and show modal if low/out
 */
function checkCreditsAndShowModal() {
    const credits = window.appState.credits;
    if (!credits) return;

    // Show modal if out of credits
    if (credits.remaining <= 0) {
        setTimeout(() => showCreditModal('out'), 1000);
    }
    // Show modal if very low on credits (first login only)
    else if (credits.remaining <= 5) {
        const hasSeenLowCreditsWarning = localStorage.getItem('hasSeenLowCreditsWarning');
        if (!hasSeenLowCreditsWarning) {
            setTimeout(() => showCreditModal('low'), 2000);
            localStorage.setItem('hasSeenLowCreditsWarning', 'true');
        }
    }
}

// Export for global access
window.checkCreditsAndShowModal = checkCreditsAndShowModal;

/**
 * Tab navigation
 */
window.showCreateTab = function() {
    console.log('Loading create tab...');
    setActiveTab('create');
    initCreatePage();
};

window.showLibraryTab = function() {
    console.log('Loading library tab...');
    setActiveTab('library');
    initLibraryPage();
};

window.showEditorTab = function(bookId) {
    console.log('Loading editor for book:', bookId);
    setActiveTab('editor');
    initEditorPage(bookId);
};

function setActiveTab(tabName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * Theme toggle handler
 */
window.toggleTheme = function() {
    const newTheme = themeToggle();
    updateThemeIcon();

    // Show brief notification
    console.log(`Theme switched to: ${getThemeDisplayName(newTheme)}`);
};

/**
 * Update theme icon based on current theme
 */
function updateThemeIcon() {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        const currentTheme = getCurrentTheme();
        themeIcon.textContent = currentTheme === 'midnight' ? '☀️' : '🌙';
    }
}

// Export for global access
window.showMainApp = showMainApp;
window.showAuthScreen = showAuthScreen;
