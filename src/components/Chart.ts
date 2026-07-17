import { el } from '../utils/dom.js';
import { filterEntries } from '../services/AnalyticsService.js';
import { movingAverage, baseHourlyRate } from '../utils/calculations.js';
import { EventBus, Events } from '../core/EventBus.js';
import { debounce } from '../utils/debounce.js';
import type { Job, Entry } from '../core/SupabaseClient.js';

interface ChartState {
    entries: Entry[];
    jobs: Job[];
    monthlyIncomeSettings: { period: string; chartType: string };
    analyticsSettings: any;
    currentChartView: string;
}

const COLORS = ['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#00BCD4', '#FF9800', '#607D8B'];

export class ChartComponent {
    private _state: ChartState;
    private _chart: any = null;
    private _debouncedUpdate: ReturnType<typeof debounce>;
    private _settingsModalController: AbortController;

    constructor(state: ChartState) {
        this._state = state;
        this._debouncedUpdate = debounce(() => this._doUpdate(), 150);
        this._settingsModalController = new AbortController();

        this._bindSettingsModal();
        this._bindJobViewSelect();

        EventBus.on(Events.ENTRIES_CHANGED, () => this.update());
        EventBus.on(Events.JOBS_CHANGED,    () => this.update());
        EventBus.on(Events.CHART_SETTINGS_CHANGED, () => this.update());
    }

