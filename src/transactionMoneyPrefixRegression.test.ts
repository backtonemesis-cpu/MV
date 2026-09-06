import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('Transaction amount money-prefix regression guard', () => {
  it('protects every prefixed money input across the density-root UI', () => {
    const rule = css.match(
      /\.mv-density-root input\.mv-money-input-with-prefix\s*\{[^}]+\}/s
    )?.[0] ?? '';

    expect(rule).toContain('.mv-density-root input.mv-money-input-with-prefix');
    expect(rule).toContain('padding-left: 32px !important');
    expect(rule).toContain('padding-right: 12px !important');
  });

  it('keeps the prefix aligned as part of the monetary value rather than tiny/detached', () => {
    const prefixRule = css.match(/\.mv-money-prefix\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(prefixRule).toContain('z-index: 1');
    expect(prefixRule).toContain('font-size: 13px !important');
    expect(prefixRule).toContain('font-weight: 600 !important');
    expect(prefixRule).toContain('line-height: 1.2 !important');
    expect(prefixRule).toContain('color: var(--text-muted) !important');
  });

  it('keeps placeholder, entered and disabled GBP prefix states visually coherent', () => {
    expect(css).toContain('.mv-density-root input.mv-money-input-with-prefix::placeholder');
    expect(css).toContain('opacity: 1');
    expect(css).toContain('.mv-money-prefix:has(+ input.mv-money-input-with-prefix:not(:placeholder-shown))');
    expect(css).toContain('color: var(--text) !important');
    expect(css).toContain('.mv-money-prefix:has(+ input.mv-money-input-with-prefix:disabled)');
    expect(css).toContain('color: var(--text-subtle) !important');
  });

  it('scales the shared GBP prefix to the mobile input text size', () => {
    const phoneRule = css.match(/\.mv-layout-phone \.mv-money-prefix\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(phoneRule).toContain('font-size: 16px !important');
    expect(phoneRule).toContain('font-weight: 600 !important');
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
