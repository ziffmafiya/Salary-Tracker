/**
 * MemoizedFilter — caches results of filterEntries() calls.
 *
 * Cache key is derived from:
 *   - entries array length (cheap change-detection proxy)
 *   - serialised analytics settings (period + includedJobs)
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
        // entries.length is O(1); JSON.stringify(settings) is small (~100 chars).
        // Together they uniquely identify the filter inputs for our use-case.
        return `${entries.length}|${settings.period}|${(settings.includedJobs || []).join(',')}|${settings.customStartDate || ''}|${settings.customEndDate || ''}`;
    }
}

/** Singleton shared across the whole app. */
export const filterCache = new MemoizedFilter();
