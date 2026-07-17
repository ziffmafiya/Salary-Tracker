// Serves Supabase client config from Vercel environment variables.
// Available at /api/config (and via rewrite as /config.js).
export default function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        res.status(500).send(
            'console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in Vercel Environment Variables.");\n'
        );
        return;
    }

    res.status(200).send(
        `const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};\n` +
        `const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};\n`
    );
}
