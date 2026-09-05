import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const COMPONENT_DIR = path.join(SRC_DIR, 'components');

function collectTsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

describe('semantic design system enforcement', () => {
  it('keeps application JSX free of hardcoded palette utilities', () => {
    const files = [
      path.join(SRC_DIR, 'App.tsx'),
      ...collectTsxFiles(COMPONENT_DIR),
    ];

    const bannedPatterns: { label: string; regex: RegExp }[] = [
      {
        label: 'hardcoded Tailwind palette color',
        regex:
          /\b(?:bg|text|border|divide|ring|outline|fill|stroke)-(?:slate|zinc|neutral|white|black|emerald|amber|rose|cyan|blue|purple|teal|indigo|red|green|orange|yellow)(?:-|\/|\b)/g,
      },
      {
        label: 'arbitrary hex color utility',
        regex: /\b(?:bg|text|border|divide|ring|outline|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
      },
      {
        label: 'direct primary-token arbitrary utility',
        regex: /\b(?:bg|text|border|ring)-\[var\(--primary(?:-light)?\)\]/g,
      },
      {
        label: 'legacy dark color override',
        regex: /\bdark:(?:bg|text|border|divide|ring)-/g,
      },
      {
        label: 'legacy MV color helper',
        regex:
          /\b(?:mv-surface|mv-surface-muted|mv-text|mv-text-muted|mv-border|mv-primary-bg|mv-primary-text|mv-primary-soft|mv-primary-border|mv-primary-button|mv-secondary-button|mv-input|mv-table|mv-overlay|mv-on-primary|mv-on-primary-muted)\b/g,
      },
    ];

    const failures: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const rule of bannedPatterns) {
        const matches = [...source.matchAll(rule.regex)].map((match) => match[0]);
        if (matches.length > 0) {
          failures.push(
            `${path.relative(process.cwd(), file)}: ${rule.label}: ${[...new Set(matches)].join(', ')}`
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
