/**
 * Job Settings Modal — list, add, edit, and delete jobs.
 */
import { BaseModal } from './BaseModal.js';
import { el, createElement } from '../../utils/dom.js';
import { EventBus, Events } from '../../core/EventBus.js';
import { validateJob } from '../../utils/validators.js';

export class JobSettingsModal extends BaseModal {
    /**
     * @param {import('../../core/SupabaseClient.js').SupabaseService} supabaseService
     * @param {{ jobs: import('../../core/SupabaseClient.js').Job[] }} state
     */
    constructor(supabaseService, state) {
        super('jobSettingsModal');
        this._db    = supabaseService;
        this._state = state;

        this._bindTrigger();
        this._bindAddForm();
    }

    /** Populate and open the modal. */
    open() {
        this._renderJobList();
        super.open();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    _bindTrigger() {
        el('jobSettingsBtn').addEventListener('click', () => this.open());
    }

    _bindAddForm() {
        el('addJobForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleAddJob();
        });
    }

    _renderJobList() {
        const container = el('jobsList');
        container.innerHTML = '';

        this._state.jobs.forEach(job => {
            const item = createElement('div', { className: 'job-item' });

            const info = createElement('div', { className: 'job-info' });
            info.appendChild(createElement('div', { className: 'job-name', textContent: job.name }));
            info.appendChild(createElement('div', {
                className: 'job-base-rate',
                textContent: `Base: ${job.baseRate} UAH for ${job.baseHours} hours (${(job.baseRate / job.baseHours).toFixed(2)} UAH/hour)`,
            }));

            const actions = createElement('div', { className: 'job-actions' });

            const editBtn = createElement('button', { className: 'edit-job-btn', textContent: 'Edit' });
            editBtn.addEventListener('click', () => this._openEditJobModal(job));

            const delBtn = createElement('button', { className: 'delete-job-btn', textContent: 'Delete' });
            delBtn.addEventListener('click', () => this._deleteJob(job.id));

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            item.appendChild(info);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    _openEditJobModal(job) {
        el('editJobId').value       = job.id;
        el('editJobName').value     = job.name;
        el('editJobBaseRate').value  = job.baseRate;
        el('editJobBaseHours').value = job.baseHours;

        // Lazy-bind the edit form once
        if (!this._editFormBound) {
            el('editJobForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this._handleSaveJobEdit();
            });
            el('editJobModal').querySelector('.close-modal').addEventListener('click', () => {
                el('editJobModal').style.display = 'none';
            });
            window.addEventListener('click', (e) => {
                if (e.target === el('editJobModal')) el('editJobModal').style.display = 'none';
            });
            this._editFormBound = true;
        }

        el('editJobModal').style.display = 'block';
    }

    async _handleSaveJobEdit() {
        const id        = el('editJobId').value;
        const name      = el('editJobName').value;
        const baseRate  = parseFloat(el('editJobBaseRate').value);
        const baseHours = parseFloat(el('editJobBaseHours').value);

        const { valid, errors } = validateJob({ name, baseRate, baseHours });
        if (!valid) { alert(errors.join('\n')); return; }

        try {
            const updated = await this._db.updateJob(id, { name, baseRate, baseHours });
            const idx = this._state.jobs.findIndex(j => j.id === id);
            if (idx !== -1) this._state.jobs[idx] = updated;

            el('editJobModal').style.display = 'none';
            EventBus.emit(Events.JOBS_CHANGED);
        } catch (err) {
            console.error('Error updating job:', err);
        }
    }

    async _handleAddJob() {
        const name      = el('newJobName').value;
        const baseRate  = parseFloat(el('newJobBaseRate').value);
        const baseHours = parseFloat(el('newJobBaseHours').value);

        const { valid, errors } = validateJob({ name, baseRate, baseHours });
        if (!valid) { alert(errors.join('\n')); return; }

        try {
            const newJob = await this._db.createJob({ name, baseRate, baseHours });
            this._state.jobs.push(newJob);

            // Reset form to defaults
            el('newJobName').value      = '';
            el('newJobBaseRate').value  = '10395';
            el('newJobBaseHours').value = '192';

            if (this._state.jobs.length === 1) {
                this._state.currentJobId = newJob.id;
            }

            this._renderJobList();
            EventBus.emit(Events.JOBS_CHANGED);
        } catch (err) {
            console.error('Error adding job:', err);
        }
    }

    async _deleteJob(jobId) {
        const hasEntries = this._state.entries.some(e => e.jobId === jobId);
        const message = hasEntries
            ? 'This job has salary entries. Deleting it will also delete all associated entries. Continue?'
            : 'Are you sure you want to delete this job?';

        if (!confirm(message)) return;

        try {
            if (hasEntries) {
                await this._db.deleteEntriesByJob(jobId);
                this._state.entries = this._state.entries.filter(e => e.jobId !== jobId);
            }

            await this._db.deleteJob(jobId);
            this._state.jobs = this._state.jobs.filter(j => j.id !== jobId);

            if (this._state.currentJobId === jobId) {
                this._state.currentJobId = this._state.jobs.length > 0 ? this._state.jobs[0].id : null;
            }

            if (this._state.currentChartView === jobId) {
                this._state.currentChartView = 'overall';
            }

            this._renderJobList();
            EventBus.emit(Events.JOBS_CHANGED);
            EventBus.emit(Events.ENTRIES_CHANGED);
        } catch (err) {
            console.error('Error deleting job:', err);
        }
    }
}
