import { BaseModal } from './BaseModal.js';
import { el, createElement } from '../../utils/dom.js';
import { parseCSV, extractIncomeGroups, getMonthFromDate } from '../../services/ImportService.js';
import { StorageService } from '../../services/StorageService.js';
import { EventBus, Events } from '../../core/EventBus.js';
import type { SupabaseService, Job, Entry } from '../../core/SupabaseClient.js';

interface ImportState {
    jobs: Job[];
    entries: Entry[];
}

interface UnresolvedCategory {
    categoryName: string;
    payee: string;
    totalIncome: number;
    count: number;
}

interface ImportAction {
    type: 'map' | 'skip';
    jobId?: string;
}

const VALUE_CREATE = '__create__';
const VALUE_SKIP = 'skip';

export class ImportModal extends BaseModal {
    private _db: SupabaseService;
    private _state: ImportState;
    private _unresolved: UnresolvedCategory[] = [];
    private _allTransactions: any[] = [];
    private _actions: Map<string, ImportAction> = new Map();
    private _fileParsed = false;

    constructor(db: SupabaseService, state: ImportState) {
        super('importModal');
        this._db = db;
        this._state = state;
        this._bind();
    }

    open(): void {
        this._resetUI();
        super.open();
    }

    private _resetUI(): void {
        this._fileParsed = false;
        this._unresolved = [];
        this._allTransactions = [];
        this._actions = new Map();

        (el('importFileInput') as HTMLInputElement).value = '';
        el('importStepFile').classList.remove('hidden');
        el('importStepMapping').classList.add('hidden');
        el('importStepResult').classList.add('hidden');
        el('importCategoriesContainer').innerHTML = '';
    }

    private _bind(): void {
        el('parseImportBtn').addEventListener('click', () => this._handleParse());
        el('applyImportBtn').addEventListener('click', () => this._handleImport());
        el('cancelImportBtn').addEventListener('click', () => this.close());
        el('closeImportResultBtn').addEventListener('click', () => this.close());
    }

    private _handleParse(): void {
        const fileInput = el('importFileInput') as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) { alert('Please select a CSV file.'); return; }

        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            const transactions = parseCSV(text);
            if (transactions.length === 0) {
                alert('No transactions found in the file. Make sure the CSV has the correct format.');
                return;
            }

            const groups = extractIncomeGroups(transactions);
            if (groups.length === 0) {
                alert('No income entries found in the file.');
                return;
            }

