import { el } from '../utils/dom.js';

export class Tooltip {
    private _tooltip: HTMLElement;

    constructor() {
        this._tooltip = el('tooltip');
        this._bind();
    }

    private _bind(): void {
        document.addEventListener('mouseover', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.tooltip-trigger') as HTMLElement | null;
            if (target && target.hasAttribute('data-tooltip')) {
                const text = target.getAttribute('data-tooltip')!;
                this._tooltip.textContent = text;
                this._tooltip.classList.add('show');
                this._tooltip.style.display = 'block';

                setTimeout(() => {
                    const rect        = target.getBoundingClientRect();
                    const ttRect      = this._tooltip.getBoundingClientRect();
                    let left = rect.left + window.scrollX + rect.width / 2 - ttRect.width / 2;
                    let top  = rect.top + window.scrollY - ttRect.height - 10;

                    if (left < 10) left = 10;
                    if (left + ttRect.width > window.innerWidth - 10) left = window.innerWidth - ttRect.width - 10;
                    if (top < 10) top = rect.bottom + window.scrollY + 10;

                    this._tooltip.style.left = `${left}px`;
                    this._tooltip.style.top  = `${top}px`;
                }, 10);
            }
        });

        document.addEventListener('mouseout', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.tooltip-trigger') as HTMLElement | null;
            if (!target || !e.relatedTarget || !target.contains(e.relatedTarget as Node)) {
                this._tooltip.classList.remove('show');
                setTimeout(() => {
                    if (!this._tooltip.classList.contains('show')) {
                        this._tooltip.style.display = 'none';
                    }
                }, 300);
            }
        });
    }
}
