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

  it('uses Date and Description visibly for Bill while retaining separate month storage', () => {
    expect(tx).toContain('htmlFor="unified-bill-due-date"');
    expect(tx).toMatch(/htmlFor="unified-bill-due-date"[\s\S]{0,180}>\s*Date\s*<\/label>/);
    expect(tx).toContain('id="unified-bill-due-date"');
    expect(tx).toContain('value={billDueDate}');
    expect(tx).toContain('dueDate: billDueDate || undefined');
    expect(tx).toContain('Description');
    expect(tx).toContain('Billing Period');
    expect(tx).toContain('month: billMonth.trim()');
    expect(tx).toContain('name: description.trim()');
  });

  it('gives Bill Date the same native date/control contract as every Transaction date', () => {
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('id="unified-bill-due-date"');
    expect((tx.match(/type="date"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(tx).toMatch(/id="unified-bill-due-date"[\s\S]{0,300}className="mv-transaction-control w-full"/);
    expect(tx).toMatch(/id="transaction-date"[\s\S]{0,300}className="mv-transaction-control w-full"/);
    expect(tx.indexOf('id="unified-bill-due-date"')).toBeLessThan(tx.indexOf('id="unified-bill-name"'));
    expect(tx.indexOf('id="unified-bill-month"')).toBeGreaterThan(tx.indexOf('id="unified-bill-category"'));
  });

  it('keeps Billing Period explicitly month-only rather than fabricating a date', () => {
    expect(tx).toContain('Billing Period');
    expect(tx).toContain('id="unified-bill-month"');
    expect(tx).toContain('displayFormat="short-uk"');
    expect(monthPicker).toContain('type="month"');
    expect(tx).toContain("setBillDueDate('')");
    expect(tx).not.toContain("setBillDueDate(localDateInputValue())");
    expect(tx).not.toContain("billMonth + '-01'");
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

  it('uses one no-asterisk convention without weakening Bill validation', () => {
    for (const label of ['Amount (£) *', 'Month *', 'Name *', 'Payment Account *', 'Category *']) {
      expect(tx).not.toContain(label);
    }
    expect(tx).toContain('if (!billMonth.trim())');
    expect(tx).toContain('if (!description.trim())');
    expect(tx).toContain('if (!accountId)');
    expect(tx).toContain('isBillCategorySelectionAllowed(categories, categoryId)');
    expect(tx).toContain('Notes (optional)');
    expect(tx).not.toContain('Due Date (optional)');
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
