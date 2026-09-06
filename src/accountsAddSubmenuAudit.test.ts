import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHumanPoundsToPence } from './utils/currency';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8'
);

const addAccountBlock =
  source.match(/\{\/\* MODAL: Add Account \*\/[\s\S]*?\{\/\* MODAL: Edit Account \*\//)?.[0] ?? '';

describe('Accounts Add Account submenu audit contract', () => {
  it('does not force focus into the form on open', () => {
    expect(addAccountBlock).not.toContain('autoFocus');
  });

  it('visibly marks every required account fact as required', () => {
    expect(addAccountBlock).toContain('Account Name *');
    expect(addAccountBlock).toContain('Owner *');
    expect(addAccountBlock).toContain('Type *');
    expect(addAccountBlock).toContain("Starting balance owed (£) *");
    expect(addAccountBlock).toContain("Starting balance (£) *");
  });

  it('associates visible labels with their controls', () => {
    for (const id of [
      'account-create-name',
      'account-create-owner',
      'account-create-type',
      'account-create-balance',
      'account-create-notes',
    ]) {
      expect(addAccountBlock).toContain(`htmlFor="${id}"`);
      expect(addAccountBlock).toContain(`id="${id}"`);
    }
  });

  it('keeps starting balance numeric-only, spinner-free and GBP-labelled', () => {
    const money = addAccountBlock.match(/<MoneyInput[\s\S]*?\/>/)?.[0] ?? '';
    expect(money).toContain('type="text"');
    expect(money).toContain('inputMode="decimal"');
    expect(money).toContain('placeholder="0.00"');
    expect(money).not.toContain('type="number"');
    expect(money).not.toContain('step=');
    expect(money).not.toContain('£');
    expect(money).toContain('pounds sterling');
  });

  it('distinguishes confirmed zero from invalid or blank starting balances', () => {
    expect(parseHumanPoundsToPence('0.00')).toBe(0);
    expect(parseHumanPoundsToPence('abc')).toBeNull();
    expect(parseHumanPoundsToPence('')).toBeNull();
    expect(source).toContain('const enteredPence = parseHumanPoundsToPence(accBalanceStr)');
    expect(source).toContain('if (enteredPence === null)');
    expect(source).toContain('Enter a valid starting balance in pounds and pence.');
  });

  it('preserves credit balances as liabilities without changing ordinary account signs', () => {
    expect(source).toContain("accType === 'credit' ? -Math.abs(enteredPence) : enteredPence");
  });

  it('announces validation errors and keeps owner identity choices explicit', () => {
    expect(addAccountBlock).toContain('<div role="alert"');
    expect(source).toContain("{ id: JOINT_ACCOUNT_OWNER_ID, name: 'Joint' }");
    expect(source).toContain(".filter((member) => member.role !== 'removed')");
  });
});
