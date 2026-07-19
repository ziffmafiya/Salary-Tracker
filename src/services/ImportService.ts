export interface CsvTransaction {
    date: string;
    categoryName: string;
    payee: string;
    comment: string;
    outcome: number;
    income: number;
}

export interface IncomeGroup {
    categoryName: string;
    payee: string;
    totalIncome: number;
    count: number;
    sampleDate: string;
}

export interface PayeeMapping {
    payee: string;
    jobId: string;
}

function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ';' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

export function parseCSV(text: string): CsvTransaction[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headerIdx = lines.findIndex(l => l.includes('date') && l.includes('categoryName') && l.includes('income'));
    if (headerIdx === -1) return [];

    const results: CsvTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        if (fields.length < 10) continue;

        const date = fields[0]?.trim() || '';
        const categoryName = fields[1]?.trim() || '';
        const payee = fields[2]?.trim() || '';
        const comment = fields[3]?.trim() || '';
        const outcome = parseFloat(fields[5]?.replace(',', '.') || '0');
        const income = parseFloat(fields[8]?.replace(',', '.') || '0');

        if (date && categoryName) {
            results.push({ date, categoryName, payee, comment, outcome, income });
        }
    }

    return results;
}

export function extractIncomeGroups(transactions: CsvTransaction[]): IncomeGroup[] {
    const incomeTx = transactions.filter(t => t.income > 0);
    const groups = new Map<string, IncomeGroup>();

    for (const tx of incomeTx) {
        const key = tx.payee || tx.categoryName;
        const existing = groups.get(key);
        if (existing) {
            existing.totalIncome += tx.income;
            existing.count++;
        } else {
            groups.set(key, {
                categoryName: tx.categoryName,
                payee: tx.payee,
                totalIncome: tx.income,
                count: 1,
                sampleDate: tx.date,
            });
        }
    }

    return Array.from(groups.values());
}

export function getMonthFromDate(dateStr: string): string {
    return dateStr.substring(0, 7);
}
