# Salary Tracker - Environment Variables Setup

## For Vercel Deployment

This is a static site. Vercel env vars are **not** available in the browser by themselves.
On each deploy the `build` script writes them into `config.js`.

1. Go to your project on Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:

| Variable Name | Value |
|--------------|-------|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase anon / public key |

4. Enable them for **Production**, **Preview**, and **Development**
5. Redeploy the project after adding or changing variables

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are also accepted if you already use those names.

## For Local Development

1. Copy `config.example.js` to `config.js`
2. Put your real Supabase URL and anon key in `config.js`
3. `config.js` is git-ignored and will not be committed

**NEVER** commit `config.js` with real credentials.
