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
    expect(modal).toContain("acc.type !== 'credit'");
    expect(modal).toContain("a.type === 'credit'");
    expect(modal).toContain('mv-repayment-flow-summary');
    expect(modal).toContain('Repayment path');
    expect(modal).toContain('accountIdentityLabel(selectedAccount)} → {accountIdentityLabel(selectedTargetAccount)');
  });

  it('shows the destination account identity and balance instead of relying on a clipped native selection alone', () => {
    expect(modal).toContain('const selectedTargetAccount = accounts.find((account) => account.id === targetAccountId)');
    expect(modal).toContain('Selected destination account');
    expect(modal).toContain('formatPence(selectedTargetAccount.currentBalancePence)');
  });

  it('keeps phone account selects contained and visibly native-select affordanced', () => {
    expect(css).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(css).toContain('padding-inline-end: 34px !important');
    expect(css).toContain('font-size: 0.8125rem !important');
    expect(css).toContain('-webkit-appearance: menulist !important');
    expect(css).toContain('appearance: auto !important');
  });
});
