import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('Shared GBP money-input regression guard', () => {
  it('protects every shared money input with tight non-overlapping spacing', () => {
    const rule = css.match(
      /\.mv-density-root input\.mv-money-input-control\s*\{[^}]+\}/s
    )?.[0] ?? '';

    expect(rule).toContain('padding-left: 23px !important');
    expect(rule).toContain('padding-right: 12px !important');
    expect(rule).toContain('font-size: 13px !important');
    expect(rule).toContain('font-weight: 600 !important');
  });

  it('keeps the non-editable prefix aligned as part of the monetary value', () => {
    const prefixRule = css.match(/\.mv-money-prefix\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(prefixRule).toContain('left: 11px');
    expect(prefixRule).toContain('top: 50%');
    expect(prefixRule).toContain('transform: translateY(-50%)');
    expect(prefixRule).toContain('font-size: 13px !important');
    expect(prefixRule).toContain('font-weight: 600 !important');
    expect(prefixRule).toContain('line-height: 1.2 !important');
  });

  it('keeps placeholder, entered, focus and disabled GBP prefix states coherent', () => {
    expect(css).toContain('.mv-density-root input.mv-money-input-control::placeholder');
    expect(css).toContain('opacity: 1');
    expect(css).toContain('.mv-money-input-shell:has(input.mv-money-input-control:not(:placeholder-shown)) .mv-money-prefix');
    expect(css).toContain('.mv-money-input-shell:focus-within .mv-money-prefix');
    expect(css).toContain('.mv-money-input-shell:has(input.mv-money-input-control:disabled) .mv-money-prefix');
  });

  it('scales shared money entry correctly in Phone mode', () => {
    expect(css).toContain('.mv-layout-phone input.mv-money-input-control');
    expect(css).toContain('padding-left: 26px !important');
    const phonePrefix = css.match(/\.mv-layout-phone \.mv-money-prefix\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(phonePrefix).toContain('font-size: 16px !important');
  });
});

describe('Transaction modal initial focus regression guard', () => {
  it('does not force autofocus into the amount field when the modal opens', () => {
    const transactionModal = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
      'utf8'
    );

    expect(transactionModal).not.toMatch(/<input\s+autoFocus\s+type="text"/);
    expect(transactionModal).not.toContain('autoFocus\n                  type="text"');
  });
});
