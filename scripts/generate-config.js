/**
 * Generates config.js from environment variables at build time (Vercel).
 * Supports SUPABASE_* (preferred) and VITE_SUPABASE_* names.
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
        'Missing Supabase credentials.\n' +
        'Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Environment Variables.'
    );
    process.exit(1);
}

const configPath = path.join(__dirname, '..', 'config.js');
const contents = `// Generated at build time — do not edit or commit
const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
`;

fs.writeFileSync(configPath, contents, 'utf8');
console.log('Wrote config.js from environment variables.');
