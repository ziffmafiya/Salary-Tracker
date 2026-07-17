/**
 * BaseModal — shared open/close logic for all modal dialogs.
 * Subclasses call super(modalId) and implement render() / _bindFormEvents().
 */
import { el } from '../../utils/dom.js';

export class BaseModal {
    /**
     * @param {string} modalId  The HTML id of the modal element
     */
    constructor(modalId) {
        this.modalId  = modalId;
        this._element = el(modalId);

        // Wire close button
        const closeBtn = this._element.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Wire backdrop click
        window.addEventListener('click', (e) => {
            if (e.target === this._element) this.close();
        });
    }

    /** Show the modal. */
    open() {
        this._element.style.display = 'block';
    }

    /** Hide the modal. */
    close() {
        this._element.style.display = 'none';
    }

    /** @returns {boolean} Whether the modal is currently visible. */
    get isOpen() {
        return this._element.style.display === 'block';
    }
}
