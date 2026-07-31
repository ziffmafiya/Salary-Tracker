export class ThemeService {
    private static STORAGE_KEY = 'salary_tracker_theme';

    public static init(): void {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') {
            this.setTheme(savedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', () => this.toggleTheme());
        }

        const oldSwitch = document.querySelector('.theme-switcher input') as HTMLInputElement | null;
        if (oldSwitch) {
            oldSwitch.checked = (document.body.getAttribute('data-theme') === 'dark');
            oldSwitch.addEventListener('change', () => {
                this.setTheme(oldSwitch.checked ? 'dark' : 'light');
            });
        }
    }

    public static getTheme(): 'light' | 'dark' {
        return (document.body.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    }

    public static setTheme(theme: 'light' | 'dark'): void {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.setAttribute('data-active-theme', theme);
        }

        const oldSwitch = document.querySelector('.theme-switcher input') as HTMLInputElement | null;
        if (oldSwitch) {
            oldSwitch.checked = (theme === 'dark');
        }
    }

    public static toggleTheme(): void {
        const current = this.getTheme();
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
}
