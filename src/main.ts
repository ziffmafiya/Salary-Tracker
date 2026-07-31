import { SalaryTracker } from './core/SalaryTracker.js';
import { ThemeService } from './services/ThemeService.js';

function initApp() {
    ThemeService.init();
    new SalaryTracker();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

