import { el, createElement } from '../utils/dom.js';
import { formatMonth } from '../utils/formatters.js';
import { EventBus, Events } from '../core/EventBus.js';
import { filterEntries, groupBySource, calculateKPIs, calculateTrends, findNotableMonths, calculateMomGrowth, calculateEffectiveRate } from '../services/AnalyticsService.js';
import { forecastSources, averageConfidence } from '../services/ForecastService.js';
import { debounce } from '../utils/debounce.js';
import type { Job, Entry } from '../core/SupabaseClient.js';

interface AnalyticsAppState {
    entries: Entry[];
    jobs: Job[];
    analyticsSettings: any;
}

export class AnalyticsPanel {
    private _state: AnalyticsAppState;
    private _debouncedRender: ReturnType<typeof debounce>;
    private _pieChart: any = null;

    constructor(state: AnalyticsAppState) {
        this._state = state;
        this._debouncedRender = debounce(() => this._doRender(), 150);
        this._bindOverviewToggle();

        EventBus.on(Events.ENTRIES_CHANGED,             () => this.render());
        EventBus.on(Events.JOBS_CHANGED,                () => this.render());
        EventBus.on(Events.ANALYTICS_SETTINGS_CHANGED,  () => this.render());
    }

    render(): void {
        this._debouncedRender();
    }

    renderNow(): void {
        this._doRender();
    }

