import { describe, expect, it, vi } from 'vitest';
import { applyThemePreferences } from './themeEngine';

describe('Stage 8 applied accent semantics', () => {
  it('preserves the chosen accent fill while deriving separate readable text tokens', () => {
    const properties = new Map<string, string>();
    const root = {
      setAttribute: vi.fn(),
      style: {
        setProperty: (name: string, value: string) => properties.set(name, value),
        colorScheme: '',
      },
      classList: { toggle: vi.fn() },
    } as unknown as HTMLElement;

    applyThemePreferences(
      {
        theme: 'light',
        accent: 'emerald',
        accentRgb: { r: 34, g: 197, b: 94 },
        cardDensity: 'compact',
        cardRadius: 'subtle',
        cardBorder: 'subtle',
      },
      root
    );

    expect(properties.get('--accent-rgb')).toBe('34, 197, 94');
    expect(properties.get('--primary')).toBe('rgb(34, 197, 94)');
    expect(properties.get('--primary-light')).toBe('rgba(34, 197, 94, 0.10)');
    expect(properties.get('--color-accent')).toBeDefined();
    expect(properties.get('--color-accent')).not.toBe('rgb(34, 197, 94)');
    expect(properties.get('--primary-light-text')).toBe(properties.get('--color-accent'));
    expect(properties.get('--text-on-primary')).toBe('rgb(0, 0, 0)');
  });

  it('keeps custom RGB as the selected accent while making its text form theme-safe', () => {
    const properties = new Map<string, string>();
    const root = {
      setAttribute: vi.fn(),
      style: {
        setProperty: (name: string, value: string) => properties.set(name, value),
        colorScheme: '',
      },
      classList: { toggle: vi.fn() },
    } as unknown as HTMLElement;

    applyThemePreferences(
      {
        theme: 'slate',
        accent: 'teal',
        accentRgb: { r: 120, g: 70, b: 220 },
        cardDensity: 'compact',
        cardRadius: 'subtle',
        cardBorder: 'subtle',
      },
      root
    );

    expect(properties.get('--primary')).toBe('rgb(120, 70, 220)');
    expect(properties.get('--color-accent')).toBeDefined();
    expect(properties.get('--primary-light-text')).toBe(properties.get('--color-accent'));
  });

  it('loads legacy primary-text compatibility after the earlier contrast layers', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = path.resolve(process.cwd(), 'src');
    const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');
    const css = fs.readFileSync(path.join(src, 'accentContrast.css'), 'utf8');

    expect(main).toContain("import './accentContrast.css';");
    expect(main.indexOf("import './accentContrast.css';")).toBeGreaterThan(
      main.indexOf("import './accessibilityContrast.css';")
    );
    expect(css).toContain('.mv-primary-text');
    expect(css).toContain('color: var(--color-accent) !important');
  });
});
