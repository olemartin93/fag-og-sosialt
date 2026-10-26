export type Theme = 'system' | 'light' | 'dark';
const KEY = 'fos-theme';

export function getTheme(): Theme {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
}
