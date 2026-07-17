const MAX_SIZE = 50;

export class MemoizedFilter {
    private _cache = new Map<string, any[]>();

    get(entries: any[], settings: any, computeFn: () => any[]): any[] {
        const key = this._key(entries, settings);

        if (this._cache.has(key)) {
            return this._cache.get(key)!;
        }

        const result = computeFn();

        if (this._cache.size >= MAX_SIZE) {
            const firstKey = this._cache.keys().next().value!;
            this._cache.delete(firstKey);
        }

        this._cache.set(key, result);
        return result;
    }

    invalidate(): void {
        this._cache.clear();
    }

    private _key(entries: any[], settings: any): string {
        const checksum = entries.reduce((s: number, e: any) => s + Math.round(e.salary * 100) + e.hours, 0);
        return `${entries.length}:${checksum}|${settings.period}|${(settings.includedJobs || []).join(',')}|${settings.customStartDate || ''}|${settings.customEndDate || ''}`;
    }
}

export const filterCache = new MemoizedFilter();
