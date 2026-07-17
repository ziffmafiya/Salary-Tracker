/**
 * SalaryTracker — the orchestrator / application core.
 *
 * Responsibilities (trimmed from original 2240-line monolith):
 *   - Create shared state object
 *   - Initialise Supabase service
 *   - Load data
 *   - Run one-time legacy migration
 *   - Instantiate all components
 *   - Wire export button
 */

import { SupabaseService }    from './SupabaseClient.js';
import { EventBus, Events }   from './EventBus.js';
import { StorageService }     from '../services/StorageService.js';
import { exportData }         from '../services/ExportService.js';
import { filterCache }        from '../utils/memoize.js';

import { SalaryForm }         from '../components/SalaryForm.js';
import { HistoryTable }       from '../components/HistoryTable.js';
import { AnalyticsPanel }     from '../components/AnalyticsPanel.js';
import { ChartComponent }     from '../components/Chart.js';
import { StatisticsPanel }    from '../components/StatisticsPanel.js';
import { BaseRatesInfo }      from '../components/BaseRatesInfo.js';
import { Tooltip }            from '../components/Tooltip.js';

import { JobSettingsModal }   from '../components/modals/JobSettingsModal.js';
import { AnalyticsModal }     from '../components/modals/AnalyticsModal.js';

export class SalaryTracker {
    constructor() {
        // Validate config injected by config.js / api/config.js
        if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL ||
            typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase credentials.');
            alert('Configuration error. Please contact the administrator.');
            return;
        }

        const client   = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this._db       = new SupabaseService(client);

        /**
         * Shared mutable state — passed by reference to all components.
         * Components read from it directly and mutate entries/jobs as needed.
         * They notify others via EventBus events.
         */
        this.state = {
            jobs:    [],
            entries: [],

            currentJobId:   null,
            currentChartView: 'overall',

            analyticsSettings: {
                period:          'all',
                customStartDate: null,
                customEndDate:   null,
                includedJobs:    [],
            },

            monthlyIncomeSettings: {
                period:    'all',
                chartType: 'salary',
            },
        };

        this._init();
    }

    // ── Private ───────────────────────────────────────────────────────────────

    async _init() {
        await this._loadData();
        await this._migrateOldData();

        // Always start with all jobs included in analytics
        this.state.analyticsSettings.includedJobs = this.state.jobs.map(j => j.id);

        this._createComponents();
        this._render();
    }

    async _loadData() {
        try {
            this.state.jobs    = await this._db.loadJobs();
            this.state.entries = await this._db.loadEntries();
        } catch (err) {
            console.error('Error loading data:', err);
        }

        // Load persisted analytics settings (jobs filter excluded — always reset to all)
        const saved = StorageService.loadAnalyticsSettings();
        if (saved) {
            this.state.analyticsSettings = {
                ...this.state.analyticsSettings,
                period:          saved.period          ?? 'all',
                customStartDate: saved.customStartDate ?? null,
                customEndDate:   saved.customEndDate   ?? null,
            };
        }
    }

    async _migrateOldData() {
        const oldJobs    = StorageService.getLegacyJobs();
        const oldEntries = StorageService.getLegacyEntries();

        if ((!oldJobs && !oldEntries) || this.state.jobs.length > 0 || this.state.entries.length > 0) {
            return; // Nothing to migrate
        }

        if (!confirm('Old local data found. Do you want to migrate it to Supabase? This is a one-time operation.')) {
            StorageService.clearLegacyData();
            return;
        }

        try {
            if (oldJobs) {
                const rows = oldJobs.map(j => ({ name: j.name, base_rate: j.baseRate, base_hours: j.baseHours }));
                this.state.jobs = await this._db.bulkInsertJobs(rows);
            }

            if (oldEntries) {
                const oldJobMap = new Map(oldJobs.map(j => [j.id, j]));
                const newJobMap = new Map(this.state.jobs.map(j => [j.name, j]));

                const rows = oldEntries.map(entry => {
                    const oldJob = oldJobMap.get(entry.jobId);
                    const newJob = newJobMap.get(oldJob?.name);
                    return { job_id: newJob?.id, month: entry.month, salary: entry.salary, hours: entry.hours };
                }).filter(r => r.job_id);

                await this._db.bulkInsertEntries(rows);
            }

            alert('Data migrated successfully!');
            StorageService.clearLegacyData();

            // Reload fresh from Supabase
            this.state.jobs    = await this._db.loadJobs();
            this.state.entries = await this._db.loadEntries();
        } catch (err) {
            console.error('Migration error:', err);
            alert(`Error migrating data: ${err.message}`);
        }
    }

    _createComponents() {
        // Utility
        new Tooltip();

        // Data-driven panels
        this._analyticsPanel  = new AnalyticsPanel(this.state);
        this._statsPanel      = new StatisticsPanel(this.state);
        this._baseRatesInfo   = new BaseRatesInfo(this.state);
        this._historyTable    = new HistoryTable(this._db, this.state);

        // Form
        this._salaryForm = new SalaryForm(this._db, this.state);

        // Chart
        this._chart = new ChartComponent(this.state);
        this._chart.init();

        // Modals
        this._jobSettingsModal  = new JobSettingsModal(this._db, this.state);
        this._analyticsModal    = new AnalyticsModal(this.state);

        // Export
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            exportData(this.state.jobs, this.state.entries);
        });

        // Persist analytics settings on change
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => {
            StorageService.saveAnalyticsSettings(this.state.analyticsSettings);
        });

        // Invalidate filter cache on any data mutation
        EventBus.on(Events.ENTRIES_CHANGED, () => filterCache.invalidate());
        EventBus.on(Events.JOBS_CHANGED,    () => filterCache.invalidate());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => filterCache.invalidate());

        // When jobs change, rebuild dependent selects
        EventBus.on(Events.JOBS_CHANGED, () => {
            this._salaryForm.renderJobSelects();
            this._chart.populateViewSelect();

            // Sync included jobs to full list on change
            this.state.analyticsSettings.includedJobs = this.state.jobs.map(j => j.id);
        });

        // When entries change, set default month for next entry
        EventBus.on(Events.ENTRIES_CHANGED, () => {
            this._salaryForm.setDefaultMonthYear();
        });
    }

    _render() {
        this._salaryForm.renderJobSelects();
        this._salaryForm.setDefaultMonthYear();
        this._chart.populateViewSelect();

        if (this.state.jobs.length > 0) {
            this.state.currentJobId = this.state.jobs[0].id;
        }

        // Use immediate renders on init — no need to debounce the first paint.
        this._analyticsPanel.renderNow();
        this._statsPanel.render();
        this._baseRatesInfo.render();
        this._historyTable.render();
    }
}
