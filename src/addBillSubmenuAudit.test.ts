import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/PlannedPaymentModal.tsx'),
  'utf8'
);

describe('Add Bill submenu audit contract', () => {
  it('does not prefill or expose a household-specific amount example', () => {
    expect(source).toContain("payment ? (payment.amountPence / 100).toFixed(2) : ''");
    expect(source).toContain('placeholder="0.00"');
    expect(source).not.toContain('placeholder="349.79"');
    expect(source).not.toContain('(e.g. 349.79)');
  });

  it('visually marks every required bill fact as required', () => {
    expect(source).toContain('Name *');
    expect(source).toContain('Amount (£) *');
    expect(source).toContain('Month *');
    expect(source).toContain('Payment Account *');
    expect(source).toContain('Responsible Person *');
  });

  it('associates visible field labels with their controls', () => {
    const ids = [
      'planned-payment-name',
      'planned-payment-amount',
      'planned-payment-month',
      'planned-payment-account',
      'planned-payment-person',
      'planned-payment-due-date',
      'planned-payment-category',
      'planned-payment-notes',
    ];

    for (const id of ids) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
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
    expect(source).toContain('{paymentAccountOptions.map((acc) => (');
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
});
