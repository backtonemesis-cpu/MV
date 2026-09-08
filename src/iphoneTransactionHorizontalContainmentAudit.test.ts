import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Step 44 iPhone transaction horizontal containment contract', () => {
  it('makes the transaction modal a vertical-only contained scroll surface', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('.mv-layout-phone .mv-transaction-modal,');
    expect(css).toContain('.mv-layout-phone .mv-transaction-modal > form,');
    expect(css).toContain('.mv-layout-phone .mv-transaction-body {');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain('overflow-x: clip;');
    expect(css).toContain('overscroll-behavior-inline: none;');
  });

  it('constrains transaction body and grid descendants instead of relying on overflow clipping alone', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('.mv-layout-phone .mv-transaction-body > *,');
    expect(css).toContain('.mv-layout-phone .mv-transaction-body .mv-modal-grid-2,');
    expect(css).toContain('.mv-layout-phone .mv-transaction-body .mv-modal-grid-2 > * {');
    expect(css).toContain('box-sizing: border-box;');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('max-width: 100%;');
  });

  it('keeps Account and Category at real container width with no negative extension', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('#transaction-account.mv-transaction-control');
    expect(css).toContain('#transaction-category.mv-transaction-control');
    expect(css).not.toContain('calc(100% + 12px)');
    expect(css).not.toContain('margin-inline-end: -12px');
  });

  it('does not alter TransactionModal account/category binding semantics', () => {
    const modal = read('components/TransactionModal.tsx');

    expect(modal).toContain('id="transaction-account"');
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('onChange={(e) => setAccountId(e.target.value)}');
    expect(modal).toContain('id="transaction-category"');
    expect(modal).toContain('value={categoryId}');
    expect(modal).toContain('onChange={(e) => setCategoryId(e.target.value)}');
  });
});
