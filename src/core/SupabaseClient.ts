export interface Job {
    id: string;
    name: string;
    base_rate: number;
    base_hours: number;
    baseRate: number;
    baseHours: number;
}

export interface Entry {
    id: string;
    job_id: string;
    jobId: string;
    month: string;
    salary: number;
    hours: number;
}

type SupabaseResponse = { data: any; error: any };

interface SupabaseInsertQuery {
    select(): Promise<SupabaseResponse> | SupabaseResponse;
}

interface SupabaseTable {
    select(columns?: string): Promise<SupabaseResponse>;
    insert(rows: any[]): SupabaseInsertQuery;
    update(data: any): { eq(column: string, value: string): { select(): Promise<SupabaseResponse> } };
    delete(): { eq(column: string, value: string): Promise<SupabaseResponse>; neq(column: string, value: string): Promise<SupabaseResponse> };
}

interface SupabaseClient {
    from(table: string): SupabaseTable;
}

type JobInput = { name: string; baseRate: number; baseHours: number };
type EntryInput = { jobId: string; month: string; salary: number; hours: number };
type BulkJobRow = { name: string; base_rate: number; base_hours: number };
type BulkEntryRow = { job_id: string; month: string; salary: number; hours: number };

export class SupabaseService {
    private _client: SupabaseClient;

    constructor(client: SupabaseClient) {
        this._client = client;
    }

    async loadJobs(): Promise<Job[]> {
        const { data, error } = await this._client.from('jobs').select('*');
        if (error) throw error;
        return (data as any[]).map(this._mapJob);
    }

    async createJob(jobData: JobInput): Promise<Job> {
        const q = await this._client
            .from('jobs')
            .insert([{ name: jobData.name, base_rate: jobData.baseRate, base_hours: jobData.baseHours }])
            .select();
        const { data, error } = q;
        if (error) throw error;
        return this._mapJob((data as any[])[0]);
    }

    async updateJob(id: string, jobData: JobInput): Promise<Job> {
        const { data, error } = await this._client
            .from('jobs')
            .update({ name: jobData.name, base_rate: jobData.baseRate, base_hours: jobData.baseHours })
            .eq('id', id)
            .select();
        if (error) throw error;
        return this._mapJob((data as any[])[0]);
    }

    async deleteJob(id: string): Promise<void> {
        const { error } = await this._client.from('jobs').delete().eq('id', id);
        if (error) throw error;
    }

    async loadEntries(): Promise<Entry[]> {
        const { data, error } = await this._client.from('entries').select('*');
        if (error) throw error;
        return (data as any[]).map(this._mapEntry);
    }

    async createEntry(entryData: EntryInput): Promise<Entry> {
        const q = await this._client
            .from('entries')
            .insert([{ job_id: entryData.jobId, month: entryData.month, salary: entryData.salary, hours: entryData.hours }])
            .select();
        const { data, error } = q;
        if (error) throw error;
        return this._mapEntry((data as any[])[0]);
    }

    async updateEntry(id: string, entryData: { month?: string; salary?: number; hours?: number }): Promise<Entry> {
        const { data, error } = await this._client
            .from('entries')
            .update(entryData)
            .eq('id', id)
            .select();
        if (error) throw error;
        return this._mapEntry((data as any[])[0]);
    }

    async deleteEntry(id: string): Promise<void> {
        const { error } = await this._client.from('entries').delete().eq('id', id);
        if (error) throw error;
    }

    async deleteEntriesByJob(jobId: string): Promise<void> {
        const { error } = await this._client.from('entries').delete().eq('job_id', jobId);
        if (error) throw error;
    }

    async deleteAllEntries(): Promise<void> {
        const { error } = await this._client
            .from('entries')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }

    async bulkInsertJobs(rows: BulkJobRow[]): Promise<Job[]> {
        const { data, error } = await this._client.from('jobs').insert(rows).select();
        if (error) throw error;
        return (data as any[]).map(this._mapJob);
    }

    async bulkInsertEntries(rows: BulkEntryRow[]): Promise<void> {
        const { error } = await (this._client.from('entries').insert(rows) as any);
        if (error) throw error;
    }

    private _mapJob(raw: any): Job {
        return { ...raw, baseRate: raw.base_rate, baseHours: raw.base_hours };
    }

    private _mapEntry(raw: any): Entry {
        return { ...raw, jobId: raw.job_id };
    }
}
