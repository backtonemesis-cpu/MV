import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHumanPoundsToPence } from './utils/currency';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8'
);

const reconcileBlock =
  source.match(/\{\/\* MODAL: Reconcile Balance \*\/[\s\S]*?\{\/\* MODAL: Account Activity Ledger \*\//)?.[0] ?? '';

describe('Accounts Reconcile submenu audit contract', () => {
  it('does not force focus into the statement date or balance on open', () => {
    expect(reconcileBlock).not.toContain('autoFocus');
  });

  it('marks and associates both required reconcile fields', () => {
    expect(reconcileBlock).toContain('Statement Date *');
    expect(reconcileBlock).toContain("'Statement balance owed (£) *'");
    expect(reconcileBlock).toContain("'Statement balance (£) *'");
    expect(reconcileBlock).toContain('htmlFor="account-reconcile-date"');
    expect(reconcileBlock).toContain('id="account-reconcile-date"');
    expect(reconcileBlock).toContain('htmlFor="account-reconcile-balance"');
    expect(reconcileBlock).toContain('id="account-reconcile-balance"');
  });

  it('keeps the statement balance numeric-only, spinner-free, generic and GBP-accessible', () => {
    const money = reconcileBlock.match(/<MoneyInput[\s\S]*?\/>/)?.[0] ?? '';
    expect(money).toContain('type="text"');
    expect(money).toContain('inputMode="decimal"');
    expect(money).toContain('placeholder="0.00"');
    expect(money).not.toContain('type="number"');
    expect(money).not.toContain('step=');
    expect(money).not.toContain('placeholder="£');
    expect(money).toMatch(/pounds sterling/i);
  });

  it('distinguishes confirmed zero from blank or invalid reconcile amounts', () => {
    expect(parseHumanPoundsToPence('0.00')).toBe(0);
    expect(parseHumanPoundsToPence('')).toBeNull();
    expect(parseHumanPoundsToPence('abc')).toBeNull();
    expect(source).toContain('const enteredPence = parseHumanPoundsToPence(reconcileBalanceStr)');
    expect(source).toContain("setError('Enter a valid statement balance in pounds and pence.')");
  });

  it('does not misrepresent invalid input as a zero-balance reconciliation', () => {
    expect(reconcileBlock).toContain("targetShownPence === null ? '—' : formatPence(targetShownPence)");
    expect(reconcileBlock).toContain("'Enter a valid balance'");
  });

  it('announces validation errors and preserves credit-liability sign semantics', () => {
    expect(reconcileBlock).toContain('<div role="alert"');
    expect(source).toContain("selectedAccount.type === 'credit'");
    expect(source).toContain('-Math.abs(enteredPence)');
  });
});
