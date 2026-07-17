import { BaseModal } from './BaseModal.js';
import { el, qsa, createElement } from '../../utils/dom.js';
import { EventBus, Events } from '../../core/EventBus.js';
import type { Job } from '../../core/SupabaseClient.js';

interface AnalyticsModalState {
    jobs: Job[];
    analyticsSettings: {
        period: string;
        customStartDate: string | null;
        customEndDate: string | null;
        includedJobs: string[];
    };
}

export class AnalyticsModal extends BaseModal {
    private _state: AnalyticsModalState;

    constructor(state: AnalyticsModalState) {
        super('analyticsSettingsModal');
        this._state = state;

        this._bindTrigger();
        this._bindControls();
    }

    open(): void {
        this._syncFromState();
        super.open();
    }

    private _bindTrigger(): void {
        el('analyticsSettingsBtn').addEventListener('click', () => this.open());
    }

    private _bindControls(): void {
        el('analyticsPeriodSelect').addEventListener('change', (e: Event) => {
            el('customDateRange').style.display = (e.target as HTMLSelectElement).value === 'custom' ? 'block' : 'none';
        });

        el('applyAnalyticsSettings').addEventListener('click', () => this._apply());
        el('resetAnalyticsSettings').addEventListener('click', () => this._reset());
        el('selectAllJobs').addEventListener('click', () => this._selectAll(true));
        el('deselectAllJobs').addEventListener('click', () => this._selectAll(false));
    }

    private _syncFromState(): void {
        const s = this._state.analyticsSettings;
        (el('analyticsPeriodSelect') as HTMLSelectElement).value = s.period;
        el('customDateRange').style.display = s.period === 'custom' ? 'block' : 'none';

        if (s.customStartDate) (el('customStartDate') as HTMLInputElement).value = s.customStartDate;
        if (s.customEndDate)   (el('customEndDate') as HTMLInputElement).value   = s.customEndDate;

        this._renderJobCheckboxes();
    }

    private _renderJobCheckboxes(): void {
        const container = el('analyticsJobsContainer');
        container.innerHTML = '';

        const included = this._state.analyticsSettings.includedJobs.length > 0
            ? this._state.analyticsSettings.includedJobs
            : this._state.jobs.map(j => j.id);

        [...this._state.jobs]
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(job => {
                const label    = createElement('label');
                const checkbox = createElement('input') as HTMLInputElement;
                checkbox.type    = 'checkbox';
                checkbox.value   = job.id;
                checkbox.id      = `job-checkbox-${job.id}`;
                checkbox.checked = included.includes(job.id);

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(job.name));
                container.appendChild(label);
            });
    }

    private _selectAll(checked: boolean): void {
        qsa('#analyticsJobsContainer input[type="checkbox"]').forEach(cb => {
            (cb as HTMLInputElement).checked = checked;
        });
    }

    private _apply(): void {
        const s = this._state.analyticsSettings;
        s.period = (el('analyticsPeriodSelect') as HTMLSelectElement).value;

        if (s.period === 'custom') {
            s.customStartDate = (el('customStartDate') as HTMLInputElement).value;
            s.customEndDate   = (el('customEndDate') as HTMLInputElement).value;
        } else {
            s.customStartDate = null;
            s.customEndDate   = null;
        }

        s.includedJobs = [];
        qsa('#analyticsJobsContainer input[type="checkbox"]:checked').forEach(cb => {
            s.includedJobs.push((cb as HTMLInputElement).value);
        });

        EventBus.emit(Events.ANALYTICS_SETTINGS_CHANGED);
    }

    private _reset(): void {
        this._state.analyticsSettings = {
            period: 'all',
            customStartDate: null,
            customEndDate: null,
            includedJobs: this._state.jobs.map(j => j.id),
        };
        this._syncFromState();
        EventBus.emit(Events.ANALYTICS_SETTINGS_CHANGED);
    }
}
