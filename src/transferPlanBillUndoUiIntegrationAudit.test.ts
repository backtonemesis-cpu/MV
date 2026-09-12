import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const view = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransferPlanView.tsx'),
  'utf8'
);

describe('GA-TP-002 exact per-bill Undo Funding UI integration', () => {
  it('passes immutable funding records and the version-aware bill undo handler from App', () => {
    expect(app).toContain(
      "import { undoTransferPlanBillFunding } from './utils/transferPlanBillFundingApi';"
    );
    expect(app).toContain(
      'await undoTransferPlanBillFunding(plannedPaymentId, household.version);'
    );
    expect(app).toContain(
      'fundingRecords={household.transferPlanFundingRecords || []}'
    );
    expect(app).toContain(
      'onUndoBillFunding={handleUndoTransferPlanBillFunding}'
    );
  });

  it('derives bill actions only from explicit immutable funding records', () => {
    expect(view).toContain(
      "import { getActiveBillFundingByPaymentId } from '../utils/transferPlanFundingCompatibility';"
    );
    expect(view).toContain(
      'getActiveBillFundingByPaymentId(\n        fundingRecords,\n        transactions,\n        selectedMonth\n      )'
    );
    expect(view).toContain(
      'buildTransferPlanAccountModels(\n        plan,\n        transactions,\n        selectedMonth,\n        fundingRecords\n      )'
    );
    expect(view).not.toContain('getLegacyIncomingFundingBatches');
  });

  it('shows the exact latest active amount and does not couple the action to payment status', () => {
    expect(view).toContain(
      'const activeBillFunding = activeBillFundingByPaymentId.get(payment.id);'
    );
    expect(view).toContain(
      'Transfer-funded {formatPence(activeBillFunding.activePence)}'
    );
    expect(view).toContain(
      'Undo funding {formatPence(activeBillFunding.activePence)}'
    );
    expect(view).toContain('!isViewOnly && activeBillFunding ? (');
    expect(view).not.toContain(
      "payment.status !== 'paid' && activeBillFunding"
    );
    expect(view).toContain('<UndoBillFundingModal');
    expect(view).toContain('onConfirm={onUndoBillFunding}');
  });
});
