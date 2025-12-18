/**
 * Create Book Page
 */
import { api } from '../api/client.js';
import { CONFIG } from '../config.js';
import { toast } from '../utils/toast.js';

export function initCreatePage() {
    const container = document.getElementById('pageContent');

    container.innerHTML = `
        <div class="page-header">
            <h1>Create New Book</h1>
            <p>Describe your book idea and let AI bring it to life</p>
        </div>

        <div class="create-form">
            <div class="form-group">
                <label for="bookDescription">Book Description</label>
                <textarea
                    id="bookDescription"
                    rows="6"
                    placeholder="Describe your book in detail. What is it about? Who is the target audience? What tone should it have?"
                    required
                ></textarea>
                <div class="form-hint">
                    Be specific! The more detail you provide, the better your book will be.
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="targetPages">Number of Pages</label>
                    <input
                        type="number"
                        id="targetPages"
                        min="${CONFIG.BOOK.MIN_PAGES}"
                        max="${CONFIG.BOOK.MAX_PAGES}"
                        value="${CONFIG.BOOK.DEFAULT_PAGES}"
                        required
                    >
                    <div class="form-hint">
                        ${CONFIG.BOOK.MIN_PAGES}-${CONFIG.BOOK.MAX_PAGES} pages
                    </div>
                </div>

                <div class="form-group">
                    <label for="bookType">Book Type</label>
                    <select id="bookType">
                        <option value="general">General</option>
                        <option value="kids">Kids</option>
                        <option value="educational">Educational</option>
                        <option value="adult">Adult</option>
                    </select>
                </div>
            </div>

            <div class="credit-estimate" id="creditEstimateBox">
                <div class="estimate-header">
                    <div class="estimate-label">💎 Cost to Create:</div>
                    <div class="estimate-value" id="creditEstimate">
                        ${CONFIG.CREDIT_COSTS.BOOK_CREATION} credits
                    </div>
                </div>
                <div class="estimate-breakdown" id="estimateBreakdown">
                    Book structure: ${CONFIG.CREDIT_COSTS.BOOK_STRUCTURE} + First page: ${CONFIG.CREDIT_COSTS.PAGE_GENERATION}
                </div>
                <div class="credit-warning" id="creditWarning" style="display: none;">
                    ⚠️ <span id="creditWarningText"></span>
                </div>
            </div>

            <div class="form-actions">
                <button id="createBookBtn" class="btn btn-primary" onclick="window.createBook()">
                    Create Book
                </button>
                <button class="btn btn-secondary" onclick="window.showCreditModal('purchase')" style="display: none;" id="buyCreditsBtn">
                    Buy More Credits
                </button>
            </div>
        </div>

        <div id="creationProgress" class="progress-container" style="display: none;">
            <div class="progress-content">
                <div class="spinner"></div>
                <h3>Creating your book...</h3>
                <p id="progressMessage">Generating book structure...</p>
            </div>
        </div>
    `;

    // Add event listener for page count changes
    const targetPagesInput = document.getElementById('targetPages');
    targetPagesInput.addEventListener('input', updateCreditEstimate);

    // Initial estimate
    updateCreditEstimate();
}

function updateCreditEstimate() {
    const targetPages = parseInt(document.getElementById('targetPages').value) || CONFIG.BOOK.DEFAULT_PAGES;
    const estimate = CONFIG.CREDIT_COSTS.BOOK_CREATION + (targetPages - 1) * CONFIG.CREDIT_COSTS.PAGE_GENERATION;

    document.getElementById('creditEstimate').textContent = `${estimate} credits`;
    document.getElementById('estimateBreakdown').textContent =
        `Structure: ${CONFIG.CREDIT_COSTS.BOOK_STRUCTURE} + First page: ${CONFIG.CREDIT_COSTS.PAGE_GENERATION} + Remaining ${targetPages - 1} pages: ${(targetPages - 1) * CONFIG.CREDIT_COSTS.PAGE_GENERATION}`;

    // Check user credits and show warnings
    const userCredits = window.appState?.credits?.remaining || 0;
    const createBtn = document.getElementById('createBookBtn');
    const buyCreditsBtn = document.getElementById('buyCreditsBtn');
    const creditWarning = document.getElementById('creditWarning');
    const creditWarningText = document.getElementById('creditWarningText');
    const creditBox = document.getElementById('creditEstimateBox');

    if (userCredits < estimate) {
        // Not enough credits
        createBtn.disabled = true;
        buyCreditsBtn.style.display = 'inline-flex';
        creditWarning.style.display = 'block';
        creditWarningText.textContent = `Insufficient credits! You have ${userCredits}, need ${estimate}.`;
        creditBox.classList.add('insufficient-credits');
    } else if (userCredits < estimate + 5) {
        // Running low
        createBtn.disabled = false;
        buyCreditsBtn.style.display = 'inline-flex';
        creditWarning.style.display = 'block';
        creditWarningText.textContent = `Running low! You have ${userCredits} credits remaining.`;
        creditBox.classList.add('low-credits');
        creditBox.classList.remove('insufficient-credits');
    } else {
        // Sufficient
        createBtn.disabled = false;
        buyCreditsBtn.style.display = 'none';
        creditWarning.style.display = 'none';
        creditBox.classList.remove('insufficient-credits', 'low-credits');
    }
}

window.createBook = async function() {
    const description = document.getElementById('bookDescription').value.trim();
    const targetPages = parseInt(document.getElementById('targetPages').value);
    const bookType = document.getElementById('bookType').value;

    if (!description) {
        toast.warning('Please enter a book description');
        return;
    }

    if (targetPages < CONFIG.BOOK.MIN_PAGES || targetPages > CONFIG.BOOK.MAX_PAGES) {
        toast.warning(`Number of pages must be between ${CONFIG.BOOK.MIN_PAGES} and ${CONFIG.BOOK.MAX_PAGES}`);
        return;
    }

    const btn = document.getElementById('createBookBtn');
    const progress = document.getElementById('creationProgress');
    const progressMsg = document.getElementById('progressMessage');

    try {
        btn.disabled = true;
        progress.style.display = 'flex';
        progressMsg.textContent = 'Generating book structure and first page...';

        const response = await api.createBook(description, targetPages, bookType);

        if (response.success) {
            progressMsg.textContent = 'Book created successfully!';

            // Update credits in global state
            if (window.appState) {
                window.appState.credits = response.credits;
                if (window.updateCreditsDisplay) {
                    window.updateCreditsDisplay();
                }
            }

            // Show success and redirect to library
            toast.success(`Book "${response.book.title}" created successfully!`);
            setTimeout(() => {
                if (window.showLibraryTab) {
                    window.showLibraryTab();
                }
            }, 1000);
        } else {
            throw new Error(response.error || 'Failed to create book');
        }
    } catch (error) {
        console.error('Error creating book:', error);
        toast.error('Error creating book: ' + error.message);
        progress.style.display = 'none';
    } finally {
        btn.disabled = false;
    }
};
