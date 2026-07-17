import { el } from '../../utils/dom.js';

export class BaseModal {
    protected modalId: string;
    protected _element: HTMLElement;
    private _backdropController: AbortController;

    constructor(modalId: string) {
        this.modalId  = modalId;
        this._element = el(modalId);
        this._backdropController = new AbortController();

        const closeBtn = this._element.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        window.addEventListener('click', (e: MouseEvent) => {
            if (e.target === this._element) this.close();
        }, { signal: this._backdropController.signal });
    }

    open(): void {
        this._element.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    close(): void {
        this._element.style.display = 'none';
    }

    destroy(): void {
        this._backdropController.abort();
    }

    get isOpen(): boolean {
        return this._element.style.display === 'block';
    }
}
