import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const transferSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransferPlanView.tsx'),
  'utf8'
);
const modalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/BulkPaymentStatusModal.tsx'),
  'utf8'
);

describe('Transfer Plan bulk payment UI audit contract', () => {
  it('keeps funding lifecycle and Paid/Unpaid status visibly separate', () => {
    expect(transferSource).toContain('Funded by Transfer');
    expect(transferSource).toContain("{payment.status === 'paid' ? 'Paid' : 'Unpaid'}");
    expect(transferSource).toContain('Funding recorded');
  });

  it('provides explicit bulk payment actions distinct from Transfer Plan inclusion', () => {
    expect(transferSource).toContain('Mark selected paid');
    expect(transferSource).toContain('Mark all unpaid paid');
    expect(transferSource).toContain('Undo selected payments');
    expect(transferSource).toContain('Include Unpaid');
    expect(transferSource).toContain('Include Paid');
    expect(transferSource).toContain('Include All');
    expect(transferSource).toContain('Exclude All');
  });

  it('uses a dedicated payment-action selector with an accessible name', () => {
    expect(transferSource).toContain('Select ${payment.name} for payment-status action');
    expect(transferSource).toContain('Payment action');
  });

  it('uses Penny modal confirmation instead of browser confirm for Undo Paid', () => {
    const paymentHandlerStart = transferSource.indexOf('const handlePaymentStatusAction');
    const fundingHandlerStart = transferSource.indexOf('const handleUndoFunding');
    const paymentHandler = transferSource.slice(paymentHandlerStart, fundingHandlerStart);
    expect(paymentHandler).not.toContain('window.confirm');
    expect(paymentHandler).not.toContain('window.alert');
    expect(paymentHandler).toContain("setBulkPaymentDialog({ mode: 'undo', payments: [payment] })");
  });

  it('bulk modal defaults to local date and keeps assigned account/amount semantics explicit', () => {
    expect(modalSource).toContain('localDateInputValue()');
    expect(modalSource).toContain("Planned amount and each bill's assigned payment account will be used.");
    expect(modalSource).toContain('accountIdentityLabel(account)');
    expect(modalSource).toContain('formatPence(totalPence)');
  });

  it('bulk modal follows the audited focus and accessibility contract', () => {
    expect(modalSource).toContain('useModalAccessibility<HTMLElement>(true, onClose)');
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain('aria-modal="true"');
    expect(modalSource).toContain('data-modal-initial-focus');
    expect(modalSource).not.toContain('autofocus');
  });

  it('carries the exact confirmation snapshots through to the final storage mutation', () => {
    expect(transferSource).toContain('onMarkPaymentsPaid(confirmedPayments, actualDate)');
    expect(transferSource).toContain('onUndoPaymentsPaid(confirmedPayments)');
    expect(transferSource).toContain('transactions={transactions}');
    expect(modalSource).toContain('await onMarkPaid(payments, date)');
    expect(modalSource).toContain('await onUndoPaid(payments)');
  });

  it('uses authoritative linked Activity evidence for Undo account, amount and date', () => {
    expect(modalSource).toContain('transaction.id === payment.actualTransactionId');
    expect(modalSource).toContain('transaction.plannedPaymentId === payment.id');
    expect(modalSource).toContain('references.length === 1');
    expect(modalSource).toContain("mode === 'undo' ? evidence?.accountId : payment.accountId");
    expect(modalSource).toContain('evidence?.amountPence');
    expect(modalSource).toContain('Paid {evidence.date}');
    expect(modalSource).toContain('hasUnsafeUndoEvidence');
    expect(modalSource).toContain('Undo is blocked because exact reciprocal Activity evidence cannot');
  });

  it('keeps opening, selecting, Cancel, Close and Escape non-mutating', () => {
    expect(transferSource).toContain('setPaymentActionSelectedIds');
    expect(transferSource).toContain('setBulkPaymentDialog');
    expect(modalSource).toContain('data-modal-initial-focus');
    expect(modalSource).toContain('onClick={onClose}');
    expect(modalSource).toContain('useModalAccessibility<HTMLElement>(true, onClose)');
    const confirmStart = modalSource.indexOf('const handleConfirm');
    const returnStart = modalSource.indexOf('return (', confirmStart);
    const confirmHandler = modalSource.slice(confirmStart, returnStart);
    expect(confirmHandler).toContain('await onMarkPaid(payments, date)');
    expect(confirmHandler).toContain('await onUndoPaid(payments)');
  });

  it('preserves phone-sized payment touch targets and does not communicate state by colour alone', () => {
    expect(transferSource).toContain('min-h-11');
    expect(transferSource).toContain('Mark selected paid');
    expect(transferSource).toContain('Mark all unpaid paid');
    expect(transferSource).toContain('Undo selected payments');
    expect(transferSource).toContain("{payment.status === 'paid' ? 'Paid' : 'Unpaid'}");
    expect(transferSource).toContain('Funded by Transfer');
    expect(transferSource).toContain('Covered by Existing Balance');
    expect(transferSource).toContain('Needs Funding');
  });

  it('states that funding is unchanged for both mark and undo operations', () => {
    expect(modalSource).toContain('Funding is unchanged. Linked Activity expenses will be created.');
    expect(modalSource).toContain('Funding is unchanged.');
  });
});
