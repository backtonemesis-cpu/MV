import { describe, expect, it } from 'vitest';
import type { AccentColor, AccentRgb, ThemePreference } from '../types';
import { accentRgbForPreference } from '../themeEngine';
import {
  accessibleAccentTextRgb,
  contrastRatio,
  textOnAccentRgb,
} from './accentContrast';

const ACCENTS: AccentColor[] = [
  'emerald',
  'sapphire',
  'amethyst',
  'crimson',
  'amber',
  'teal',
  'indigo',
  'rose',
  'gold',
];

const WORST_ROUTINE_SURFACE: Record<ThemePreference, AccentRgb> = {
  light: { r: 226, g: 232, b: 240 },
  dark: { r: 30, g: 39, b: 62 },
  slate: { r: 71, g: 85, b: 105 },
};

const CUSTOM_ACCENTS: AccentRgb[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 128, g: 128, b: 128 },
  { r: 6, g: 182, b: 212 },
  { r: 240, g: 180, b: 30 },
  { r: 120, g: 70, b: 220 },
];

describe('Stage 8 accent contrast', () => {
  it('derives AA normal-text accent colors for every preset across every theme', () => {
    for (const theme of ['light', 'dark', 'slate'] as ThemePreference[]) {
      for (const accent of ACCENTS) {
        const raw = accentRgbForPreference({ accent });
        const text = accessibleAccentTextRgb(raw, theme);
        expect(
          contrastRatio(text, WORST_ROUTINE_SURFACE[theme]),
          `${theme}/${accent}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('protects arbitrary custom accent RGB values across every theme', () => {
    for (const theme of ['light', 'dark', 'slate'] as ThemePreference[]) {
      for (const raw of CUSTOM_ACCENTS) {
        const text = accessibleAccentTextRgb(raw, theme);
        expect(contrastRatio(text, WORST_ROUTINE_SURFACE[theme])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('chooses readable text for accent-filled controls for presets and custom colors', () => {
    const allAccents = [
      ...ACCENTS.map((accent) => accentRgbForPreference({ accent })),
      ...CUSTOM_ACCENTS,
    ];

    for (const accent of allAccents) {
      expect(contrastRatio(textOnAccentRgb(accent), accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not change an already-compliant accent text color unnecessarily', () => {
    const sapphire = accentRgbForPreference({ accent: 'sapphire' });
    expect(accessibleAccentTextRgb(sapphire, 'light')).toEqual(sapphire);
  });
});
