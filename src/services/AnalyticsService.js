/**
 * Pure analytics calculations — no DOM, no Supabase.
 * All methods accept data arrays and return plain objects.
 *
 * filterEntries() results are memoized via filterCache so the same
 * filtered array is never recomputed when inputs haven't changed.
 * Call filterCache.invalidate() after any mutation to entries or jobs.
 */

import { mean, stdDev, percentChange } from '../utils/calculations.js';
import { filterCache } from '../utils/memoize.js';

/**
 * Filter entries by period and optional job list.
 * Results are memoized — repeated calls with the same inputs return the
 * cached array immediately without iterating entries again.
 *
 * @param {import('../core/SupabaseClient.js').Entry[]} entries
 * @param {{
 *   period: 'all'|'year'|'6months'|'3months'|'custom',
 *   customStartDate?: string,
 *   customEndDate?: string,
 *   includedJobs?: string[]
 * }} settings
 * @returns {import('../core/SupabaseClient.js').Entry[]}
 */
export function filterEntries(entries, settings) {
    return filterCache.get(entries, settings, () => _filterEntries(entries, settings));
}

function _filterEntries(entries, settings) {
    let filtered = [...entries];

    // Filter by included jobs
    if (settings.includedJobs && settings.includedJobs.length > 0) {
        filtered = filtered.filter(e => settings.includedJobs.includes(e.jobId));
    }

    // Filter by period
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
                    e => e.month >= settings.customStartDate && e.month <= settings.customEndDate
                );
            }
            break;

        // case 'all': no filtering
    }

    return filtered;
}

/**
 * Group entries by job (source), aggregating totals.
 *
 * @param {import('../core/SupabaseClient.js').Entry[]} entries
 * @param {import('../core/SupabaseClient.js').Job[]}   jobs
 * @returns {Object.<string, { name: string, entries: Entry[], totalIncome: number, totalHours: number }>}
 */
export function groupBySource(entries, jobs) {
    // O(1) lookup instead of jobs.find() per entry
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const sourceData = {};

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

/**
 * Compute top-level KPIs from grouped source data.
 *
 * @param {ReturnType<groupBySource>} sourceData
 * @param {import('../core/SupabaseClient.js').Entry[]} allEntries
 * @returns {{
 *   totalGrossIncome: number,
 *   avgMonthlyIncome: number,
 *   avgHourlyRate: number,
 *   dominantSource: string|null,
 *   monthsCount: number
 * }}
 */
export function calculateKPIs(sourceData, allEntries) {
    const totalGrossIncome = allEntries.reduce((sum, e) => sum + e.salary, 0);
    const totalHours       = allEntries.reduce((sum, e) => sum + e.hours,  0);
    const uniqueMonths     = [...new Set(allEntries.map(e => e.month))];
    const avgMonthlyIncome = uniqueMonths.length > 0 ? totalGrossIncome / uniqueMonths.length : 0;
    const avgHourlyRate    = totalHours > 0 ? totalGrossIncome / totalHours : 0;

    let dominantSource = null;
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

/**
 * Compute trend direction, % change and volatility per source.
 *
 * @param {ReturnType<groupBySource>} sourceData
 * @returns {Object.<string, { name: string, direction: string, change: number, volatility: number, avgIncome: number }>}
 */
export function calculateTrends(sourceData) {
    const trends = {};

    Object.entries(sourceData).forEach(([sourceId, data]) => {
        // Aggregate by month
        const monthlyMap = {};
        data.entries.forEach(e => {
            monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
        });

        const values = Object.keys(monthlyMap).sort().map(m => monthlyMap[m]);

        if (values.length < 2) {
            trends[sourceId] = { name: data.name, direction: 'stable', change: 0, volatility: 0, avgIncome: values[0] || 0 };
            return;
        }

        // Split cleanly at midpoint — no overlap for even or odd length arrays.
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

/**
 * Find months that deviate more than 1.5σ from the mean (spikes and drops).
 *
 * @param {import('../core/SupabaseClient.js').Entry[]} entries
 * @param {number} [sigmaThreshold=1.5]
 * @param {number} [topN=5]
 * @returns {Array<{ month: string, value: number, change: number, type: string, reason: string }>}
 */
export function findNotableMonths(entries, sigmaThreshold = 1.5, topN = 5) {
    const monthlyMap = {};
    entries.forEach(e => {
        monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
    });

    const months = Object.keys(monthlyMap).sort();
    const values = months.map(m => monthlyMap[m]);

    if (values.length < 3) return [];

    const avg = mean(values);
    const sd  = stdDev(values);

    const notable = months
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
        .filter(Boolean);

    return notable.sort((a, b) => b.change - a.change).slice(0, topN);
}
