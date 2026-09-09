import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const transactionModal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const billModal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');

describe('unified Add shared UI architecture', () => {
  it('uses one shared type-tab component for all six visible Add choices', () => {
    expect(transactionModal).toContain('<UnifiedAddTypeTabs');
    expect(billModal).toContain('<UnifiedAddTypeTabs');
    for (const type of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) {
      expect(sharedUi).toContain(`'${type}'`);
    }
    expect(sharedUi).toContain('mv-transaction-type-tabs');
    expect(sharedUi).toContain('mv-transaction-type-tab');
  });

  it('uses the same account selector component for Transaction and Bill workflows', () => {
    expect(transactionModal).toContain('<UnifiedAddAccountField');
    expect(billModal).toContain('<UnifiedAddAccountField');
    expect(billModal).toContain('id="planned-payment-account"');
    expect(transactionModal).toContain('id="transaction-account"');
    expect(sharedUi).toContain('mv-transaction-account-select');
    expect(sharedUi).toContain('mv-mobile-account-trigger');
    expect(sharedUi).toContain('mv-mobile-account-picker');
    expect(sharedUi).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
  });

  it('shares validation/success presentation and footer actions without sharing finance persistence', () => {
    expect(transactionModal).toContain('<UnifiedAddStatusMessage');
    expect(billModal).toContain('<UnifiedAddStatusMessage');
    expect(transactionModal).toContain('<UnifiedAddFooter');
    expect(billModal).toContain('<UnifiedAddFooter');
    expect(sharedUi).not.toContain('onSave');
    expect(sharedUi).not.toContain('PlannedPayment');
    expect(css).toContain('.mv-unified-add-status.is-error');
    expect(css).toContain('.mv-unified-add-status.is-success');
    expect(css).toContain('.mv-unified-add-status.is-warning');
  });

  it('keeps Bill financially separate as PlannedPayment while sharing the same visible shell', () => {
    expect(billModal).toContain('Partial<PlannedPayment>');
    expect(transactionModal).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(transactionModal).toContain('await onSaveBill({');
    expect(transactionModal).toContain('responsiblePerson');
    expect(transactionModal).not.toContain("type: 'bill'");
    expect(transactionModal).not.toContain('OPEN_BILL_EVENT');
    expect(sharedUi).not.toContain('amountPence');
    expect(sharedUi).not.toContain('responsiblePerson');
  });

  it('puts Bill core controls on the same control class used by transaction forms', () => {
    for (const id of [
      'planned-payment-name',
      'planned-payment-amount',
      'planned-payment-due-date',
      'planned-payment-category',
      'planned-payment-notes',
    ]) {
      const index = billModal.indexOf(`id="${id}"`);
      expect(index).toBeGreaterThan(-1);
      expect(billModal.slice(index, index + 500)).toContain('mv-transaction-control');
    }
  });
});
