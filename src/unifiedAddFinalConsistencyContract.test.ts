import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = path.resolve(root, 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const selectSource = fs.readFileSync(path.join(src, 'components/MVSelect.tsx'), 'utf8');
const selectCss = fs.readFileSync(path.join(src, 'mvSelect.css'), 'utf8');
const launcherCss = fs.readFileSync(path.join(root, 'public/unified-add-launcher-fix.css'), 'utf8');
const app = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('final unified Add consistency contract', () => {
  it('uses exactly one shared footer geometry across all six creation types', () => {
    expect(tx).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-modal-fixed-actions mv-unified-add-footer');
    expect(css).toContain('.mv-unified-add-footer {');
    expect(css).toContain('display: grid !important');
    expect(css).toContain('grid-template-columns: max-content minmax(0, 1fr) !important');
    expect(css).toContain('.mv-unified-add-footer > .mv-transaction-secondary');
    expect(css).toContain('.mv-unified-add-footer > .mv-transaction-primary');
    expect(css).toContain('width: 100% !important');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-secondary');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-primary');
    expect(css).not.toContain('grid-template-columns: 1fr 1fr');
  });

  it('derives Bill month from the active working month without exposing a redundant picker', () => {
    expect(tx).toContain('const [billMonth, setBillMonth] = useState(activeMonth);');
    expect(tx).toContain('setBillMonth(activeMonth || localMonthInputValue())');
    expect(tx).toContain('month: billMonth.trim()');
    expect(tx).toContain("if (!billMonth.trim())");
    expect(tx).not.toContain('id="unified-bill-month"');
    expect(tx).not.toContain('Billing Month');
    expect(tx).not.toContain('<MonthPicker');
    expect(types).toContain('month: string;');
  });

  it('puts the optional Bill Due Date beside Amount while keeping it separate from month storage', () => {
    const billStart = tx.indexOf('{isBillEntry ? (');
    const descriptionStart = tx.indexOf('htmlFor="unified-bill-name"', billStart);
    const topBill = tx.slice(billStart, descriptionStart);
    expect(topBill).toContain('id="unified-bill-amount"');
    expect(topBill).toContain('htmlFor="unified-bill-due-date"');
    expect(topBill).toContain('Due Date (optional)');
    expect(topBill).toContain('id="unified-bill-due-date"');
    expect(topBill).toContain('type="date"');
    expect(topBill).toContain('value={billDueDate}');
    expect(tx).toContain("const [billDueDate, setBillDueDate] = useState('')");
    expect(tx).toContain('dueDate: billDueDate || undefined');
    expect(types).toContain('dueDate?: string;');
  });

  it('starts new transaction Dates blank, requires an explicit choice, and preserves edit dates', () => {
    expect(tx).toContain("const [date, setDate] = useState('')");
    expect(tx).toContain("setDate('')");
    expect(tx).not.toContain('setDate(localDateInputValue())');
    expect(tx).toContain('setDate(initialTransaction.date)');
    expect(tx).toContain("if (!date) {");
    expect(tx).toContain("setError('Date is required.')");
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('value={date}');
    expect(tx).toContain('onChange={(e) => setDate(e.target.value)}');
  });

  it('uses the same wording for fields that perform the same function', () => {
    expect(tx).toMatch(/htmlFor="unified-bill-name"[\s\S]{0,180}>\s*Description\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="transaction-description"[\s\S]{0,180}>\s*Description\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="unified-bill-notes"[\s\S]{0,180}>\s*Notes \(optional\)\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="transaction-notes"[\s\S]{0,180}>\s*Notes \(optional\)\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="unified-bill-category"[\s\S]{0,180}>\s*Category\s*<\/label>/);
    expect(tx).toMatch(/htmlFor="transaction-category"[\s\S]{0,180}>\s*Category\s*<\/label>/);
    expect((tx.match(/setError\('Description is required\.'\)/g) ?? []).length).toBe(2);
  });

  it('presents Bill name as Description while preserving PlannedPayment.name storage', () => {
    expect(tx).toContain('htmlFor="unified-bill-name"');
    expect(tx).toContain('name: description.trim()');
    expect(types).toContain('export interface PlannedPayment');
    expect(types).toContain('name: string;');
  });

  it('uses type-specific creation actions and preserves edit wording', () => {
    for (const label of [
      'Record Expense',
      'Record Income',
      'Record Transfer',
      'Record Refund',
      'Record Repayment',
      'Record Bill',
    ]) {
      expect(tx).toContain(`'${label}'`);
    }
    expect(tx).toContain("'Update Transaction'");
    expect(tx).not.toContain("'Record Transaction'");
  });

  it('uses Add Entry only for unified creation and preserves specialist/edit titles', () => {
    expect(tx).toContain("isUnifiedAddLauncher ? 'Add Entry' : 'New Transaction'");
    expect(tx).toContain("initialTransaction ? 'Edit Transaction'");
    expect(tx).not.toContain("{initialTransaction ? 'Edit Transaction' : 'Add Entry'}");
  });

  it('keeps Bill option booleans unchanged while using compact shared rhythm', () => {
    expect(tx).toContain('checked={billIncludeInTransferPlan}');
    expect(tx).toContain('setBillIncludeInTransferPlan(event.target.checked)');
    expect(tx).toContain('checked={billIsRecurring}');
    expect(tx).toContain('setBillIsRecurring(event.target.checked)');
    expect(tx).toContain('includeInTransferPlan: billIncludeInTransferPlan');
    expect(tx).toContain('isRecurring: billIsRecurring');
    expect(css).toContain('.mv-unified-bill-option');
    expect(css).toContain('min-height: 40px');
    expect(css).toContain('font-size: 0.75rem');
    expect(css).toContain('font-weight: 600');
    expect(css).toContain('min-height: 44px');
  });

  it('shows non-persistent empty account and category prompts across all paths', () => {
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
    expect(bridge).not.toContain("emptyOption.textContent = ''");
    expect(bridge).not.toContain("option.value === ''");
    expect(selectCss).toContain('.mv-select-trigger.is-placeholder');
  });

  it('uses one no-asterisk convention and keeps required validation explicit', () => {
    for (const label of ['Amount (£) *', 'Description *', 'Payment Account *', 'Category *', 'Date *']) {
      expect(tx).not.toContain(label);
    }
    expect(tx).toContain('Due Date (optional)');
    expect((tx.match(/Notes \(optional\)/g) ?? []).length).toBe(2);
    expect(tx).toContain('required');
    expect(tx).toContain("if (!billMonth.trim())");
    expect(tx).toContain("if (!description.trim())");
    expect(tx).toContain("if (!date)");
    expect(tx).toContain("if (!accountId)");
    expect(tx).toContain('isBillCategorySelectionAllowed(categories, categoryId)');
    expect(tx).toContain("if (!type)");
    expect(tx).toContain("if (!isTransfer && !isSplitEnabled && !categoryId)");
  });

  it('preserves the already-fixed repayment labels, filters and financial validation', () => {
    expect(tx).toContain("isRepayment ? 'Pay From Account' : 'Account'");
    expect(tx).toContain("isRepayment ? 'Credit Card Being Repaid' : 'To Account'");
    expect(tx).toContain("acc.type !== 'credit'");
    expect(tx).toContain("a.type === 'credit'");
    expect(tx).toContain('repaymentDebtBeforeEditPence');
    expect(tx).toContain('repaymentSourceBalanceBeforeEditPence');
    expect(tx).toContain('if (pence > outstandingDebtPence)');
    expect(tx).toContain("sourceAccount?.type !== 'current'");
    expect(tx).toContain("sourceAccount?.type !== 'joint'");
    expect(tx).toContain('disabled={!isBillEntry && repaymentAmountBlocked}');
  });

  it('preserves the shared contained account selector and balance evidence', () => {
    expect(sharedUi).toContain('<MVSelect');
    expect(sharedUi).toContain('value: account.id');
    expect(sharedUi).toContain('label: accountIdentityLabel(account)');
    expect(sharedUi).not.toContain('mv-mobile-account-trigger');
    expect(sharedUi).not.toContain('mv-mobile-account-picker');
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(selectSource).toContain('window.visualViewport');
    expect(sharedUi).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(selectCss).toContain('position: fixed');
    expect(selectCss).toContain('overflow-y: auto');
    expect(selectCss).toContain('@media (max-width: 47.999rem)');
  });

  it('keeps Bill as PlannedPayment and the other five as Transaction with no schema migration', () => {
    expect(tx).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(tx).toContain('await onSaveBill({');
    expect(app).toContain('onSaveBill={handleCreatePlannedPayment}');
    expect(app).toContain('await createPlannedPayment(data, household.version)');
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
    expect(tx).not.toContain("type: 'bill'");
    expect(tx).not.toContain('schemaVersion:');
    expect(tx).not.toContain('migration');
  });

  it('preserves split categories, refund and fresh-state isolation including blank Date', () => {
    expect(tx).toContain('Split Categories');
    expect(tx).toContain('isRefund');
    expect(tx).toContain("if (newType === 'refund')");
    expect(tx).toContain('const clearSharedDraft = () =>');
    expect(tx).toContain("setDescription('')");
    expect(tx).toContain("setAmountStr('')");
    const start = tx.indexOf('const clearSharedDraft = () =>');
    const end = tx.indexOf('\n  };', start);
    expect(tx.slice(start, end)).toContain("setDate('')");
    expect(bridge).not.toContain('openFreshUnifiedTransaction');
    expect(bridge).not.toContain('stopImmediatePropagation');
  });
});
