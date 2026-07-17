/**
 * Supabase abstraction layer.
 * All direct Supabase calls live here — the rest of the app uses this service.
 * Centralises error handling and field mapping (snake_case ↔ camelCase).
 */

/**
 * @typedef {Object} Job
 * @property {string}  id
 * @property {string}  name
 * @property {number}  base_rate
 * @property {number}  base_hours
 * @property {number}  baseRate   (alias for base_rate)
 * @property {number}  baseHours  (alias for base_hours)
 */

/**
 * @typedef {Object} Entry
 * @property {string}  id
 * @property {string}  job_id
 * @property {string}  jobId   (alias for job_id)
 * @property {string}  month   "YYYY-MM"
 * @property {number}  salary
 * @property {number}  hours
 */

export class SupabaseService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} client
     */
    constructor(client) {
        this._client = client;
    }

    // ── Jobs ───────────────────────────────────────────────────────────────

    /**
     * Load all jobs, mapping snake_case columns to camelCase aliases.
     * @returns {Promise<Job[]>}
     */
    async loadJobs() {
        const { data, error } = await this._client.from('jobs').select('*');
        if (error) throw error;
        return data.map(this._mapJob);
    }

    /**
     * Insert a new job.
     * @param {{ name: string, baseRate: number, baseHours: number }} jobData
     * @returns {Promise<Job>}
     */
    async createJob(jobData) {
        const { data, error } = await this._client
            .from('jobs')
            .insert([{ name: jobData.name, base_rate: jobData.baseRate, base_hours: jobData.baseHours }])
            .select();
        if (error) throw error;
        return this._mapJob(data[0]);
    }

    /**
     * Update an existing job.
     * @param {string} id
     * @param {{ name: string, baseRate: number, baseHours: number }} jobData
     * @returns {Promise<Job>}
     */
    async updateJob(id, jobData) {
        const { data, error } = await this._client
            .from('jobs')
            .update({ name: jobData.name, base_rate: jobData.baseRate, base_hours: jobData.baseHours })
            .eq('id', id)
            .select();
        if (error) throw error;
        return this._mapJob(data[0]);
    }

    /**
     * Delete a job by ID.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteJob(id) {
        const { error } = await this._client.from('jobs').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Entries ────────────────────────────────────────────────────────────

    /**
     * Load all entries, mapping snake_case columns to camelCase aliases.
     * @returns {Promise<Entry[]>}
     */
    async loadEntries() {
        const { data, error } = await this._client.from('entries').select('*');
        if (error) throw error;
        return data.map(this._mapEntry);
    }

    /**
     * Insert a new entry.
     * @param {{ jobId: string, month: string, salary: number, hours: number }} entryData
     * @returns {Promise<Entry>}
     */
    async createEntry(entryData) {
        const { data, error } = await this._client
            .from('entries')
            .insert([{ job_id: entryData.jobId, month: entryData.month, salary: entryData.salary, hours: entryData.hours }])
            .select();
        if (error) throw error;
        return this._mapEntry(data[0]);
    }

    /**
     * Update an existing entry's salary, hours, and/or month.
     * @param {string} id
     * @param {{ month?: string, salary?: number, hours?: number }} entryData
     * @returns {Promise<Entry>}
     */
    async updateEntry(id, entryData) {
        const { data, error } = await this._client
            .from('entries')
            .update(entryData)
            .eq('id', id)
            .select();
        if (error) throw error;
        return this._mapEntry(data[0]);
    }

    /**
     * Delete a single entry by ID.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteEntry(id) {
        const { error } = await this._client.from('entries').delete().eq('id', id);
        if (error) throw error;
    }

    /**
     * Delete all entries belonging to a specific job.
     * @param {string} jobId
     * @returns {Promise<void>}
     */
    async deleteEntriesByJob(jobId) {
        const { error } = await this._client.from('entries').delete().eq('job_id', jobId);
        if (error) throw error;
    }

    /**
     * Delete ALL entries (used by "Clear All Data").
     * @returns {Promise<void>}
     */
    async deleteAllEntries() {
        // Using .neq with a nil UUID is the established pattern in this codebase
        const { error } = await this._client
            .from('entries')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }

    /**
     * Bulk insert jobs (migration only).
     * @param {Array<{ name: string, base_rate: number, base_hours: number }>} rows
     * @returns {Promise<Job[]>}
     */
    async bulkInsertJobs(rows) {
        const { data, error } = await this._client.from('jobs').insert(rows).select();
        if (error) throw error;
        return data.map(this._mapJob);
    }

    /**
     * Bulk insert entries (migration only).
     * @param {Array<{ job_id: string, month: string, salary: number, hours: number }>} rows
     * @returns {Promise<void>}
     */
    async bulkInsertEntries(rows) {
        const { error } = await this._client.from('entries').insert(rows);
        if (error) throw error;
    }

    // ── Private mappers ────────────────────────────────────────────────────

    _mapJob(raw) {
        return { ...raw, baseRate: raw.base_rate, baseHours: raw.base_hours };
    }

    _mapEntry(raw) {
        return { ...raw, jobId: raw.job_id };
    }
}
