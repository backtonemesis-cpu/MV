import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemePreferences,
  normalizeAccentPreference,
  normalizeAccentRgb,
  normalizeCardBorderPreference,
  normalizeCardDensityPreference,
  normalizeCardRadiusPreference,
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

  it('accepts the nine premium accents and migrates legacy values', () => {
    expect(normalizeAccentPreference('emerald')).toBe('emerald');
    expect(normalizeAccentPreference('sapphire')).toBe('sapphire');
    expect(normalizeAccentPreference('amethyst')).toBe('amethyst');
    expect(normalizeAccentPreference('crimson')).toBe('crimson');
    expect(normalizeAccentPreference('amber')).toBe('amber');
    expect(normalizeAccentPreference('teal')).toBe('teal');
    expect(normalizeAccentPreference('indigo')).toBe('indigo');
    expect(normalizeAccentPreference('rose')).toBe('rose');
    expect(normalizeAccentPreference('gold')).toBe('gold');

    expect(normalizeAccentPreference('blue')).toBe('sapphire');
    expect(normalizeAccentPreference('lilac')).toBe('amethyst');
    expect(normalizeAccentPreference('purple')).toBe('amethyst');
    expect(normalizeAccentPreference('red')).toBe('crimson');
    expect(normalizeAccentPreference('yellow')).toBe('amber');
    expect(normalizeAccentPreference('orange')).toBe('amber');
    expect(normalizeAccentPreference('green')).toBe('emerald');
    expect(normalizeAccentPreference('default')).toBe('emerald');
  });

  it('normalizes card appearance preferences safely', () => {
    expect(normalizeCardDensityPreference('compact')).toBe('compact');
    expect(normalizeCardDensityPreference('comfortable')).toBe('comfortable');
    expect(normalizeCardDensityPreference('unknown')).toBe('compact');

    expect(normalizeCardRadiusPreference('sharp')).toBe('sharp');
    expect(normalizeCardRadiusPreference('subtle')).toBe('subtle');
    expect(normalizeCardRadiusPreference('rounded')).toBe('rounded');
    expect(normalizeCardRadiusPreference('unknown')).toBe('subtle');

    expect(normalizeCardBorderPreference('none')).toBe('none');
    expect(normalizeCardBorderPreference('subtle')).toBe('subtle');
    expect(normalizeCardBorderPreference('high')).toBe('high');
    expect(normalizeCardBorderPreference('unknown')).toBe('subtle');
  });

  it('normalizes custom RGB accent channels safely', () => {
    expect(normalizeAccentRgb({ r: 6, g: 182, b: 212 })).toEqual({
      r: 6,
      g: 182,
      b: 212,
    });
    expect(normalizeAccentRgb({ r: -20, g: 300, b: 12.6 })).toEqual({
      r: 0,
      g: 255,
      b: 13,
    });
    expect(normalizeAccentRgb({ r: 'bad', g: 100, b: 100 })).toBeUndefined();

    expect(
      normalizeUserPreferences({
        theme: 'dark',
        accent: 'teal',
        accentRgb: { r: 6, g: 182, b: 212 },
      })
    ).toEqual({
      theme: 'dark',
      accent: 'teal',
      accentRgb: { r: 6, g: 182, b: 212 },
      cardDensity: 'compact',
      cardRadius: 'subtle',
      cardBorder: 'subtle',
    });
  });

  it('applies accent and card geometry variables together', () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();

    const root = {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      style: {
        setProperty: (name: string, value: string) => properties.set(name, value),
        colorScheme: '',
      },
      classList: {
        toggle: vi.fn(),
      },
    } as unknown as HTMLElement;

    applyThemePreferences(
      {
        theme: 'dark',
        accent: 'teal',
        accentRgb: { r: 6, g: 182, b: 212 },
        cardDensity: 'comfortable',
        cardRadius: 'rounded',
        cardBorder: 'high',
      },
      root
    );

    expect(properties.get('--accent-rgb')).toBe('6, 182, 212');
    expect(properties.get('--card-padding')).toBe('16px 20px');
    expect(properties.get('--card-gap')).toBe('14px');
    expect(properties.get('--card-font-scale')).toBe('14px');
    expect(properties.get('--card-radius')).toBe('8px');
    expect(properties.get('--card-border')).toBe('1px solid #3B4B75');
    expect(attributes.get('data-card-density')).toBe('comfortable');
    expect(attributes.get('data-card-radius')).toBe('rounded');
    expect(attributes.get('data-card-border')).toBe('high');
  });

  it('normalizes stored legacy preferences safely', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'slate', accent: 'blue' }));

    expect(readStoredUserPreferences(storage)).toEqual({
      theme: 'slate',
      accent: 'sapphire',
      cardDensity: 'compact',
      cardRadius: 'subtle',
      cardBorder: 'subtle',
    });
  });

  it('returns a complete valid token pair for missing values', () => {
    expect(normalizeUserPreferences({})).toEqual({
      theme: 'light',
      accent: 'emerald',
      cardDensity: 'compact',
      cardRadius: 'subtle',
      cardBorder: 'subtle',
    });
  });
});
