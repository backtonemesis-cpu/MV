import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');

describe('unified Add transaction type isolation', () => {
  it('clears all non-date transaction entry state when a new creation type is chosen', () => {
    expect(modal).toContain("if (!initialTransaction && type && newType !== type)");
    for (const reset of [
      "setDescription('')",
      "setAmountStr('')",
      "setCategoryId('')",
      "setAccountId('')",
      "setTargetAccountId('')",
      "setNotes('')",
      'setIsSavings(false)',
      'setIsSplitEnabled(false)',
      'setSplits([])',
    ]) {
      expect(modal).toContain(reset);
    }
    expect(modal).not.toContain("setDate('')");
  });

  it('keeps edit-mode historical data out of the creation-only reset rule', () => {
    expect(modal).toContain("if (!initialTransaction && type && newType !== type)");
    expect(modal).toContain('if (initialTransaction) {');
  });

  it('makes repayment direction explicit while preserving two-account financial semantics', () => {
    expect(modal).toContain("isRepayment ? 'Pay from account' : 'Account'");
    expect(modal).toContain("isRepayment ? 'Credit card being repaid' : 'To Account'");
    expect(modal).toContain("account.type !== 'credit'");
    expect(modal).toContain("account.type === 'credit'");
    expect(modal).toContain('mv-repayment-flow-summary');
    expect(modal).toContain('Repayment path');
    expect(modal).toContain('accountIdentityLabel(selectedAccount)} → {accountIdentityLabel(selectedTargetAccount)');
  });

  it('shows balance only below both selected account controls so identity is not duplicated', () => {
    expect(modal).toContain('Selected account ${accountIdentityLabel(selectedAccount)}, balance');
    expect(modal).toContain('Selected destination account ${accountIdentityLabel(selectedTargetAccount)}, balance');
    expect(modal).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(modal).toContain('Balance: {formatPence(selectedTargetAccount.currentBalancePence)}');
    expect(modal).not.toContain('<div className="mv-selected-account-identity">');
  });

  it('hard-blocks repayments that exceed the outstanding credit-card debt', () => {
    expect(modal).toContain('const outstandingDebtPence = Math.max(0, -creditAccount.currentBalancePence)');
    expect(modal).toContain('if (pence > outstandingDebtPence)');
    expect(modal).toContain('Repayment cannot exceed the credit card balance of');
    expect(modal).toContain('const repaymentExceedsDebt = Boolean(');
    expect(modal).toContain('disabled={isSubmitting || repaymentAmountBlocked}');
    expect(modal).toContain('Repayment exceeds the credit card balance of');
  });

  it('blocks non-overdraft source overspend and treats legacy joint-current accounts like current accounts', () => {
    expect(modal).toContain("sourceAccount?.type !== 'current'");
    expect(modal).toContain("sourceAccount?.type !== 'joint'");
    expect(modal).toContain("selectedAccount?.type === 'joint'");
    expect(modal).toContain('Repayment cannot exceed the available');
    expect(modal).toContain('const repaymentExceedsCurrentVisibleBalance = Boolean(');
    expect(modal).toContain('Check the available overdraft before recording.');
  });

  it('replaces the oversized iOS native account menu with a contained in-app phone picker', () => {
    expect(modal).toContain('mv-mobile-account-trigger');
    expect(modal).toContain('mv-mobile-account-picker-backdrop');
    expect(modal).toContain('mv-mobile-account-picker-list');
    expect(modal).toContain('role="listbox"');
    expect(modal).toContain('role="option"');
    expect(css).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(css).toContain('display: none !important');
    expect(css).toContain('.mv-layout-phone .mv-mobile-account-trigger');
    expect(css).toContain('display: flex');
    expect(css).toContain('max-height: min(68dvh, 620px)');
    expect(css).toContain('overflow-y: auto');
  });
});
