import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeAccentPreference,
  normalizeThemePreference,
  normalizeUserPreferences,
  readStoredUserPreferences,
  THEME_STORAGE_KEY,
} from './themeEngine';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

describe('token theme engine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts only the three base modes', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('slate')).toBe('slate');
    expect(normalizeThemePreference('unknown')).toBe('light');
  });

  it('migrates legacy system mode to the current OS preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(normalizeThemePreference('system')).toBe('dark');

    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(normalizeThemePreference('system')).toBe('light');
  });

  it('maps legacy accents into the new three-accent palette', () => {
    expect(normalizeAccentPreference('emerald')).toBe('emerald');
    expect(normalizeAccentPreference('blue')).toBe('sapphire');
    expect(normalizeAccentPreference('indigo')).toBe('sapphire');
    expect(normalizeAccentPreference('lilac')).toBe('amethyst');
    expect(normalizeAccentPreference('purple')).toBe('amethyst');
    expect(normalizeAccentPreference('orange')).toBe('emerald');
  });

  it('normalizes stored legacy preferences safely', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'slate', accent: 'blue' }));

    expect(readStoredUserPreferences(storage)).toEqual({
      theme: 'slate',
      accent: 'sapphire',
    });
  });

  it('returns a complete valid token pair for missing values', () => {
    expect(normalizeUserPreferences({})).toEqual({
      theme: 'light',
      accent: 'emerald',
    });
  });
});
