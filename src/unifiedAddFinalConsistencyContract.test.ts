import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = path.resolve(root, 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const monthPicker = fs.readFileSync(path.join(src, 'components/MonthPicker.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(src, 'index.css'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
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

  it('makes Billing Month reuse the transaction control contract on desktop', () => {
    expect(tx).toContain('Billing Month');
    expect(tx).toContain('inputClassName="mv-transaction-control"');
    expect(monthPicker).toContain('inputClassName?: string;');
    expect(monthPicker).toContain('className={\`mv-month-picker-input \${inputClassName}\`.trim()}');
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('className="mv-transaction-control w-full"');
    expect(css).toContain('.mv-unified-add-month .mv-month-picker-input.mv-transaction-control');
    expect(css).toContain('height: 32px !important');
    expect(css).toContain('min-height: 32px !important');
    expect(css).toContain('padding: 6px 12px !important');
    expect(css).toContain('font-size: 13px !important');
    expect(css).toContain('font-weight: 500 !important');
    expect(indexCss).toContain('.mv-transaction-control,');
  });

  it('makes Billing Month match the Phone Date geometry without changing month semantics', () => {
    expect(tx).toContain('id="unified-bill-month"');
    expect(tx).toContain('<MonthPicker');
    expect(tx).toContain('value={billMonth}');
    expect(tx).toContain('onChange={setBillMonth}');
    expect(tx).toContain('month: billMonth.trim()');
    expect(css).toContain('.mv-layout-phone .mv-transaction-modal[data-active-add-type="bill"] .mv-unified-add-month .mv-month-picker-input.mv-transaction-control');
    expect(css).toContain('height: 40px !important');
    expect(css).toContain('min-height: 40px !important');
    expect(css).toContain('max-height: 40px !important');
    expect(css).toContain('padding: 0 12px !important');
    expect(css).toContain('font-size: var(--mv-ds-text-body) !important');
    expect(css).toContain('line-height: 40px !important');
    expect(mobileCss).toContain('.mv-layout-phone');
  });

  it('uses Billing Month wording and keeps exact month-only storage', () => {
    expect(tx).toContain('Billing Month');
    expect(tx).not.toMatch(/>\s*Month\s*</);
    expect(tx).toContain('ariaLabel="Billing month"');
    expect(types).toContain('month: string;');
    expect(tx).not.toContain("type="date"\n                      value={billMonth}");
  });

  it('presents Bill name as Description while preserving PlannedPayment.name storage', () => {
    expect(tx).toContain('htmlFor="unified-bill-name"');
    expect(tx).toMatch(/htmlFor="unified-bill-name"[\s\S]{0,180}>\s*Description\s*<\/label>/);
    expect(tx).toContain('name: description.trim()');
    expect(tx).toContain("setError('Description is required.')");
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
    expect(sharedUi).toContain("<option value=\"\">{placeholder}</option>");
    expect(sharedUi).toContain("selectedAccount ? accountIdentityLabel(selectedAccount) : placeholder");
    expect(sharedUi).toContain("value ? '' : 'is-placeholder'");
    expect(sharedUi).toContain("selectedAccount ? '' : 'is-placeholder'");
    expect(bridge).not.toContain("emptyOption.textContent = ''");
    expect(bridge).not.toContain("option.value === ''");
    expect(css).toContain('.mv-transaction-control.is-placeholder');
    expect(css).toContain('.mv-mobile-account-trigger.is-placeholder');
  });

  it('uses one no-asterisk required convention and marks only genuinely optional text/date fields', () => {
    for (const label of ['Amount (£) *', 'Billing Month *', 'Description *', 'Payment Account *', 'Category *']) {
      expect(tx).not.toContain(label);
    }
    expect(tx).toContain('Due Date (optional)');
    expect((tx.match(/Notes \(optional\)/g) ?? []).length).toBe(2);
    expect(tx).toContain('required');
    expect(tx).toContain("if (!billMonth.trim())");
    expect(tx).toContain("if (!description.trim())");
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

  it('preserves the contained Phone account picker and balance evidence', () => {
    expect(sharedUi).toContain('mv-mobile-account-trigger');
    expect(sharedUi).toContain('mv-mobile-account-picker-backdrop');
    expect(sharedUi).toContain('role="listbox"');
    expect(sharedUi).toContain('role="option"');
    expect(sharedUi).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(css).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(css).toContain('display: none !important');
    expect(css).toContain('max-height: min(68dvh, 620px)');
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

  it('preserves split categories, refund and in-place fresh-state isolation', () => {
    expect(tx).toContain('Split Categories');
    expect(tx).toContain('isRefund');
    expect(tx).toContain("if (newType === 'refund')");
    expect(tx).toContain('const clearSharedDraft = () =>');
    expect(tx).toContain("setDescription('')");
    expect(tx).toContain("setAmountStr('')");
    const start = tx.indexOf('const clearSharedDraft = () =>');
    const end = tx.indexOf('\n  };', start);
    expect(tx.slice(start, end)).not.toContain('setDate(');
    expect(bridge).not.toContain('openFreshUnifiedTransaction');
    expect(bridge).not.toContain('stopImmediatePropagation');
  });
});
