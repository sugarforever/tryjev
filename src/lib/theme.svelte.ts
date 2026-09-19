// Shared theme state: <html data-theme> is set before paint by the inline script in app.html
// (?theme=… wins over localStorage, default candy); the layout syncs this store with it and persists changes.
export type Theme = 'swiss' | 'candy';
export const THEMES: Theme[] = ['swiss', 'candy'];
export const theme = $state<{ value: Theme }>({ value: 'candy' });
export const isTheme = (t: unknown): t is Theme => t === 'swiss' || t === 'candy';
