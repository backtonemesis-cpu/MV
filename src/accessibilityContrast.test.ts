import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const channel = (value: number) => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const normalized = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) =>
    channel(Number.parseInt(normalized.slice(offset, offset + 2), 16))
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('Stage 7 supporting-text contrast contract', () => {
  it('loads accessibility contrast overrides after all earlier presentation layers', () => {
    const main = read('main.tsx');
    expect(main).toContain("import './accessibilityContrast.css';");
    expect(main.indexOf("import './accessibilityContrast.css';")).toBeGreaterThan(
      main.indexOf("import './mobileUx.css';")
    );
  });

  it('keeps normal-size muted/subtle text at or above WCAG AA across common theme surfaces', () => {
    const cases = [
      {
        theme: 'light',
        foreground: '#566579',
        backgrounds: ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0'],
      },
      {
        theme: 'dark',
        foreground: '#94a3b8',
        backgrounds: ['#0f131e', '#181f32', '#1e273e', '#111522'],
      },
      {
        theme: 'slate',
        foreground: '#cbd5e1',
        backgrounds: ['#1e293b', '#334155', '#293548', '#475569', '#1f2937'],
      },
    ];

    for (const testCase of cases) {
      for (const background of testCase.backgrounds) {
        expect(
          contrast(testCase.foreground, background),
          `${testCase.theme}: ${testCase.foreground} on ${background}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('changes only reference/supporting text tokens in the override stylesheet', () => {
    const css = read('accessibilityContrast.css');
    expect(css).toContain('--text-muted: #566579');
    expect(css).toContain('--text-subtle: #566579');
    expect(css).toContain('--text-muted: #94a3b8');
    expect(css).toContain('--text-subtle: #94a3b8');
    expect(css).toContain('--text-muted: #cbd5e1');
    expect(css).toContain('--text-subtle: #cbd5e1');
    expect(css).not.toContain('--success-text:');
    expect(css).not.toContain('--danger-text:');
    expect(css).not.toContain('--primary:');
  });
});
