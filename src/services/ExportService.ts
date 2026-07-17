import { Job, Entry } from '../core/SupabaseClient.js';

export function exportData(jobs: Job[], entries: Entry[]): void {
    if (entries.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }

    const firstJob = jobs.length > 0 ? jobs[0] : null;
    const incomeSources = jobs.map(job => ({ id: job.id, label: job.name }));

    const jobMap = new Map(jobs.map(j => [j.id, j]));

    const entriesByMonth: Record<string, Entry[]> = {};
    [...entries].sort((a, b) => a.month.localeCompare(b.month)).forEach(entry => {
        if (!entriesByMonth[entry.month]) entriesByMonth[entry.month] = [];
        entriesByMonth[entry.month].push(entry);
    });

    const records = Object.keys(entriesByMonth).sort().map(month => {
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];

        const monthEntries = entriesByMonth[month];

        const incomes = monthEntries.map(entry => ({
            source_id: entry.jobId,
            salary_gross: entry.salary,
            other_income: 0,
            hours_worked: entry.hours,
        }));

        const notesArray = monthEntries.map(entry => {
            const job = jobMap.get(entry.jobId);
            return job ? `${job.name}: ${entry.hours}ч` : `${entry.hours}ч`;
        });
        const notes = notesArray.length > 1 ? notesArray.join(', ') : '';

        return { period_start: startDate, period_end: endDate, incomes, notes };
    });

    const periodStart = records.length > 0 ? records[0].period_start : null;
    const periodEnd   = records.length > 0 ? records[records.length - 1].period_end : null;
    const sourceLabel = incomeSources.length === 1 ? 'источником' :
                        incomeSources.length < 5   ? 'источниками' : 'источниками';

    const payload = {
        person: {
            id: null,
            name: firstJob ? firstJob.name : '',
            role: firstJob ? firstJob.name : '',
            country: 'Ukraine',
        },
        currency: 'UAH',
        period_granularity: 'monthly',
        income_sources: incomeSources,
        records,
        export_summary: {
            records_count: records.length,
            period_covered_start: periodStart,
            period_covered_end: periodEnd,
            exported_at: new Date().toISOString().replace('Z', '+03:00'),
        },
        metadata: {
            generated_by: 'Salary Tracker v1.3',
            version: '1.0',
            notes: `Экспорт данных о зарплате с ${incomeSources.length} ${sourceLabel} дохода: ${incomeSources.map(s => s.label).join(', ')}`,
        },
    };

    const promptText = buildAnalysisPrompt();
    const content    = promptText + JSON.stringify(payload, null, 2);

    downloadTextFile(content, `salary_export_${new Date().toISOString().split('T')[0]}.txt`);
    console.log('Данные экспортированы:', payload);
}

function buildAnalysisPrompt(): string {
    return `Я присылаю JSON с данными по доходам за весь доступный период. В файле есть несколько источников дохода, перечисленных в поле income_sources, и в каждом месяце records[].incomes указаны суммы по source_id.

Важно: в данных нет налогов и нет расходов — считай net_income = salary_gross + bonuses + other_income для каждого источника и периода.

Проанализируй весь период и выдай подробный отчёт на русском со следующими разделами:

1) Краткое резюме (2–4 предложения): общий average monthly net income и распределение между источниками (какой источник доминирует).

2) KPI за весь период:
- total_gross_income (всех источников)
- total_net_income (тот же, так как налогов нет)
- breakdown per source: total_by_source и share_of_total (в %)
- average_monthly_net_income (всего) и per_source averages
- volatility per source (stddev)
- share_of_bonuses overall и per source

3) Тренды:
- income_trend overall: массив period(YYYY-MM) → total_net_income
- income_trend per source: для каждого source_id массив period → net_income
- определение тренда (рост/падение/стабильно) для каждого источника и в целом
- выделение notable months (спайки/падения) и вероятные причины

4) Корреляция между источниками (корр коэффициент): есть ли связь (например когда private падает, state растёт)

5) Forecast: простая линейная проекция total и per source на 3 следующих периода (указать допущения)

6) Рекомендации (6–12 пунктов), привязанные к источникам: как стабилизировать частный доход, как оптимально распределять бонусы, идеи для диверсификации или сохранения бонусов

7) Data quality: перечисли пропущенные/неоднородные записи (например отсутствует запись для source_id в месяце) и предложи дополнительные поля (pay_date, income_type, contract_type)

8) В конце — CSV-подобные таблицы с KPI и массивы для графиков:
- total_income_trend (period,value)
- per_source_trends: {source_id: [{period,value}, ...], ...}

Вставь JSON ниже:

`;
}

function downloadTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
