/**
 * Email Capture Modal
 * Captures user email on first credit purchase for marketing
 */
import { api } from '../api/client.js';

let modalElement = null;
let hasShownModal = false;

/**
 * Initialize email capture modal
 */
export function initEmailCaptureModal() {
    // Check if already shown
    hasShownModal = localStorage.getItem('hasProvidedEmail') === 'true';

    // Create modal HTML if not exists
    if (!document.getElementById('emailCaptureModal')) {
        createModalHTML();
    }

    modalElement = document.getElementById('emailCaptureModal');
}

/**
 * Show email capture modal
 * Only shows once per user
 */
export function showEmailCaptureModal() {
    if (hasShownModal) {
        console.log('Email already captured, skipping modal');
        return;
    }

    if (!modalElement) {
        initEmailCaptureModal();
    }

    // Show modal with animation
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Hide email capture modal
 */
export function hideEmailCaptureModal() {
    if (modalElement) {
        modalElement.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Submit email
 */
async function submitEmail(event) {
    event.preventDefault();

    const emailInput = document.getElementById('captureEmail');
    const submitBtn = document.getElementById('emailSubmitBtn');
    const skipBtn = document.getElementById('emailSkipBtn');
    const errorDiv = document.getElementById('emailCaptureError');
    const errorText = document.getElementById('emailCaptureErrorText');

    const email = emailInput.value.trim();

    if (!email) {
        errorText.textContent = 'Please enter your email address';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorText.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Show loading
    submitBtn.disabled = true;
    skipBtn.disabled = true;
    errorDiv.classList.add('hidden');
    submitBtn.innerHTML = '<span class="loading"></span> Saving...';

    try {
        const response = await api.post('/api/users/update-email', { email });

        if (response.success) {
            console.log('✅ Email captured successfully');

            // Mark as shown
            localStorage.setItem('hasProvidedEmail', 'true');
            hasShownModal = true;

            // Show success message briefly
            submitBtn.innerHTML = '✓ Saved!';

            // Close modal after short delay
            setTimeout(() => {
                hideEmailCaptureModal();
            }, 1000);
        } else {
            throw new Error(response.error || 'Failed to save email');
        }
    } catch (error) {
        console.error('❌ Email capture failed:', error);
        errorText.textContent = error.message || 'Failed to save email. Please try again.';
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        skipBtn.disabled = false;
        submitBtn.innerHTML = 'Continue';
    }
}

/**
 * Skip email capture
 */
function skipEmailCapture() {
    // Mark as shown so it doesn't appear again
    localStorage.setItem('hasProvidedEmail', 'true');
    hasShownModal = true;
    hideEmailCaptureModal();
}

/**
 * Create modal HTML
 */
function createModalHTML() {
    const modalHTML = `
        <div id="emailCaptureModal" class="modal email-capture-modal">
            <div class="modal-overlay" onclick="window.skipEmailCapture()"></div>
            <div class="modal-content email-capture-content">
                <button class="modal-close" onclick="window.skipEmailCapture()" aria-label="Skip">×</button>

                <div class="email-capture-header">
                    <div class="email-capture-icon">📧</div>
                    <h2>Stay Updated!</h2>
                    <p>Get exclusive updates, tips, and special offers delivered to your inbox.</p>
                </div>

                <form id="emailCaptureForm" class="email-capture-form">
                    <div class="form-group">
                        <label for="captureEmail">Email Address</label>
                        <input
                            type="email"
                            id="captureEmail"
                            class="form-control"
                            placeholder="your@email.com"
                            required
                            autocomplete="email"
                        >
                    </div>

                    <div id="emailCaptureError" class="alert alert-error hidden">
                        <span>❌</span>
                        <span id="emailCaptureErrorText"></span>
                    </div>

                    <div class="email-capture-actions">
                        <button type="submit" class="btn btn-primary btn-block" id="emailSubmitBtn">
                            Continue
                        </button>
                        <button type="button" class="btn btn-text btn-sm" id="emailSkipBtn" onclick="window.skipEmailCapture()">
                            Skip for now
                        </button>
                    </div>
                </form>

                <p class="email-capture-footer">
                    <small>We respect your privacy. Unsubscribe anytime.</small>
                </p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add form submit handler
    const form = document.getElementById('emailCaptureForm');
    if (form) {
        form.addEventListener('submit', submitEmail);
    }
}

// Export for global access
window.showEmailCaptureModal = showEmailCaptureModal;
window.hideEmailCaptureModal = hideEmailCaptureModal;
window.skipEmailCapture = skipEmailCapture;
