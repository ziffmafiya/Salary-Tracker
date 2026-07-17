/**
 * Thin wrapper around localStorage.
 * Centralises all localStorage key names and JSON parse/stringify logic.
 */

const KEYS = {
    ANALYTICS_SETTINGS: 'salaryTrackerAnalyticsSettings',
    // Legacy keys used only during one-time migration
    LEGACY_JOBS:    'salaryTrackerJobs',
    LEGACY_ENTRIES: 'salaryTrackerEntries',
};

export const StorageService = {
    // ── Analytics settings ─────────────────────────────────────────────────

    /**
     * Persist analytics settings object.
     * @param {Object} settings
     */
    saveAnalyticsSettings(settings) {
        try {
            localStorage.setItem(KEYS.ANALYTICS_SETTINGS, JSON.stringify(settings));
        } catch (err) {
            console.error('StorageService: failed to save analytics settings', err);
        }
    },

    /**
     * Load analytics settings, or return null if not found.
     * @returns {Object|null}
     */
    loadAnalyticsSettings() {
        try {
            const raw = localStorage.getItem(KEYS.ANALYTICS_SETTINGS);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('StorageService: failed to load analytics settings', err);
            return null;
        }
    },

    // ── Legacy migration helpers ────────────────────────────────────────────

    /**
     * Read legacy jobs from localStorage (migration only).
     * @returns {Array|null}
     */
    getLegacyJobs() {
        try {
            const raw = localStorage.getItem(KEYS.LEGACY_JOBS);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /**
     * Read legacy entries from localStorage (migration only).
     * @returns {Array|null}
     */
    getLegacyEntries() {
        try {
            const raw = localStorage.getItem(KEYS.LEGACY_ENTRIES);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /**
     * Remove legacy localStorage keys after successful migration.
     */
    clearLegacyData() {
        localStorage.removeItem(KEYS.LEGACY_JOBS);
        localStorage.removeItem(KEYS.LEGACY_ENTRIES);
    },
};
