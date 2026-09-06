import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('Transaction amount money-prefix regression guard', () => {
  it('protects transaction-body money inputs from the currency prefix', () => {
    const rule = css.match(
      /\.mv-modal-form input\.mv-money-input-with-prefix,[\s\S]*?\.mv-transaction-body input\.mv-money-input-with-prefix\s*\{[^}]+\}/
    )?.[0] ?? '';

    expect(rule).toContain('.mv-transaction-body input.mv-money-input-with-prefix');
    expect(rule).toContain('padding-left: 32px !important');
    expect(rule).toContain('padding-right: 12px !important');
  });

  it('keeps the prefix positioned independently from the entered value', () => {
    const prefixRule = css.match(/\.mv-money-prefix\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(prefixRule).toContain('z-index: 1');
    expect(prefixRule).toContain('color: var(--text-muted) !important');
  });
});
