import { autoregressionForecastWithCI, mean } from '../utils/calculations.js';

interface ForecastMonth {
    key: string;
    name: string;
}

interface SourceForecast {
    name: string;
    forecasts: Array<{
        month: string;
        monthName: string;
        amount: number;
        lower: number;
        upper: number;
        confidence: string;
    }>;
}

interface ForecastResult {
    forecastMonths: ForecastMonth[];
    forecasts: Record<string, SourceForecast>;
}

interface SourceDataValue {
    name: string;
    entries: Array<{ month: string; salary: number; hours: number }>;
    totalIncome: number;
    totalHours: number;
}

export function generateForecastMonths(numPeriods = 3): ForecastMonth[] {
    const now = new Date();
    const months: ForecastMonth[] = [];

    for (let i = 1; i <= numPeriods; i++) {
        const future = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = `${future.getFullYear()}-${(future.getMonth() + 1).toString().padStart(2, '0')}`;
        const name = future.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ key, name });
    }

    return months;
}

export function forecastSources(sourceData: Record<string, SourceDataValue>, numPeriods = 3): ForecastResult {
    const forecastMonths = generateForecastMonths(numPeriods);
    const forecasts: Record<string, SourceForecast> = {};

    Object.entries(sourceData).forEach(([sourceId, data]) => {
        const monthlyMap: Record<string, number> = {};
        data.entries.forEach(e => {
            monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
        });

        const sortedMonths = Object.keys(monthlyMap).sort();
        const values = sortedMonths.map(m => monthlyMap[m]);

        const qualityLabel = values.length >= 6 ? 'high' : values.length >= 3 ? 'medium' : 'low';

        const ciForecasts = values.length >= 2
            ? autoregressionForecastWithCI(values, numPeriods)
            : Array.from({ length: numPeriods }, () => {
                const avg = mean(values) || 0;
                return { point: avg, lower: avg, upper: avg, confidence: 0.95 };
            });

        forecasts[sourceId] = {
            name: data.name,
            forecasts: forecastMonths.map((month, i) => ({
                month: month.key,
                monthName: month.name,
                amount: ciForecasts[i]?.point ?? mean(values),
                lower: ciForecasts[i]?.lower ?? mean(values),
                upper: ciForecasts[i]?.upper ?? mean(values),
                confidence: qualityLabel,
            })),
        };
    });

    return { forecastMonths, forecasts };
}

function confidenceToNum(confidence: string): number {
    return { high: 3, medium: 2, low: 1 }[confidence] ?? 1;
}

export function averageConfidence(sourcesArray: SourceForecast[], monthKey: string): string {
    if (sourcesArray.length === 0) return 'low';

    const total = sourcesArray.reduce((sum, source) => {
        const mf = source.forecasts.find(f => f.month === monthKey);
        return sum + confidenceToNum(mf ? mf.confidence : 'low');
    }, 0);

    const avg = total / sourcesArray.length;
    const map: Record<number, string> = { 3: 'high', 2: 'medium', 1: 'low' };
    return map[Math.round(avg)] ?? 'low';
}
