import { el } from '../utils/dom.js';
import { validateEntry } from '../utils/validators.js';
import { EventBus, Events } from '../core/EventBus.js';
import type { SupabaseService, Job, Entry } from '../core/SupabaseClient.js';

interface SalaryFormState {
    jobs: Job[];
    entries: Entry[];
    currentJobId: string | null;
}

export class SalaryForm {
    private _db: SupabaseService;
    private _state: SalaryFormState;

    constructor(supabaseService: SupabaseService, state: SalaryFormState) {
        this._db = supabaseService;
        this._state = state;

        el('salaryForm').addEventListener('submit', (e: Event) => {
            e.preventDefault();
            this._handleSubmit();
        });

        EventBus.on(Events.JOBS_CHANGED, () => this.renderJobSelects());
    }

    renderJobSelects(): void {
        const jobSelect     = el('jobSelect');
        const viewJobSelect = el('viewJobSelect');

        jobSelect.innerHTML     = '';
        viewJobSelect.innerHTML = '';

        this._state.jobs.forEach(job => {
            jobSelect.appendChild(this._createOption(job.id, job.name));
            viewJobSelect.appendChild(this._createOption(job.id, job.name));
        });

        if (this._state.currentJobId) {
            (viewJobSelect as HTMLSelectElement).value = this._state.currentJobId;
        }
    }

    setDefaultMonthYear(): void {
        const input = el('monthYearInput') as HTMLInputElement;
        const jobEntries = this._state.entries
            .filter(e => e.jobId === this._state.currentJobId)
            .map(e => e.month)
            .sort();

        if (jobEntries.length > 0) {
            const last = jobEntries[jobEntries.length - 1];
            const [y, m] = last.split('-');
            let nextMonth = parseInt(m) + 1;
            let nextYear  = parseInt(y);
            if (nextMonth > 12) { nextMonth = 1; nextYear++; }
            input.value = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        } else {
            const now = new Date();
            input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
    }

    private async _handleSubmit(): Promise<void> {
        const jobId  = (el('jobSelect') as HTMLSelectElement).value;
        const month  = (el('monthYearInput') as HTMLInputElement).value;
        const salary = parseFloat((el('salary') as HTMLInputElement).value);
        const hours  = parseFloat((el('hours') as HTMLInputElement).value);

        const { valid, errors } = validateEntry({ jobId, month, salary, hours });
        if (!valid) { alert(errors.join('\n')); return; }

        const existing = this._state.entries.find(e => e.job_id === jobId && e.month === month);

        if (existing) {
            if (!confirm('An entry for this job and month already exists. Update it?')) return;

            const idx = this._state.entries.findIndex(e => e.id === existing.id);
            const original = this._state.entries[idx];

            this._state.entries[idx] = { ...original, salary, hours };

            try {
                const updated = await this._db.updateEntry(existing.id, { salary, hours });
                this._state.entries[idx] = updated;
                EventBus.emit(Events.ENTRIES_CHANGED);
            } catch (err) {
                this._state.entries[idx] = original;
                console.error('Error updating entry:', err);
                alert('Failed to update entry. Please try again.');
            }
        } else {
            try {
                const created = await this._db.createEntry({ jobId, month, salary, hours });
                this._state.entries.push(created);
                this._state.currentJobId = jobId;
                (el('viewJobSelect') as HTMLSelectElement).value = jobId;

                (el('salary') as HTMLInputElement).value = '';
                this.setDefaultMonthYear();
                EventBus.emit(Events.ENTRIES_CHANGED);
            } catch (err) {
                console.error('Error saving entry:', err);
                alert('Failed to save entry. Please try again.');
            }
        }
    }

    private _createOption(value: string, text: string): HTMLOptionElement {
        const opt = document.createElement('option');
        opt.value       = value;
        opt.textContent = text;
        return opt;
    }
}
