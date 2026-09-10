import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const selectSource = fs.readFileSync(path.join(src, 'components/MVSelect.tsx'), 'utf8');
const selectCss = fs.readFileSync(path.join(src, 'mvSelect.css'), 'utf8');
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

  it('shows Description but derives the Bill month invisibly from the active working month', () => {
    expect(tx).toContain('Description');
    expect(tx).toContain('id="unified-bill-name"');
    expect(tx).toContain('name: description.trim()');
    expect(tx).toContain('month: billMonth.trim()');
    expect(tx).toContain('const [billMonth, setBillMonth] = useState(activeMonth);');
    expect(tx).toContain("setBillMonth(activeMonth || '2026-09')");
    expect(tx).not.toContain('Billing Month');
    expect(tx).not.toContain('id="unified-bill-month"');
    expect(tx).not.toContain('<MonthPicker');
  });

  it('puts the real optional Bill Due Date in the same top-row position as transaction Date', () => {
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('id="unified-bill-due-date"');
    expect(tx).toContain('Due Date (optional)');
    const billStart = tx.indexOf('{isBillEntry ? (');
    const descriptionStart = tx.indexOf('htmlFor="unified-bill-name"', billStart);
    const billTop = tx.slice(billStart, descriptionStart);
    expect(billTop).toContain('id="unified-bill-amount"');
    expect(billTop).toContain('id="unified-bill-due-date"');
    expect(billTop).toContain('value={billDueDate}');
  });

  it('starts new transaction dates blank while preserving existing dates in edit mode', () => {
    expect(tx).toContain("const [date, setDate] = useState('')");
    expect(tx).toContain("setDate('')");
    expect(tx).toContain('setDate(initialTransaction.date)');
    expect(tx).not.toContain('setDate(localDateInputValue())');
    expect(tx).toContain("setError('Date is required.')");
  });

  it('uses consistent wording where Bill and Transaction fields have the same meaning', () => {
    expect(tx).toMatch(/htmlFor="unified-bill-name"[\s\S]{0,180}>\s*Description\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="transaction-description"[\s\S]{0,180}>\s*Description\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="unified-bill-notes"[\s\S]{0,180}>\s*Notes \(optional\)\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="transaction-notes"[\s\S]{0,180}>\s*Notes \(optional\)\s*<\/label>/);
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
    expect(sharedUi).toContain('placeholder={placeholder}');
    expect(selectSource).toContain('selectedOption?.label ?? placeholder');
    expect(selectSource).toContain("selectedOption ? '' : 'is-placeholder'");
    expect(tx).toContain("categoryId ? '' : 'is-placeholder'");
    expect(bridge).not.toContain('querySelectorAll<HTMLSelectElement>');
    expect(selectCss).toContain('.mv-select-trigger.is-placeholder');
  });

  it('uses one no-asterisk convention without weakening required validation', () => {
    for (const label of ['Amount (£) *', 'Description *', 'Payment Account *', 'Category *', 'Date *']) {
      expect(tx).not.toContain(label);
    }
    expect(tx).toContain('if (!billMonth.trim())');
    expect(tx).toContain('if (!date)');
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
