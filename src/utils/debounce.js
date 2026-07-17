/**
 * Debounce & throttle utilities.
 */

/**
 * Returns a debounced version of fn that delays invocation until after
 * `wait` ms have elapsed since the last call.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} wait  delay in milliseconds
 * @returns {T & { cancel(): void }}
 */
export function debounce(fn, wait) {
    let timer = null;

    function debounced(...args) {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, wait);
    }

    debounced.cancel = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return debounced;
}

/**
 * Returns a throttled version of fn that invokes at most once per `limit` ms.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} limit  minimum interval in milliseconds
 * @returns {T}
 */
export function throttle(fn, limit) {
    let lastCall = 0;
    let timer    = null;

    return function throttled(...args) {
        const now = Date.now();
        const remaining = limit - (now - lastCall);

        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            lastCall = now;
            fn.apply(this, args);
        } else {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer    = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}
