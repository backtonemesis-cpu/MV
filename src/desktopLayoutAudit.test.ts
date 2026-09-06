import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (name: string) => fs.readFileSync(path.join(SRC, name), 'utf8');

describe('Audited desktop layout contract', () => {
  it('caps the PC workspace at 1440px instead of forcing an unlimited viewport', () => {
    const css = read('index.css');
    const app = read('App.tsx');
    const header = read('components/Header.tsx');
    const navigation = read('components/Navigation.tsx');

    expect(css).toContain('--device-shell-max: 1440px');
    expect(css).toContain('max-width: 1440px !important');
    expect(app).toContain('max-w-[1440px]');
    expect(header).toContain('max-w-[1440px]');
    expect(navigation).toContain('max-w-[1440px]');
    const auditedContract = css.slice(css.lastIndexOf('AUDITED DESKTOP CONTRACT'));
    expect(auditedContract).toContain('max-width: 1440px !important');
    expect(auditedContract).toContain('margin-inline: auto !important');
  });

  it('keeps the PC app bar and routine form controls at the audited sizes', () => {
    const css = read('index.css');
    const header = read('components/Header.tsx');
    expect(css).toContain('min-height: 64px !important');
    expect(css).toContain('height: 64px !important');
    expect(header).toContain('flex h-16 items-center');
    expect(css).toContain('min-height: 40px !important');
    expect(css).toContain('height: 40px !important');
  });

  it('does not use the CSS zoom property to solve desktop readability', () => {
    const css = read('index.css');
    expect(css).not.toMatch(/(^|[;{]\s*)zoom\s*:/m);
  });
});