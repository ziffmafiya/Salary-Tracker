class DOMCacheClass {
    private _cache = new Map<string, HTMLElement>();

    get(id: string): HTMLElement | null {
        if (this._cache.has(id)) return this._cache.get(id) as HTMLElement;

        const element = document.getElementById(id);
        if (!element) {
            console.warn(`DOMCache: element #${id} not found`);
            return null;
        }

        this._cache.set(id, element);
        return element;
    }

    invalidate(id: string): void {
        this._cache.delete(id);
    }

    clear(): void {
        this._cache.clear();
    }
}

export const domCache = new DOMCacheClass();

export function el(id: string): HTMLElement {
    const element = domCache.get(id);
    if (!element) throw new Error(`Element #${id} not found in DOM`);
    return element;
}

export function qs(selector: string, root: Element | Document = document): HTMLElement | null {
    return root.querySelector(selector);
}

export function qsa(selector: string, root: Element | Document = document): NodeListOf<HTMLElement> {
    return root.querySelectorAll(selector);
}

interface CreateElementOpts {
    className?: string;
    innerHTML?: string;
    textContent?: string;
}

export function createElement(tag: string, opts: CreateElementOpts = {}): HTMLElement {
    const elem = document.createElement(tag);
    if (opts.className)              elem.className   = opts.className;
    if (opts.innerHTML !== undefined) elem.innerHTML   = opts.innerHTML;
    if (opts.textContent !== undefined) elem.textContent = opts.textContent;
    return elem;
}
