import { el, createElement } from '../utils/dom.js';
import { formatMonth, formatDiff } from '../utils/formatters.js';
import { hourlyRate, baseHourlyRate, baseSalaryForHours } from '../utils/calculations.js';
import { EventBus, Events } from '../core/EventBus.js';
import { validateEntry } from '../utils/validators.js';
import { filterEntries } from '../services/AnalyticsService.js';
import type { SupabaseService, Job, Entry } from '../core/SupabaseClient.js';

interface HistoryState {
    entries: Entry[];
    jobs: Job[];
    analyticsSettings: any;
}

const EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const DEL_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

export class HistoryTable {
    private _db: SupabaseService;
    private _state: HistoryState;
    private _modalController: AbortController;

    constructor(supabaseService: SupabaseService, state: HistoryState) {
        this._db = supabaseService;
        this._state = state;
        this._modalController = new AbortController();
        this._bindModalClose();
        this._bindEditForm();
        this._bindClearAll();

        EventBus.on(Events.ENTRIES_CHANGED, () => this.render());
        EventBus.on(Events.JOBS_CHANGED,    () => this.render());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED, () => this.render());
    }

    render(): void {
        const tbody = document.querySelector('#salaryHistoryTable tbody') as HTMLElement;
        tbody.innerHTML = '';

        const { entries, jobs, analyticsSettings } = this._state;

        const jobMap = new Map(jobs.map(j => [j.id, j]));

        const filtered = filterEntries(entries, analyticsSettings);
        filtered.sort((a, b) => b.month.localeCompare(a.month));

        const byJob: Record<string, Entry[]> = {};
        const entryIndexMap: Record<string, Map<string, number>> = {};
        filtered.forEach(e => {
            if (!byJob[e.jobId]) byJob[e.jobId] = [];
            byJob[e.jobId].push(e);
        });
        Object.entries(byJob).forEach(([jobId, arr]) => {
            arr.sort((a, b) => a.month.localeCompare(b.month));
            entryIndexMap[jobId] = new Map(arr.map((e, i) => [e.id, i]));
        });

        filtered.forEach(entry => {
            const job = jobMap.get(entry.jobId);
            if (!job) return;
            const idx = entryIndexMap[entry.jobId]?.get(entry.id) ?? -1;
            tbody.appendChild(this._buildRow(entry, job, idx, byJob[entry.jobId]));
        });

        this._applyToggle(tbody);
    }

    private _buildRow(entry: Entry, job: Job, idx: number, jobEntries: Entry[]): HTMLTableRowElement {
        const rate         = hourlyRate(entry.salary, entry.hours);
        const baseRate     = baseHourlyRate(job);
        const baseSalary   = baseSalaryForHours(job, entry.hours);
        const salaryDiff   = entry.salary - baseSalary;
        const rateDiff     = rate - baseRate;

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

    private _cell(label: string, text: string): HTMLTableCellElement {
        const td = document.createElement('td') as HTMLTableCellElement;
        td.setAttribute('data-label', label);
        td.textContent = text;
        return td;
    }

    private _actionCell(entry: Entry): HTMLTableCellElement {
        const td = createElement('td', { className: 'action-cell' }) as HTMLTableCellElement;
        td.setAttribute('data-label', 'Action');

        const editBtn = createElement('button', { className: 'icon-btn edit-btn', innerHTML: EDIT_SVG });
        editBtn.addEventListener('click', () => this._openEditModal(entry));

        const delBtn = createElement('button', { className: 'icon-btn delete-btn', innerHTML: DEL_SVG });
        delBtn.addEventListener('click', () => this._deleteEntry(entry.id));

        td.appendChild(editBtn);
        td.appendChild(delBtn);
        return td;
    }

    private _applyToggle(tbody: HTMLElement): void {
        const rows = tbody.querySelectorAll('tr');
        const LIMIT = 5;

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
            const hidden = tbody.querySelectorAll('.hidden-entry');
            const showing = hidden.length > 0;
            hidden.forEach(r => r.classList.toggle('hidden-entry'));
            btn.textContent = showing ? 'Show less' : `Show all (${rows.length - LIMIT} more)`;
        });

        document.querySelector('.table-container')!.appendChild(btn);
    }

    private _bindModalClose(): void {
        const modal = el('editEntryModal');
        modal.querySelector('.close-modal')!.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) modal.style.display = 'none';
        }, { signal: this._modalController.signal });
    }

    private _bindEditForm(): void {
        el('editEntryForm').addEventListener('submit', (e: Event) => {
            e.preventDefault();
            this._handleSaveEdit();
        });
    }

    private _openEditModal(entry: Entry): void {
        (el('editEntryId') as HTMLInputElement).value          = entry.id;
        (el('editEntryJobHidden') as HTMLInputElement).value   = entry.jobId;
        (el('editEntryMonthYear') as HTMLInputElement).value   = entry.month;
        (el('editEntrySalary') as HTMLInputElement).value      = String(entry.salary);
        (el('editEntryHours') as HTMLInputElement).value       = String(entry.hours);

        const jobMap = new Map(this._state.jobs.map(j => [j.id, j]));
        const job = jobMap.get(entry.jobId);
        el('editEntryJob').textContent = job ? job.name : '';

        el('editEntryModal').style.display = 'block';
    }

    private async _handleSaveEdit(): Promise<void> {
        const id     = (el('editEntryId') as HTMLInputElement).value;
        const jobId  = (el('editEntryJobHidden') as HTMLInputElement).value;
        const month  = (el('editEntryMonthYear') as HTMLInputElement).value;
        const salary = parseFloat((el('editEntrySalary') as HTMLInputElement).value);
        const hours  = parseFloat((el('editEntryHours') as HTMLInputElement).value);

        const { valid, errors } = validateEntry({ jobId, month, salary, hours });
        if (!valid) { alert(errors.join('\n')); return; }

        const idx = this._state.entries.findIndex(e => e.id === id);
        const original = this._state.entries[idx];

        this._state.entries[idx] = { ...original, month, salary, hours };

        try {
            const updated = await this._db.updateEntry(id, { month, salary, hours });
            this._state.entries[idx] = updated;

            el('editEntryModal').style.display = 'none';
            EventBus.emit(Events.ENTRIES_CHANGED);
        } catch (err) {
            this._state.entries[idx] = original;
            console.error('Error updating entry:', err);
            alert('Failed to save changes. Please try again.');
        }
    }

    private async _deleteEntry(entryId: string): Promise<void> {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        const original = [...this._state.entries];
        this._state.entries = this._state.entries.filter(e => e.id !== entryId);
        EventBus.emit(Events.ENTRIES_CHANGED);

        try {
            await this._db.deleteEntry(entryId);
        } catch (err) {
            this._state.entries = original;
            EventBus.emit(Events.ENTRIES_CHANGED);
            console.error('Error deleting entry:', err);
            alert('Failed to delete entry. Please try again.');
        }
    }

    private _bindClearAll(): void {
        el('clearAllData').addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete all salary data? This action cannot be undone.')) return;

            const original = [...this._state.entries];
            this._state.entries = [];
            EventBus.emit(Events.ENTRIES_CHANGED);

            try {
                await this._db.deleteAllEntries();
            } catch (err) {
                this._state.entries = original;
                EventBus.emit(Events.ENTRIES_CHANGED);
                console.error('Error clearing entries:', err);
                alert('Failed to clear data. Please try again.');
            }
        });
    }
}
