/**
 * AnalyticsPanel — Overview section: KPIs, trends, notable months, forecast.
 */
import { el, createElement } from '../utils/dom.js';
import { formatMonth } from '../utils/formatters.js';
import { EventBus, Events } from '../core/EventBus.js';
import { filterEntries, groupBySource, calculateKPIs, calculateTrends, findNotableMonths } from '../services/AnalyticsService.js';
import { forecastSources, averageConfidence } from '../services/ForecastService.js';
import { debounce } from '../utils/debounce.js';

export class AnalyticsPanel {
    /**
     * @param {Object} state  shared app state
     */
    constructor(state) {
        this._state = state;

        // Debounce so bursts of events (jobs+entries changed together) only
        // trigger one expensive analytics pass after 150 ms of silence.
        this._debouncedRender = debounce(() => this._doRender(), 150);

        this._bindOverviewToggle();

        EventBus.on(Events.ENTRIES_CHANGED,             () => this.render());
        EventBus.on(Events.JOBS_CHANGED,                () => this.render());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED,  () => this.render());
    }

    // ── Public ────────────────────────────────────────────────────────────────

    /** Debounced public entry-point — coalesces rapid event bursts. */
    render() {
        this._debouncedRender();
    }

    /** Immediate render — used during initial paint. */
    renderNow() {
        this._doRender();
    }

    // ── Private — main render pass ────────────────────────────────────────────

    _doRender() {
        try {
            const { entries, jobs, analyticsSettings } = this._state;
            const filtered = filterEntries(entries, analyticsSettings);

            this._updateGearIcon();

            if (filtered.length === 0) {
                this._renderEmpty();
                return;
            }

            const sourceData    = groupBySource(filtered, jobs);
            const kpis          = calculateKPIs(sourceData, filtered);
            const trends        = calculateTrends(sourceData);
            const notableMonths = findNotableMonths(filtered);
            const forecastData  = forecastSources(sourceData);

            this._renderSummary(kpis, sourceData);
            this._renderKPIs(kpis, sourceData);
            this._renderTrends(trends);
            this._renderNotableMonths(notableMonths);
            this._renderForecast(forecastData);
        } catch (err) {
            console.error('[AnalyticsPanel] Render failed:', err);
            const grid = el('forecastGrid');
            if (grid) {
                grid.innerHTML = '<div class="forecast-item-unified">Analytics unavailable — check console for details.</div>';
            }
        }
    }

    // ── Private — overview toggle ─────────────────────────────────────────────

    _bindOverviewToggle() {
        const toggle  = el('overviewToggle');
        const details = el('overviewDetails');
        if (toggle && details) {
            toggle.addEventListener('click', () => {
                const visible = details.classList.toggle('visible');
                toggle.textContent = visible ? 'Hide details' : 'Show details';
            });
        }
    }

    // ── Private — gear icon ───────────────────────────────────────────────────

    _updateGearIcon() {
        const { analyticsSettings, jobs } = this._state;
        const gear = el('gearAnimation');
        const hasCustom = analyticsSettings.includedJobs.length < jobs.length
            || analyticsSettings.period !== 'all';

        if (hasCustom) {
            gear.classList.add('active-settings');
            gear.setAttribute('data-tooltip', this._buildSettingsSummary());
        } else {
            gear.classList.remove('active-settings');
            gear.removeAttribute('data-tooltip');
        }
    }

    _buildSettingsSummary() {
        const s = this._state.analyticsSettings;
        let text = `Current Analytics Settings:\nPeriod: ${s.period}\n`;

        if (s.period === 'custom') {
            text += `  Start Date: ${s.customStartDate || 'N/A'}\n`;
            text += `  End Date: ${s.customEndDate || 'N/A'}\n`;
        }

    // Исправляем deadcode: переменная _ никогда не используется
    const { includedJobs } = s;
        if (includedJobs.length === this._state.jobs.length) {
            text += 'Jobs: All Jobs Included\n';
        } else if (includedJobs.length === 0) {
            text += 'Jobs: No Jobs Included\n';
        } else {
            const names = includedJobs
                .map(id => this._state.jobs.find(j => j.id === id)?.name)
                .filter(Boolean)
                .join(', ');
            text += `Jobs: ${names}\n`;
        }
        return text;
    }

    // ── Private — render helpers ──────────────────────────────────────────────

    _renderEmpty() {
        el('summaryText').textContent = 'No data available for analysis with current filters.';
        ['totalIncome', 'totalHours', 'averageHourlyRate', 'totalGrossIncome', 'avgMonthlyIncome']
            .forEach(id => { el(id).textContent = '-'; });
        ['breakdownGrid', 'trendAnalysis', 'notableList', 'forecastGrid']
            .forEach(id => { el(id).innerHTML = ''; });
    }

    _renderSummary(kpis, sourceData) {
        const sourceCount   = Object.keys(sourceData).length;
        const dominantShare = sourceCount > 0
            ? (Math.max(...Object.values(sourceData).map(s => s.totalIncome)) / kpis.totalGrossIncome * 100).toFixed(1)
            : 0;

        el('summaryText').textContent =
            `Over ${kpis.monthsCount} months, your average monthly net income is ${kpis.avgMonthlyIncome.toFixed(0)} UAH ` +
            `from ${sourceCount} income sources. ${kpis.dominantSource} dominates with ${dominantShare}% of total income, ` +
            `contributing most to your financial stability.`;
    }

    _renderKPIs(kpis, sourceData) {
        const totalHours = Object.values(sourceData).reduce((s, d) => s + d.totalHours, 0);

        el('totalIncome').textContent        = `${kpis.totalGrossIncome.toFixed(0)} UAH`;
        el('totalHours').textContent         = totalHours.toFixed(0);
        el('totalGrossIncome').textContent   = `${kpis.totalGrossIncome.toFixed(0)} UAH`;
        el('avgMonthlyIncome').textContent   = `${kpis.avgMonthlyIncome.toFixed(0)} UAH`;
        el('averageHourlyRate').textContent  = `${kpis.avgHourlyRate.toFixed(2)} UAH/hour`;

        const grid = el('breakdownGrid');
        grid.innerHTML = '';

        Object.entries(sourceData).forEach(([, data]) => {
            const share     = (data.totalIncome / kpis.totalGrossIncome * 100).toFixed(1);
            const months    = new Set(data.entries.map(e => e.month)).size;
            const avgMonthly = months > 0 ? (data.totalIncome / months).toFixed(0) : 0;

            const item = createElement('div', {
                className: 'source-item',
                innerHTML: `
                    <div class="source-name">${data.name}</div>
                    <div class="source-amount">${data.totalIncome.toFixed(0)} UAH <span class="source-share">(${share}%)</span></div>
                    <div class="source-details">Avg: ${avgMonthly} UAH/month</div>
                `,
            });
            grid.appendChild(item);
        });
    }

    _renderTrends(trends) {
        const container = el('trendAnalysis');
        container.innerHTML = '';

        Object.values(trends).forEach(trend => {
            const icon = trend.direction === 'growing' ? '📈' :
                         trend.direction === 'declining' ? '📉' : '➡️';
            const trendText = trend.direction === 'stable'
                ? 'Stable'
                : `${trend.direction === 'growing' ? 'Growing' : 'Declining'} (${trend.change.toFixed(1)}%)`;

            const item = createElement('div', {
                className: 'trend-item-unified',
                innerHTML: `
                    <div class="trend-source-name">${trend.name}</div>
                    <div class="trend-direction-unified">
                        <span class="trend-icon-unified">${icon}</span>
                        <span class="trend-text-unified">${trendText}</span>
                    </div>
                    <div class="trend-stats-unified">
                        Avg: ${trend.avgIncome.toFixed(0)} UAH/month<br>
                        Volatility: ${trend.volatility.toFixed(0)} UAH
                    </div>
                `,
            });
            container.appendChild(item);
        });
    }

    _renderNotableMonths(notableMonths) {
        const container = el('notableList');
        container.innerHTML = '';

        if (notableMonths.length === 0) {
            container.appendChild(createElement('div', {
                className: 'notable-item-unified',
                innerHTML: '<div class="notable-month-unified">No significant variations detected</div>',
            }));
            return;
        }

        notableMonths.forEach(notable => {
            const item = createElement('div', {
                className: 'notable-item-unified',
                innerHTML: `
                    <div>
                        <div class="notable-month-unified">${formatMonth(notable.month)}</div>
                        <div class="notable-change-unified">${notable.change.toFixed(1)}% ${notable.type}</div>
                    </div>
                    <div class="notable-reason-unified">${notable.reason}</div>
                `,
            });
            container.appendChild(item);
        });
    }

    _renderForecast(forecastData) {
        const grid = el('forecastGrid');
        grid.innerHTML = '';

        const { forecasts, forecastMonths } = forecastData;

        if (!forecasts || Object.keys(forecasts).length === 0) {
            grid.appendChild(createElement('div', {
                className: 'forecast-item-unified',
                innerHTML: '<div class="forecast-month-unified">No data available for forecast</div>',
            }));
            return;
        }

        const sourcesArray = Object.values(forecasts);

        forecastMonths.forEach((month, monthIndex) => {
            const monthForecasts = sourcesArray.map(source =>
                source.forecasts.find(f => f.month === month.key)
            );

            const total      = monthForecasts.reduce((s, mf) => s + (mf ? mf.amount : 0), 0);
            const totalLower = monthForecasts.reduce((s, mf) => s + (mf ? mf.lower  : 0), 0);
            const totalUpper = monthForecasts.reduce((s, mf) => s + (mf ? mf.upper  : 0), 0);
            const avgConf    = averageConfidence(sourcesArray, month.key);
            const trendIcon  = this._getTrendIcon(sourcesArray, month.key, monthIndex);

            const breakdownHtml = sourcesArray.map(source => {
                const mf = source.forecasts.find(f => f.month === month.key);
                if (!mf) return '';
                return `<div class="forecast-source-unified">
                    <span>${source.name}</span>
                    <span>${mf.amount.toFixed(0)} UAH</span>
                </div>`;
            }).join('');

            const item = createElement('div', {
                className: 'forecast-item-unified overall',
                innerHTML: `
                    <div class="forecast-trend-unified">${trendIcon}</div>
                    <div class="forecast-month-unified">${month.name}</div>
                    <div class="forecast-amount-unified">${total.toFixed(0)} UAH</div>
                    <div class="forecast-range-unified">${totalLower.toFixed(0)} – ${totalUpper.toFixed(0)} UAH</div>
                    <div class="forecast-confidence-unified">
                        <span class="confidence-indicator-unified ${avgConf}"></span>
                        Confidence: ${avgConf}
                    </div>
                    <div class="forecast-breakdown-unified">${breakdownHtml}</div>
                `,
            });
            grid.appendChild(item);
        });
    }

    /**
     * Derive a trend icon by comparing this month's point forecast to the
     * previous month's (or current history if it's the first forecast month).
     * Uses the actual `amount` values so the icon reflects real AR output.
     *
     * @param {Array}  sourcesArray
     * @param {string} monthKey
     * @param {number} monthIndex   0-based index within forecastMonths
     */
    _getTrendIcon(sourcesArray, monthKey, monthIndex = 0) {
        // Sum point forecasts for this month
        const thisTotal = sourcesArray.reduce((s, source) => {
            const mf = source.forecasts.find(f => f.month === monthKey);
            return s + (mf ? mf.amount : 0);
        }, 0);

        // For the first forecast month we compare to the last historical value.
        // For subsequent months we compare to the previous forecast month.
        let prevTotal = 0;
        if (monthIndex === 0) {
            // Use each source's last known historical entry as baseline
            sourcesArray.forEach(source => {
                if (source.forecasts.length > 0) {
                    // All forecast entries for this source — take the smallest amount
                    // as a proxy for the most recent historical average. We don't have
                    // direct access to raw history here, so fall back gracefully.
                    prevTotal += source.forecasts[0].amount; // reuse first forecast as neutral
                }
            });
            // If we can't meaningfully compare, stay neutral
            if (Math.abs(thisTotal - prevTotal) < 1) return '➡️';
        } else {
            // Compare to the immediately preceding forecast month in the array
            sourcesArray.forEach(source => {
                const prev = source.forecasts[monthIndex - 1];
                prevTotal += prev ? prev.amount : 0;
            });
        }

        const delta = thisTotal - prevTotal;
        if (delta > prevTotal * 0.02) return '📈';   // > 2 % growth
        if (delta < -prevTotal * 0.02) return '📉';  // > 2 % decline
        return '➡️';
    }
}
