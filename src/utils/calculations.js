/**
 * Pure mathematical / financial calculation helpers.
 * No DOM or Supabase dependencies — easy to unit-test.
 */

/**
 * Calculate hourly rate from salary and hours.
 * @param {number} salary
 * @param {number} hours
 * @returns {number}
 */
export function hourlyRate(salary, hours) {
    return hours > 0 ? salary / hours : 0;
}

/**
 * Base hourly rate derived from a job's baseRate and baseHours.
 * @param {{ baseRate: number, baseHours: number }} job
 * @returns {number}
 */
export function baseHourlyRate(job) {
    if (!job || !job.baseRate || !job.baseHours || job.baseHours === 0) return 0;
    return job.baseRate / job.baseHours;
}

/**
 * Proportional base salary for a given number of hours worked.
 * @param {{ baseRate: number, baseHours: number }} job
 * @param {number} hours
 * @returns {number}
 */
export function baseSalaryForHours(job, hours) {
    return baseHourlyRate(job) * hours;
}

/**
 * Simple arithmetic mean.
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Population standard deviation.
 * @param {number[]} values
 * @returns {number}
 */
export function stdDev(values) {
    if (values.length === 0) return 0;
    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
}

/**
 * N-period moving average. Returns null for initial positions where window is incomplete.
 * @param {number[]} data
 * @param {number} windowSize
 * @returns {(number|null)[]}
 */
export function movingAverage(data, windowSize) {
    if (data.length < windowSize) {
        return new Array(data.length).fill(null);
    }
    return data.map((_, i) => {
        if (i < windowSize - 1) return null;
        const window = data.slice(i - windowSize + 1, i + 1);
        return window.reduce((sum, v) => sum + v, 0) / windowSize;
    });
}

/**
 * Percent change between two values.
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
export function percentChange(from, to) {
    if (from === 0) return 0;
    return ((to - from) / from) * 100;
}

/**
 * Calculate Autocorrelation Function (ACF) up to maxLag for centered values.
 * @param {number[]} centeredValues
 * @param {number} maxLag
 * @returns {number[]}
 */
export function calculateACF(centeredValues, maxLag) {
    const n = centeredValues.length;
    const variance = centeredValues.reduce((sum, v) => sum + v * v, 0) / n;
    if (variance === 0) return new Array(maxLag + 1).fill(0);

    const acf = [];
    for (let lag = 0; lag <= maxLag; lag++) {
        let covariance = 0;
        for (let t = 0; t < n - lag; t++) {
            covariance += centeredValues[t] * centeredValues[t + lag];
        }
        acf.push(covariance / (n * variance));
    }
    return acf;
}

/**
 * Levinson-Durbin algorithm to solve Yule-Walker equations for AR model coefficients.
 * @param {number[]} acf
 * @param {number} p  model order
 * @returns {number[]}
 */
export function levinsonDurbin(acf, p) {
    let a = [1];
    let k = [];
    let E = acf[0];

    for (let i = 1; i <= p; i++) {
        let num = 0;
        for (let j = 1; j < i; j++) {
            num += a[j] * acf[i - j];
        }
        num += acf[i];

        const ki = E === 0 ? 0 : -num / E;
        k.push(ki);

        const a_new = [...a];
        for (let j = 1; j < i; j++) {
            a_new[j] = a[j] + ki * a[i - j];
        }
        a_new.push(ki);

        a = a_new;
        E *= (1 - ki * ki);
    }

    return a.slice(1).map(val => -val);
}

// ---------------------------------------------------------------------------
// AR model helpers
// ---------------------------------------------------------------------------

/**
 * Rolling-window variance check for weak stationarity.
 * Splits the series into thirds and compares the max/min variance ratio.
 * A ratio below 3 is treated as stationary (empirical threshold).
 *
 * @param {number[]} values
 * @returns {boolean}
 */
export function isStationary(values) {
    if (values.length < 6) return true; // too short to judge
    const windowSize = Math.floor(values.length / 3);
    const variances = [];
    for (let i = 0; i <= values.length - windowSize; i += windowSize) {
        const w = values.slice(i, i + windowSize);
        const avg = mean(w);
        const v = w.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / w.length;
        variances.push(v);
    }
    const minVar = Math.min(...variances);
    if (minVar === 0) return false;
    return Math.max(...variances) / minVar < 3;
}

/**
 * First-order difference to remove a linear trend and improve stationarity.
 * @param {number[]} values
 * @returns {number[]}
 */
function difference(values) {
    return values.slice(1).map((v, i) => v - values[i]);
}

/**
 * Fit an AR(p) model and return its coefficients plus residuals.
 * @param {number[]} values  mean-centered series
 * @param {number}   p
 * @returns {{ coefficients: number[], residuals: number[] }}
 */
function fitAR(centeredValues, p) {
    const acf = calculateACF(centeredValues, p);
    const coefficients = levinsonDurbin(acf, p);

    // Compute in-sample residuals
    const residuals = [];
    for (let t = p; t < centeredValues.length; t++) {
        let predicted = 0;
        for (let j = 0; j < p; j++) {
            predicted += coefficients[j] * centeredValues[t - 1 - j];
        }
        residuals.push(centeredValues[t] - predicted);
    }

    return { coefficients, residuals };
}

