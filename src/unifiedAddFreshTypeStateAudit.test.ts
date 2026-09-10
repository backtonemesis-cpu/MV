import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const selectSource = fs.readFileSync(path.join(src, 'components/MVSelect.tsx'), 'utf8');
const selectCss = fs.readFileSync(path.join(src, 'mvSelect.css'), 'utf8');

describe('unified Add transaction type isolation', () => {
  it('clears all creation draft state including Date when switching Transaction types or crossing into/out of Bill', () => {
    expect(modal).toContain("if (!initialTransaction && (isBillEntry || (type && newType !== type)))");
    for (const reset of [
      "setDescription('')",
      "setAmountStr('')",
      "setCategoryId('')",
      "setAccountId('')",
      "setTargetAccountId('')",
      "setDate('')",
      "setNotes('')",
      'setIsSavings(false)',
      'setIsSplitEnabled(false)',
      'setSplits([])',
    ]) {
      expect(modal).toContain(reset);
    }
    expect(modal).toContain('const handleUnifiedChoiceChange = (choice: UnifiedAddChoice) =>');
    expect(modal).toContain("if (choice === 'bill')");
    expect(modal).toContain('setIsBillEntry(true)');
  });

  it('keeps edit-mode historical Date and data out of the creation-only reset rule', () => {
    expect(modal).toContain("if (!initialTransaction && (isBillEntry || (type && newType !== type)))");
    expect(modal).toContain('if (initialTransaction) {');
    expect(modal).toContain('setDate(initialTransaction.date)');
  });

  it('makes repayment direction explicit while preserving two-account financial semantics', () => {
    expect(modal).toContain("isRepayment ? 'Pay From Account' : 'Account'");
    expect(modal).toContain("isRepayment ? 'Credit Card Being Repaid' : 'To Account'");
    expect(modal).toContain("acc.type !== 'credit'");
    expect(modal).toContain("a.type === 'credit'");
    expect(modal).toContain('mv-repayment-flow-summary');
    expect(modal).toContain('Repayment path');
    expect(modal).toContain('accountIdentityLabel(selectedAccount)} → {accountIdentityLabel(selectedTargetAccount)');
  });

  it('shows balance only below both selected account controls so identity is not duplicated', () => {
    expect(modal).toContain('<UnifiedAddAccountField');
    expect(modal).toContain('summaryAriaPrefix="Selected destination account"');
    expect(sharedUi).toContain('${summaryAriaPrefix} ${accountIdentityLabel(selectedAccount)}, balance');
    expect(sharedUi).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(sharedUi).not.toContain('mv-selected-account-identity');
  });

  it('hard-blocks repayments that exceed debt while preserving valid edits of an existing repayment', () => {
    expect(modal).toContain('repaymentDebtBeforeEditPence(selectedTargetAccount, initialTransaction)');
    expect(modal).toContain('repaymentDebtBeforeEditPence(creditAccount, initialTransaction)');
    expect(modal).toContain('repaymentAffectsCurrentBalance(account, initialTransaction)');
    expect(modal).toContain('Math.max(debtBeforeEditPence, initialTransaction.amountPence)');
    expect(modal).toContain('if (pence > outstandingDebtPence)');
    expect(modal).toContain('Repayment exceeds card balance (');
    expect(modal).toContain('const repaymentExceedsDebt = Boolean(');
    expect(modal).toContain('disabled={!isBillEntry && repaymentAmountBlocked}');
    expect(sharedUi).toContain('disabled={submitting || disabled}');
    expect(modal).toContain('Repayment exceeds card balance (');
  });

  it('blocks non-overdraft source overspend and treats legacy joint-current accounts like current accounts', () => {
    expect(modal).toContain("sourceAccount?.type !== 'current'");
    expect(modal).toContain("sourceAccount?.type !== 'joint'");
    expect(modal).toContain("selectedAccount?.type === 'joint'");
    expect(modal).toContain('repaymentSourceBalanceBeforeEditPence(selectedAccount, initialTransaction)');
    expect(modal).toContain('repaymentSourceBalanceBeforeEditPence(sourceAccount, initialTransaction)');
    expect(modal).toContain('Math.max(balanceBeforeEditPence, initialTransaction.amountPence)');
    expect(modal).toContain('Repayment exceeds ${sourceAccount?.type || \'source\'} balance (');
    expect(modal).toContain('const repaymentExceedsCurrentVisibleBalance = Boolean(');
    expect(modal).toContain('Exceeds current balance (');
    expect(modal).toContain('Check overdraft.');
  });

  it('renders repayment blocking errors and overdraft warnings with distinct semantic severity styling', () => {
    expect(modal).toContain('variant="error" className="mv-repayment-amount-message"');
    expect(modal).toContain('variant="warning" className="mv-repayment-amount-message"');
    expect(sharedUi).toContain('const Icon = variant === \'success\' ? CheckCircle2 : AlertCircle');
    expect(css).toContain('.mv-unified-add-status.is-error');
    expect(css).toContain('background: var(--danger-bg)');
    expect(css).toContain('color: var(--danger-text)');
    expect(css).toContain('border-color: var(--danger-border)');
    expect(css).toContain('background: var(--warning-bg)');
    expect(css).toContain('color: var(--warning-text)');
    expect(css).toContain('border-color: var(--warning-border)');
  });

  it('uses the shared contained MVSelect account picker in every layout mode', () => {
    expect(modal).toContain('<UnifiedAddAccountField');
    expect(sharedUi).toContain('<MVSelect');
    expect(sharedUi).toContain('value: account.id');
    expect(sharedUi).toContain('label: accountIdentityLabel(account)');
    expect(sharedUi).not.toContain('mv-mobile-account-trigger');
    expect(sharedUi).not.toContain('mv-mobile-account-picker');
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(selectSource).toContain('window.visualViewport');
    expect(selectCss).toContain('position: fixed');
    expect(selectCss).toContain('overflow-y: auto');
    expect(selectCss).toContain('@media (max-width: 47.999rem)');
    expect(selectCss).toContain('min-height: 44px');
  });
});
