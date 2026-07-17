/* ── Globals injected by config.js ────────────────────────────────── */
declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;

/* ── Supabase CDN global (@supabase/supabase-js) ──────────────────── */
declare namespace supabase {
    function createClient(url: string, key: string): import('@supabase/supabase-js').SupabaseClient;
}

/* ── Chart.js CDN global ──────────────────────────────────────────── */
interface ChartConfiguration {
    type: string;
    data: any;
    options?: any;
}
declare class Chart {
    static defaults: { color: string; borderColor: string };
    constructor(ctx: CanvasRenderingContext2D, config: ChartConfiguration);
    data: any;
    options: any;
    update(mode?: string): void;
    destroy(): void;
}
