/**
 * Book Preview Component
 * Shows EPUB preview before export
 */
import { api } from '../api/client.js';

/**
 * Show book preview modal
 */
export async function showBookPreview(book) {
    const modal = createPreviewModal(book);
    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

/**
 * Create preview modal
 */
function createPreviewModal(book) {
    const modal = document.createElement('div');
    modal.id = 'bookPreviewModal';
    modal.className = 'modal book-preview-modal';

    const pages = book.pages || [];
    const pageCount = pages.length;

    modal.innerHTML = `
        <div class="modal-overlay" onclick="window.closeBookPreview()"></div>
        <div class="modal-content book-preview-content">
            <button class="modal-close" onclick="window.closeBookPreview()" aria-label="Close">×</button>

            <div class="preview-header">
                <div class="preview-cover">
                    ${book.cover_svg || '<div class="cover-placeholder">📚</div>'}
                </div>
                <div class="preview-info">
                    <h2>${book.title}</h2>
                    ${book.subtitle ? `<p class="subtitle">${book.subtitle}</p>` : ''}
                    <div class="preview-meta">
                        <span>📄 ${pageCount} pages</span>
                        <span>✍️ ${book.author_name || 'AI Book Generator'}</span>
                        ${book.genre ? `<span>📚 ${book.genre}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="preview-body">
                <div class="preview-tabs">
                    <button class="preview-tab active" onclick="window.switchPreviewTab('pages')">
                        Pages (${pageCount})
                    </button>
                    <button class="preview-tab" onclick="window.switchPreviewTab('metadata')">
                        Book Info
                    </button>
                </div>

                <div class="preview-content-pages" id="previewPagesTab">
                    <div class="pages-list">
                        ${renderPagesList(pages)}
                    </div>
                </div>

                <div class="preview-content-metadata hidden" id="previewMetadataTab">
                    <div class="metadata-grid">
                        <div class="metadata-item">
                            <label>Title:</label>
                            <span>${book.title}</span>
                        </div>
                        ${book.subtitle ? `
                        <div class="metadata-item">
                            <label>Subtitle:</label>
                            <span>${book.subtitle}</span>
                        </div>
                        ` : ''}
                        <div class="metadata-item">
                            <label>Author:</label>
                            <span>${book.author_name || 'AI Book Generator'}</span>
                        </div>
                        <div class="metadata-item">
                            <label>Type:</label>
                            <span>${book.book_type}</span>
                        </div>
                        ${book.genre ? `
                        <div class="metadata-item">
                            <label>Genre:</label>
                            <span>${book.genre}</span>
                        </div>
                        ` : ''}
                        <div class="metadata-item">
                            <label>Language:</label>
                            <span>${book.language || 'en'}</span>
                        </div>
                        <div class="metadata-item">
                            <label>Created:</label>
                            <span>${new Date(book.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="metadata-item">
                            <label>Status:</label>
                            <span class="status-badge">${book.is_completed ? 'Completed' : 'In Progress'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="preview-footer">
                <button class="btn btn-secondary" onclick="window.closeBookPreview()">
                    Close Preview
                </button>
                <button class="btn btn-primary" onclick="window.confirmExport('${book.book_id}', '${book.title}')">
                    💎 Export to EPUB (1 credit)
                </button>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Render pages list
 */
function renderPagesList(pages) {
    if (!pages || pages.length === 0) {
        return '<p class="no-pages">No pages generated yet.</p>';
    }

    return pages.map((page, index) => `
        <div class="preview-page-card">
            <div class="page-header">
                <span class="page-number">Page ${index + 1}</span>
                ${page.is_generated ? '<span class="page-status">✅ Generated</span>' : '<span class="page-status pending">⏳ Pending</span>'}
            </div>
            <div class="page-content">
                ${page.content ? page.content.substring(0, 200) + (page.content.length > 200 ? '...' : '') : 'No content'}
            </div>
        </div>
    `).join('');
}

/**
 * Switch preview tabs
 */
window.switchPreviewTab = function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.preview-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tabName));
    });

    // Show/hide content
    document.getElementById('previewPagesTab').classList.toggle('hidden', tabName !== 'pages');
    document.getElementById('previewMetadataTab').classList.toggle('hidden', tabName !== 'metadata');
};

/**
 * Close preview
 */
window.closeBookPreview = function() {
    const modal = document.getElementById('bookPreviewModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
};

/**
 * Confirm export from preview
 */
window.confirmExport = async function(bookId, bookTitle) {
    window.closeBookPreview();
    // Call the existing export function
    if (window.exportBook) {
        await window.exportBook(bookId, bookTitle);
    }
};
