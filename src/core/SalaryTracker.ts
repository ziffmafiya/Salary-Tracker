import { SupabaseService, Job, Entry } from './SupabaseClient.js';
import { EventBus, Events } from './EventBus.js';
import { StorageService } from '../services/StorageService.js';
import { exportData } from '../services/ExportService.js';
import { filterCache } from '../utils/memoize.js';

import { SalaryForm } from '../components/SalaryForm.js';
import { HistoryTable } from '../components/HistoryTable.js';
import { AnalyticsPanel } from '../components/AnalyticsPanel.js';
import { ChartComponent } from '../components/Chart.js';
import { StatisticsPanel } from '../components/StatisticsPanel.js';
import { BaseRatesInfo } from '../components/BaseRatesInfo.js';
import { Tooltip } from '../components/Tooltip.js';

import { JobSettingsModal } from '../components/modals/JobSettingsModal.js';
import { AnalyticsModal } from '../components/modals/AnalyticsModal.js';

export interface AppState {
    jobs: Job[];
    entries: Entry[];
    currentJobId: string | null;
    currentChartView: string;
    analyticsSettings: {
        period: string;
        customStartDate: string | null;
        customEndDate: string | null;
        includedJobs: string[];
    };
    monthlyIncomeSettings: {
        period: string;
        chartType: string;
    };
}

export class SalaryTracker {
    private _db!: SupabaseService;
    state!: AppState;

    private _analyticsPanel!: AnalyticsPanel;
    private _statsPanel!: StatisticsPanel;
    private _baseRatesInfo!: BaseRatesInfo;
    private _historyTable!: HistoryTable;
    private _salaryForm!: SalaryForm;
    private _chart!: ChartComponent;
    private _jobSettingsModal!: JobSettingsModal;
    private _analyticsModal!: AnalyticsModal;

    constructor() {
        if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL ||
            typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase credentials.');
            alert('Configuration error. Please contact the administrator.');
            return;
        }

        const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as any;
        this._db = new SupabaseService(client);

        this.state = {
            jobs: [],
            entries: [],

            currentJobId: null,
            currentChartView: 'overall',

            analyticsSettings: {
                period: 'all',
                customStartDate: null,
                customEndDate: null,
                includedJobs: [],
            },

            monthlyIncomeSettings: {
                period: 'all',
                chartType: 'salary',
            },
        };

        this._init();
    }

    private async _init(): Promise<void> {
        await this._loadData();
        await this._migrateOldData();

        this.state.analyticsSettings.includedJobs = this.state.jobs.map(j => j.id);

        this._createComponents();
        this._render();
    }

    private async _loadData(): Promise<void> {
        try {
            this.state.jobs = await this._db.loadJobs();
            this.state.entries = await this._db.loadEntries();
        } catch (err) {
            console.error('Error loading data:', err);
        }

        const saved = StorageService.loadAnalyticsSettings();
        if (saved) {
            this.state.analyticsSettings = {
                ...this.state.analyticsSettings,
                period: saved.period ?? 'all',
                customStartDate: saved.customStartDate ?? null,
                customEndDate: saved.customEndDate ?? null,
            };
        }
    }

    private async _migrateOldData(): Promise<void> {
        const oldJobs = StorageService.getLegacyJobs();
        const oldEntries = StorageService.getLegacyEntries();

        if ((!oldJobs && !oldEntries) || this.state.jobs.length > 0 || this.state.entries.length > 0) {
            return;
        }

        if (!confirm('Old local data found. Do you want to migrate it to Supabase? This is a one-time operation.')) {
            StorageService.clearLegacyData();
            return;
        }

        try {
            if (oldJobs) {
                const rows = oldJobs.map((j: any) => ({ name: j.name, base_rate: j.baseRate, base_hours: j.baseHours }));
                this.state.jobs = await this._db.bulkInsertJobs(rows);
            }

            if (oldEntries && oldJobs) {
                const oldJobMap = new Map(oldJobs.map((j: any) => [j.id, j]));
                const newJobMap = new Map(this.state.jobs.map(j => [j.name, j]));

                const rows = oldEntries.map((entry: any) => {
                    const oldJob = oldJobMap.get(entry.jobId);
                    const newJob = newJobMap.get(oldJob?.name);
                    return { job_id: newJob?.id ?? '', month: entry.month, salary: entry.salary, hours: entry.hours };
                }).filter((r: any) => r.job_id);

                await this._db.bulkInsertEntries(rows);
            }

            alert('Data migrated successfully!');
            StorageService.clearLegacyData();

            this.state.jobs = await this._db.loadJobs();
            this.state.entries = await this._db.loadEntries();
        } catch (err: any) {
            console.error('Migration error:', err);
            alert(`Error migrating data: ${err.message}`);
        }
    }

    private _createComponents(): void {
        new Tooltip();

        this._analyticsPanel = new AnalyticsPanel(this.state);
        this._statsPanel = new StatisticsPanel(this.state);
        this._baseRatesInfo = new BaseRatesInfo(this.state);
        this._historyTable = new HistoryTable(this._db, this.state);

        this._salaryForm = new SalaryForm(this._db, this.state);

        this._chart = new ChartComponent(this.state);
        this._chart.init();

        this._jobSettingsModal = new JobSettingsModal(this._db, this.state);
        this._analyticsModal = new AnalyticsModal(this.state);

        document.getElementById('exportDataBtn')!.addEventListener('click', () => {
            exportData(this.state.jobs, this.state.entries);
        });

        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => {
            StorageService.saveAnalyticsSettings(this.state.analyticsSettings);
        });

        EventBus.on(Events.ENTRIES_CHANGED, () => filterCache.invalidate());
        EventBus.on(Events.JOBS_CHANGED,    () => filterCache.invalidate());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => filterCache.invalidate());

        EventBus.on(Events.JOBS_CHANGED, () => {
            this._salaryForm.renderJobSelects();
            this._chart.populateViewSelect();
            this.state.analyticsSettings.includedJobs = this.state.jobs.map(j => j.id);
        });

        EventBus.on(Events.ENTRIES_CHANGED, () => {
            this._salaryForm.setDefaultMonthYear();
        });
    }

    private _render(): void {
        this._salaryForm.renderJobSelects();
        this._salaryForm.setDefaultMonthYear();
        this._chart.populateViewSelect();

        if (this.state.jobs.length > 0) {
            this.state.currentJobId = this.state.jobs[0].id;
        }

        this._analyticsPanel.renderNow();
        this._statsPanel.render();
        this._baseRatesInfo.render();
        this._historyTable.render();
    }
}
