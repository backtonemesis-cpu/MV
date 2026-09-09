import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const app = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
const transactionModal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const plannedPaymentModal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('unified Add batch-entry workflow', () => {
  it('does not let the App-level transaction save handler close the modal after a successful save', () => {
    const handler = app.slice(
      app.indexOf('const handleSaveTransaction'),
      app.indexOf('// Delete Transaction')
    );

    expect(handler).toContain('await createTransaction');
    expect(handler).toContain('await loadData();');
    expect(handler).not.toContain('setShowTxModal(false)');
    expect(handler).not.toContain('setEditingTx(null)');
  });

  it('keeps conflict failures inside the form instead of treating them as successful saves', () => {
    const handler = app.slice(
      app.indexOf('const handleSaveTransaction'),
      app.indexOf('// Delete Transaction')
    );

    expect(handler).toContain('setConflictServerVersion');
    expect(handler).toContain('throw err;');
  });

  it('keeps unified transaction entry open, resets the current type, and reports success', () => {
    expect(transactionModal).toContain('resetForNextTransaction');
    expect(transactionModal).toContain('if (isUnifiedAddLauncher && !initialTransaction)');
    expect(transactionModal).toContain('setSuccessMessage(`${successLabel[recordedType]} recorded. Ready for another entry.`)');
    expect(transactionModal).toContain('<UnifiedAddStatusMessage variant="success"');
    expect(sharedUi).toContain("const role = variant === 'error' ? 'alert' : 'status'");
    expect(sharedUi).toContain("aria-live={variant === 'error' ? undefined : 'polite'}");
    expect(transactionModal).toContain("expense: 'Expense'");
    expect(transactionModal).toContain("income: 'Income'");
    expect(transactionModal).toContain("transfer: 'Transfer'");
    expect(transactionModal).toContain("refund: 'Refund'");
    expect(transactionModal).toContain("repayment: 'Repayment'");
  });

  it('keeps unified Bill entry inside the same modal, clears the Bill draft, and reports success', () => {
    expect(transactionModal).toContain('const resetForNextBill = () =>');
    expect(transactionModal).toContain('await onSaveBill({');
    expect(transactionModal).toContain('resetForNextBill();');
    expect(transactionModal).toContain("setSuccessMessage('Bill recorded. Ready for another entry.')");
    expect(transactionModal).toContain('<UnifiedAddStatusMessage variant="success"');
    expect(sharedUi).toContain("aria-live={variant === 'error' ? undefined : 'polite'}");
  });

  it('still closes direct and editing workflows after save', () => {
    expect(transactionModal).toMatch(/if \(isUnifiedAddLauncher && !initialTransaction\)[\s\S]*else \{\s*closeModal\(\);/);
    expect(plannedPaymentModal).toMatch(/if \(isUnifiedAdd && !isEditing\)[\s\S]*else \{\s*clearUnifiedState\(\);\s*onClose\(\);/);
  });

  it('preserves Bill as PlannedPayment data even though creation now shares the Transaction modal shell', () => {
    expect(plannedPaymentModal).toContain('Partial<PlannedPayment>');
    expect(transactionModal).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(transactionModal).toContain('await onSaveBill({');
    expect(app).toContain('onSaveBill={handleCreatePlannedPayment}');
    expect(transactionModal).not.toContain("type: 'bill'");
  });
});
