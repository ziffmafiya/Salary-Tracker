export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): T & { cancel(): void } {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function debounced(this: any, ...args: any[]) {
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

    return debounced as T & { cancel(): void };
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T {
    let lastCall = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    return function throttled(this: any, ...args: any[]) {
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
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    } as T;
}
