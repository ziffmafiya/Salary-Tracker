/**
 * MemoizedFilter — caches results of filterEntries() calls.
 *
 * Cache key is derived from:
 *   - a checksum over all entry salary+hours values (detects edits within
 *     the same-length array — fixes the stale-data bug where entries.length
 *     alone could not distinguish a salary edit from an unchanged state)
 *   - serialised analytics settings (period + includedJobs + date range)
 *
 * The cache is bounded to MAX_SIZE entries; the oldest entry is evicted
 * when the limit is exceeded (simple FIFO via insertion order of Map).
 *
 * Call .invalidate() whenever entries or jobs are mutated so stale
 * results are never returned.
 */

const MAX_SIZE = 50;

export class MemoizedFilter {
    constructor() {
        /** @type {Map<string, any[]>} */
        this._cache = new Map();
    }

    /**
     * Return cached result for the given inputs, or compute and cache it.
     *
     * @param {any[]}    entries
     * @param {Object}   settings   analytics settings object
     * @param {Function} computeFn  () => filteredEntries[]
     * @returns {any[]}
     */
    get(entries, settings, computeFn) {
        const key = this._key(entries, settings);

        if (this._cache.has(key)) {
            return this._cache.get(key);
        }

        const result = computeFn();

        // Evict oldest when at capacity
        if (this._cache.size >= MAX_SIZE) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }

        this._cache.set(key, result);
        return result;
    }

    /** Flush entire cache — call after any mutation to entries or jobs. */
    invalidate() {
        this._cache.clear();
    }

    // ── Private ────────────────────────────────────────────────────────────────

    _key(entries, settings) {
        // A lightweight checksum over salary+hours values detects edits within
        // a same-length array (e.g. updating a salary without adding/removing rows).
        // Each value is rounded to avoid floating-point noise producing false misses.
        const checksum = entries.reduce((s, e) => s + Math.round(e.salary * 100) + e.hours, 0);
        return `${entries.length}:${checksum}|${settings.period}|${(settings.includedJobs || []).join(',')}|${settings.customStartDate || ''}|${settings.customEndDate || ''}`;
    }
}

/** Singleton shared across the whole app. */
export const filterCache = new MemoizedFilter();
