const UAH_FORMATTER = new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatUAH(amount: number): string {
    return UAH_FORMATTER.format(amount);
}

export function formatUAHPlain(amount: number, decimals = 2): string {
    return `${Number(amount).toFixed(decimals)} UAH`;
}

export function formatMonth(month: string, locale = 'en-US'): string {
    const [year, mon] = month.split('-');
    const date = new Date(parseInt(year), parseInt(mon) - 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function formatDiff(value: number, decimals = 2, suffix = ''): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}${suffix}`;
}

export function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

export function formatRate(rate: number): string {
    return `${rate.toFixed(2)} UAH/hour`;
}
