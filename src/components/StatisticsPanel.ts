import { el } from '../utils/dom.js';
import { hourlyRate, baseHourlyRate, baseSalaryForHours } from '../utils/calculations.js';
import { formatMonth } from '../utils/formatters.js';
import { EventBus, Events } from '../core/EventBus.js';
import type { Job, Entry } from '../core/SupabaseClient.js';

interface StatsState {
    currentJobId: string | null;
    jobs: Job[];
    entries: Entry[];
}

export class StatisticsPanel {
    private _state: StatsState;

    constructor(state: StatsState) {
        this._state = state;

        EventBus.on(Events.ENTRIES_CHANGED, () => this.render());
        EventBus.on(Events.JOBS_CHANGED,    () => this.render());
        EventBus.on(Events.JOB_SELECTED,    () => this.render());

        el('viewJobSelect').addEventListener('change', (e: Event) => {
            this._state.currentJobId = (e.target as HTMLSelectElement).value;
            EventBus.emit(Events.JOB_SELECTED);
        });
    }

    render(): void {
        const { currentJobId, jobs, entries } = this._state;
        const jobMap = new Map(jobs.map(j => [j.id, j]));
        const job   = jobMap.get(currentJobId ?? '');
        const entry = this._getLatestEntry(currentJobId, entries ?? []);

        const title = el('statisticsTitle');

        if (!entry || !job) {
            if (title) title.textContent = 'Current Entry';
            const empty = (id: string) => { const e = el(id); if (e) e.textContent = '-'; };
            empty('currentSalary');
            empty('currentHours');
            empty('currentHourlyRate');
            empty('currentDifference');
            return;
        }

        if (title) title.textContent = `Last Entry (${formatMonth(entry.month)})`;

        const rate       = hourlyRate(entry.salary, entry.hours);
        const baseRate   = baseHourlyRate(job);
        const baseSalary = baseSalaryForHours(job, entry.hours);
        const diff       = entry.salary - baseSalary;

        const salaryEl = el('currentSalary');
        if (salaryEl) {
            salaryEl.textContent = `${entry.salary.toFixed(2)} UAH`;
            salaryEl.className   = 'tooltip-trigger';
            salaryEl.setAttribute('data-tooltip', `Base salary proportional to hours worked: ${baseSalary.toFixed(2)} UAH`);
        }

        const hoursEl = el('currentHours');
        if (hoursEl) hoursEl.textContent = `${entry.hours} hours`;

        const rateEl = el('currentHourlyRate');
        if (rateEl) {
            rateEl.textContent = `${rate.toFixed(2)} UAH/hour`;
            rateEl.className   = `tooltip-trigger ${rate > baseRate ? 'positive' : 'negative'}`;
            rateEl.setAttribute('data-tooltip', `Base hourly rate for this job: ${baseRate.toFixed(2)} UAH/hour`);
        }

        const diffEl = el('currentDifference');
        if (diffEl) {
            const sign = diff >= 0 ? '+' : '';
            diffEl.textContent = `${sign}${diff.toFixed(2)} UAH`;
            diffEl.className   = `tooltip-trigger ${diff >= 0 ? 'positive' : 'negative'}`;
            diffEl.setAttribute('data-tooltip', `Base salary proportional to hours worked this month: ${baseSalary.toFixed(2)} UAH`);
        }
    }

    private _getLatestEntry(jobId: string | null, entries: Entry[]): Entry | null {
        if (!jobId) return null;
        const jobEntries = entries
            .filter(e => e.jobId === jobId)
            .sort((a, b) => b.month.localeCompare(a.month));
        return jobEntries[0] || null;
    }
}
