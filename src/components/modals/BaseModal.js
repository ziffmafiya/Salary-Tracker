/**
 * BaseModal — shared open/close logic for all modal dialogs.
 * Subclasses call super(modalId) and implement render() / _bindFormEvents().
 *
 * The backdrop click listener is wired once via an AbortController so it
 * can be cleanly removed when the modal is destroyed, preventing accumulation
 * of window listeners across multiple modal instances.
 */
import { el } from '../../utils/dom.js';

export class BaseModal {
    /**
     * @param {string} modalId  The HTML id of the modal element
     */
    constructor(modalId) {
        this.modalId  = modalId;
        this._element = el(modalId);

        // AbortController lets us remove the window listener without holding
        // a reference to the bound function.
        this._backdropController = new AbortController();

        // Wire close button
        const closeBtn = this._element.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Wire backdrop click — cleaned up via AbortController on destroy()
        window.addEventListener('click', (e) => {
            if (e.target === this._element) this.close();
        }, { signal: this._backdropController.signal });
    }

    /** Show the modal and scroll to top. */
    open() {
        this._element.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /** Hide the modal. */
    close() {
        this._element.style.display = 'none';
    }

    /**
     * Remove the backdrop listener. Call when the modal is permanently removed
     * from the page to prevent listener accumulation.
     */
    destroy() {
        this._backdropController.abort();
    }

    /** @returns {boolean} Whether the modal is currently visible. */
    get isOpen() {
        return this._element.style.display === 'block';
    }
}
