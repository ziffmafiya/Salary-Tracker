/**
 * Formatting helpers — central place for all display formatting logic.
 */

const UAH_FORMATTER = new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Format a number as UAH currency string.
 * @param {number} amount
 * @returns {string}  e.g. "10 395,00 ₴"
 */
export function formatUAH(amount) {
    return UAH_FORMATTER.format(amount);
}

/**
 * Format amount with a plain " UAH" suffix (used in legacy display text).
 * @param {number} amount
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatUAHPlain(amount, decimals = 2) {
    return `${Number(amount).toFixed(decimals)} UAH`;
}

/**
 * Format a "YYYY-MM" string to a locale month+year label.
 * @param {string} month  "YYYY-MM"
 * @param {string} [locale='en-US']
 * @returns {string}  e.g. "January 2025"
 */
export function formatMonth(month, locale = 'en-US') {
    const [year, mon] = month.split('-');
    const date = new Date(parseInt(year), parseInt(mon) - 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * Format a signed difference with leading + for positive values.
 * @param {number} value
 * @param {number} [decimals=2]
 * @param {string} [suffix='']
 * @returns {string}
 */
export function formatDiff(value, decimals = 2, suffix = '') {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}${suffix}`;
}

/**
 * Format a percent change with leading sign.
 * @param {number} value
 * @returns {string}
 */
export function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format hourly rate.
 * @param {number} rate
 * @returns {string}
 */
export function formatRate(rate) {
    return `${rate.toFixed(2)} UAH/hour`;
}