    init(): void {
        const ctx = (el('salaryChart') as HTMLCanvasElement).getContext('2d')!;

        Chart.defaults.color       = '#0D0A0B';
        Chart.defaults.borderColor = '#f0ecf2';

        this._chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: this._buildOptions(),
        });

        this._doUpdate();
    }

    update(): void {
        this._debouncedUpdate();
    }

    _doUpdate(): void {
        if (!this._chart) return;

        const { entries, jobs, monthlyIncomeSettings, analyticsSettings, currentChartView } = this._state;

        let filtered = filterEntries(entries, {
            ...analyticsSettings,
            period: monthlyIncomeSettings.period,
        });

        if (currentChartView !== 'overall') {
            filtered = filtered.filter(e => e.jobId === currentChartView);
        }

        const allMonths = [...new Set(filtered.map(e => e.month))].sort();

        const labels = allMonths.map(month => {
            const [y, m] = month.split('-');
            return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        });

        const chartType = monthlyIncomeSettings.chartType;
        const datasets: any[] = [];

        const mainData = this._buildMainData(allMonths, filtered, chartType);
        const yTitle   = chartType === 'salary' ? 'Total Salary (UAH)' : 'Average Hourly Rate (UAH/hour)';
        const dataLabel = chartType === 'salary' ? 'Monthly Income' : 'Hourly Rate';

        datasets.push({
            label:              dataLabel,
            data:               mainData,
            borderColor:        COLORS[0],
            backgroundColor:    'transparent',
            tension:            0.4,
            fill:               false,
            pointRadius:        6,
            pointHoverRadius:   8,
            pointBackgroundColor: COLORS[0],
        });

        const maData = movingAverage(mainData, 3);
        datasets.push({
            label:           'Moving Average (3-month)',
            data:            maData,
            borderColor:     '#FF9800',
            backgroundColor: 'transparent',
            borderWidth:     2,
            tension:         0.4,
            fill:            false,
            pointRadius:     0,
            pointHoverRadius: 0,
            borderDash:      [5, 5],
        });

        const baseData = this._buildBaseData(allMonths, filtered, jobs, chartType);
        const baseLabel = chartType === 'salary' ? 'Base Salary (Proportional)' : 'Base Hourly Rate';
        datasets.push({
            label:           baseLabel,
            data:            baseData,
            borderColor:     '#7e8495',
            backgroundColor: 'transparent',
            borderDash:      [5, 5],
            tension:         0.4,
            fill:            false,
            pointRadius:     4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0D0A0B',
        });

        this._chart.data.labels = labels;

        if (this._chart.data.datasets.length === datasets.length) {
            this._chart.data.datasets.forEach((ds: any, i: number) => {
                ds.data  = datasets[i].data;
                ds.label = datasets[i].label;
            });
        } else {
            this._chart.data.datasets = datasets;
        }

        this._chart.options.scales.y.title.text = yTitle;
        this._chart.options._chartType = chartType;

        this._chart.update('none');
    }

    populateViewSelect(): void {
        const select = el('chartViewSelect') as HTMLSelectElement;
        select.innerHTML = '';

        const overall = document.createElement('option');
        overall.value       = 'overall';
        overall.textContent = 'Overall';
        select.appendChild(overall);

        this._state.jobs.forEach(job => {
            const opt = document.createElement('option');
            opt.value       = job.id;
            opt.textContent = job.name;
            select.appendChild(opt);
        });

        const validValues = ['overall', ...this._state.jobs.map(j => j.id)];
        if (!validValues.includes(this._state.currentChartView)) {
            this._state.currentChartView = 'overall';
        }
        select.value = this._state.currentChartView;
    }

    private _buildMainData(months: string[], filtered: Entry[], chartType: string): number[] {
        return months.map(month => {
            const monthEntries = filtered.filter(e => e.month === month);
            if (chartType === 'salary') {
                return monthEntries.reduce((sum, e) => sum + e.salary, 0);
            }
            const totalSalary = monthEntries.reduce((sum, e) => sum + e.salary, 0);
            const totalHours  = monthEntries.reduce((sum, e) => sum + e.hours, 0);
            return totalHours > 0 ? totalSalary / totalHours : 0;
        });
    }

    private _buildBaseData(months: string[], filtered: Entry[], jobs: Job[], chartType: string): number[] {
        const jobMap = new Map(jobs.map(j => [j.id, j]));

        return months.map(month => {
            const monthEntries = filtered.filter(e => e.month === month);
            if (monthEntries.length === 0) return 0;

            if (chartType === 'salary') {
                return monthEntries.reduce((sum, entry) => {
                    const job = jobMap.get(entry.jobId);
                    if (!job) return sum;
                    return sum + (baseHourlyRate(job) * entry.hours);
                }, 0);
            }

            const totalHours = monthEntries.reduce((sum, e) => sum + e.hours, 0);
            if (totalHours === 0) return 0;

            const weightedBase = monthEntries.reduce((sum, entry) => {
                const job = jobMap.get(entry.jobId);
                if (!job) return sum;
                return sum + (baseHourlyRate(job) * entry.hours);
            }, 0);

            return weightedBase / totalHours;
        });
    }

    private _buildOptions(): any {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Month' },
                    grid:  { color: '#f0ecf2' },
                    ticks: { autoSkip: true, maxRotation: 45, minRotation: 0, padding: 10 },
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Amount (UAH)', color: '#0D0A0B' },
                    grid:  { color: '#f0ecf2' },
                },
            },
            plugins: {
                legend: {
                    display:  true,
                    position: 'top',
                    labels:   { color: '#0D0A0B', padding: 20 },
                },
                tooltip: {
                    enabled:         true,
                    backgroundColor: '#1F2937',
                    titleColor:      '#FFFFFF',
                    bodyColor:       '#FFFFFF',
                    borderColor:     '#4A55E1',
                    borderWidth:     1,
                    padding:         10,
                    callbacks: {
                        label(context: any) {
                            const chartType = context.chart.options._chartType;
                            let label = context.dataset.label ? context.dataset.label + ': ' : '';
                            if (context.parsed.y !== null) {
                                const formatted = new Intl.NumberFormat('uk-UA', {
                                    style: 'currency', currency: 'UAH',
                                }).format(context.parsed.y);
                                label += chartType === 'hourlyRate'
                                    ? formatted.replace('UAH', 'UAH/hour')
                                    : formatted;
                            }
                            return label;
                        },
                    },
                },
            },
        };
    }

    private _bindSettingsModal(): void {
        const modal = el('monthlyIncomeSettingsModal');

        el('monthlyIncomeSettingsBtn').addEventListener('click', () => {
            this.populateViewSelect();
            modal.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        modal.querySelector('.close-modal')!.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) modal.style.display = 'none';
        }, { signal: this._settingsModalController.signal });

        el('applyMonthlyIncomeSettings').addEventListener('click', () => this._applySettings());
        el('resetMonthlyIncomeSettings').addEventListener('click', () => this._resetSettings());
    }

    private _bindJobViewSelect(): void {
        el('chartViewSelect').addEventListener('change', (e: Event) => {
            this._state.currentChartView = (e.target as HTMLSelectElement).value;
            this.update();
        });
    }

    private _applySettings(): void {
        this._state.monthlyIncomeSettings.period = (el('periodSelect') as HTMLSelectElement).value;

        const checkedType = document.querySelector('input[name="chartType"]:checked') as HTMLInputElement | null;
        if (checkedType) {
            this._state.monthlyIncomeSettings.chartType = checkedType.value;
        }

        this._state.currentChartView = (el('chartViewSelect') as HTMLSelectElement).value;
        this.update();
    }

    private _resetSettings(): void {
        this._state.monthlyIncomeSettings = { period: 'all', chartType: 'salary' };
        this._state.currentChartView      = 'overall';

        (el('periodSelect') as HTMLSelectElement).value = 'all';
        (document.querySelector('input[name="chartType"][value="salary"]') as HTMLInputElement).checked = true;
        this.populateViewSelect();
        this.update();
    }
}
