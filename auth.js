// Basic checks to ensure Supabase is loaded and configured
if (typeof supabase === 'undefined') {
    alert('Error: Supabase client not loaded. Check the script tag in index.html.');
}
if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    alert('Error: Supabase URL or Key not found. Make sure you have created config.js with your Supabase credentials.');
}

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');

    // Handle Login
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            alert(`Error logging in: ${error.message}`);
        } else {
            checkUser();
        }
    });

    // Handle Sign Up
    signupBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const { data, error } = await supabaseClient.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            alert(`Error signing up: ${error.message}`);
        } else {
            alert('Signed up successfully! Please check your email to confirm.');
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert(`Error logging out: ${error.message}`);
        }
        checkUser();
    });

    // Check user session
    const checkUser = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            // User is logged in
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
            userInfo.style.display = 'flex';
            userEmail.textContent = session.user.email;
            // Initialize the main app
            window.salaryTracker = new SalaryTracker(supabaseClient);
        } else {
            // User is not logged in
            authContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            userInfo.style.display = 'none';
        }
    };

    // Initial check
    checkUser();
});
