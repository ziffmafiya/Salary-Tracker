import { SalaryTracker } from './core/SalaryTracker.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SalaryTracker());
} else {
    new SalaryTracker();
}
