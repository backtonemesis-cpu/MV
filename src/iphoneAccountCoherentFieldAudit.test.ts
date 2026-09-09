import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Step 44 iPhone Account coherent selected-state presentation', () => {
  it('keeps a native select for desktop/state parity and a contained Phone picker for interaction', () => {
    const modal = read('components/TransactionModal.tsx');
    const shared = read('components/UnifiedAddUi.tsx');
    const css = read('unifiedAddConsistency.css');

    expect(modal).toContain('id="transaction-account"');
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('<UnifiedAddAccountField');
    expect(shared).toContain('<select');
    expect(shared).toContain('value={value}');
    expect(shared).toContain('onChange={(event) => onChange(event.target.value)}');
    expect(shared).toContain('mv-mobile-account-trigger');
    expect(shared).toContain('mv-mobile-account-picker');
    expect(css).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(css).toContain('display: none !important');
    expect(css).toContain('.mv-layout-phone .mv-mobile-account-trigger');
    expect(css).toContain('display: flex');
  });

  it('keeps the authoritative account identity in the Phone trigger and balance secondary', () => {
    const shared = read('components/UnifiedAddUi.tsx');

    expect(shared).toContain('accountIdentityLabel(selectedAccount)');
    expect(shared).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(shared).toContain('mv-mobile-account-trigger');
    expect(shared).toContain('mv-selected-account-balance');
    expect(shared).not.toContain('mv-selected-account-identity');
  });

  it('keeps Account and Category inside the real Phone container without negative width extensions', () => {
    const css = read('mobileUx.css');
    expect(css).toContain('#transaction-account.mv-transaction-control');
    expect(css).toContain('#transaction-category.mv-transaction-control');
    expect(css).not.toContain('width: calc(100% + 12px)');
    expect(css).not.toContain('max-width: calc(100% + 12px)');
    expect(css).not.toContain('margin-inline-end: -12px');
    expect((css.match(/width: 100% !important;/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(css).not.toContain('.mv-layout-phone select.mv-transaction-control {');
  });

  it('keeps the contained Phone picker scrollable rather than opening the oversized native account sheet', () => {
    const css = read('unifiedAddConsistency.css');
    expect(css).toContain('.mv-mobile-account-picker-list');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('max-height: min(68dvh, 620px)');
    expect(css).not.toContain('calc(100% +');
  });
});
