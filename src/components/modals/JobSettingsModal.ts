import { BaseModal } from './BaseModal.js';
import { el, createElement } from '../../utils/dom.js';
import { EventBus, Events } from '../../core/EventBus.js';
import { validateJob } from '../../utils/validators.js';
import type { SupabaseService, Job, Entry } from '../../core/SupabaseClient.js';

interface JobSettingsState {
    jobs: Job[];
    entries: Entry[];
    currentJobId: string | null;
    currentChartView: string;
}

export class JobSettingsModal extends BaseModal {
    private _db: SupabaseService;
    private _state: JobSettingsState;
    private _editFormBound = false;
    private _editModalController: AbortController;

    constructor(supabaseService: SupabaseService, state: JobSettingsState) {
        super('jobSettingsModal');
        this._db = supabaseService;
        this._state = state;
        this._editModalController = new AbortController();

        this._bindTrigger();
        this._bindAddForm();
    }

    open(): void {
        this._renderJobList();
        super.open();
    }

    private _bindTrigger(): void {
        el('jobSettingsBtn').addEventListener('click', () => this.open());
    }

    private _bindAddForm(): void {
        el('addJobForm').addEventListener('submit', (e: Event) => {
            e.preventDefault();
            this._handleAddJob();
        });
    }

    private _renderJobList(): void {
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

    private _openEditJobModal(job: Job): void {
        (el('editJobId') as HTMLInputElement).value       = job.id;
        (el('editJobName') as HTMLInputElement).value     = job.name;
        (el('editJobBaseRate') as HTMLInputElement).value  = String(job.baseRate);
        (el('editJobBaseHours') as HTMLInputElement).value = String(job.baseHours);

        if (!this._editFormBound) {
            el('editJobForm').addEventListener('submit', (e: Event) => {
                e.preventDefault();
                this._handleSaveJobEdit();
            });
            el('editJobModal').querySelector('.close-modal')!.addEventListener('click', () => {
                el('editJobModal').style.display = 'none';
            });
            window.addEventListener('click', (e: MouseEvent) => {
                if (e.target === el('editJobModal')) el('editJobModal').style.display = 'none';
            }, { signal: this._editModalController.signal });
            this._editFormBound = true;
        }

        el('editJobModal').style.display = 'block';
    }

    private async _handleSaveJobEdit(): Promise<void> {
        const id        = (el('editJobId') as HTMLInputElement).value;
        const name      = (el('editJobName') as HTMLInputElement).value;
        const baseRate  = parseFloat((el('editJobBaseRate') as HTMLInputElement).value);
        const baseHours = parseFloat((el('editJobBaseHours') as HTMLInputElement).value);

        const { valid, errors } = validateJob({ name, baseRate, baseHours });
        if (!valid) { alert(errors.join('\n')); return; }

        const idx = this._state.jobs.findIndex(j => j.id === id);
        const original = this._state.jobs[idx];

        this._state.jobs[idx] = { ...original, name, baseRate, baseHours };

        try {
            const updated = await this._db.updateJob(id, { name, baseRate, baseHours });
            this._state.jobs[idx] = updated;

            el('editJobModal').style.display = 'none';
            EventBus.emit(Events.JOBS_CHANGED);
        } catch (err) {
            this._state.jobs[idx] = original;
            console.error('Error updating job:', err);
            alert('Failed to save job changes. Please try again.');
        }
    }

    private async _handleAddJob(): Promise<void> {
        const name      = (el('newJobName') as HTMLInputElement).value;
        const baseRate  = parseFloat((el('newJobBaseRate') as HTMLInputElement).value);
        const baseHours = parseFloat((el('newJobBaseHours') as HTMLInputElement).value);

        const { valid, errors } = validateJob({ name, baseRate, baseHours });
        if (!valid) { alert(errors.join('\n')); return; }

        try {
            const newJob = await this._db.createJob({ name, baseRate, baseHours });
            this._state.jobs.push(newJob);

            (el('newJobName') as HTMLInputElement).value      = '';
            (el('newJobBaseRate') as HTMLInputElement).value  = '10395';
            (el('newJobBaseHours') as HTMLInputElement).value = '192';

            if (this._state.jobs.length === 1) {
                this._state.currentJobId = newJob.id;
            }

            this._renderJobList();
            EventBus.emit(Events.JOBS_CHANGED);
        } catch (err) {
            console.error('Error adding job:', err);
            alert('Failed to add job. Please try again.');
        }
    }

    private async _deleteJob(jobId: string): Promise<void> {
        const hasEntries = this._state.entries.some(e => e.jobId === jobId);
        const message = hasEntries
            ? 'This job has salary entries. Deleting it will also delete all associated entries. Continue?'
            : 'Are you sure you want to delete this job?';

        if (!confirm(message)) return;

        const originalJobs    = [...this._state.jobs];
        const originalEntries = [...this._state.entries];
        const originalJobId   = this._state.currentJobId;
        const originalChartView = this._state.currentChartView;

        if (hasEntries) {
            this._state.entries = this._state.entries.filter(e => e.jobId !== jobId);
        }
        this._state.jobs = this._state.jobs.filter(j => j.id !== jobId);

        if (this._state.currentJobId === jobId) {
            this._state.currentJobId = this._state.jobs.length > 0 ? this._state.jobs[0].id : null;
        }
        if (this._state.currentChartView === jobId) {
            this._state.currentChartView = 'overall';
        }

        this._renderJobList();
        EventBus.emit(Events.JOBS_CHANGED);
        if (hasEntries) EventBus.emit(Events.ENTRIES_CHANGED);

        try {
            if (hasEntries) await this._db.deleteEntriesByJob(jobId);
            await this._db.deleteJob(jobId);
        } catch (err) {
            this._state.jobs           = originalJobs;
            this._state.entries        = originalEntries;
            this._state.currentJobId   = originalJobId;
            this._state.currentChartView = originalChartView;

            this._renderJobList();
            EventBus.emit(Events.JOBS_CHANGED);
            if (hasEntries) EventBus.emit(Events.ENTRIES_CHANGED);

            console.error('Error deleting job:', err);
            alert('Failed to delete job. Please try again.');
        }
    }
}
