/**
 * API client for backend communication
 */
import { CONFIG } from '../config.js';
import { storage } from '../utils/storage.js';

class APIClient {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
    }

    /**
     * Get authorization headers
     */
    getHeaders() {
        const licenseKey = storage.getLicenseKey();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${licenseKey || ''}`
        };
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        if (response.ok) {
            // Handle binary responses (like EPUB downloads)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/epub')) {
                return response.blob();
            }
            return response.json();
        }

        // Handle errors
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.detail || 'Request failed');
    }

    /**
     * Make GET request
     */
    async get(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    }

    /**
     * Make POST request
     */
    async post(endpoint, data) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    }

    /**
     * Make PUT request
     */
    async put(endpoint, data) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    }

    /**
     * Make DELETE request
     */
    async delete(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    }

    // Specific API methods

    /**
     * Get user credits
     */
    async getCredits() {
        return this.get('/api/credits');
    }

    /**
     * Create new book
     */
    async createBook(description, targetPages, bookType) {
        return this.post('/api/books', {
            description,
            target_pages: targetPages,
            book_type: bookType
        });
    }

    /**
     * Generate next page
     */
    async generatePage(bookId, pageNumber, userInput = null) {
        return this.post('/api/books/generate-page', {
            book_id: bookId,
            page_number: pageNumber,
            user_input: userInput
        });
    }

    /**
     * Update page content
     */
    async updatePage(bookId, pageNumber, content) {
        return this.put('/api/books/update-page', {
            book_id: bookId,
            page_number: pageNumber,
            content
        });
    }

    /**
     * Get all books
     */
    async getBooks(limit = 50, offset = 0) {
        return this.get(`/api/books?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get in-progress books
     */
    async getInProgressBooks(limit = 50, offset = 0) {
        return this.get(`/api/books/in-progress?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get completed books
     */
    async getCompletedBooks(limit = 50, offset = 0) {
        return this.get(`/api/books/completed?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get single book
     */
    async getBook(bookId) {
        return this.get(`/api/books/${bookId}`);
    }

    /**
     * Delete book
     */
    async deleteBook(bookId) {
        return this.delete(`/api/books/${bookId}`);
    }

    /**
     * Complete book (generate cover)
     */
    async completeBook(bookId) {
        return this.post('/api/books/complete', {
            book_id: bookId
        });
    }

    /**
     * Export book to EPUB
     */
    async exportBook(bookId) {
        const response = await fetch(`${this.baseURL}/api/books/export`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ book_id: bookId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }

        return response.blob();
    }
}

export const api = new APIClient();
