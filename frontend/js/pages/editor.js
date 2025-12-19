/**
 * Book Editor Page
 */
import { api } from '../api/client.js';
import { CONFIG } from '../config.js';
import { toast } from '../utils/toast.js';
import { modal } from '../utils/modal.js';
import { showBookPreview } from '../components/bookPreview.js';

let currentBook = null;
let currentPage = 1;

export async function initEditorPage(bookId) {
    const container = document.getElementById('pageContent');

    container.innerHTML = `
        <div class="editor-loading">
            <div class="spinner"></div>
            <p>Loading book...</p>
        </div>
    `;

    try {
        const response = await api.getBook(bookId);

        if (response.success) {
            currentBook = response.book;
            renderEditor();
        } else {
            throw new Error('Failed to load book');
        }
    } catch (error) {
        console.error('Error loading book:', error);
        container.innerHTML = `
            <div class="error-message">
                <h3>Failed to load book</h3>
                <p>${error.message}</p>
                <button class="btn btn-secondary" onclick="window.showLibraryTab()">
                    Back to Library
                </button>
            </div>
        `;
    }
}

function renderCompletedBook() {
    const container = document.getElementById('pageContent');
    const pagesGenerated = currentBook.pages ? currentBook.pages.length : 0;
    const totalPages = currentBook.target_pages || 0;

    container.innerHTML = `
        <div class="completed-book-view">
            <div class="completed-header">
                <button class="btn btn-icon back-to-library-btn" title="Back to library">
                    ← Back to Library
                </button>
            </div>

            <div class="completed-content">
                <div class="book-cover-section">
                    ${currentBook.cover_svg ? `
                        <div class="book-cover-display">
                            ${currentBook.cover_svg}
                        </div>
                    ` : `
                        <div class="book-cover-placeholder">
                            <h2>${escapeHtml(currentBook.title)}</h2>
                        </div>
                    `}
                </div>

                <div class="book-info-section">
                    <h1>${escapeHtml(currentBook.title)}</h1>
                    <p class="book-description">${escapeHtml(currentBook.description || '')}</p>

                    <div class="book-stats">
                        <div class="stat-item">
                            <span class="stat-label">Pages:</span>
                            <span class="stat-value">${pagesGenerated}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Type:</span>
                            <span class="stat-value">${escapeHtml(currentBook.book_type || 'N/A')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Completed:</span>
                            <span class="stat-value">${new Date(currentBook.completed_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div class="completed-actions">
                        <button class="btn btn-primary btn-lg export-book-btn" data-book-id="${currentBook.book_id}">
                            📥 Download EPUB
                        </button>
                        <button class="btn btn-secondary view-pages-btn">
                            📖 View Pages
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners
    attachCompletedBookEventListeners();
}

/**
 * Attach event listeners for completed book view
 */
function attachCompletedBookEventListeners() {
    // Back to library button
    const backBtn = document.querySelector('.back-to-library-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Back button clicked from completed book - going to library');
            window.showLibraryTab();
        });
    }

    // Export book button - show preview first
    const exportBtn = document.querySelector('.export-book-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Show preview before export
            showBookPreview(currentBook);
        });
    }

    // View pages button
    const viewPagesBtn = document.querySelector('.view-pages-btn');
    if (viewPagesBtn) {
        viewPagesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.viewPages();
        });
    }
}

function renderEditor() {
    // If book is completed, show the completed book view
    if (currentBook.is_completed || currentBook.status === 'completed') {
        renderCompletedBook();
        return;
    }

    const container = document.getElementById('pageContent');
    const pagesGenerated = currentBook.pages ? currentBook.pages.length : 0;
    const totalPages = currentBook.target_pages || 0;
    const progress = totalPages > 0 ? (pagesGenerated / totalPages) * 100 : 0;

    container.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">
                <button class="btn btn-icon back-to-library-btn" title="Back to library">
                    ← Back
                </button>
                <div>
                    <h1>${escapeHtml(currentBook.title)}</h1>
                    <p class="book-subtitle">${escapeHtml(currentBook.description || '')}</p>
                </div>
            </div>
            <div class="editor-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">
                    ${pagesGenerated} / ${totalPages} pages completed
                </div>
            </div>
        </div>

        <div class="sidebar-overlay" id="sidebarOverlay"></div>

        <div class="editor-container">
            <div class="editor-sidebar" id="editorSidebar">
                <div class="pages-list">
                    <div class="pages-header">
                        <h3>Pages</h3>
                    </div>
                    <div id="pagesList"></div>
                </div>

                <!-- Premium Features Section -->
                <div class="premium-features-section">
                    <div class="premium-header">
                        <h3>⭐ Premium Features</h3>
                    </div>

                    <button class="premium-feature-btn" onclick="window.generateIllustration()">
                        <div class="feature-icon">🎨</div>
                        <div class="feature-info">
                            <div class="feature-name">AI Illustration</div>
                            <div class="feature-desc">Add custom images</div>
                        </div>
                    </button>

                    <button class="premium-feature-btn" onclick="window.applyCustomStyle()">
                        <div class="feature-icon">✨</div>
                        <div class="feature-info">
                            <div class="feature-name">Custom Style</div>
                            <div class="feature-desc">Apply writing style</div>
                        </div>
                    </button>

                    <button class="premium-feature-btn" onclick="window.bulkExport()">
                        <div class="feature-icon">📦</div>
                        <div class="feature-info">
                            <div class="feature-name">Bulk Export</div>
                            <div class="feature-desc">PDF, DOCX, TXT</div>
                        </div>
                    </button>
                </div>
            </div>

            <div class="editor-main">
                <div class="page-editor">
                    <div class="page-header">
                        <h2 id="pageTitle">Page 1</h2>
                        <div class="page-actions">
                            ${pagesGenerated < totalPages ? `
                                <button class="btn btn-primary generate-next-page-btn">
                                    ✨ Generate Next Page
                                </button>
                            ` : ''}
                            ${currentBook.status !== 'completed' && pagesGenerated === totalPages ? `
                                <button class="btn btn-success complete-book-btn">
                                    ✅ Complete Book
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div id="pageEditorContent" class="page-content">
                        <div class="empty-state">Select a page to view</div>
                    </div>

                    <div class="page-footer">
                        <button class="btn btn-secondary" id="savePageBtn" disabled>
                            💾 Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <button class="mobile-pages-toggle" title="View pages" aria-label="View pages">
            📖
        </button>
    `;

    // Attach event listeners with proper delegation
    attachEditorEventListeners();

    renderPagesList();

    if (currentBook.pages && currentBook.pages.length > 0) {
        displayPage(1);
    }
}

/**
 * Attach event listeners to editor elements
 */
function attachEditorEventListeners() {
    // Back to library button
    const backBtn = document.querySelector('.back-to-library-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Back button clicked from editor - going to library');
            window.showLibraryTab();
        });
    }

    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-pages-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.toggleMobileSidebar();
        });
    }

    // Sidebar overlay
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.toggleMobileSidebar();
        });
    }

    // Generate next page button
    const generateBtn = document.querySelector('.generate-next-page-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.generateNextPage();
        });
    }

    // Complete book button
    const completeBtn = document.querySelector('.complete-book-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.completeBook();
        });
    }

    // Save page button
    const saveBtn = document.getElementById('savePageBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.savePage();
        });
    }
}

function renderPagesList() {
    const pagesList = document.getElementById('pagesList');
    const pages = currentBook.pages || [];

    pagesList.innerHTML = pages.map((page, index) => `
        <div class="page-item ${currentPage === page.page_number ? 'active' : ''}"
             data-page-number="${page.page_number}">
            <div class="page-number">Page ${page.page_number}</div>
            <div class="page-preview">${escapeHtml(page.content.substring(0, 50))}...</div>
        </div>
    `).join('');

    // Add placeholder for next page
    const actualPageCount = pages.length;
    const totalPages = currentBook.target_pages || 0;
    if (actualPageCount < totalPages) {
        pagesList.innerHTML += `
            <div class="page-item page-placeholder">
                <div class="page-number">Page ${actualPageCount + 1}</div>
                <div class="page-preview">Not generated yet</div>
            </div>
        `;
    }

    // Attach click listeners to page items using event delegation
    pagesList.querySelectorAll('.page-item:not(.page-placeholder)').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pageNumber = parseInt(item.getAttribute('data-page-number'));
            window.displayPage(pageNumber);
        });
    });
}

window.displayPage = function(pageNumber) {
    currentPage = pageNumber;

    const page = currentBook.pages.find(p => p.page_number === pageNumber);
    const contentEl = document.getElementById('pageEditorContent');

    // Add subtle loading state
    contentEl.style.opacity = '0.5';

    // Use requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
        if (!page) {
            contentEl.innerHTML = `
                <div class="empty-state">Page ${pageNumber} has not been generated yet</div>
            `;
            contentEl.style.opacity = '1';
            return;
        }

        document.getElementById('pageTitle').textContent = `Page ${pageNumber}`;
        contentEl.innerHTML = `
            <textarea
                id="pageTextarea"
                rows="20"
                onInput="window.markPageDirty()"
            >${escapeHtml(page.content)}</textarea>
        `;

        // Restore opacity
        contentEl.style.opacity = '1';

        // Update active state in sidebar
        document.querySelectorAll('.page-item').forEach(item => {
            const itemPageNumber = parseInt(item.getAttribute('data-page-number'));
            item.classList.toggle('active', itemPageNumber === pageNumber);
        });

        const saveBtn = document.getElementById('savePageBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
        }

        // Close mobile sidebar after selecting a page
        const sidebar = document.getElementById('editorSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
};

window.markPageDirty = function() {
    document.getElementById('savePageBtn').disabled = false;
};

window.savePage = async function() {
    const content = document.getElementById('pageTextarea').value;

    try {
        const response = await api.updatePage(currentBook.book_id, currentPage, content);

        if (response.success) {
            // Update local data
            const page = currentBook.pages.find(p => p.page_number === currentPage);
            if (page) {
                page.content = content;
            }

            document.getElementById('savePageBtn').disabled = true;
            toast.success('Page saved successfully!');
        } else {
            throw new Error('Failed to save page');
        }
    } catch (error) {
        console.error('Error saving page:', error);
        toast.error('Failed to save page: ' + error.message);
    }
};

window.generateNextPage = async function() {
    // Use the actual count of pages, not current_page_count which may be stale
    const actualPageCount = currentBook.pages ? currentBook.pages.length : 0;
    const nextPageNumber = actualPageCount + 1;

    console.log('Generating page:', {
        book_id: currentBook.book_id,
        page_number: nextPageNumber,
        actual_page_count: actualPageCount,
        current_page_count: currentBook.current_page_count
    });

    const btn = event.target;
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.textContent = '⏳ Generating...';

        const response = await api.generatePage(currentBook.book_id, nextPageNumber);

        if (response.success) {
            // Reload book data
            const bookResponse = await api.getBook(currentBook.book_id);
            if (bookResponse.success) {
                currentBook = bookResponse.book;
                renderEditor();
                displayPage(nextPageNumber);

                // Update credits
                if (window.appState) {
                    window.appState.credits = response.credits;
                    if (window.updateCreditsDisplay) {
                        window.updateCreditsDisplay();
                    }
                }
            }
        } else {
            throw new Error(response.error || 'Failed to generate page');
        }
    } catch (error) {
        console.error('Error generating page:', error);
        console.error('Error details:', error.stack);
        toast.error('Failed to generate page: ' + (error.message || JSON.stringify(error)));
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

window.completeBook = async function() {
    const confirmed = await modal.confirm({
        title: 'Complete Book?',
        message: 'This will generate an AI cover for your book and mark it as completed (costs 2 credits). This may take 30-60 seconds.',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        type: 'warning'
    });

    if (!confirmed) {
        return;
    }

    // Show loading modal with premium styling
    const loadingModal = document.createElement('div');
    loadingModal.className = 'spinner-overlay';
    loadingModal.innerHTML = `
        <div class="spinner-content">
            <div style="font-size:3rem;margin-bottom:var(--spacing-lg);">🎨</div>
            <h3 style="margin:0 0 var(--spacing-sm) 0;font-family:var(--font-serif);color:var(--text-primary);">Generating Book Cover</h3>
            <p style="color:var(--text-secondary);margin:0 0 var(--spacing-xl) 0;font-family:var(--font-sans);">Claude is designing a professional cover for your book...</p>
            <div style="width:100%;height:6px;background:var(--bg-tertiary);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:100%;height:100%;background:linear-gradient(90deg,var(--primary),var(--primary-light));animation:loading 1.5s ease-in-out infinite;"></div>
            </div>
            <p style="color:var(--text-tertiary);font-size:var(--text-sm);margin:var(--spacing-lg) 0 0 0;font-family:var(--font-sans);">This usually takes 30-60 seconds</p>
        </div>
        <style>
            @keyframes loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        </style>
    `;
    document.body.appendChild(loadingModal);

    try {
        const response = await api.completeBook(currentBook.book_id);

        // Remove loading modal
        document.body.removeChild(loadingModal);

        if (response.success) {
            toast.success('Book completed successfully! You can now export it as an EPUB.');

            // Update credits
            if (window.appState) {
                window.appState.credits = response.credits;
                if (window.updateCreditsDisplay) {
                    window.updateCreditsDisplay();
                }
            }

            // Reload book
            const bookResponse = await api.getBook(currentBook.book_id);
            if (bookResponse.success) {
                currentBook = bookResponse.book;
                renderEditor();
            }
        } else {
            throw new Error(response.error || 'Failed to complete book');
        }
    } catch (error) {
        // Remove loading modal if still present
        if (loadingModal.parentNode) {
            document.body.removeChild(loadingModal);
        }
        console.error('Error completing book:', error);
        toast.error('Failed to complete book: ' + error.message);
    }
};

window.viewPages = function() {
    // Toggle between completed view and pages view
    const container = document.getElementById('pageContent');

    // Re-render the full editor (without the completed check)
    const pagesGenerated = currentBook.pages ? currentBook.pages.length : 0;
    const totalPages = currentBook.target_pages || 0;
    const progress = 100;

    container.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">
                <button class="btn btn-icon back-to-book-view-btn" title="Back to book view">
                    ← Back
                </button>
                <div>
                    <h1>${escapeHtml(currentBook.title)}</h1>
                    <p class="book-subtitle">Browse Pages</p>
                </div>
            </div>
        </div>

        <div class="sidebar-overlay" id="sidebarOverlay"></div>

        <div class="editor-container">
            <div class="editor-sidebar" id="editorSidebar">
                <div class="pages-list">
                    <div class="pages-header">
                        <h3>Pages</h3>
                    </div>
                    <div id="pagesList"></div>
                </div>

                <!-- Premium Features Section -->
                <div class="premium-features-section">
                    <div class="premium-header">
                        <h3>⭐ Premium Features</h3>
                    </div>

                    <button class="premium-feature-btn" onclick="window.generateIllustration()">
                        <div class="feature-icon">🎨</div>
                        <div class="feature-info">
                            <div class="feature-name">AI Illustration</div>
                            <div class="feature-desc">Add custom images</div>
                        </div>
                    </button>

                    <button class="premium-feature-btn" onclick="window.applyCustomStyle()">
                        <div class="feature-icon">✨</div>
                        <div class="feature-info">
                            <div class="feature-name">Custom Style</div>
                            <div class="feature-desc">Apply writing style</div>
                        </div>
                    </button>

                    <button class="premium-feature-btn" onclick="window.bulkExport()">
                        <div class="feature-icon">📦</div>
                        <div class="feature-info">
                            <div class="feature-name">Bulk Export</div>
                            <div class="feature-desc">PDF, DOCX, TXT</div>
                        </div>
                    </button>
                </div>
            </div>

            <div class="editor-main">
                <div class="page-editor">
                    <div class="page-header">
                        <h2 id="pageTitle">Page 1</h2>
                    </div>

                    <div id="pageEditorContent" class="page-content">
                        <div class="empty-state">Select a page to view</div>
                    </div>
                </div>
            </div>
        </div>

        <button class="mobile-pages-toggle" title="View pages" aria-label="View pages">
            📖
        </button>
    `;

    // Attach event listeners
    attachViewPagesEventListeners();

    renderPagesList();

    if (currentBook.pages && currentBook.pages.length > 0) {
        displayPage(1);
    }
};

