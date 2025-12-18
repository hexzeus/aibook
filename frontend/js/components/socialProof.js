/**
 * Social Proof Component
 * Displays real-time statistics to build trust
 */
import { api } from '../api/client.js';

let statsInterval = null;

/**
 * Initialize social proof display
 */
export async function initSocialProof() {
    // Create social proof bar if not exists
    if (!document.getElementById('socialProofBar')) {
        createSocialProofBar();
    }

    // Load initial stats
    await updateSocialProofStats();

    // Update every 30 seconds
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    statsInterval = setInterval(updateSocialProofStats, 30000);
}

/**
 * Create social proof bar HTML
 */
function createSocialProofBar() {
    const barHTML = `
        <div id="socialProofBar" class="social-proof-bar">
            <div class="social-proof-content">
                <div class="social-proof-stat">
                    <span class="stat-icon">📚</span>
                    <span class="stat-value" id="statBooksToday">...</span>
                    <span class="stat-label">books created today</span>
                </div>
                <div class="social-proof-stat">
                    <span class="stat-icon">📝</span>
                    <span class="stat-value" id="statPagesToday">...</span>
                    <span class="stat-label">pages generated today</span>
                </div>
                <div class="social-proof-stat">
                    <span class="stat-icon">👥</span>
                    <span class="stat-value" id="statActiveUsers">...</span>
                    <span class="stat-label">active users</span>
                </div>
            </div>
        </div>
    `;

    // Insert after header
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        const header = mainApp.querySelector('.app-header');
        if (header) {
            header.insertAdjacentHTML('afterend', barHTML);
        }
    }
}

/**
 * Update social proof statistics
 */
async function updateSocialProofStats() {
    try {
        const stats = await api.get('/api/analytics/realtime');

        // Animate number changes
        animateValue('statBooksToday', stats.books_created_today || 0);
        animateValue('statPagesToday', stats.pages_generated_today || 0);
        animateValue('statActiveUsers', stats.active_users_today || 0);
    } catch (error) {
        console.error('Failed to load social proof stats:', error);
    }
}

/**
 * Animate number value change
 */
function animateValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === newValue) return;

    const duration = 1000; // 1 second
    const startTime = Date.now();
    const diff = newValue - currentValue;

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const current = Math.round(currentValue + (diff * easeProgress));
        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };

    animate();
}

/**
 * Cleanup
 */
export function destroySocialProof() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}
