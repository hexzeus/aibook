/**
 * Premium Modal & Confirmation System
 */

class ModalManager {
    constructor() {
        this.activeModal = null;
    }

    confirm(options) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';

            const title = options.title || 'Confirm';
            const message = options.message || 'Are you sure?';
            const confirmText = options.confirmText || 'Confirm';
            const cancelText = options.cancelText || 'Cancel';
            const type = options.type || 'warning';

            modal.innerHTML = `
                <div class="modal-content modal-${type}">
                    <div class="modal-header">
                        <h3>${this.escapeHtml(title)}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${this.escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary modal-cancel">${this.escapeHtml(cancelText)}</button>
                        <button class="btn btn-primary modal-confirm">${this.escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            this.activeModal = modal;

            // Trigger animation
            requestAnimationFrame(() => {
                modal.classList.add('modal-show');
            });

            // Handle confirm
            const confirmBtn = modal.querySelector('.modal-confirm');
            confirmBtn.addEventListener('click', () => {
                this.close(modal);
                resolve(true);
            });

            // Handle cancel
            const cancelBtn = modal.querySelector('.modal-cancel');
            cancelBtn.addEventListener('click', () => {
                this.close(modal);
                resolve(false);
            });

            // Handle backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close(modal);
                    resolve(false);
                }
            });

            // Handle escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close(modal);
                    resolve(false);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            // Focus confirm button
            confirmBtn.focus();
        });
    }

    close(modal) {
        modal.classList.remove('modal-show');
        modal.classList.add('modal-hide');

        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            if (this.activeModal === modal) {
                this.activeModal = null;
            }
        }, 300);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create singleton instance
const modal = new ModalManager();

export { modal };
