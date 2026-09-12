import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/PlannedPaymentModal.tsx'),
  'utf8'
);
const sharedUi = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UnifiedAddUi.tsx'),
  'utf8'
);

describe('Add Bill submenu audit contract', () => {
  it('does not prefill or expose a household-specific amount example', () => {
    expect(source).toContain("payment ? (payment.amountPence / 100).toFixed(2) : ''");
    expect(source).toContain('placeholder="0.00"');
    expect(source).not.toContain('placeholder="349.79"');
    expect(source).not.toContain('(e.g. 349.79)');
  });

  it('visually marks every user-entered required bill fact as required', () => {
    expect(source).toContain('Name *');
    expect(source).toContain('Amount (£) *');
    expect(source).toContain('Month *');
    expect(source).toContain('Payment Account *');
    expect(source).not.toContain('Responsible Person *');
    expect(source).toContain('resolveAccountOwnerPayer(selectedAccount, members)');
  });

  it('associates visible field labels with their controls', () => {
    for (const id of [
      'planned-payment-name',
      'planned-payment-amount',
      'planned-payment-month',
      'planned-payment-due-date',
      'planned-payment-category',
      'planned-payment-notes',
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
    expect(source).toContain('id="planned-payment-account"');
    expect(source).toContain('label="Payment Account *"');
    expect(sharedUi).toContain('htmlFor={id}');
    expect(sharedUi).toContain('id={id}');
    expect(sharedUi).toContain('ariaLabelledBy={labelId}');
    expect(source).not.toContain('planned-payment-person');
  });

  it('associates Transfer Plan and recurring checkbox text with the actual controls', () => {
    expect(source).toContain('htmlFor="modal-include-plan-toggle"');
    expect(source).toContain('id="modal-include-plan-toggle"');
    expect(source).toContain('htmlFor="modal-recurring-toggle"');
    expect(source).toContain('id="modal-recurring-toggle"');
  });

  it('offers active payment accounts while preserving an archived account already linked during edit', () => {
    expect(source).toContain('const paymentAccountOptions = accounts.filter(');
    expect(source).toContain("account.isActive !== false || account.id === payment?.accountId");
    expect(source).toContain('options={paymentAccountOptions}');
    expect(sharedUi).toContain('options.map((account) =>');
  });

  it('keeps the bill amount numeric-only with explicit GBP semantics', () => {
    expect(source).toContain('<MoneyInput');
    expect(source).toContain('aria-label="Bill amount in pounds sterling"');
    expect(source).toContain('Amount (£) *');
    expect(source).not.toContain('mv-money-prefix');
  });

  it('does not force focus into a monetary field', () => {
    const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).not.toContain('autoFocus');
  });

  it('uses spinner-free decimal text entry for the bill amount', () => {
    const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('type="text"');
    expect(blocks[0]).toContain('inputMode="decimal"');
    expect(blocks[0]).not.toContain('type="number"');
    expect(blocks[0]).not.toContain('step=');
    expect(blocks[0]).not.toContain('min=');
  });

  it('filters new bill categories by authoritative category group metadata before adaptive rendering', () => {
    expect(source).toContain("import { CategorySelect } from './CategorySelect';");
    expect(source).toContain('getBillCategoryOptions(');
    expect(source).toContain('categories={billCategoryOptions}');
    expect(source).toContain('categoryGroups={categoryGroups}');
    expect(source).toContain('isBillCategorySelectionAllowed(');
    expect(source).not.toContain('{categories.map((c) => (');
  });

  it('preserves only the currently linked excluded category during historical edits', () => {
    expect(source).toContain('payment?.categoryId');
    expect(source).toContain('getBillCategoryOptions(');
    expect(source).toContain('isBillCategorySelectionAllowed(');
  });
});
