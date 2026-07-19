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
        return StorageService.loadCategoryMappings() || [];
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
                textContent: mapping.categoryName,
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
                const updated = mappings.filter((m: any) => m.categoryName !== mapping.categoryName);
                StorageService.saveCategoryMappings(updated);
                this._renderMappings();
            });

            row.appendChild(info);
            row.appendChild(delBtn);
            container.appendChild(row);
        }
    }

    private _addMapping(): void {
        const category = (el('newMappingCategory') as HTMLInputElement).value.trim();
        const jobId = (el('newMappingJob') as HTMLSelectElement).value;

        if (!category) { alert('Please enter a category name.'); return; }
        if (!jobId) { alert('Please select a job.'); return; }

        const mappings = this._getMappings();
        const existing = mappings.findIndex((m: any) => m.categoryName === category);
        if (existing >= 0) {
            mappings[existing].jobId = jobId;
        } else {
            mappings.push({ categoryName: category, jobId });
        }

        StorageService.saveCategoryMappings(mappings);
        (el('newMappingCategory') as HTMLInputElement).value = '';
        this._renderMappings();
    }
}