/**
 * AIC for an AR(p) model.
 * AIC = 2k − 2·ln(L)  where k = p + 1 (coefficients + variance parameter).
 *
 * @param {{ residuals: number[] }} model
 * @param {number} n  total number of observations used in fit
 * @param {number} p  model order
 * @returns {number}
 */
function calculateAIC(model, n, p) {
    const k = p + 1;
    const variance = model.residuals.reduce((sum, r) => sum + r * r, 0) / n;
    if (variance <= 0) return Infinity;
    const logLikelihood = -0.5 * n * (Math.log(2 * Math.PI) + Math.log(variance) + 1);
    return 2 * k - 2 * logLikelihood;
}

/**
 * Select the optimal AR order using AIC.
 * @param {number[]} centeredValues  mean-centered series
 * @param {number}   maxP
 * @returns {number}
 */
export function selectOptimalP(centeredValues, maxP = 5) {
    const upper = Math.min(maxP, Math.floor(centeredValues.length / 2));
    if (upper < 1) return 1;

    let bestP = 1;
    let bestAIC = Infinity;

    for (let p = 1; p <= upper; p++) {
        try {
            const model = fitAR(centeredValues, p);
            const aic = calculateAIC(model, centeredValues.length, p);
            if (aic < bestAIC) {
                bestAIC = aic;
                bestP = p;
            }
        } catch {
            // skip degenerate orders
        }
    }

    return bestP;
}

// ---------------------------------------------------------------------------
// Public forecast API
// ---------------------------------------------------------------------------

/**
 * Autoregressive forecast with confidence intervals.
 *
 * Improvements over the original:
 *  1. Stationarity check — non-stationary series are first-differenced.
 *  2. AIC-based automatic order selection instead of a fixed p = 3.
 *  3. Returns point forecast + symmetric confidence interval per step.
 *
 * @param {number[]} values        historical monthly values
 * @param {number}   numPeriods    how many future periods to forecast
 * @param {number}   [confidence=0.95]  desired confidence level (0–1)
 * @returns {Array<{ point: number, lower: number, upper: number, confidence: number }>}
 */
export function autoregressionForecastWithCI(values, numPeriods, confidence = 0.95) {
    const n = values.length;
    const fallback = mean(values) || 0;

    if (n < 2) {
        return Array.from({ length: numPeriods }, () => ({
            point: fallback, lower: fallback, upper: fallback, confidence,
        }));
    }

    // 1. Stationarity — difference once if needed
    const stationary = isStationary(values);
    const workingValues = stationary ? values : difference(values);
    const workingMean = mean(workingValues);
    const centeredValues = workingValues.map(v => v - workingMean);

    // 2. AIC-optimal order
    const p = selectOptimalP(centeredValues);

    // 3. Fit model and estimate residual variance
    const model = fitAR(centeredValues, p);
    const { coefficients } = model;
    const residualVariance = model.residuals.length > 0
        ? model.residuals.reduce((sum, r) => sum + r * r, 0) / model.residuals.length
        : Math.pow(stdDev(centeredValues), 2);

    // z-score for the requested confidence level (two-tailed)
    // Common values: 0.90→1.645, 0.95→1.960, 0.99→2.576
    const zScore = (() => {
        if (confidence >= 0.99) return 2.576;
        if (confidence >= 0.95) return 1.960;
        if (confidence >= 0.90) return 1.645;
        return 1.282; // 80 %
    })();

    // Forecast on the centered, possibly-differenced series
    const centeredHistory = [...centeredValues];
    const results = [];

    for (let h = 1; h <= numPeriods; h++) {
        let centeredForecast = 0;
        for (let j = 0; j < p; j++) {
            const idx = centeredHistory.length - 1 - j;
            if (idx >= 0) {
                centeredForecast += coefficients[j] * centeredHistory[idx];
            }
        }
        centeredHistory.push(centeredForecast);

        // Back-transform from centered (and differenced) space
        let point = centeredForecast + workingMean;
        if (!stationary) {
            // Undo differencing: add the last original value cumulatively
            const base = h === 1 ? values[values.length - 1] : results[h - 2].point;
            point = base + point;
        }
        point = Math.max(0, point);

        // Confidence interval: stderr grows with horizon (simplified propagation)
        const stderr = Math.sqrt(residualVariance * h);
        const margin = zScore * stderr;

        results.push({
            point,
            lower: Math.max(0, point - margin),
            upper: point + margin,
            confidence,
        });
    }

    return results;
}

/**
 * Autoregressive forecast — backward-compatible wrapper returning point values only.
 * @param {number[]} values       historical monthly values
 * @param {number}   numPeriods   how many future periods to forecast
 * @returns {number[]}
 */
export function autoregressionForecast(values, numPeriods) {
    return autoregressionForecastWithCI(values, numPeriods).map(r => r.point);
}
