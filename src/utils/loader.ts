const overlay = () => document.getElementById('loadingOverlay');

export function showLoader(text?: string): void {
    const el = overlay();
    if (!el) return;
    const txt = el.querySelector('.loading-text');
    if (txt && text) txt.textContent = text;
    el.classList.remove('hidden');
}

export function hideLoader(): void {
    const el = overlay();
    if (!el) return;
    el.classList.add('hidden');
}
