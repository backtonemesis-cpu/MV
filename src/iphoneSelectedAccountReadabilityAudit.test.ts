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

  it('derives the Phone selected-account summary from the exact selected accountId and currentBalancePence', () => {
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

  it('limits the new visual treatment to the selected-account summary in Phone mode', () => {
    const css = read('mobileUx.css');

    expect(css).toContain('.mv-selected-account-summary {\n  display: none;');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-summary');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-identity');
    expect(css).toContain('.mv-layout-phone .mv-selected-account-balance');
    expect(css).not.toContain('#transaction-account.mv-transaction-control');
  });
});
