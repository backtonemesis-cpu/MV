import { describe, expect, it } from 'vitest';

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Stage 4 WCAG small-text contrast guardrails', () => {
  const minimum = 4.5;

  it('keeps light-theme supporting text at AA contrast on white and muted surfaces', () => {
    expect(contrast('#5f6f85', '#ffffff')).toBeGreaterThanOrEqual(minimum);
    expect(contrast('#5f6f85', '#f1f5f9')).toBeGreaterThanOrEqual(minimum);
  });

  it('keeps dark-theme subtle text at AA contrast on primary finance surfaces', () => {
    expect(contrast('#94a3b8', '#181f32')).toBeGreaterThanOrEqual(minimum);
    expect(contrast('#94a3b8', '#0f131e')).toBeGreaterThanOrEqual(minimum);
  });

  it('keeps slate-theme subtle text at AA contrast on its surface', () => {
    expect(contrast('#cbd5e1', '#334155')).toBeGreaterThanOrEqual(minimum);
  });
});
