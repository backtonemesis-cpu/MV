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
const undoFundingSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UndoFundingModal.tsx'),
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
    expect(transferSource).toContain('Mark all paid');
    expect(transferSource).toContain('Undo selected payments');
    expect(transferSource).toContain('Include Unpaid');
    expect(transferSource).toContain('Include Paid');
    expect(transferSource).toContain('Include All');
    expect(transferSource).toContain('Exclude All');
  });

  it('uses a simple payment selector with explicit accessible names and no visible Payment action clutter', () => {
    expect(transferSource).toContain('Select ${payment.name} for payment');
    expect(transferSource).toContain('Select ${payment.name} to undo payment');
    expect(transferSource).not.toContain('<span>Payment action</span>');
  });

  it('routes normal single-bill Mark paid through the shared compact confirmation and keeps Payment details secondary', () => {
    const paymentHandlerStart = transferSource.indexOf('const handlePaymentStatusAction');
    const fundingHandlerStart = transferSource.indexOf('const handleUndoFunding');
    const paymentHandler = transferSource.slice(paymentHandlerStart, fundingHandlerStart);
    expect(paymentHandler).toContain("setBulkPaymentDialog({ mode: 'mark', payments: [payment] })");
    expect(transferSource).toContain('Mark paid');
    expect(transferSource).toContain('Payment details');
    expect(transferSource).toContain('setMarkingPayment(payment)');
  });

  it('makes whole-card Mark all paid the primary ready-to-pay card action', () => {
    expect(transferSource).toContain("(lifecycle === 'funded' || lifecycle === 'covered')");
    expect(transferSource).toContain("payments: requirement.unpaidPayments");
    expect(transferSource).toContain('Mark all paid');
    expect(transferSource).toContain('Funding');
    expect(transferSource).toContain('Payment');
  });

  it('uses Penny modal confirmation instead of browser confirm for Undo Paid', () => {
    const paymentHandlerStart = transferSource.indexOf('const handlePaymentStatusAction');
    const fundingHandlerStart = transferSource.indexOf('const handleUndoFunding');
    const paymentHandler = transferSource.slice(paymentHandlerStart, fundingHandlerStart);
    expect(paymentHandler).not.toContain('window.confirm');
    expect(paymentHandler).not.toContain('window.alert');
    expect(paymentHandler).toContain("setBulkPaymentDialog({ mode: 'undo', payments: [payment] })");
  });

  it('shared quick-payment modal defaults to UK-local date and shows known account/person/category/amount context', () => {
    expect(modalSource).toContain('localDateInputValue()');
    expect(modalSource).toContain('Planned amounts and assigned payment accounts are already set.');
    expect(modalSource).toContain('accountIdentityLabel(account)');
    expect(modalSource).toContain('payment.responsiblePerson');
    expect(modalSource).toContain('categoriesById.get(payment.categoryId)');
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
    expect(modalSource).toContain('Paid {formatDateKeyUk(evidence.date)}');
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
    expect(transferSource).toContain('min-w-11');
    expect(transferSource).toContain('Mark selected paid');
    expect(transferSource).toContain('Mark all paid');
    expect(transferSource).toContain('Undo selected payments');
    expect(transferSource).toContain('Payment details');
    expect(transferSource).toContain("{payment.status === 'paid' ? 'Paid' : 'Unpaid'}");
    expect(transferSource).toContain('Funded by Transfer');
    expect(transferSource).toContain('Covered by Existing Balance');
    expect(transferSource).toContain('Needs Funding');
  });

  it('uses no browser-native confirm anywhere in the Transfer Plan reversal workflow', () => {
    expect(transferSource).not.toContain('window.confirm');
    expect(transferSource).toContain('UndoFundingModal');
    expect(undoFundingSource).toContain('data-modal-initial-focus');
    expect(undoFundingSource).toContain('useModalAccessibility<HTMLElement>(true, onClose)');
    expect(undoFundingSource).toContain('This reverses only the exact reviewed Transfer Plan funding batch.');
    expect(undoFundingSource).toContain('Paid/Unpaid status and linked Activity expenses are unchanged.');
    expect(undoFundingSource).toContain('resulting account/funding position may change');
  });

  it('states that funding is unchanged for both mark and undo operations', () => {
    expect(modalSource).toContain('Funding is unchanged. Linked Activity expenses will be created.');
    expect(modalSource).toContain('Funding is unchanged.');
  });
});
