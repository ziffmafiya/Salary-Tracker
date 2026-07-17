/**
 * 3-month income forecast using Autoregressive (AR) modelling.
 * No DOM or Supabase dependencies.
 */

import { autoregressionForecastWithCI, mean } from '../utils/calculations.js';

/**
 * Generate N-month labels starting from the month after current date.
 * @param {number} [numPeriods=3]
 * @returns {Array<{ key: string, name: string }>}
 */
export function generateForecastMonths(numPeriods = 3) {
    const now = new Date();
    const months = [];

    for (let i = 1; i <= numPeriods; i++) {
        const future = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = `${future.getFullYear()}-${(future.getMonth() + 1).toString().padStart(2, '0')}`;
        const name = future.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ key, name });
    }

    return months;
}

/**
 * Forecast income for each source over the next 3 months.
 *
 * @param {Object} sourceData  output of AnalyticsService.groupBySource()
 * @param {number} [numPeriods=3]
 * @returns {{
 *   forecastMonths: Array<{ key: string, name: string }>,
 *   forecasts: Object.<string, {
 *     name: string,
 *     forecasts: Array<{
 *       month: string,
 *       monthName: string,
 *       amount: number,
 *       lower: number,
 *       upper: number,
 *       confidence: string
 *     }>
 *   }>
 * }}
 */
export function forecastSources(sourceData, numPeriods = 3) {
    const forecastMonths = generateForecastMonths(numPeriods);
    const forecasts = {};

    Object.entries(sourceData).forEach(([sourceId, data]) => {
        // Aggregate entries by month for this source
        const monthlyMap = {};
        data.entries.forEach(e => {
            monthlyMap[e.month] = (monthlyMap[e.month] || 0) + e.salary;
        });

        const sortedMonths = Object.keys(monthlyMap).sort();
        const values = sortedMonths.map(m => monthlyMap[m]);

        const qualityLabel = values.length >= 6 ? 'high' : values.length >= 3 ? 'medium' : 'low';

        // AR forecast with confidence intervals (95 %)
        const ciForecasts = values.length >= 2
            ? autoregressionForecastWithCI(values, numPeriods)
            : Array.from({ length: numPeriods }, () => {
                const avg = mean(values) || 0;
                return { point: avg, lower: avg, upper: avg, confidence: 0.95 };
            });

        forecasts[sourceId] = {
            name: data.name,
            forecasts: forecastMonths.map((month, i) => ({
                month:      month.key,
                monthName:  month.name,
                amount:     ciForecasts[i]?.point  ?? mean(values),
                lower:      ciForecasts[i]?.lower  ?? mean(values),
                upper:      ciForecasts[i]?.upper  ?? mean(values),
                confidence: qualityLabel,
            })),
        };
    });

    return { forecastMonths, forecasts };
}

/**
 * Map a string confidence level to a numeric weight.
 * @param {'high'|'medium'|'low'} confidence
 * @returns {number}
 */
function confidenceToNum(confidence) {
    return { high: 3, medium: 2, low: 1 }[confidence] ?? 1;
}

/**
 * Average confidence across all sources for a given month key.
 * @param {Object[]} sourcesArray  array of { forecasts: [...] }
 * @param {string}   monthKey
 * @returns {'high'|'medium'|'low'}
 */
export function averageConfidence(sourcesArray, monthKey) {
    if (sourcesArray.length === 0) return 'low';

    const total = sourcesArray.reduce((sum, source) => {
        const mf = source.forecasts.find(f => f.month === monthKey);
        return sum + confidenceToNum(mf ? mf.confidence : 'low');
    }, 0);

    const avg = total / sourcesArray.length;
    return { 3: 'high', 2: 'medium', 1: 'low' }[Math.round(avg)] ?? 'low';
}
