/**
 * Onboarding Flow for New Users
 * Guides users through their first book creation
 */

let currentStep = 0;
const ONBOARDING_KEY = 'aibook_onboarding_completed';

/**
 * Check if user needs onboarding
 */
export function shouldShowOnboarding() {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    const hasBooks = window.appState?.currentUser?.total_books_created > 0;

    return !completed && !hasBooks;
}

/**
 * Start onboarding flow
 */
export function startOnboarding() {
    currentStep = 0;
    createOnboardingOverlay();
    showStep(0);
}

/**
 * Create onboarding overlay
 */
function createOnboardingOverlay() {
    const overlayHTML = `
        <div id="onboardingOverlay" class="onboarding-overlay">
            <div class="onboarding-backdrop"></div>
            <div class="onboarding-spotlight" id="onboardingSpotlight"></div>
            <div class="onboarding-tooltip" id="onboardingTooltip">
                <div class="tooltip-content">
                    <h3 id="tooltipTitle"></h3>
                    <p id="tooltipMessage"></p>
                    <div class="tooltip-actions">
                        <button class="btn btn-secondary btn-sm" onclick="window.skipOnboarding()">
                            Skip Tour
                        </button>
                        <div class="tooltip-nav">
                            <span id="tooltipStep">1 of 5</span>
                            <button class="btn btn-primary btn-sm" onclick="window.nextOnboardingStep()">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

/**
 * Onboarding steps
 */
const STEPS = [
    {
        title: "Welcome to AI Book Generator! 📚",
        message: "Let's take a quick tour to help you create your first amazing book. This will only take 30 seconds!",
        target: null,
        position: 'center'
    },
    {
        title: "Your Credits 💎",
        message: "These are your credits. Each action (creating books, generating pages, exporting) costs credits. You start with 1000 credits!",
        target: '.credits-display',
        position: 'bottom'
    },
    {
        title: "Describe Your Book ✍️",
        message: "Start by describing your book idea in detail. The more specific you are, the better your book will be!",
        target: '#bookDescription',
        position: 'right'
    },
    {
        title: "Set Your Pages 📄",
        message: "Choose how many pages you want. The credit cost updates automatically as you change this number.",
        target: '#targetPages',
        position: 'right'
    },
    {
        title: "Create Your First Book! 🚀",
        message: "When you're ready, click here to generate your book. AI will create the structure and first page instantly!",
        target: '#createBookBtn',
        position: 'top'
    }
];

/**
 * Show specific step
 */
function showStep(stepIndex) {
    if (stepIndex >= STEPS.length) {
        completeOnboarding();
        return;
    }

    const step = STEPS[stepIndex];
    const tooltip = document.getElementById('onboardingTooltip');
    const spotlight = document.getElementById('onboardingSpotlight');

    // Update tooltip content
    document.getElementById('tooltipTitle').textContent = step.title;
    document.getElementById('tooltipMessage').textContent = step.message;
    document.getElementById('tooltipStep').textContent = `${stepIndex + 1} of ${STEPS.length}`;

    // Update button text
    const nextBtn = document.querySelector('.tooltip-nav .btn-primary');
    nextBtn.textContent = stepIndex === STEPS.length - 1 ? 'Get Started!' : 'Next';

    if (step.target) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            // Position spotlight
            const rect = targetEl.getBoundingClientRect();
            spotlight.style.left = rect.left - 10 + 'px';
            spotlight.style.top = rect.top - 10 + 'px';
            spotlight.style.width = rect.width + 20 + 'px';
            spotlight.style.height = rect.height + 20 + 'px';
            spotlight.style.display = 'block';

            // Position tooltip
            positionTooltip(tooltip, rect, step.position);

            // Scroll element into view
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        // Center position for intro
        spotlight.style.display = 'none';
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
    }

    currentStep = stepIndex;
}

/**
 * Position tooltip relative to target
 */
function positionTooltip(tooltip, targetRect, position) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 20;

    let top, left;

    switch (position) {
        case 'top':
            top = targetRect.top - tooltipRect.height - margin;
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            break;
        case 'bottom':
            top = targetRect.bottom + margin;
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            break;
        case 'left':
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            left = targetRect.left - tooltipRect.width - margin;
            break;
        case 'right':
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            left = targetRect.right + margin;
            break;
        default:
            top = targetRect.bottom + margin;
            left = targetRect.left;
    }

    // Keep within viewport
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.transform = 'none';
}

/**
 * Next step
 */
window.nextOnboardingStep = function() {
    showStep(currentStep + 1);
};

/**
 * Skip onboarding
 */
window.skipOnboarding = function() {
    if (confirm('Are you sure you want to skip the quick tour?')) {
        completeOnboarding();
    }
};

/**
 * Complete onboarding
 */
function completeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, 'true');

    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Reset onboarding (for testing)
 */
window.resetOnboarding = function() {
    localStorage.removeItem(ONBOARDING_KEY);
    console.log('Onboarding reset. Reload page to see it again.');
};
