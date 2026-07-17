import { mean, stdDev, percentChange } from '../utils/calculations.js';
import { filterCache } from '../utils/memoize.js';
import { Entry, Job } from '../core/SupabaseClient.js';

interface AnalyticsSettings {
    period: string;
    customStartDate?: string;
    customEndDate?: string;
    includedJobs?: string[];
}

interface SourceDataValue {
    name: string;
    entries: Entry[];
    totalIncome: number;
    totalHours: number;
}

interface KPIs {
    totalGrossIncome: number;
    avgMonthlyIncome: number;
    avgHourlyRate: number;
    dominantSource: string | null;
    monthsCount: number;
}

interface TrendInfo {
    name: string;
    direction: string;
    change: number;
    volatility: number;
    avgIncome: number;
}

interface NotableMonth {
    month: string;
    value: number;
    change: number;
    type: string;
    reason: string;
}

export function filterEntries(entries: Entry[], settings: AnalyticsSettings): Entry[] {
    return filterCache.get(entries, settings, () => _filterEntries(entries, settings));
}

function _filterEntries(entries: Entry[], settings: AnalyticsSettings): Entry[] {
    let filtered = [...entries];

    if (settings.includedJobs && settings.includedJobs.length > 0) {
        filtered = filtered.filter(e => settings.includedJobs!.includes(e.jobId));
    }

    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    switch (settings.period) {
        case 'year':
            filtered = filtered.filter(e => parseInt(e.month.split('-')[0]) === currentYear);
            break;

        case '6months':
            filtered = filtered.filter(e => {
                const [y, m] = e.month.split('-').map(Number);
                const monthsAgo = (currentYear - y) * 12 + (currentMonth - m);
                return monthsAgo >= 0 && monthsAgo < 6;
            });
            break;

        case '3months':
            filtered = filtered.filter(e => {
                const [y, m] = e.month.split('-').map(Number);
                const monthsAgo = (currentYear - y) * 12 + (currentMonth - m);
                return monthsAgo >= 0 && monthsAgo < 3;
            });
            break;

        case 'custom':
            if (settings.customStartDate && settings.customEndDate) {
                filtered = filtered.filter(
                    e => e.month >= settings.customStartDate! && e.month <= settings.customEndDate!
                );
            }
            break;
    }

    return filtered;
}

export function groupBySource(entries: Entry[], jobs: Job[]): Record<string, SourceDataValue> {
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const sourceData: Record<string, SourceDataValue> = {};

    entries.forEach(entry => {
        const job = jobMap.get(entry.jobId);
        if (!job) return;

        if (!sourceData[entry.jobId]) {
            sourceData[entry.jobId] = {
                name: job.name,
                entries: [],
                totalIncome: 0,
                totalHours: 0,
            };
        }

        sourceData[entry.jobId].entries.push(entry);
        sourceData[entry.jobId].totalIncome += entry.salary;
        sourceData[entry.jobId].totalHours  += entry.hours;
    });

    return sourceData;
}

export function calculateKPIs(sourceData: Record<string, SourceDataValue>, allEntries: Entry[]): KPIs {
    const totalGrossIncome = allEntries.reduce((sum, e) => sum + e.salary, 0);
    const totalHours       = allEntries.reduce((sum, e) => sum + e.hours,  0);
    const uniqueMonths     = [...new Set(allEntries.map(e => e.month))];
    const avgMonthlyIncome = uniqueMonths.length > 0 ? totalGrossIncome / uniqueMonths.length : 0;
    const avgHourlyRate    = totalHours > 0 ? totalGrossIncome / totalHours : 0;

    let dominantSource: string | null = null;
    let maxIncome = 0;
    Object.values(sourceData).forEach(data => {
        if (data.totalIncome > maxIncome) {
            maxIncome = data.totalIncome;
            dominantSource = data.name;
        }
    });

    return {
        totalGrossIncome,
        avgMonthlyIncome,
        avgHourlyRate,
        dominantSource,
        monthsCount: uniqueMonths.length,
    };
}

