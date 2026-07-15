# Salary Tracker - Environment Variables Setup

## For Vercel Deployment

Add these environment variables in your Vercel project settings:

1. Go to your project on Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

| Variable Name | Value |
|--------------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., https://xxx.supabase.co) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

4. Make sure to add them for **Production**, **Preview**, and **Development** environments

## For Local Development

1. Copy `config.example.js` to `config.js`
2. Replace the placeholder values with your actual Supabase credentials
3. The `config.js` file is git-ignored and will NOT be committed

**NEVER** commit `config.js` or expose your credentials in the repository.
