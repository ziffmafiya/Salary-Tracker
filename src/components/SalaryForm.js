/**
 * SalaryForm — "Add Salary Data" section.
 * Handles the add-entry form and populates job dropdowns.
 */
import { el } from '../utils/dom.js';
import { validateEntry } from '../utils/validators.js';
import { EventBus, Events } from '../core/EventBus.js';

export class SalaryForm {
    /**
     * @param {import('../core/SupabaseClient.js').SupabaseService} supabaseService
     * @param {Object} state  shared app state (jobs, entries, currentJobId)
     */
    constructor(supabaseService, state) {
        this._db    = supabaseService;
        this._state = state;

        el('salaryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        // Re-render selects whenever jobs change
        EventBus.on(Events.JOBS_CHANGED, () => this.renderJobSelects());
    }

    /**
     * Populate #jobSelect and #viewJobSelect dropdowns.
     */
    renderJobSelects() {
        const jobSelect     = el('jobSelect');
        const viewJobSelect = el('viewJobSelect');

        jobSelect.innerHTML     = '';
        viewJobSelect.innerHTML = '';

        this._state.jobs.forEach(job => {
            jobSelect.appendChild(this._createOption(job.id, job.name));
            viewJobSelect.appendChild(this._createOption(job.id, job.name));
        });

        if (this._state.currentJobId) {
            viewJobSelect.value = this._state.currentJobId;
        }
    }

    /**
     * Auto-advance the month input to the next month after the latest entry.
     */
    setDefaultMonthYear() {
        const input = el('monthYearInput');
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

    // ── Private ──────────────────────────────────────────────────────────────

    async _handleSubmit() {
        const jobId  = el('jobSelect').value;
        const month  = el('monthYearInput').value;
        const salary = parseFloat(el('salary').value);
        const hours  = parseFloat(el('hours').value);

        const { valid, errors } = validateEntry({ jobId, month, salary, hours });
        if (!valid) { alert(errors.join('\n')); return; }

        const existing = this._state.entries.find(e => e.job_id === jobId && e.month === month);

        if (existing) {
            if (!confirm('An entry for this job and month already exists. Update it?')) return;

            const idx = this._state.entries.findIndex(e => e.id === existing.id);
            const original = this._state.entries[idx];

            // Optimistic update
            this._state.entries[idx] = { ...original, salary, hours };

            try {
                const updated = await this._db.updateEntry(existing.id, { salary, hours });
                this._state.entries[idx] = updated;
                EventBus.emit(Events.ENTRIES_CHANGED);
            } catch (err) {
                // Roll back on failure
                this._state.entries[idx] = original;
                console.error('Error updating entry:', err);
                alert('Failed to update entry. Please try again.');
            }
        } else {
            try {
                const created = await this._db.createEntry({ jobId, month, salary, hours });
                this._state.entries.push(created);
                this._state.currentJobId = jobId;
                el('viewJobSelect').value = jobId;

                el('salary').value = '';
                this.setDefaultMonthYear();
                EventBus.emit(Events.ENTRIES_CHANGED);
            } catch (err) {
                console.error('Error saving entry:', err);
                alert('Failed to save entry. Please try again.');
            }
        }
    }

    _createOption(value, text) {
        const opt = document.createElement('option');
        opt.value       = value;
        opt.textContent = text;
        return opt;
    }
}
