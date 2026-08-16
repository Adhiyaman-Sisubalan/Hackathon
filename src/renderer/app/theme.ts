export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = typeof themeModes[number];

const storageKey = 'reconciliation.theme';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Storage is unavailable on some packaged origins, so a failed read must not break start-up. */
export function storedThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isThemeMode(stored) ? stored : 'system';
  } catch { return 'system'; }
}

export function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export function persistThemeMode(mode: ThemeMode): void {
  try {
    if (mode === 'system') window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, mode);
  } catch { /* preference is best-effort only */ }
}
