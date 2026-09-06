import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransferPlanView.tsx'),
  'utf8'
);

describe('Transfer Plan funded-selection lock audit contract', () => {
  it('derives a lock from recorded funding batches', () => {
    expect(source).toContain('fundedSelectionLockedAccountIds');
    expect(source).toContain('model.fundingBatches.length > 0');
    expect(source).toContain('isPaymentSelectionLocked');
  });

  it('blocks direct plan-selection changes while funding remains recorded', () => {
    expect(source).toContain('if (isViewOnly || isPaymentSelectionLocked(payment)) return;');
    expect(source).toContain('Undo Funding before changing Transfer Plan selection.');
  });

  it('disables funded-card bill checkboxes without hiding their selected state', () => {
    expect(source).toContain('checked={payment.includeInTransferPlan}');
    expect(source).toContain('model.fundingBatches.length > 0');
    expect(source).toContain('funded-selection-lock-');
  });

  it('prevents bulk selection from mutating funded accounts', () => {
    expect(source).toContain('const eligiblePaymentIds = monthPayments');
    expect(source).toContain('!isPaymentSelectionLocked(payment)');
    expect(source).toContain('paymentIds: eligiblePaymentIds');
    expect(source).toContain('if (eligiblePaymentIds.length === 0) return;');
  });

  it('keeps Undo Funding as a separate reviewed reconciliation route', () => {
    expect(source).toContain('Undo Funding');
    expect(source).toContain('UndoFundingModal');
    expect(source).toContain('setUndoFundingModel(model)');
    expect(source).not.toContain('window.confirm');
  });
});
