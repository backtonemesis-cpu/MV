import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const launcherCss = fs.readFileSync(path.resolve(process.cwd(), 'public/unified-add-launcher-fix.css'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('unified Add presentation parity after physical iPhone audit', () => {
  it('removes Bill-only visible required asterisks without weakening Bill validation', () => {
    for (const label of ['Amount (£) *', 'Month *', 'Name *', 'Payment Account *', 'Category *']) {
      expect(tx).not.toContain(label);
    }

    expect(tx).toContain('id="unified-bill-amount"');
    expect(tx).toContain('aria-label="Bill amount in pounds sterling"');
    expect(tx).toMatch(/id="unified-bill-amount"[\s\S]{0,500}\brequired\b/);

    expect(tx).toContain('id="unified-bill-name"');
    expect(tx).toMatch(/id="unified-bill-name"[\s\S]{0,500}\brequired\b/);

    expect(tx).toContain('id="unified-bill-category"');
    expect(tx).toMatch(/id="unified-bill-category"[\s\S]{0,500}\brequired\b/);

    expect(tx).toContain("if (!billMonth.trim())");
    expect(tx).toContain("if (!description.trim())");
    expect(tx).toContain("if (!accountId)");
    expect(tx).toContain('isBillCategorySelectionAllowed(categories, categoryId)');
  });

  it('uses one exact shared footer geometry contract across all six Add types', () => {
    expect(tx).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-unified-add-footer');
    expect(sharedUi).toContain('className="mv-transaction-secondary"');
    expect(sharedUi).toContain('className="mv-transaction-primary disabled:opacity-50"');
    expect(css).toContain('.mv-unified-add-footer {');
    expect(css).toContain('display: grid !important');
    expect(css).toContain('grid-template-columns: max-content minmax(0, 1fr) !important');
    expect(css).toContain('.mv-unified-add-footer > .mv-transaction-primary');
    expect(css).toContain('width: 100% !important');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-secondary');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-primary');
  });

  it('keeps semantic Month input while matching the Date control geometry and typography', () => {
    expect(tx).toContain('id="unified-bill-month"');
    expect(tx).toContain('<MonthPicker');
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');

    expect(tx).toContain('inputClassName="mv-transaction-control"');\n    expect(css).toContain('.mv-unified-add-month .mv-month-picker-input.mv-transaction-control');
    expect(css).toContain('height: 32px !important');
    expect(css).toContain('min-height: 32px !important');
    expect(css).toContain('font-size: 13px !important');
    expect(css).toContain('font-weight: 500 !important');

    expect(css).toContain(
      '.mv-layout-phone .mv-transaction-modal[data-active-add-type="bill"] .mv-unified-add-month .mv-month-picker-input'
    );
    expect(css).toContain('height: 40px !important');
    expect(css).toContain('font-size: var(--mv-ds-text-body) !important');
    expect(css).toContain('font-weight: 400 !important');
    expect(css).toContain('line-height: 40px !important');
  });

  it('uses shared 12px field rhythm between Bill grouped fields including Category and Due Date', () => {
    expect(tx).toContain('className="mv-transaction-dynamic mv-unified-add-field-stack"');
    expect(css).toContain('.mv-unified-add-field-stack');
    expect(css).toContain('gap: 12px');
    expect(tx.indexOf('id="unified-bill-category"')).toBeLessThan(tx.indexOf('id="unified-bill-due-date"'));
  });

  it('keeps Bill option semantics while presenting them in the unified compact field rhythm', () => {
    expect(tx).toContain('id="unified-bill-transfer-plan"');
    expect(tx).toContain('checked={billIncludeInTransferPlan}');
    expect(tx).toContain('setBillIncludeInTransferPlan(event.target.checked)');
    expect(tx).toContain('id="unified-bill-recurring"');
    expect(tx).toContain('checked={billIsRecurring}');
    expect(tx).toContain('setBillIsRecurring(event.target.checked)');

    expect(css).toContain('.mv-unified-bill-option');
    expect(css).toContain('min-height: 40px');
    expect(css).toContain('font-size: 0.75rem');
    expect(css).toContain('font-weight: 600');
    expect(css).not.toContain('min-height: 48px');
    expect(css).not.toContain('font-size: 0.875rem;\n  }');
  });

  it('uses Title Case for the two repayment account-direction labels only', () => {
    expect(tx).toContain("isRepayment ? 'Pay From Account' : 'Account'");
    expect(tx).toContain("isRepayment ? 'Credit Card Being Repaid' : 'To Account'");
    expect(tx).not.toContain("isRepayment ? 'Pay from account' : 'Account'");
    expect(tx).not.toContain("isRepayment ? 'Credit card being repaid' : 'To Account'");
  });

  it('keeps Bill on PlannedPayment semantics and does not introduce Transaction type bill', () => {
    expect(tx).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(tx).toContain('await onSaveBill({');
    expect(tx).toContain('includeInTransferPlan: billIncludeInTransferPlan');
    expect(tx).toContain('isRecurring: billIsRecurring');
    expect(tx).not.toContain("type: 'bill'");
    expect(types).toContain(
      "export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';"
    );
  });

  it('preserves repayment arithmetic and validation contracts unchanged by this presentation repair', () => {
    expect(tx).toContain('repaymentDebtBeforeEditPence');
    expect(tx).toContain('repaymentSourceBalanceBeforeEditPence');
    expect(tx).toContain('if (pence > outstandingDebtPence)');
    expect(tx).toContain("sourceAccount?.type !== 'current'");
    expect(tx).toContain("sourceAccount?.type !== 'joint'");
    expect(tx).toContain('disabled={!isBillEntry && repaymentAmountBlocked}');
  });
});
