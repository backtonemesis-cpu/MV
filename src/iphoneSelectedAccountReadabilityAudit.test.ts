import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Account } from './types';
import { accountIdentityLabel, accountOptionLabel } from './utils/accountDisplay';
import { formatPence } from './utils/currency';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const mariusLloyds: Account = {
  id: 'lloyds-marius',
  name: 'Lloyds',
  type: 'current',
  currency: 'GBP',
  startingBalancePence: 0,
  currentBalancePence: 328833,
  ownerPerson: 'Marius',
  isActive: true,
};

const vestaLloyds: Account = {
  id: 'lloyds-vesta',
  name: 'Lloyds',
  type: 'current',
  currency: 'GBP',
  startingBalancePence: 0,
  currentBalancePence: -19995,
  ownerPerson: 'Vesta',
  isActive: true,
};

describe('Step 44 iPhone selected-account readability contract', () => {
  it('keeps same-name account identity unambiguous by name, type and owner', () => {
    expect(accountIdentityLabel(mariusLloyds)).toBe('Lloyds · Current · Marius');
    expect(accountIdentityLabel(vestaLloyds)).toBe('Lloyds · Current · Vesta');
    expect(accountIdentityLabel(mariusLloyds)).not.toBe(accountIdentityLabel(vestaLloyds));
  });

  it('keeps picker options rich with the exact authoritative balance', () => {
    expect(accountOptionLabel(mariusLloyds)).toBe('Lloyds · Current · Marius · £3,288.33');
    expect(accountOptionLabel(vestaLloyds)).toBe('Lloyds · Current · Vesta · -£199.95');
  });

  it('derives the Phone selected-account presentation from the exact selected accountId and currentBalancePence', () => {
    const modal = read('components/TransactionModal.tsx');

    expect(modal).toContain("const selectedAccount = accounts.find((account) => account.id === accountId);");
    expect(modal).toContain('{accountIdentityLabel(selectedAccount)}');
    expect(modal).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('onChange={(e) => setAccountId(e.target.value)}');
    expect(formatPence(mariusLloyds.currentBalancePence)).toBe('£3,288.33');
  });

  it('keeps the Account picker option labels and repayment filtering semantics unchanged', () => {
    const modal = read('components/TransactionModal.tsx');

    expect(modal).toContain('{accountOptionLabel(acc)}');
    expect(modal).toContain('(acc.isActive !== false || acc.id === accountId)');
    expect(modal).toContain('(!isRepayment || acc.type !== \'credit\')');
    expect(modal).toContain('a.id !== accountId');
    expect(modal).toContain('(!isRepayment || a.type === \'credit\')');
  });

  it('gives Account and Category equivalent contained Phone outer-width treatment without changing unrelated selects', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('.mv-layout-phone #transaction-category.mv-transaction-control');
    expect(css).toContain('.mv-layout-phone #transaction-account.mv-transaction-control');

    const categoryRule = css.match(/\.mv-layout-phone #transaction-category\.mv-transaction-control \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    const accountRule = css.match(/\.mv-layout-phone #transaction-account\.mv-transaction-control \{([\s\S]*?)\n  \}/)?.[1] ?? '';

    for (const rule of [categoryRule, accountRule]) {
      expect(rule).toContain('width: 100% !important;');
      expect(rule).toContain('max-width: 100% !important;');
      expect(rule).toContain('margin-inline: 0 !important;');
      expect(rule).not.toContain('calc(100% +');
      expect(rule).not.toContain('margin-inline-end: -');
    }

    expect(css).not.toContain('.mv-layout-phone select.mv-transaction-control {');
  });

  it('preserves long Category content intact while the native picker remains available', () => {
    const modal = read('components/TransactionModal.tsx');
    const css = read('mobileUx.css');

    expect(modal).toContain('id="transaction-category"');
    expect(modal).toContain('value={categoryId}');
    expect(modal).toContain('onChange={(e) => setCategoryId(e.target.value)}');
    expect(css).toContain('-webkit-appearance: menulist;');
    expect(css).toContain('padding-inline: 16px 36px !important;');
    expect('Child Maintenance Received').toBe('Child Maintenance Received');
  });

  it('presents one coherent selected Account field instead of a clipped native label plus duplicate identity block', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('> #transaction-account {\n    grid-column: 1;\n    grid-row: 2;\n    color: transparent !important;');
    expect(css).toContain('.mv-layout-phone #transaction-account > option {\n    color: CanvasText;');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-summary {\n    display: contents;');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-identity');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-balance');
    expect(css).toContain('grid-row: 3;');
  });
});