            this._allTransactions = transactions;
            this._renderCategories(groups);
        };
        reader.readAsText(file);
    }

    private _renderCategories(groups: UnresolvedCategory[]): void {
        const savedMappings = StorageService.loadCategoryMappings() || [];
        const jobMap = new Map(this._state.jobs.map(j => [j.id, j]));

        this._unresolved = [];
        this._actions = new Map();

        const container = el('importCategoriesContainer');
        container.innerHTML = '';

        for (const group of groups) {
            const mapping = savedMappings.find((m: any) => m.categoryName === group.categoryName);

            if (mapping && jobMap.has(mapping.jobId)) {
                this._actions.set(group.categoryName, { type: 'map', jobId: mapping.jobId });
                continue;
            }

            this._unresolved.push(group);

            const row = createElement('div', { className: 'import-category-row' });

            const info = createElement('div', { className: 'import-category-info' });
            info.appendChild(createElement('div', { className: 'import-category-name', textContent: group.categoryName }));
            info.appendChild(createElement('div', {
                className: 'import-category-detail',
                textContent: `${group.count} entries, total ${group.totalIncome.toFixed(2)} UAH · e.g. ${group.payee}`,
            }));

            const actionDiv = createElement('div', { className: 'import-category-action' });

            const select = createElement('select') as HTMLSelectElement;

            const skipOpt = createElement('option', { textContent: '— Skip —' }) as HTMLOptionElement;
            skipOpt.value = VALUE_SKIP;
            select.appendChild(skipOpt);

            const createOpt = createElement('option', { textContent: '— Create new job —' }) as HTMLOptionElement;
            createOpt.value = VALUE_CREATE;
            select.appendChild(createOpt);

            for (const job of this._state.jobs) {
                const opt = createElement('option', { textContent: `→ ${job.name}` }) as HTMLOptionElement;
                opt.value = `job:${job.id}`;
                select.appendChild(opt);
            }

            select.addEventListener('change', () => {
                const val = select.value;
                if (val === VALUE_SKIP) {
                    this._actions.set(group.categoryName, { type: 'skip' });
                } else if (val.startsWith('job:')) {
                    this._actions.set(group.categoryName, { type: 'map', jobId: val.slice(4) });
                } else if (val === VALUE_CREATE) {
                    this._actions.delete(group.categoryName);
                }
            });

            actionDiv.appendChild(select);
            row.appendChild(info);
            row.appendChild(actionDiv);
            container.appendChild(row);
        }

        if (this._unresolved.length === 0) {
            container.innerHTML = '<p class="text-meta">All categories already mapped. Ready to import.</p>';
        }

        el('importStepFile').classList.add('hidden');
        el('importStepMapping').classList.remove('hidden');
        this._fileParsed = true;
    }

    private async _handleImport(): Promise<void> {
        if (!this._fileParsed) return;

        const defaultHours = parseFloat((el('importDefaultHours') as HTMLInputElement).value) || 96;
        const savedMappings = (StorageService.loadCategoryMappings() || []) as any[];
        const jobMap = new Map(this._state.jobs.map(j => [j.id, j]));
        const newMappings = [...savedMappings];
        const newJobs: Job[] = [];
        let errors: string[] = [];

        const categoryRows = el('importCategoriesContainer').querySelectorAll('.import-category-row');
        for (const row of categoryRows) {
            const nameEl = row.querySelector('.import-category-name');
            if (!nameEl) continue;
            const categoryName = nameEl.textContent || '';
            const select = row.querySelector('select') as HTMLSelectElement;
            if (!select || select.value !== VALUE_CREATE) continue;

            const jobName = categoryName;
            try {
                const newJob = await this._db.createJob({ name: jobName, baseRate: 10395, baseHours: 192 });
                newJobs.push(newJob);
                this._state.jobs.push(newJob);
                jobMap.set(newJob.id, newJob);
                this._actions.set(categoryName, { type: 'map', jobId: newJob.id });
                newMappings.push({ categoryName, jobId: newJob.id });
            } catch (err: any) {
                errors.push(`Failed to create job "${jobName}": ${err.message}`);
                this._actions.set(categoryName, { type: 'skip' });
            }
        }

        const incomeTx = this._allTransactions.filter((t: any) => t.income > 0);
        const entriesToCreate: any[] = [];

        for (const tx of incomeTx) {
            const action = this._actions.get(tx.categoryName);
            if (!action || action.type === 'skip') continue;

            const jobId = action.jobId;
            if (!jobId || !jobMap.has(jobId)) continue;

            entriesToCreate.push({
                jobId,
                month: getMonthFromDate(tx.date),
                salary: tx.income,
                hours: defaultHours,
            });
        }

        if (entriesToCreate.length === 0) {
            this._showResult(0, 0, errors.length ? errors : ['No entries to import.']);
            return;
        }

        try {
            await this._db.bulkInsertEntries(
                entriesToCreate.map((e: any) => ({ job_id: e.jobId, month: e.month, salary: e.salary, hours: e.hours }))
            );
        } catch (err: any) {
            errors.push(`Database error: ${err.message}`);
        }

        if (newMappings.length > savedMappings.length) {
            StorageService.saveCategoryMappings(newMappings);
        }

        this._state.entries = await this._db.loadEntries();
        EventBus.emit(Events.ENTRIES_CHANGED);
        EventBus.emit(Events.JOBS_CHANGED);

        this._showResult(entriesToCreate.length, newJobs.length, errors);
    }

    private _showResult(imported: number, createdJobs: number, errors: string[]): void {
        el('importStepMapping').classList.add('hidden');
        el('importStepResult').classList.remove('hidden');

        const summary = el('importResultSummary');
        const parts: string[] = [];
        parts.push(`<p><strong>${imported}</strong> entries imported successfully.</p>`);
        if (createdJobs > 0) {
            parts.push(`<p><strong>${createdJobs}</strong> new job(s) created.</p>`);
        }
        if (errors.length > 0) {
            parts.push(`<p class="text-meta" style="color:var(--danger-color)">${errors.join('<br>')}</p>`);
        }
        summary.innerHTML = parts.join('');
    }
}
