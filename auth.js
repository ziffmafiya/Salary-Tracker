// Initialize Supabase client without authentication
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const userInfo = document.getElementById('user-info');

    // Hide auth container and show app directly
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    userInfo.style.display = 'none';

    // Initialize the main app without authentication
    window.salaryTracker = new SalaryTracker(supabaseClient);
});