export function calculateTrends(sourceData: Record<string, SourceDataValue>): Record<string, TrendInfo> {
    const trends: Record<string, TrendInfo> = {};

    Object.entries(sourceData).forEach(([sourceId, data]) => {
        const monthlyMap: Record<string, number> = {};
        data.entries.forEach(e => {
            monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
        });

        const values = Object.keys(monthlyMap).sort().map(m => monthlyMap[m]);

        if (values.length < 2) {
            trends[sourceId] = { name: data.name, direction: 'stable', change: 0, volatility: 0, avgIncome: values[0] || 0 };
            return;
        }

        const half       = Math.floor(values.length / 2);
        const firstHalf  = values.slice(0, half);
        const secondHalf = values.slice(half);

        const firstAvg  = mean(firstHalf);
        const secondAvg = mean(secondHalf);
        const change    = percentChange(firstAvg, secondAvg);

        let direction = 'stable';
        if (Math.abs(change) > 5) {
            direction = change > 0 ? 'growing' : 'declining';
        }

        trends[sourceId] = {
            name: data.name,
            direction,
            change: Math.abs(change),
            volatility: stdDev(values),
            avgIncome: mean(values),
        };
    });

    return trends;
}

export function findNotableMonths(entries: Entry[], sigmaThreshold = 1.5, topN = 5): NotableMonth[] {
    const monthlyMap: Record<string, number> = {};
    entries.forEach(e => {
        monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
    });

    const months = Object.keys(monthlyMap).sort();
    const values = months.map(m => monthlyMap[m]);

    if (values.length < 3) return [];

    const avg = mean(values);
    const sd  = stdDev(values);

    const notable: NotableMonth[] = months
        .map(month => {
            const value = monthlyMap[month];
            const deviation = sd > 0 ? Math.abs(value - avg) / sd : 0;
            if (deviation <= sigmaThreshold) return null;

            const change = Math.abs(percentChange(avg, value));
            const type   = value > avg ? 'spike' : 'drop';

            return {
                month,
                value,
                change,
                type,
                reason: type === 'spike' ? 'Possible bonus or extra income' : 'Reduced income period',
            };
        })
        .filter((m): m is NotableMonth => m !== null);

    return notable.sort((a, b) => b.change - a.change).slice(0, topN);
}

export function calculateMomGrowth(entries: Entry[]): { change: number | null; direction: string; previousMonth: string | null; currentMonth: string | null } {
    const monthlyMap: Record<string, number> = {};
    entries.forEach(e => {
        monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
    });

    const months = Object.keys(monthlyMap).sort();
    if (months.length < 2) {
        return { change: null, direction: 'stable', previousMonth: null, currentMonth: months[0] || null };
    }

    const current = monthlyMap[months[months.length - 1]];
    const prev = monthlyMap[months[months.length - 2]];

    if (prev === 0) {
        return { change: null, direction: 'stable', previousMonth: months[months.length - 2], currentMonth: months[months.length - 1] };
    }

    const change = ((current - prev) / prev) * 100;
    const direction = change > 1 ? 'up' : change < -1 ? 'down' : 'stable';

    return { change, direction, previousMonth: months[months.length - 2], currentMonth: months[months.length - 1] };
}

export function calculateEffectiveRate(entries: Entry[], jobs: Job[]): { rate: number; totalIncome: number; totalBaseHours: number } {
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    const monthJobSet = new Set<string>();
    let totalIncome = 0;

    entries.forEach(e => {
        totalIncome += e.salary;
        monthJobSet.add(`${e.month}:${e.jobId}`);
    });

    let totalBaseHours = 0;
    monthJobSet.forEach(key => {
        const jobId = key.split(':')[1];
        const job = jobMap.get(jobId);
        if (job) totalBaseHours += job.baseHours;
    });

    return {
        rate: totalBaseHours > 0 ? totalIncome / totalBaseHours : 0,
        totalIncome,
        totalBaseHours,
    };
}