    private _doRender(): void {
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
            this._renderMomGrowth(filtered, jobs);
            this._renderEffectiveRate(filtered, jobs);
            this._updatePieChart(sourceData);
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

    private _bindOverviewToggle(): void {
        const toggle  = el('overviewToggle');
        const details = el('overviewDetails');
        if (toggle && details) {
            toggle.addEventListener('click', () => {
                const visible = details.classList.toggle('visible');
                toggle.textContent = visible ? 'Hide details' : 'Show details';
                if (visible) {
                    setTimeout(() => details.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }
            });
        }
    }

    private _updateGearIcon(): void {
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

    private _buildSettingsSummary(): string {
        const s = this._state.analyticsSettings;
        let text = `Current Analytics Settings:\nPeriod: ${s.period}\n`;

        if (s.period === 'custom') {
            text += `  Start Date: ${s.customStartDate || 'N/A'}\n`;
            text += `  End Date: ${s.customEndDate || 'N/A'}\n`;
        }

        const { includedJobs } = s;
        if (includedJobs.length === this._state.jobs.length) {
            text += 'Jobs: All Jobs Included\n';
        } else if (includedJobs.length === 0) {
            text += 'Jobs: No Jobs Included\n';
        } else {
            const jobMap = new Map(this._state.jobs.map(j => [j.id, j]));
            const names  = includedJobs
                .map((id: string) => jobMap.get(id)?.name)
                .filter(Boolean)
                .join(', ');
            text += `Jobs: ${names}\n`;
        }
        return text;
    }

    private _renderEmpty(): void {
        el('summaryText').textContent = 'No data available for analysis with current filters.';
        ['totalIncome', 'totalHours', 'averageHourlyRate', 'totalGrossIncome', 'avgMonthlyIncome', 'momGrowth', 'effectiveRate']
            .forEach(id => { el(id).textContent = '-'; });
        ['breakdownGrid', 'trendAnalysis', 'notableList', 'forecastGrid']
            .forEach(id => { el(id).innerHTML = ''; });
        this._updatePieChart(null);
    }

    private _renderMomGrowth(entries: Entry[], jobs: Job[]): void {
        const { change, direction } = calculateMomGrowth(entries);
        const el = document.getElementById('momGrowth');
        if (!el) return;

        if (change === null) {
            el.textContent = '—';
            el.className = 'metric-value';
            return;
        }

        const sign = change >= 0 ? '+' : '';
        el.textContent = `${sign}${change.toFixed(1)}%`;
        el.className = direction === 'up' ? 'metric-value positive' : direction === 'down' ? 'metric-value negative' : 'metric-value';
    }

    private _renderEffectiveRate(entries: Entry[], jobs: Job[]): void {
        const { rate } = calculateEffectiveRate(entries, jobs);
        const el = document.getElementById('effectiveRate');
        if (!el) return;

        if (rate === 0) {
            el.textContent = '—';
            return;
        }

        el.textContent = `${rate.toFixed(2)} UAH/h`;
    }

    private _updatePieChart(sourceData: Record<string, any> | null): void {
        if (!this._pieChart) {
            const ctx = (el('sourcePieChart') as HTMLCanvasElement)?.getContext('2d');
            if (!ctx) return;
            this._pieChart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 12, boxWidth: 12 } },
                        tooltip: {
                            backgroundColor: '#1F2937',
                            titleColor: '#FFFFFF',
                            bodyColor: '#FFFFFF',
                            borderColor: '#4A55E1',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label(context: any) {
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const val = context.parsed;
                                    const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                                    return `${context.label}: ${val.toFixed(0)} UAH (${pct}%)`;
                                },
                            },
                        },
                    },
                },
            });
        }

        if (!sourceData || Object.keys(sourceData).length === 0) {
            this._pieChart.data.labels = [];
            this._pieChart.data.datasets = [{ data: [], backgroundColor: [] }];
            this._pieChart.update('none');
            return;
        }

        const COLORS = ['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#00BCD4', '#FF9800', '#607D8B', '#795548', '#E91E63'];
        const entries = Object.entries(sourceData);

        this._pieChart.data.labels = entries.map(([, d]) => d.name);
        this._pieChart.data.datasets = [{
            data: entries.map(([, d]) => d.totalIncome),
            backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
            borderColor: '#FFFFFF',
            borderWidth: 2,
        }];

        this._pieChart.update('none');
    }

    private _renderSummary(kpis: any, sourceData: Record<string, any>): void {
        const sourceCount   = Object.keys(sourceData).length;
        const dominantShare = sourceCount > 0
            ? (Math.max(...Object.values(sourceData).map((s: any) => s.totalIncome)) / kpis.totalGrossIncome * 100).toFixed(1)
            : 0;

        el('summaryText').textContent =
            `Over ${kpis.monthsCount} months, your average monthly net income is ${kpis.avgMonthlyIncome.toFixed(0)} UAH ` +
            `from ${sourceCount} income sources. ${kpis.dominantSource} dominates with ${dominantShare}% of total income, ` +
            `contributing most to your financial stability.`;
    }

    private _renderKPIs(kpis: any, sourceData: Record<string, any>): void {
        const totalHours = Object.values(sourceData).reduce((s: number, d: any) => s + d.totalHours, 0);

        el('totalIncome').textContent        = `${kpis.totalGrossIncome.toFixed(0)} UAH`;
        el('totalHours').textContent         = totalHours.toFixed(0);
        el('totalGrossIncome').textContent   = `${kpis.totalGrossIncome.toFixed(0)} UAH`;
        el('avgMonthlyIncome').textContent   = `${kpis.avgMonthlyIncome.toFixed(0)} UAH`;
        el('averageHourlyRate').textContent  = `${kpis.avgHourlyRate.toFixed(2)} UAH/hour`;

        const grid = el('breakdownGrid');
        grid.innerHTML = '';

        Object.entries(sourceData).forEach(([, data]: [string, any]) => {
            const share     = (data.totalIncome / kpis.totalGrossIncome * 100).toFixed(1);
            const months    = new Set(data.entries.map((e: any) => e.month)).size;
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

    private _renderTrends(trends: Record<string, any>): void {
        const container = el('trendAnalysis');
        container.innerHTML = '';

        Object.values(trends).forEach((trend: any) => {
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

    private _renderNotableMonths(notableMonths: any[]): void {
        const container = el('notableList');
        container.innerHTML = '';

        if (notableMonths.length === 0) {
            container.appendChild(createElement('div', {
                className: 'notable-item-unified',
                innerHTML: '<div class="notable-month-unified">No significant variations detected</div>',
            }));
            return;
        }

        notableMonths.forEach((notable: any) => {
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

    private _renderForecast(forecastData: any): void {
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

        const sourcesArray = Object.values(forecasts) as any[];

        forecastMonths.forEach((month: any, monthIndex: number) => {
            const monthForecasts = sourcesArray.map(source =>
                source.forecasts.find((f: any) => f.month === month.key)
            );

            const total      = monthForecasts.reduce((s: number, mf: any) => s + (mf ? mf.amount : 0), 0);
            const totalLower = monthForecasts.reduce((s: number, mf: any) => s + (mf ? mf.lower  : 0), 0);
            const totalUpper = monthForecasts.reduce((s: number, mf: any) => s + (mf ? mf.upper  : 0), 0);
            const avgConf    = averageConfidence(sourcesArray, month.key);
            const trendIcon  = this._getTrendIcon(sourcesArray, month.key, monthIndex);

            const breakdownHtml = sourcesArray.map(source => {
                const mf = source.forecasts.find((f: any) => f.month === month.key);
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

    private _getTrendIcon(sourcesArray: any[], monthKey: string, monthIndex = 0): string {
        const thisTotal = sourcesArray.reduce((s: number, source: any) => {
            const mf = source.forecasts.find((f: any) => f.month === monthKey);
            return s + (mf ? mf.amount : 0);
        }, 0);

        let prevTotal = 0;
        if (monthIndex === 0) {
            sourcesArray.forEach(source => {
                if (source.forecasts.length > 0) {
                    prevTotal += source.forecasts[0].amount;
                }
            });
            if (Math.abs(thisTotal - prevTotal) < 1) return '➡️';
        } else {
            sourcesArray.forEach(source => {
                const prev = source.forecasts[monthIndex - 1];
                prevTotal += prev ? prev.amount : 0;
            });
        }

        const delta = thisTotal - prevTotal;
        if (delta > prevTotal * 0.02) return '📈';
        if (delta < -prevTotal * 0.02) return '📉';
        return '➡️';
    }
}
