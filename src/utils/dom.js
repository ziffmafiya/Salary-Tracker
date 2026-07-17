/**
 * DOM utility helpers — eliminates repeated document.getElementById() calls.
 *
 * DOMCache caches element lookups so repeated calls to el() never hit the DOM
 * more than once per element. Call domCache.invalidate(id) when elements are
 * dynamically added/removed.
 */

class DOMCacheClass {
    constructor() {
        /** @type {Map<string, HTMLElement>} */
        this._cache = new Map();
    }

    /**
     * Get an element by ID, using the cache.
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    get(id) {
        if (this._cache.has(id)) return this._cache.get(id);

        const element = document.getElementById(id);
        if (!element) {
            console.warn(`DOMCache: element #${id} not found`);
            return null;
        }

        this._cache.set(id, element);
        return element;
    }

    /**
     * Remove a cached entry — use after dynamic DOM mutations.
     * @param {string} id
     */
    invalidate(id) {
        this._cache.delete(id);
    }

    /** Clear the entire cache. */
    clear() {
        this._cache.clear();
    }
}

/** Singleton DOM cache used by the el() helper and all components. */
export const domCache = new DOMCacheClass();

/**
 * Shorthand for cached getElementById. Throws if element is missing.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function el(id) {
    const element = domCache.get(id);
    if (!element) throw new Error(`Element #${id} not found in DOM`);
    return element;
}

/**
 * Query selector scoped to an optional root (defaults to document).
 * Not cached — used for selectors that can't be addressed by ID.
 * @param {string} selector
 * @param {Element|Document} [root=document]
 * @returns {HTMLElement|null}
 */
export function qs(selector, root = document) {
    return root.querySelector(selector);
}

/**
 * Query selector all, scoped to an optional root.
 * @param {string} selector
 * @param {Element|Document} [root=document]
 * @returns {NodeList}
 */
export function qsa(selector, root = document) {
    return root.querySelectorAll(selector);
}

/**
 * Create a DOM element with optional class name and inner HTML/text.
 * @param {string} tag
 * @param {Object} [opts]
 * @param {string} [opts.className]
 * @param {string} [opts.innerHTML]
 * @param {string} [opts.textContent]
 * @returns {HTMLElement}
 */
export function createElement(tag, opts = {}) {
    const elem = document.createElement(tag);
    if (opts.className)              elem.className   = opts.className;
    if (opts.innerHTML !== undefined) elem.innerHTML   = opts.innerHTML;
    if (opts.textContent !== undefined) elem.textContent = opts.textContent;
    return elem;
}
