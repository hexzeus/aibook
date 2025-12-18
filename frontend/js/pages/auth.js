/**
 * Authentication page logic
 */
import { storage } from '../utils/storage.js';
import { api } from '../api/client.js';

/**
 * Initialize auth handlers
 */
export function initAuth() {
    const form = document.getElementById('authForm');
    if (form) {
        form.addEventListener('submit', handleAuth);
    }

    // Populate saved license key (masked)
    populateSavedLicenseKey();

    // Add clear button handler
    const clearBtn = document.getElementById('clearLicenseBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSavedLicense);
    }
}

/**
 * Populate saved license key (masked for security)
 */
function populateSavedLicenseKey() {
    const savedLicense = storage.getLicenseKey();
    const licenseInput = document.getElementById('licenseKey');
    const clearBtn = document.getElementById('clearLicenseBtn');

    if (savedLicense && licenseInput) {
        // Mask the license key (show only last 4 characters)
        const maskedKey = maskLicenseKey(savedLicense);
        licenseInput.value = maskedKey;
        licenseInput.setAttribute('data-actual-key', savedLicense);
        licenseInput.setAttribute('data-is-masked', 'true');

        // Show clear button
        if (clearBtn) {
            clearBtn.style.display = 'block';
        }

        // When user focuses, reveal the full key if they want to edit
        licenseInput.addEventListener('focus', function() {
            if (this.getAttribute('data-is-masked') === 'true') {
                this.value = this.getAttribute('data-actual-key');
                this.removeAttribute('data-is-masked');
            }
        });

        // If they blur without changing, re-mask it
        licenseInput.addEventListener('blur', function() {
            const actualKey = this.getAttribute('data-actual-key');
            if (actualKey && this.value === actualKey) {
                this.value = maskLicenseKey(actualKey);
                this.setAttribute('data-is-masked', 'true');
            }
        });
    }
}

/**
 * Mask license key for display
 */
function maskLicenseKey(key) {
    if (!key || key.length < 8) {
        return '****************';
    }
    // Show last 4 characters
    const visiblePart = key.slice(-4);
    const maskedPart = '*'.repeat(Math.max(12, key.length - 4));
    return maskedPart + visiblePart;
}

/**
 * Clear saved license
 */
function clearSavedLicense(event) {
    event.preventDefault();

    const licenseInput = document.getElementById('licenseKey');
    const clearBtn = document.getElementById('clearLicenseBtn');

    // Clear the input
    licenseInput.value = '';
    licenseInput.removeAttribute('data-actual-key');
    licenseInput.removeAttribute('data-is-masked');
    licenseInput.focus();

    // Hide clear button
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }

    // Clear from storage
    storage.removeLicenseKey();
}

/**
 * Handle authentication
 */
async function handleAuth(event) {
    event.preventDefault();

    const licenseInput = document.getElementById('licenseKey');
    const authBtn = document.getElementById('authBtn');
    const authError = document.getElementById('authError');
    const authErrorText = document.getElementById('authErrorText');

    // Get the actual key (might be masked)
    let licenseKey = licenseInput.getAttribute('data-actual-key') || licenseInput.value.trim();

    if (!licenseKey) {
        showError('Please enter your license key');
        return;
    }

    // Show loading
    authBtn.disabled = true;
    authError.classList.add('hidden');
    authBtn.innerHTML = '<span class="loading"></span> Verifying...';

    try {
        // Save license key
        storage.setLicenseKey(licenseKey);

        // Validate with API
        const response = await api.getCredits();

        if (response.success) {
            console.log('✅ Login successful');

            // Update global state
            window.appState.credits = response.credits;
            window.appState.currentUser = {
                credits: response.credits,
                usage: response.usage
            };

            // Show main app
            window.showMainApp();
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('❌ Auth failed:', error);
        storage.removeLicenseKey();
        showError(error.message || 'Invalid license key');
    } finally {
        authBtn.disabled = false;
        authBtn.innerHTML = '<span id="authBtnText">Access Book Generator</span>';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const authError = document.getElementById('authError');
    const authErrorText = document.getElementById('authErrorText');

    authErrorText.textContent = message;
    authError.classList.remove('hidden');
}
