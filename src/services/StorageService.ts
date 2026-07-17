const KEYS = {
    ANALYTICS_SETTINGS: 'salaryTrackerAnalyticsSettings',
    LEGACY_JOBS:    'salaryTrackerJobs',
    LEGACY_ENTRIES: 'salaryTrackerEntries',
};

export const StorageService = {
    saveAnalyticsSettings(settings: any): void {
        try {
            localStorage.setItem(KEYS.ANALYTICS_SETTINGS, JSON.stringify(settings));
        } catch (err) {
            console.error('StorageService: failed to save analytics settings', err);
        }
    },

    loadAnalyticsSettings(): any | null {
        try {
            const raw = localStorage.getItem(KEYS.ANALYTICS_SETTINGS);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('StorageService: failed to load analytics settings', err);
            return null;
        }
    },

    getLegacyJobs(): any[] | null {
        try {
            const raw = localStorage.getItem(KEYS.LEGACY_JOBS);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    getLegacyEntries(): any[] | null {
        try {
            const raw = localStorage.getItem(KEYS.LEGACY_ENTRIES);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    clearLegacyData(): void {
        localStorage.removeItem(KEYS.LEGACY_JOBS);
        localStorage.removeItem(KEYS.LEGACY_ENTRIES);
    },
};
