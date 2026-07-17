export function hourlyRate(salary: number, hours: number): number {
    return hours > 0 ? salary / hours : 0;
}

export function baseHourlyRate(job: { baseRate: number; baseHours: number } | null | undefined): number {
    if (!job || !job.baseRate || !job.baseHours || job.baseHours === 0) return 0;
    return job.baseRate / job.baseHours;
}

export function baseSalaryForHours(job: { baseRate: number; baseHours: number } | null | undefined, hours: number): number {
    return baseHourlyRate(job) * hours;
}

export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
}

export function movingAverage(data: number[], windowSize: number): (number | null)[] {
    if (data.length < windowSize) {
        return new Array(data.length).fill(null);
    }
    return data.map((_, i) => {
        if (i < windowSize - 1) return null;
        const window = data.slice(i - windowSize + 1, i + 1);
        return window.reduce((sum, v) => sum + v, 0) / windowSize;
    });
}

export function percentChange(from: number, to: number): number {
    if (from === 0) return 0;
    return ((to - from) / from) * 100;
}

export function calculateACF(centeredValues: number[], maxLag: number): number[] {
    const n = centeredValues.length;
    const variance = centeredValues.reduce((sum, v) => sum + v * v, 0) / n;
    if (variance === 0) return new Array(maxLag + 1).fill(0);

    const acf: number[] = [];
    for (let lag = 0; lag <= maxLag; lag++) {
        let covariance = 0;
        for (let t = 0; t < n - lag; t++) {
            covariance += centeredValues[t] * centeredValues[t + lag];
        }
        acf.push(covariance / (n * variance));
    }
    return acf;
}

export function levinsonDurbin(acf: number[], p: number): number[] {
    let a: number[] = [1];
    const k: number[] = [];
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

function difference(values: number[]): number[] {
    return values.slice(1).map((v, i) => v - values[i]);
}

function fitAR(centeredValues: number[], p: number): { coefficients: number[]; residuals: number[] } {
    const acf = calculateACF(centeredValues, p);
    const coefficients = levinsonDurbin(acf, p);

    const residuals: number[] = [];
    for (let t = p; t < centeredValues.length; t++) {
        let predicted = 0;
        for (let j = 0; j < p; j++) {
            predicted += coefficients[j] * centeredValues[t - 1 - j];
        }
        residuals.push(centeredValues[t] - predicted);
    }

    return { coefficients, residuals };
}

function calculateAIC(model: { residuals: number[] }, n: number, p: number): number {
    const k = p + 1;
    const variance = model.residuals.reduce((sum, r) => sum + r * r, 0) / n;
    if (variance <= 0) return Infinity;
    const logLikelihood = -0.5 * n * (Math.log(2 * Math.PI) + Math.log(variance) + 1);
    return 2 * k - 2 * logLikelihood;
}

export function selectOptimalP(centeredValues: number[], maxP = 5): number {
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

export function isStationary(values: number[]): boolean {
    if (values.length < 6) return true;
    const windowSize = Math.floor(values.length / 3);
    const variances: number[] = [];
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

export function autoregressionForecastWithCI(
    values: number[],
    numPeriods: number,
    confidence = 0.95,
): Array<{ point: number; lower: number; upper: number; confidence: number }> {
    const n = values.length;
    const fallback = mean(values) || 0;

    if (n < 2) {
        return Array.from({ length: numPeriods }, () => ({
            point: fallback, lower: fallback, upper: fallback, confidence,
        }));
    }

    const stationary = isStationary(values);
    const workingValues = stationary ? values : difference(values);
    const workingMean = mean(workingValues);
    const centeredValues = workingValues.map(v => v - workingMean);

    const p = selectOptimalP(centeredValues);
    const model = fitAR(centeredValues, p);
    const { coefficients } = model;
    const residualVariance = model.residuals.length > 0
        ? model.residuals.reduce((sum, r) => sum + r * r, 0) / model.residuals.length
        : Math.pow(stdDev(centeredValues), 2);

    const zScore = (() => {
        if (confidence >= 0.99) return 2.576;
        if (confidence >= 0.95) return 1.960;
        if (confidence >= 0.90) return 1.645;
        return 1.282;
    })();

    const centeredHistory = [...centeredValues];
    const results: Array<{ point: number; lower: number; upper: number; confidence: number }> = [];

    for (let h = 1; h <= numPeriods; h++) {
        let centeredForecast = 0;
        for (let j = 0; j < p; j++) {
            const idx = centeredHistory.length - 1 - j;
            if (idx >= 0) {
                centeredForecast += coefficients[j] * centeredHistory[idx];
            }
        }
        centeredHistory.push(centeredForecast);

        let point = centeredForecast + workingMean;
        if (!stationary) {
            const base = h === 1 ? values[values.length - 1] : results[h - 2].point;
            point = base + point;
        }
        point = Math.max(0, point);

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

export function autoregressionForecast(values: number[], numPeriods: number): number[] {
    return autoregressionForecastWithCI(values, numPeriods).map(r => r.point);
}
