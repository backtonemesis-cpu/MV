import type { AccentRgb, ThemePreference } from '../types';

const NORMAL_TEXT_MIN_CONTRAST = 4.5;

const THEME_TEXT_SURFACE: Record<ThemePreference, AccentRgb> = {
  // Brightest routine surface for each theme: satisfying this surface also
  // protects darker/lighter routine surfaces used by navigation and controls.
  light: { r: 226, g: 232, b: 240 }, // #e2e8f0 surface-hover
  dark: { r: 30, g: 39, b: 62 }, // #1e273e surface-hover
  slate: { r: 71, g: 85, b: 105 }, // #475569 surface-hover
};

const BLACK: AccentRgb = { r: 0, g: 0, b: 0 };
const WHITE: AccentRgb = { r: 255, g: 255, b: 255 };

function linearChannel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: AccentRgb): number {
  return (
    0.2126 * linearChannel(rgb.r) +
    0.7152 * linearChannel(rgb.g) +
    0.0722 * linearChannel(rgb.b)
  );
}

export function contrastRatio(foreground: AccentRgb, background: AccentRgb): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function mixRgb(source: AccentRgb, target: AccentRgb, amount: number): AccentRgb {
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return {
    r: mix(source.r, target.r),
    g: mix(source.g, target.g),
    b: mix(source.b, target.b),
  };
}

export function accessibleAccentTextRgb(accent: AccentRgb, theme: ThemePreference): AccentRgb {
  const background = THEME_TEXT_SURFACE[theme];
  if (contrastRatio(accent, background) >= NORMAL_TEXT_MIN_CONTRAST) return accent;

  // Preserve hue as far as possible. Light themes darken the selected accent;
  // dark/slate themes lighten it until normal-size text reaches AA contrast.
  const target = theme === 'light' ? BLACK : WHITE;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mixRgb(accent, target, step / 100);
    if (contrastRatio(candidate, background) >= NORMAL_TEXT_MIN_CONTRAST) return candidate;
  }

  return target;
}

export function textOnAccentRgb(accent: AccentRgb): AccentRgb {
  return contrastRatio(BLACK, accent) >= contrastRatio(WHITE, accent) ? BLACK : WHITE;
}

export function rgbCss(rgb: AccentRgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
