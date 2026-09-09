import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const monthPicker = fs.readFileSync(path.join(src, 'components/MonthPicker.tsx'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const launcherCss = fs.readFileSync(path.resolve(process.cwd(), 'public/unified-add-launcher-fix.css'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('final unified Add presentation consistency', () => {
  it('uses the neutral new-entry title without changing transaction edit wording', () => {
    expect(tx).toContain("initialTransaction ? 'Edit Transaction' : isUnifiedAddLauncher ? 'Add Entry' : 'New Transaction'");
  });

  it('uses specific creation actions while preserving Bill as a PlannedPayment save', () => {
    for (const label of [
      "'Record Expense'",
      "'Record Income'",
      "'Record Transfer'",
      "'Record Refund'",
      "'Record Repayment'",
      "'Record Bill'",
    ]) {
      expect(tx).toContain(label);
    }
    expect(tx).toContain("'Update Transaction'");
    expect(tx).toContain('await onSaveBill({');
    expect(tx).toContain('name: description.trim()');
    expect(tx).not.toContain("type: 'bill'");
    expect(types).toContain(
      "export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';"
    );
  });

  it('uses Billing Month and Description visibly while retaining the safe stored Bill name', () => {
    expect(tx).toContain('Billing Month');
    expect(tx).toContain('Description');
    expect(tx).toContain('id="unified-bill-month"');
    expect(tx).toContain('id="unified-bill-name"');
    expect(tx).toContain('name: description.trim()');
  });

  it('shares the Date field contract with the semantic Billing Month input on desktop and Phone', () => {
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('inputClassName="mv-transaction-control"');
    expect(monthPicker).toContain('inputClassName?: string;');
    expect(monthPicker).toContain('mv-month-picker-input');
    expect(css).toContain('.mv-unified-add-month .mv-month-picker-input.mv-transaction-control');
    expect(css).toContain('height: 32px !important');
    expect(css).toContain('min-height: 32px !important');
    expect(css).toContain('height: 40px !important');
    expect(css).toContain('line-height: 40px !important');
  });

  it('uses one footer geometry component and has no Bill-only proportional override', () => {
    expect(tx).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-unified-add-footer');
    expect(css).toContain('.mv-unified-add-footer {');
    expect(css).toContain('grid-template-columns: max-content minmax(0, 1fr) !important');
    expect(css).toContain('.mv-unified-add-footer > .mv-transaction-primary');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-secondary');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-primary');
    expect(css).not.toContain('grid-template-columns: 1fr 1fr');
  });

  it('shows non-persistent empty account and category prompts on every unified path', () => {
    for (const prompt of [
      'Select account',
      'Select payment account',
      'Select source account',
      'Select destination account',
      'Select paying account',
      'Select credit card',
      'Select category',
    ]) {
      expect(tx + sharedUi).toContain(prompt);
    }
    expect(sharedUi).toContain('selectedAccount ? accountIdentityLabel(selectedAccount) : placeholder');
    expect(sharedUi).toContain("value ? '' : 'is-placeholder'");
    expect(tx).toContain("categoryId ? '' : 'is-placeholder'");
    expect(bridge).not.toContain('querySelectorAll<HTMLSelectElement>');
    expect(css).toContain('.mv-transaction-control.is-placeholder');
  });

  it('uses one no-asterisk convention without weakening required validation', () => {
    for (const label of ['Amount (£) *', 'Month *', 'Name *', 'Payment Account *', 'Category *']) {
      expect(tx).not.toContain(label);
    }
    expect(tx).toContain('if (!billMonth.trim())');
    expect(tx).toContain('if (!description.trim())');
    expect(tx).toContain('if (!accountId)');
    expect(tx).toContain('isBillCategorySelectionAllowed(categories, categoryId)');
    expect(tx).toContain('Due Date (optional)');
    expect(tx).toContain('Notes (optional)');
  });

  it('keeps Bill boolean semantics, repayment labels, and repayment protections unchanged', () => {
    expect(tx).toContain('includeInTransferPlan: billIncludeInTransferPlan');
    expect(tx).toContain('isRecurring: billIsRecurring');
    expect(tx).toContain('checked={billIncludeInTransferPlan}');
    expect(tx).toContain('checked={billIsRecurring}');
    expect(css).toContain('.mv-unified-bill-option');
    expect(css).toContain('min-height: 44px');
    expect(tx).toContain("isRepayment ? 'Pay From Account' : 'Account'");
    expect(tx).toContain("isRepayment ? 'Credit Card Being Repaid' : 'To Account'");
    expect(tx).toContain('repaymentDebtBeforeEditPence');
    expect(tx).toContain('repaymentSourceBalanceBeforeEditPence');
    expect(tx).toContain('if (pence > outstandingDebtPence)');
  });
});
