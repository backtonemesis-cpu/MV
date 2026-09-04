import type { AccentColor, ThemePreference, UserPreferences } from './types';

export const THEME_STORAGE_KEY = 'mv_local_preferences_v1';
export const LEGACY_THEME_KEY = 'mv-theme-mode';

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'slate') return value;

  if (value === 'system') {
    try {
      return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  return 'light';
}

export function normalizeAccentPreference(value: unknown): AccentColor {
  if (value === 'emerald' || value === 'sapphire' || value === 'amethyst') return value;

  if (value === 'blue' || value === 'indigo') return 'sapphire';
  if (value === 'lilac' || value === 'purple') return 'amethyst';

  return 'emerald';
}

export function normalizeUserPreferences(
  value: Partial<UserPreferences> | Record<string, unknown> | null | undefined
): UserPreferences {
  return {
    theme: normalizeThemePreference(value?.theme),
    accent: normalizeAccentPreference(value?.accent),
  };
}

export function readStoredUserPreferences(storage?: Storage | null): UserPreferences {
  let resolvedStorage = storage;

  try {
    if (resolvedStorage === undefined) {
      resolvedStorage = globalThis.localStorage ?? null;
    }
  } catch {
    resolvedStorage = null;
  }

  if (!resolvedStorage) return { theme: 'light', accent: 'emerald' };

  try {
    const saved = resolvedStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      return normalizeUserPreferences(JSON.parse(saved));
    }

    return {
      theme: normalizeThemePreference(resolvedStorage.getItem(LEGACY_THEME_KEY)),
      accent: 'emerald',
    };
  } catch {
    return { theme: 'light', accent: 'emerald' };
  }
}

export function applyThemePreferences(
  preferences: UserPreferences,
  root?: HTMLElement | null
): void {
  const normalized = normalizeUserPreferences(preferences);
  const resolvedRoot =
    root ??
    (typeof document !== 'undefined' ? document.documentElement : null);

  if (!resolvedRoot) return;

  resolvedRoot.setAttribute('data-theme', normalized.theme);
  resolvedRoot.setAttribute('data-accent', normalized.accent);

  // Compatibility only: semantic CSS variables remain the source of truth.
  resolvedRoot.classList.toggle('dark', normalized.theme !== 'light');
  resolvedRoot.style.colorScheme = normalized.theme === 'light' ? 'light' : 'dark';
}
