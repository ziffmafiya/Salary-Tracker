/**
 * Analytics Settings Modal — period selector and job filter checkboxes.
 */
import { BaseModal } from './BaseModal.js';
import { el, qsa, createElement } from '../../utils/dom.js';
import { EventBus, Events } from '../../core/EventBus.js';

export class AnalyticsModal extends BaseModal {
    /**
     * @param {{ jobs: Job[], analyticsSettings: Object }} state
     */
    constructor(state) {
        super('analyticsSettingsModal');
        this._state = state;

        this._bindTrigger();
        this._bindControls();
    }

    /** Sync modal UI from state and show. */
    open() {
        this._syncFromState();
        super.open();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    _bindTrigger() {
        el('analyticsSettingsBtn').addEventListener('click', () => this.open());
    }

    _bindControls() {
        // Toggle custom date range visibility
        el('analyticsPeriodSelect').addEventListener('change', (e) => {
            el('customDateRange').style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        el('applyAnalyticsSettings').addEventListener('click', () => this._apply());
        el('resetAnalyticsSettings').addEventListener('click', () => this._reset());
        el('selectAllJobs').addEventListener('click', () => this._selectAll(true));
        el('deselectAllJobs').addEventListener('click', () => this._selectAll(false));
    }

    _syncFromState() {
        const s = this._state.analyticsSettings;
        el('analyticsPeriodSelect').value = s.period;
        el('customDateRange').style.display = s.period === 'custom' ? 'block' : 'none';

        if (s.customStartDate) el('customStartDate').value = s.customStartDate;
        if (s.customEndDate)   el('customEndDate').value   = s.customEndDate;

        this._renderJobCheckboxes();
    }

    _renderJobCheckboxes() {
        const container = el('analyticsJobsContainer');
        container.innerHTML = '';

        const included = this._state.analyticsSettings.includedJobs.length > 0
            ? this._state.analyticsSettings.includedJobs
            : this._state.jobs.map(j => j.id);

        [...this._state.jobs]
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(job => {
                const label    = createElement('label');
                const checkbox = createElement('input');
                checkbox.type    = 'checkbox';
                checkbox.value   = job.id;
                checkbox.id      = `job-checkbox-${job.id}`;
                checkbox.checked = included.includes(job.id);

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(job.name));
                container.appendChild(label);
            });
    }

    _selectAll(checked) {
        qsa('#analyticsJobsContainer input[type="checkbox"]').forEach(cb => { cb.checked = checked; });
    }

    _apply() {
        const s = this._state.analyticsSettings;
        s.period = el('analyticsPeriodSelect').value;

        if (s.period === 'custom') {
            s.customStartDate = el('customStartDate').value;
            s.customEndDate   = el('customEndDate').value;
        } else {
            s.customStartDate = null;
            s.customEndDate   = null;
        }

        s.includedJobs = [];
        qsa('#analyticsJobsContainer input[type="checkbox"]:checked').forEach(cb => {
            s.includedJobs.push(cb.value);
        });

        EventBus.emit(Events.ANALYTICS_SETTINGS_CHANGED);
    }

    _reset() {
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
