import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8');

function luminance(hex: string): number {
  const rgb = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4)
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Settings contrast regression guard', () => {
  it('does not hard-code the old low-contrast slate text for inactive settings controls', () => {
    expect(css).toContain('.mv-settings-tab');
    expect(css).toContain('.mv-settings-segment');
    expect(css).toContain('color: var(--text-muted);');

    const tabRule = css.match(/\.mv-settings-tab\s*\{[^}]+\}/s)?.[0] ?? '';
    const segmentRule = css.match(/\.mv-settings-segment\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(tabRule).not.toContain('color: #64748B');
    expect(segmentRule).not.toContain('color: #64748B');
  });

  it('routes Settings panel and audit supporting text through the hardened theme tokens', () => {
    expect(css).toContain('.mv-settings-panel .text-muted');
    expect(css).toContain('.mv-settings-panel .text-subtle');
    expect(css).toContain('.mv-settings-log-row .text-muted');
    expect(css).toContain('.mv-settings-log-row .text-subtle');
    expect(css).toContain('color: var(--text-muted);');
    expect(css).toContain('color: var(--text-subtle);');
  });

  it('uses dark text on fixed green primary backgrounds at AA contrast', () => {
    expect(contrast('#22C55E', '#0F172A')).toBeGreaterThanOrEqual(4.5);

    const settingsPrimary = css.match(/\.mv-settings-primary\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(settingsPrimary).toContain('background: #22C55E');
    expect(settingsPrimary).toContain('color: #0F172A');

    const sharedPrimary = css.match(/\.mv-backup-primary,\s*\.mv-income-primary\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(sharedPrimary).toContain('background: #22C55E');
    expect(sharedPrimary).toContain('color: #0F172A');

    const transactionPrimary = css.match(/\.mv-transaction-primary,\s*\.mv-account-primary,\s*\.mv-income-primary\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(transactionPrimary).toContain('background: #22C55E');
    expect(transactionPrimary).toContain('color: #0F172A');
  });

  it('routes transaction modal inactive type and payer controls through hardened muted text', () => {
    const typeRule = css.match(/\.mv-transaction-type-tab\s*\{[^}]+\}/s)?.[0] ?? '';
    const payerRule = css.match(/\.mv-transaction-selector-pill\s*\{[^}]+\}/s)?.[0] ?? '';
    const integrityRule = css.match(/\.mv-integrity-title\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(typeRule).toContain('color: var(--text-muted)');
    expect(payerRule).toContain('color: var(--text-muted)');
    expect(integrityRule).toContain('color: var(--text-muted)');
    expect(typeRule).not.toContain('color: #64748B');
    expect(payerRule).not.toContain('color: #64748B');
  });
});
