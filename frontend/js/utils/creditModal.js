/**
 * Credit Purchase Modal
 * Displays when user is low on credits or runs out
 */
import { api } from '../api/client.js';

let creditPackages = [];
let modalElement = null;

/**
 * Initialize credit modal
 */
export async function initCreditModal() {
    // Fetch available packages
    try {
        const response = await api.get('/api/credit-packages');
        if (response.success) {
            creditPackages = response.packages;
        }
    } catch (error) {
        console.error('Failed to load credit packages:', error);
    }

    // Create modal HTML if not exists
    if (!document.getElementById('creditModal')) {
        createModalHTML();
    }

    modalElement = document.getElementById('creditModal');
}

/**
 * Show credit modal
 * @param {string} reason - Why modal is shown: 'low' | 'out' | 'purchase'
 */
export async function showCreditModal(reason = 'low') {
    if (!modalElement) {
        await initCreditModal();
    }

    // Ensure packages are loaded before rendering
    if (creditPackages.length === 0) {
        console.warn('Credit packages not loaded yet, fetching...');
        try {
            const response = await api.get('/api/credit-packages');
            if (response.success) {
                creditPackages = response.packages;
            }
        } catch (error) {
            console.error('Failed to load credit packages:', error);
        }
    }

    // Update modal content based on reason
    updateModalContent(reason);

    // Render packages
    renderPackages();

    // Show modal with animation
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Hide credit modal
 */
export function hideCreditModal() {
    if (modalElement) {
        modalElement.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Update modal content based on reason
 */
function updateModalContent(reason) {
    const titleEl = document.getElementById('creditModalTitle');
    const messageEl = document.getElementById('creditModalMessage');

    switch (reason) {
        case 'out':
            titleEl.textContent = '⚠️ Out of Credits!';
            messageEl.textContent = 'You need more credits to continue generating books. Choose a package below to get started again!';
            break;
        case 'low':
            titleEl.textContent = '⚠️ Running Low on Credits';
            messageEl.textContent = 'You\'re running low on credits! Stock up now to keep creating amazing books without interruption.';
            break;
        case 'purchase':
        default:
            titleEl.textContent = '💎 Buy More Credits';
            messageEl.textContent = 'Choose a credit package to unlock more book generation power!';
            break;
    }

    // Render packages
    renderPackages();
}

/**
 * Render credit packages
 */
function renderPackages() {
    const container = document.getElementById('creditPackagesContainer');
    if (!container || creditPackages.length === 0) return;

    container.innerHTML = creditPackages.map(pkg => `
        <div class="credit-package-card ${pkg.is_featured ? 'featured' : ''}">
            ${pkg.is_featured ? '<div class="package-badge">' + pkg.badge + '</div>' : ''}
            ${pkg.savings_percent > 0 ? '<div class="savings-badge">Save ' + pkg.savings_percent + '%</div>' : ''}

            <div class="package-header">
                <h3>${pkg.name}</h3>
                <div class="package-price">${pkg.price}</div>
            </div>

            <div class="package-details">
                <div class="package-credits">
                    <span class="credits-amount">${pkg.credits.toLocaleString()}</span>
                    <span class="credits-label">Credits</span>
                </div>

                ${pkg.savings_percent > 0 ?
                    '<div class="package-savings">You save ' + pkg.savings_percent + '%</div>' :
                    '<div class="package-badge-text">' + pkg.badge + '</div>'
                }
            </div>

            <button
                class="btn btn-primary package-buy-btn"
                onclick="window.purchaseCredits('${pkg.id}')"
            >
                Purchase Now
            </button>
        </div>
    `).join('');
}

/**
 * Purchase credits
 */
window.purchaseCredits = async function(packageId) {
    try {
        const response = await api.post('/api/credits/purchase', { package_id: packageId });

        if (response.success && response.purchase_url) {
            // Show email capture modal if not already shown
            // (Will be checked on return from Gumroad)
            const hasProvidedEmail = localStorage.getItem('hasProvidedEmail');
            if (!hasProvidedEmail) {
                // Set flag to show email modal on return
                localStorage.setItem('showEmailCaptureAfterPurchase', 'true');
            }

            // Redirect to Gumroad
            window.location.href = response.purchase_url;
        }
    } catch (error) {
        alert('Failed to initiate purchase: ' + error.message);
    }
};

/**
 * Create modal HTML
 */
function createModalHTML() {
    const modalHTML = `
        <div id="creditModal" class="modal credit-modal">
            <div class="modal-overlay" onclick="window.hideCreditModal()"></div>
            <div class="modal-content credit-modal-content">
                <button class="modal-close" onclick="window.hideCreditModal()" aria-label="Close">×</button>

                <div class="credit-modal-header">
                    <h2 id="creditModalTitle">💎 Buy More Credits</h2>
                    <p id="creditModalMessage">Choose a credit package to unlock more book generation power!</p>
                </div>

                <div id="creditPackagesContainer" class="credit-packages-grid">
                    <!-- Packages will be loaded here -->
                </div>

                <div class="credit-modal-footer">
                    <p class="text-muted">
                        <small>Secure checkout via Gumroad • Instant credit delivery • 30-day money-back guarantee</small>
                    </p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Export for global access
window.showCreditModal = showCreditModal;
window.hideCreditModal = hideCreditModal;
