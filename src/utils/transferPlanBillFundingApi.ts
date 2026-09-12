import { undoAttributedTransferPlanBillFunding } from './transferPlanFundingReversalStore';

export async function undoTransferPlanBillFunding(
  plannedPaymentId: string,
  expectedVersion: number
) {
  return undoAttributedTransferPlanBillFunding(
    plannedPaymentId,
    expectedVersion
  );
}
