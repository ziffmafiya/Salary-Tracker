interface EntryData {
    jobId: string;
    month: string;
    salary: number;
    hours: number;
}

interface JobData {
    name: string;
    baseRate: number;
    baseHours: number;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateEntry(data: EntryData): ValidationResult {
    const errors: string[] = [];

    if (!data.jobId) errors.push('Job must be selected.');
    if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) errors.push('Month must be in YYYY-MM format.');
    if (isNaN(data.salary) || data.salary < 0) errors.push('Salary must be a non-negative number.');
    if (isNaN(data.hours) || data.hours <= 0) errors.push('Hours must be a positive number.');

    return { valid: errors.length === 0, errors };
}

export function validateJob(data: JobData): ValidationResult {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') errors.push('Job name is required.');
    if (isNaN(data.baseRate) || data.baseRate <= 0) errors.push('Base rate must be a positive number.');
    if (isNaN(data.baseHours) || data.baseHours <= 0) errors.push('Base hours must be a positive number.');

    return { valid: errors.length === 0, errors };
}
