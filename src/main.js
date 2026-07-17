/**
 * main.js — Application entry point (~20 lines).
 *
 * The browser loads this module after config.js injects
 * SUPABASE_URL and SUPABASE_ANON_KEY as globals.
 */
import { SalaryTracker } from './core/SalaryTracker.js';

// Bootstrap the application once the DOM is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SalaryTracker());
} else {
    new SalaryTracker();
}
