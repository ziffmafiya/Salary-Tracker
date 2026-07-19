import { BaseModal } from './BaseModal.js';
import { el, createElement } from '../../utils/dom.js';
import { StorageService } from '../../services/StorageService.js';
import type { Job } from '../../core/SupabaseClient.js';

interface MappingState {
    jobs: Job[];
}

export class CategoryMappingModal extends BaseModal {
    private _state: MappingState;

    constructor(state: MappingState) {
        super('categoryMappingModal');
        this._state = state;
        this._bind();
    }

    open(): void {
        this._renderMappings();
        this._populateJobSelect();
        super.open();
    }

    private _bind(): void {
        el('categoryMappingBtn').addEventListener('click', () => this.open());
        el('addMappingBtn').addEventListener('click', () => this._addMapping());
    }

    private _populateJobSelect(): void {
        const select = el('newMappingJob') as HTMLSelectElement;
        select.innerHTML = '';
        for (const job of this._state.jobs) {
            const opt = createElement('option', { textContent: job.name }) as HTMLOptionElement;
            opt.value = job.id;
            select.appendChild(opt);
        }
    }

    private _getMappings(): any[] {
        return StorageService.loadPayeeMappings() || [];
    }

    private _renderMappings(): void {
        const mappings = this._getMappings();
        const jobMap = new Map(this._state.jobs.map(j => [j.id, j]));
        const container = el('categoryMappingsList');
        container.innerHTML = '';

        if (mappings.length === 0) {
            container.innerHTML = '<p class="text-meta">No mappings configured yet.</p>';
            return;
        }

        for (const mapping of mappings) {
            const job = jobMap.get(mapping.jobId);
            if (!job) continue;

            const row = createElement('div', { className: 'mapping-row' });
            const info = createElement('div', { className: 'mapping-info' });
            info.appendChild(createElement('div', {
                className: 'mapping-category',
                textContent: mapping.payee,
            }));
            info.appendChild(createElement('div', {
                className: 'mapping-job',
                textContent: `→ ${job.name}`,
            }));

            const delBtn = createElement('button', {
                className: 'mapping-delete-btn',
                textContent: 'Delete',
            });
            delBtn.addEventListener('click', () => {
                const updated = mappings.filter((m: any) => m.payee !== mapping.payee);
                StorageService.savePayeeMappings(updated);
                this._renderMappings();
            });

            row.appendChild(info);
            row.appendChild(delBtn);
            container.appendChild(row);
        }
    }

    private _addMapping(): void {
        const payee = (el('newMappingPayee') as HTMLInputElement).value.trim();
        const jobId = (el('newMappingJob') as HTMLSelectElement).value;

        if (!payee) { alert('Please enter a payee name.'); return; }
        if (!jobId) { alert('Please select a job.'); return; }

        const mappings = this._getMappings();
        const existing = mappings.findIndex((m: any) => m.payee === payee);
        if (existing >= 0) {
            mappings[existing].jobId = jobId;
        } else {
            mappings.push({ payee, jobId });
        }

        StorageService.savePayeeMappings(mappings);
        (el('newMappingPayee') as HTMLInputElement).value = '';
        this._renderMappings();
    }
}
