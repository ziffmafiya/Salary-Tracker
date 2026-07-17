/**
 * BaseRatesInfo — footer section listing base rate for each job.
 */
import { el, createElement } from '../utils/dom.js';
import { baseHourlyRate } from '../utils/calculations.js';
import { EventBus, Events } from '../core/EventBus.js';

export class BaseRatesInfo {
    /**
     * @param {Object} state  shared app state
     */
    constructor(state) {
        this._state = state;

        EventBus.on(Events.JOBS_CHANGED, () => this.render());
    }

    render() {
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
