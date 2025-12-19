/**
 * Subscription Management Page
 * Displays available plans and manages subscriptions
 */
import { api } from '../api/client.js';

let subscriptionData = null;
let availablePlans = [];

/**
 * Initialize subscriptions page
 */
export async function initSubscriptionsPage() {
    console.log('Loading subscriptions page...');

    const pageContent = document.getElementById('pageContent');
    pageContent.innerHTML = getLoadingHTML();

    try {
        // Fetch subscription data and available plans
        const [statusResponse, plansResponse] = await Promise.all([
            api.get('/api/subscriptions/status'),
            api.get('/api/subscriptions/plans')
        ]);

        if (statusResponse.success && plansResponse.success) {
            subscriptionData = statusResponse;
            availablePlans = plansResponse.plans;
            renderSubscriptionsPage();
        } else {
            throw new Error('Failed to load subscription data');
        }
    } catch (error) {
        console.error('Failed to load subscriptions page:', error);
        pageContent.innerHTML = getErrorHTML(error.message);
    }
}

/**
 * Render subscriptions page
 */
function renderSubscriptionsPage() {
    const pageContent = document.getElementById('pageContent');

    const html = `
        <div class="subscriptions-page">
            <div class="subscriptions-header">
                <h1 class="page-title">⭐ Subscription Plans</h1>
                <p class="page-subtitle">Get monthly credits automatically - never run out!</p>
            </div>

            <!-- Current Subscription Status -->
            ${subscriptionData.has_subscription ? `
                <div class="current-subscription card">
                    <div class="subscription-badge active">✓ Active</div>
                    <h2>Your Current Plan</h2>

                    <div class="subscription-details">
                        <div class="detail-row">
                            <span class="detail-label">Plan:</span>
                            <span class="detail-value">${subscriptionData.plan_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Monthly Credits:</span>
                            <span class="detail-value">${subscriptionData.monthly_credits} credits</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Next Reset:</span>
                            <span class="detail-value">${formatDate(subscriptionData.next_reset)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">
                                <span class="status-badge active">${subscriptionData.status}</span>
                            </span>
                        </div>
                    </div>

                    <div class="subscription-actions">
                        <button class="btn btn-secondary" onclick="window.manageBilling()">
                            Manage Billing
                        </button>
                        <button class="btn btn-text btn-danger" onclick="window.cancelSubscription()">
                            Cancel Subscription
                        </button>
                    </div>
                </div>
            ` : `
                <div class="alert alert-info">
                    <span>💡</span>
                    <div>
                        <p><strong>No Active Subscription</strong></p>
                        <p>Subscribe to get monthly credits automatically and save up to 40%!</p>
                    </div>
                </div>
            `}

            <!-- Available Plans -->
            <div class="plans-grid">
                ${availablePlans.map(plan => renderPlanCard(plan)).join('')}
            </div>

            <!-- Subscription Benefits -->
            <div class="subscription-benefits card">
                <h2>Why Subscribe?</h2>

                <div class="benefits-grid">
                    <div class="benefit">
                        <div class="benefit-icon">💰</div>
                        <h3>Save Money</h3>
                        <p>Get more credits for less compared to one-time purchases</p>
                    </div>

                    <div class="benefit">
                        <div class="benefit-icon">🔄</div>
                        <h3>Auto Renewal</h3>
                        <p>Never run out of credits - automatic monthly refresh</p>
                    </div>

                    <div class="benefit">
                        <div class="benefit-icon">⭐</div>
                        <h3>Premium Features</h3>
                        <p>Access exclusive features like AI illustrations and custom styles</p>
                    </div>

                    <div class="benefit">
                        <div class="benefit-icon">🎯</div>
                        <h3>Priority Support</h3>
                        <p>Get faster support and early access to new features</p>
                    </div>
                </div>
            </div>

            <!-- FAQ -->
            <div class="subscription-faq card">
                <h2>Frequently Asked Questions</h2>

                <div class="faq-list">
                    <div class="faq-item">
                        <h3>Can I cancel anytime?</h3>
                        <p>Yes! Cancel your subscription at any time. You'll keep your credits until the end of the billing period.</p>
                    </div>

                    <div class="faq-item">
                        <h3>What happens to unused credits?</h3>
                        <p>Unused credits don't roll over. You get a fresh allocation each month based on your plan.</p>
                    </div>

                    <div class="faq-item">
                        <h3>Can I upgrade or downgrade?</h3>
                        <p>Yes! You can change your plan at any time. Changes take effect on your next billing cycle.</p>
                    </div>

                    <div class="faq-item">
                        <h3>Do I need a subscription?</h3>
                        <p>No, you can always buy credits individually. Subscriptions are just more cost-effective for regular users.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;
}

/**
 * Render individual plan card
 */
function renderPlanCard(plan) {
    const isCurrentPlan = subscriptionData.has_subscription &&
                         subscriptionData.plan_name === plan.name;

    return `
        <div class="plan-card ${plan.is_featured ? 'featured' : ''} ${isCurrentPlan ? 'current' : ''}">
            ${plan.is_featured ? '<div class="plan-badge">Most Popular</div>' : ''}
            ${isCurrentPlan ? '<div class="plan-badge current">Current Plan</div>' : ''}

            <div class="plan-header">
                <h3>${plan.name}</h3>
                <div class="plan-price">
                    <span class="price-amount">${plan.price}</span>
                    <span class="price-period">/month</span>
                </div>
            </div>

            <div class="plan-features">
                <div class="plan-credits">
                    <strong>${plan.monthly_credits.toLocaleString()}</strong> credits/month
                </div>

                ${plan.savings_percent > 0 ? `
                    <div class="plan-savings">
                        Save ${plan.savings_percent}% vs. one-time purchase
                    </div>
                ` : ''}

                <ul class="plan-feature-list">
                    ${plan.features.map(feature => `
                        <li>✓ ${feature}</li>
                    `).join('')}
                </ul>
            </div>

            <button
                class="btn ${plan.is_featured ? 'btn-primary' : 'btn-secondary'} btn-block"
                onclick="window.subscribeToPlan('${plan.id}')"
                ${isCurrentPlan ? 'disabled' : ''}
            >
                ${isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
            </button>
        </div>
    `;
}

/**
 * Subscribe to a plan
 */
window.subscribeToPlan = async function(planId) {
    try {
        const response = await api.post('/api/subscriptions/subscribe', {
            plan_id: planId,
            provider: 'stripe' // Default to Stripe
        });

        if (response.success && response.checkout_url) {
            // Redirect to Stripe checkout
            window.location.href = response.checkout_url;
        } else {
            throw new Error(response.error || 'Failed to initiate subscription');
        }
    } catch (error) {
        alert('Failed to start subscription: ' + error.message);
    }
};

/**
 * Manage billing
 */
window.manageBilling = async function() {
    try {
        const response = await api.post('/api/subscriptions/manage-billing');

        if (response.success && response.portal_url) {
            // Redirect to Stripe billing portal
            window.location.href = response.portal_url;
        } else {
            throw new Error('Failed to access billing portal');
        }
    } catch (error) {
        alert('Failed to access billing: ' + error.message);
    }
};

/**
 * Cancel subscription
 */
window.cancelSubscription = async function() {
    const confirmed = confirm(
        'Are you sure you want to cancel your subscription?\n\n' +
        'You will keep your credits until the end of the current billing period.'
    );

    if (!confirmed) return;

    try {
        const response = await api.post('/api/subscriptions/cancel');

        if (response.success) {
            alert('✅ Subscription cancelled successfully. You can continue using your credits until the end of the billing period.');

            // Reload page to show updated status
            await initSubscriptionsPage();
        } else {
            throw new Error(response.error || 'Failed to cancel subscription');
        }
    } catch (error) {
        alert('Failed to cancel subscription: ' + error.message);
    }
};

/**
 * Format date helper
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Loading HTML
 */
function getLoadingHTML() {
    return `
        <div class="loading-container">
            <div class="spinner-large"></div>
            <p>Loading subscription plans...</p>
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
