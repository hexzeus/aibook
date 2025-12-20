/**
 * Books Library Page
 */
import { api } from '../api/client.js';
import { CONFIG } from '../config.js';
import { toast } from '../utils/toast.js';
import { modal } from '../utils/modal.js';

let currentFilter = 'all';

export function initLibraryPage() {
    const container = document.getElementById('pageContent');

    container.innerHTML = `
        <div class="page-header">
            <h1>Your Books</h1>
            <div class="library-filters">
                <button class="filter-btn active" data-filter="all" onclick="window.filterBooks('all')">
                    All Books
                </button>
                <button class="filter-btn" data-filter="in-progress" onclick="window.filterBooks('in-progress')">
                    In Progress
                </button>
                <button class="filter-btn" data-filter="completed" onclick="window.filterBooks('completed')">
                    Completed
                </button>
            </div>
        </div>

        <div id="booksGrid" class="books-grid">
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading your books...</p>
            </div>
        </div>
    `;

    loadBooks('all');
}

window.filterBooks = function(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    loadBooks(filter);
};

async function loadBooks(filter) {
    const grid = document.getElementById('booksGrid');

    try {
        grid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading your books...</p>
            </div>
        `;

        let response;
        if (filter === 'in-progress') {
            response = await api.getInProgressBooks();
        } else if (filter === 'completed') {
            response = await api.getCompletedBooks();
        } else {
            response = await api.getBooks();
        }

        if (response.success) {
            console.log(`Loaded ${response.books.length} books for filter: ${filter}`);
            console.log('First book sample:', response.books[0]);
            displayBooks(response.books);
        } else {
            throw new Error('Failed to load books');
        }
    } catch (error) {
        console.error('Error loading books:', error);
        grid.innerHTML = `
            <div class="error-message">
                <p>Failed to load books: ${error.message}</p>
                <button class="btn btn-secondary" onclick="window.filterBooks('${filter}')">
                    Retry
                </button>
            </div>
        `;
    }
}

function displayBooks(books) {
    const grid = document.getElementById('booksGrid');

    if (books.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>No books yet</h3>
                <p>Create your first book to get started!</p>
                <button class="btn btn-primary" onclick="window.showCreateTab()">
                    Create Book
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = books.map(book => createBookCard(book)).join('');
}

function createBookCard(book) {
    // Handle different field names from different endpoints
    const pagesGenerated = book.pages_generated || book.page_count || 0;
    const totalPages = book.total_pages || book.target_pages || 0;
    const progress = totalPages > 0 ? (pagesGenerated / totalPages) * 100 : 0;
    const statusClass = book.status === 'completed' ? 'completed' : 'in-progress';
    const statusText = book.status === 'completed' ? 'Completed' : 'In Progress';
    const isCompleted = book.status === 'completed' || book.is_completed;

    // Debug: Log book data to see what we're getting
    if (isCompleted) {
        console.log('Completed book:', book.title, 'has cover_svg:', !!book.cover_svg);
    }

    return `
        <div class="book-card ${statusClass}" onclick="window.openBook('${book.book_id}')">
            ${isCompleted ? `
                <div class="book-card-cover">
                    ${book.cover_svg ?
                        (book.cover_svg.startsWith('data:image') ?
                            `<img src="${book.cover_svg}" alt="${escapeHtml(book.title)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);" />`
                            : book.cover_svg
                        ) : `
                        <div class="book-cover-placeholder">
                            <div class="placeholder-icon">📖</div>
                            <div class="placeholder-title">${escapeHtml(book.title)}</div>
                        </div>
                    `}
                </div>
            ` : ''}

            <div class="book-card-header">
                <h3>${escapeHtml(book.title)}</h3>
                <span class="book-status status-${book.status}">${statusText}</span>
            </div>

            <p class="book-description">${escapeHtml(book.description)}</p>

            ${!isCompleted ? `
                <div class="book-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">
                        ${pagesGenerated} / ${totalPages} pages
                    </div>
                </div>
            ` : `
                <div class="book-meta">
                    <span class="meta-item">
                        <span class="meta-icon">📄</span>
                        ${pagesGenerated} pages
                    </span>
                </div>
            `}

            <div class="book-meta">
                <span class="meta-item">
                    <span class="meta-icon">📅</span>
                    ${formatDate(book.created_at)}
                </span>
                <span class="meta-item">
                    <span class="meta-icon">📝</span>
                    ${book.book_type}
                </span>
            </div>

            <div class="book-actions">
                ${book.status === 'completed' ? `
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.exportBook('${book.book_id}', '${escapeHtml(book.title)}')">
                        📥 Export EPUB
                    </button>
                ` : `
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); window.openBook('${book.book_id}')">
                        ✏️ Continue Writing
                    </button>
                `}
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); window.deleteBook('${book.book_id}', '${escapeHtml(book.title)}')">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;
}

window.openBook = function(bookId) {
    if (window.showEditorTab) {
        window.showEditorTab(bookId);
    }
};

window.exportBook = async function(bookId, title) {
    try {
        const blob = await api.exportBook(bookId);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.epub`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Book exported successfully!');
    } catch (error) {
        console.error('Error exporting book:', error);
        toast.error('Failed to export book: ' + error.message);
    }
};

window.deleteBook = async function(bookId, title) {
    const confirmed = await modal.confirm({
        title: 'Delete Book?',
        message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'warning'
    });

    if (!confirmed) {
        return;
    }

    try {
        const response = await api.deleteBook(bookId);

        if (response.success) {
            toast.success('Book deleted successfully');
            // Reload the library by calling filterBooks with current filter
            window.filterBooks(currentFilter);
        } else {
            throw new Error('Failed to delete book');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        toast.error('Failed to delete book: ' + error.message);
    }
};

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
