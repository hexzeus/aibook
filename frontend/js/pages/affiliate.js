/**
 * Affiliate Dashboard Page
 * Shows affiliate stats, code, and earnings
 */
import { api } from '../api/client.js';

let affiliateData = null;

/**
 * Initialize affiliate page
 */
export async function initAffiliatePage() {
    console.log('Loading affiliate page...');

    const pageContent = document.getElementById('pageContent');
    pageContent.innerHTML = getLoadingHTML();

    try {
        // Fetch affiliate data
        const response = await api.get('/api/affiliate/stats');

        if (response.success) {
            affiliateData = response;
            renderAffiliatePage();
        } else {
            throw new Error('Failed to load affiliate data');
        }
    } catch (error) {
        console.error('Failed to load affiliate page:', error);
        pageContent.innerHTML = getErrorHTML(error.message);
    }
}

/**
 * Render affiliate dashboard
 */
function renderAffiliatePage() {
    const pageContent = document.getElementById('pageContent');

    const html = `
        <div class="affiliate-page">
            <div class="affiliate-header">
                <h1 class="page-title">💰 Affiliate Program</h1>
                <p class="page-subtitle">Earn 30% commission on every referral!</p>
            </div>

            <!-- Stats Grid -->
            <div class="affiliate-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <div class="stat-value">${affiliateData.total_referrals || 0}</div>
                        <div class="stat-label">Total Referrals</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon">💵</div>
                    <div class="stat-info">
                        <div class="stat-value">$${((affiliateData.total_earnings_cents || 0) / 100).toFixed(2)}</div>
                        <div class="stat-label">Total Earnings</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon">⏳</div>
                    <div class="stat-info">
                        <div class="stat-value">$${((affiliateData.pending_payout_cents || 0) / 100).toFixed(2)}</div>
                        <div class="stat-label">Pending Payout</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <div class="stat-value">$${((affiliateData.paid_out_cents || 0) / 100).toFixed(2)}</div>
                        <div class="stat-label">Paid Out</div>
                    </div>
                </div>
            </div>

            <!-- Affiliate Code Section -->
            <div class="affiliate-code-section card">
                <h2>Your Affiliate Link</h2>
                <p class="text-muted">Share this link to earn 30% commission on all purchases!</p>

                ${affiliateData.affiliate_code ? `
                    <div class="affiliate-code-display">
                        <div class="code-box">
                            <code id="affiliateLink">${getAffiliateLink(affiliateData.affiliate_code)}</code>
                        </div>
                        <button class="btn btn-primary" onclick="window.copyAffiliateLink()">
                            📋 Copy Link
                        </button>
                    </div>

                    <div class="affiliate-code-alt">
                        <p><strong>Affiliate Code:</strong> <code>${affiliateData.affiliate_code}</code></p>
                    </div>
                ` : `
                    <div class="alert alert-info">
                        <span>ℹ️</span>
                        <div>
                            <p><strong>Get Your Affiliate Link</strong></p>
                            <p>Generate your unique affiliate code to start earning commissions!</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="window.generateAffiliateCode()">
                        Generate Affiliate Code
                    </button>
                `}
            </div>

            <!-- Payout Email Section -->
            ${affiliateData.affiliate_code ? `
                <div class="affiliate-payout-section card">
                    <h2>Payout Settings</h2>
                    <p class="text-muted">Where should we send your affiliate earnings?</p>

                    <form id="affiliatePayoutForm" class="affiliate-payout-form">
                        <div class="form-group">
                            <label for="payoutEmail">PayPal Email</label>
                            <input
                                type="email"
                                id="payoutEmail"
                                class="form-control"
                                placeholder="your@paypal.com"
                                value="${affiliateData.payout_email || ''}"
                            >
                            <p class="form-hint">We send payouts monthly via PayPal (minimum $50)</p>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            Save Payout Email
                        </button>
                    </form>

                    <div id="payoutSuccess" class="alert alert-success hidden mt-2">
                        <span>✅</span>
                        <span>Payout email saved successfully!</span>
                    </div>

                    <div id="payoutError" class="alert alert-error hidden mt-2">
                        <span>❌</span>
                        <span id="payoutErrorText"></span>
                    </div>
                </div>
            ` : ''}

            <!-- How It Works -->
            <div class="affiliate-how-it-works card">
                <h2>How It Works</h2>

                <div class="how-it-works-steps">
                    <div class="step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h3>Share Your Link</h3>
                            <p>Share your unique affiliate link on social media, your website, or with friends.</p>
                        </div>
                    </div>

                    <div class="step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h3>People Purchase</h3>
                            <p>When someone uses your link to purchase credits or a subscription, you earn 30%.</p>
                        </div>
                    </div>

                    <div class="step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h3>Get Paid</h3>
                            <p>Receive monthly payouts via PayPal once you reach the $50 minimum threshold.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Referrals -->
            ${affiliateData.recent_referrals && affiliateData.recent_referrals.length > 0 ? `
                <div class="affiliate-referrals card">
                    <h2>Recent Referrals</h2>

                    <div class="referrals-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${affiliateData.recent_referrals.map(ref => `
                                    <tr>
                                        <td>${formatDate(ref.date)}</td>
                                        <td><span class="status-badge ${ref.status}">${ref.status}</span></td>
                                        <td>$${(ref.earnings_cents / 100).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    pageContent.innerHTML = html;

    // Add form handler if payout section exists
    const payoutForm = document.getElementById('affiliatePayoutForm');
    if (payoutForm) {
        payoutForm.addEventListener('submit', handlePayoutEmailSubmit);
    }
}

/**
 * Get affiliate link
 */
function getAffiliateLink(code) {
    return `${window.location.origin}?ref=${code}`;
}

/**
 * Copy affiliate link
 */
window.copyAffiliateLink = async function() {
    const linkEl = document.getElementById('affiliateLink');
    const link = linkEl.textContent;

    try {
        await navigator.clipboard.writeText(link);
        alert('✅ Affiliate link copied to clipboard!');
    } catch (error) {
        // Fallback for older browsers
        linkEl.select();
        document.execCommand('copy');
        alert('✅ Affiliate link copied to clipboard!');
    }
};

/**
 * Generate affiliate code
 */
window.generateAffiliateCode = async function() {
    try {
        const response = await api.post('/api/affiliate/generate-code');

        if (response.success) {
            // Reload page to show new code
            await initAffiliatePage();
        } else {
            throw new Error(response.error || 'Failed to generate code');
        }
    } catch (error) {
        alert('Failed to generate affiliate code: ' + error.message);
    }
};

/**
 * Handle payout email submit
 */
async function handlePayoutEmailSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('payoutEmail');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const successDiv = document.getElementById('payoutSuccess');
    const errorDiv = document.getElementById('payoutError');
    const errorText = document.getElementById('payoutErrorText');

    const email = emailInput.value.trim();

    if (!email) {
        errorText.textContent = 'Please enter a PayPal email address';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Saving...';
    successDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const response = await api.post('/api/affiliate/update-payout-email', { email });

        if (response.success) {
            successDiv.classList.remove('hidden');
            setTimeout(() => successDiv.classList.add('hidden'), 3000);
        } else {
            throw new Error(response.error || 'Failed to save email');
        }
    } catch (error) {
        errorText.textContent = error.message;
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Payout Email';
    }
}

/**
 * Format date helper
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Loading HTML
 */
function getLoadingHTML() {
    return `
        <div class="loading-container">
            <div class="spinner-large"></div>
            <p>Loading affiliate dashboard...</p>
        </div>
    `;
}

/**
 * Error HTML
 */
function getErrorHTML(message) {
    return `
        <div class="error-container">
            <div class="alert alert-error">
                <span>❌</span>
                <span>${message}</span>
            </div>
        </div>
    `;
}