/**
 * Attach event listeners for view pages mode
 */
function attachViewPagesEventListeners() {
    // Back to book view button
    const backBtn = document.querySelector('.back-to-book-view-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Back button clicked from view pages');
            // Go back to completed book view
            renderCompletedBook();
        });
    }

    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-pages-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.toggleMobileSidebar();
        });
    }

    // Sidebar overlay
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.toggleMobileSidebar();
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Toggle mobile sidebar for page navigation
 */
window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('editorSidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');

        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('mobile-open')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
};

/**
 * Premium Feature: Generate AI Illustration
 */
window.generateIllustration = async function() {
    const prompt = window.prompt('Describe the illustration you want to generate:');
    if (!prompt) return;

    try {
        const response = await api.post('/api/premium/generate-illustration', {
            book_id: currentBook.book_id,
            page_number: currentPage,
            prompt: prompt
        });

        if (response.success) {
            alert('✅ Illustration generated successfully!');
            // Refresh the current page to show the illustration
            await loadPage(currentPage);
        } else {
            throw new Error(response.error || 'Failed to generate illustration');
        }
    } catch (error) {
        alert('Failed to generate illustration: ' + error.message);
    }
};

/**
 * Premium Feature: Apply Custom Style
 */
window.applyCustomStyle = async function() {
    const style = window.prompt('Enter your custom writing style (e.g., "professional and formal", "casual and friendly"):');
    if (!style) return;

    try {
        const response = await api.post('/api/premium/apply-style', {
            book_id: currentBook.book_id,
            page_number: currentPage,
            style: style
        });

        if (response.success) {
            alert('✅ Custom style applied successfully!');
            // Refresh the current page to show styled content
            await loadPage(currentPage);
        } else {
            throw new Error(response.error || 'Failed to apply custom style');
        }
    } catch (error) {
        alert('Failed to apply custom style: ' + error.message);
    }
};

/**
 * Premium Feature: Bulk Export
 */
window.bulkExport = async function() {
    const formats = ['PDF', 'DOCX', 'TXT'];
    const selectedFormats = [];

    for (const format of formats) {
        if (confirm(`Include ${format} format?`)) {
            selectedFormats.push(format.toLowerCase());
        }
    }

    if (selectedFormats.length === 0) {
        alert('No formats selected');
        return;
    }

    try {
        const response = await api.post('/api/premium/bulk-export', {
            book_id: currentBook.book_id,
            formats: selectedFormats
        });

        if (response.success && response.download_urls) {
            alert('✅ Bulk export started! Download links:\n\n' +
                Object.entries(response.download_urls)
                    .map(([format, url]) => `${format.toUpperCase()}: ${url}`)
                    .join('\n')
            );
        } else {
            throw new Error(response.error || 'Failed to export');
        }
    } catch (error) {
        alert('Failed to bulk export: ' + error.message);
    }
};
