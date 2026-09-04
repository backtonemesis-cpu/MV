import type { AccentColor, AccentRgb, ThemePreference, UserPreferences } from './types';

export const THEME_STORAGE_KEY = 'mv_local_preferences_v1';
export const LEGACY_THEME_KEY = 'mv-theme-mode';

const ACCENT_RGB_FALLBACKS: Record<AccentColor, AccentRgb> = {
  emerald: { r: 34, g: 197, b: 94 },
  sapphire: { r: 37, g: 99, b: 235 },
  amethyst: { r: 139, g: 92, b: 246 },
  crimson: { r: 225, g: 29, b: 72 },
  amber: { r: 217, g: 119, b: 6 },
  teal: { r: 13, g: 148, b: 136 },
  indigo: { r: 79, g: 70, b: 229 },
  rose: { r: 219, g: 39, b: 119 },
  gold: { r: 180, g: 83, b: 9 },
};

function clampRgbChannel(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(255, Math.round(numeric)));
}

export function normalizeAccentRgb(value: unknown): AccentRgb | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as Partial<AccentRgb>;
  const r = clampRgbChannel(candidate.r);
  const g = clampRgbChannel(candidate.g);
  const b = clampRgbChannel(candidate.b);

  if (r === null || g === null || b === null) return undefined;
  return { r, g, b };
}

export function accentRgbForPreference(preferences: Pick<UserPreferences, 'accent' | 'accentRgb'>): AccentRgb {
  return normalizeAccentRgb(preferences.accentRgb) ?? ACCENT_RGB_FALLBACKS[preferences.accent];
}

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
  if (
    value === 'emerald' ||
    value === 'sapphire' ||
    value === 'amethyst' ||
    value === 'crimson' ||
    value === 'amber' ||
    value === 'teal' ||
    value === 'indigo' ||
    value === 'rose' ||
    value === 'gold'
  ) {
    return value;
  }

  // Legacy accent migration.
  if (value === 'default' || value === 'green') return 'emerald';
  if (value === 'blue') return 'sapphire';
  if (value === 'lilac' || value === 'purple') return 'amethyst';
  if (value === 'red') return 'crimson';
  if (value === 'yellow' || value === 'orange') return 'amber';

  return 'emerald';
}

export function normalizeUserPreferences(
  value: Partial<UserPreferences> | Record<string, unknown> | null | undefined
): UserPreferences {
  const normalized: UserPreferences = {
    theme: normalizeThemePreference(value?.theme),
    accent: normalizeAccentPreference(value?.accent),
  };

  const accentRgb = normalizeAccentRgb(value?.accentRgb);
  if (accentRgb) normalized.accentRgb = accentRgb;

  return normalized;
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

  const accentRgb = accentRgbForPreference(normalized);
  const accentRgbCss = `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`;
  resolvedRoot.style.setProperty('--accent-rgb', accentRgbCss);
  resolvedRoot.style.setProperty('--primary', `rgb(${accentRgbCss})`);
  resolvedRoot.style.setProperty('--primary-light', `rgba(${accentRgbCss}, 0.10)`);
  resolvedRoot.style.setProperty('--primary-light-text', `rgb(${accentRgbCss})`);

  // Compatibility only: semantic CSS variables remain the source of truth.
  resolvedRoot.classList.toggle('dark', normalized.theme !== 'light');
  resolvedRoot.style.colorScheme = normalized.theme === 'light' ? 'light' : 'dark';
}
