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

  it('keeps authoritative rich account labels available', () => {
    expect(accountOptionLabel(mariusLloyds)).toBe('Lloyds · Current · Marius · £3,288.33');
    expect(accountOptionLabel(vestaLloyds)).toBe('Lloyds · Current · Vesta · -£199.95');
  });

  it('derives the selected-account presentation from exact accountId and currentBalancePence', () => {
    const modal = read('components/TransactionModal.tsx');
    const shared = read('components/UnifiedAddUi.tsx');

    expect(modal).toContain("const selectedAccount = accounts.find((account) => account.id === accountId);");
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('<UnifiedAddAccountField');
    expect(shared).toContain('const selectedAccount = options.find((account) => account.id === value)');
    expect(shared).toContain('label: accountIdentityLabel(account)');
    expect(shared).toContain('trailing: formatPence(account.currentBalancePence)');
    expect(shared).toContain('onValueChange={onChange}');
    expect(formatPence(mariusLloyds.currentBalancePence)).toBe('£3,288.33');
  });

  it('keeps repayment account filtering semantics unchanged', () => {
    const modal = read('components/TransactionModal.tsx');

    expect(modal).toContain('(acc.isActive !== false || acc.id === accountId)');
    expect(modal).toContain('(!isRepayment || acc.type !== \'credit\')');
    expect(modal).toContain('a.id !== accountId');
    expect(modal).toContain('(!isRepayment || a.type === \'credit\')');
  });

  it('uses one shared account dropdown rather than Phone-only/native split architectures', () => {
    const shared = read('components/UnifiedAddUi.tsx');
    const select = read('components/MVSelect.tsx');
    const css = read('mvSelect.css');

    expect(shared).toContain('<MVSelect');
    expect(shared).not.toContain('<select');
    expect(shared).not.toContain('mv-mobile-account-trigger');
    expect(shared).not.toContain('mv-mobile-account-picker');
    expect(select).toContain("aria-haspopup={hasOptions ? 'listbox' : undefined}");
    expect(select).toContain('aria-disabled={disabled || !hasOptions || undefined}');
    expect(select).toContain('role="option"');
    expect(css).toContain('background: var(--field)');
  });

  it('keeps long option content intact inside a bounded scrollable popover', () => {
    const select = read('components/MVSelect.tsx');
    const css = read('mvSelect.css');

    expect(select).toContain('maxHeight');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('overflow-wrap: anywhere');
    expect('Child Maintenance Received').toBe('Child Maintenance Received');
  });

  it('retains balance as subordinate information instead of collapsing identity', () => {
    const shared = read('components/UnifiedAddUi.tsx');
    const css = read('mvSelect.css');

    expect(shared).toContain('mv-selected-account-balance');
    expect(shared).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(css).toContain('.mv-select-option-trailing');
    expect(css).toContain('font-variant-numeric: tabular-nums');
  });
});
