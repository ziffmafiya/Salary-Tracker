import { el, createElement } from '../utils/dom.js';
import { baseHourlyRate } from '../utils/calculations.js';
import { EventBus, Events } from '../core/EventBus.js';
import type { Job } from '../core/SupabaseClient.js';

interface BaseRatesState {
    jobs: Job[];
}

export class BaseRatesInfo {
    private _state: BaseRatesState;

    constructor(state: BaseRatesState) {
        this._state = state;
        EventBus.on(Events.JOBS_CHANGED, () => this.render());
    }

    render(): void {
        const container = el('baseRatesContainer');
        container.innerHTML = '';

        this._state.jobs.forEach(job => {
            const rate = baseHourlyRate(job);
            container.appendChild(createElement('div', {
                className:   'base-rate-item',
                textContent: `${job.name}: ${job.baseRate} UAH for ${job.baseHours} hours | ${rate.toFixed(2)} UAH/hour`,
            }));
        });
    }
}
