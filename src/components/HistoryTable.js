/**
 * HistoryTable — renders the salary history table and the edit-entry modal.
 */
import { el, createElement } from '../utils/dom.js';
import { formatMonth, formatDiff } from '../utils/formatters.js';
import { hourlyRate, baseHourlyRate, baseSalaryForHours } from '../utils/calculations.js';
import { EventBus, Events } from '../core/EventBus.js';
import { validateEntry } from '../utils/validators.js';

const EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const DEL_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

export class HistoryTable {
    /**
     * @param {import('../core/SupabaseClient.js').SupabaseService} supabaseService
     * @param {Object} state  shared app state
     */
    constructor(supabaseService, state) {
        this._db    = supabaseService;
        this._state = state;

        this._bindModalClose();
        this._bindEditForm();
        this._bindClearAll();

        EventBus.on(Events.ENTRIES_CHANGED, () => this.render());
        EventBus.on(Events.JOBS_CHANGED,    () => this.render());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => this.render());
    }

    // ── Public ────────────────────────────────────────────────────────────────

    render() {
        const tbody = document.querySelector('#salaryHistoryTable tbody');
        tbody.innerHTML = '';

        const { entries, jobs, analyticsSettings } = this._state;

        // Import filter inline to avoid circular deps — use the service directly
        const { filterEntries } = window._analyticsService || {};
        const filtered = filterEntries
            ? filterEntries(entries, analyticsSettings)
            : this._fallbackFilter(entries, analyticsSettings);

        // Sort newest first
        filtered.sort((a, b) => b.month.localeCompare(a.month));

        // Per-job sorted arrays for % change calculation
        const byJob = {};
        filtered.forEach(e => {
            if (!byJob[e.jobId]) byJob[e.jobId] = [];
            byJob[e.jobId].push(e);
        });
        Object.values(byJob).forEach(arr => arr.sort((a, b) => a.month.localeCompare(b.month)));

        filtered.forEach(entry => {
            const job = jobs.find(j => j.id === entry.jobId);
            if (!job) return;
            tbody.appendChild(this._buildRow(entry, job, byJob[entry.jobId]));
        });

        this._applyToggle(tbody);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _buildRow(entry, job, jobEntries) {
        const rate         = hourlyRate(entry.salary, entry.hours);
        const baseRate     = baseHourlyRate(job);
        const baseSalary   = baseSalaryForHours(job, entry.hours);
        const salaryDiff   = entry.salary - baseSalary;
        const rateDiff     = rate - baseRate;

        const idx      = jobEntries.findIndex(e => e.id === entry.id);
        const prev     = idx > 0 ? jobEntries[idx - 1] : null;
        const prevRate = prev ? hourlyRate(prev.salary, prev.hours) : null;

        const row = document.createElement('tr');

        row.appendChild(this._cell('Month',       formatMonth(entry.month)));
        row.appendChild(this._cell('Job',         job.name));
        row.appendChild(this._cell('Salary',      `${entry.salary.toFixed(2)} UAH`));
        row.appendChild(this._cell('Hours',       String(entry.hours)));
        row.appendChild(this._cell('Hourly Rate', `${rate.toFixed(2)} UAH/h`));

        const sdCell = this._cell('Salary Diff', formatDiff(salaryDiff, 2));
        sdCell.className = salaryDiff >= 0 ? 'positive' : 'negative';
        row.appendChild(sdCell);

        const rdCell = this._cell('Rate Diff', formatDiff(rateDiff, 2, ' UAH/h'));
        rdCell.className = rateDiff >= 0 ? 'positive' : 'negative';
        row.appendChild(rdCell);

        row.appendChild(this._actionCell(entry));

        return row;
    }

    _cell(label, text) {
        const td = document.createElement('td');
        td.setAttribute('data-label', label);
        td.textContent = text;
        return td;
    }

    _actionCell(entry) {
        const td = createElement('td', { className: 'action-cell' });
        td.setAttribute('data-label', 'Action');

        const editBtn = createElement('button', { className: 'icon-btn edit-btn', innerHTML: EDIT_SVG });
        editBtn.addEventListener('click', () => this._openEditModal(entry));

        const delBtn = createElement('button', { className: 'icon-btn delete-btn', innerHTML: DEL_SVG });
        delBtn.addEventListener('click', () => this._deleteEntry(entry.id));

        td.appendChild(editBtn);
        td.appendChild(delBtn);
        return td;
    }

    _applyToggle(tbody) {
        const rows = tbody.querySelectorAll('tr');
        const LIMIT = 5;

        // Remove stale toggle
        const old = document.querySelector('#salaryHistoryToggle');
        if (old) old.remove();

        if (rows.length <= LIMIT) return;

        rows.forEach((row, i) => {
            if (i >= LIMIT) row.classList.add('hidden-entry');
        });

        const btn = createElement('button', {
            className: 'toggle-history-btn',
            textContent: `Show all (${rows.length - LIMIT} more)`,
        });
        btn.id = 'salaryHistoryToggle';

        btn.addEventListener('click', () => {
            const hidden  = tbody.querySelectorAll('.hidden-entry');
            const showing = hidden.length > 0;
            hidden.forEach(r => r.classList.toggle('hidden-entry'));
            btn.textContent = showing ? 'Show less' : `Show all (${rows.length - LIMIT} more)`;
        });

        document.querySelector('.table-container').appendChild(btn);
    }

    // ── Edit Entry Modal ───────────────────────────────────────────────────────

    _bindModalClose() {
        const modal = el('editEntryModal');
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    _bindEditForm() {
        el('editEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSaveEdit();
        });
    }

    _openEditModal(entry) {
        el('editEntryId').value          = entry.id;
        el('editEntryJobHidden').value   = entry.jobId;
        el('editEntryMonthYear').value   = entry.month;
        el('editEntrySalary').value      = entry.salary;
        el('editEntryHours').value       = entry.hours;

        const job = this._state.jobs.find(j => j.id === entry.jobId);
        el('editEntryJob').textContent = job ? job.name : '';

        el('editEntryModal').style.display = 'block';
    }

    async _handleSaveEdit() {
        const id     = el('editEntryId').value;
        const jobId  = el('editEntryJobHidden').value;
        const month  = el('editEntryMonthYear').value;
        const salary = parseFloat(el('editEntrySalary').value);
        const hours  = parseFloat(el('editEntryHours').value);

        const { valid, errors } = validateEntry({ jobId, month, salary, hours });
        if (!valid) { alert(errors.join('\n')); return; }

        try {
            const updated = await this._db.updateEntry(id, { month, salary, hours });
            const idx = this._state.entries.findIndex(e => e.id === id);
            this._state.entries[idx] = updated;

            el('editEntryModal').style.display = 'none';
            EventBus.emit(Events.ENTRIES_CHANGED);
        } catch (err) {
            console.error('Error updating entry:', err);
        }
    }

    async _deleteEntry(entryId) {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            await this._db.deleteEntry(entryId);
            this._state.entries = this._state.entries.filter(e => e.id !== entryId);
            EventBus.emit(Events.ENTRIES_CHANGED);
        } catch (err) {
            console.error('Error deleting entry:', err);
        }
    }

    // ── Clear all ──────────────────────────────────────────────────────────────

    _bindClearAll() {
        el('clearAllData').addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete all salary data? This action cannot be undone.')) return;
            try {
                await this._db.deleteAllEntries();
                this._state.entries = [];
                EventBus.emit(Events.ENTRIES_CHANGED);
            } catch (err) {
                console.error('Error clearing entries:', err);
            }
        });
    }

    // ── Fallback filter (used if AnalyticsService not on window) ──────────────

    _fallbackFilter(entries, settings) {
        return entries.filter(e => {
            if (settings.includedJobs && settings.includedJobs.length > 0) {
                if (!settings.includedJobs.includes(e.jobId)) return false;
            }
            return true;
        });
    }
}
