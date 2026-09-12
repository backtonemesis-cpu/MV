import type {
  PlannedPayment,
  TransferPlanFundingRecord,
  TransferPlanFundingSourceShare,
} from '../types';

export interface BuildTransferPlanFundingRecordInput {
  id: string;
  month: string;
  destinationAccountId: string;
  destinationBalanceBeforePence: number;
  expectedTransferTotalPence: number;
  sourceLegs: TransferPlanFundingSourceShare[];
  selectedUnpaidPayments: PlannedPayment[];
  createdAt: string;
  createdBy: string;
}

function assertSafeNonNegativePence(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be non-negative safe integer pence.`);
  }
}

function assertSafeSignedPence(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be safe integer pence.`);
  }
}

function sumPence(values: number[], label: string): number {
  let total = 0;
  for (const value of values) {
    assertSafeNonNegativePence(value, label);
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new Error(`${label} total exceeds safe integer pence.`);
    }
  }
  return total;
}

function orderedPayments(payments: PlannedPayment[]): PlannedPayment[] {
  return [...payments].sort((a, b) => {
    const dueA = a.dueDate || '9999-99-99';
    const dueB = b.dueDate || '9999-99-99';
    return dueA.localeCompare(dueB) || a.id.localeCompare(b.id);
  });
}

export function validateTransferPlanFundingRecord(
  record: TransferPlanFundingRecord
): void {
  if (!record.id.trim()) throw new Error('Funding record ID is required.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month)) {
    throw new Error('Funding record month must use YYYY-MM format.');
  }
  if (!record.destinationAccountId.trim()) {
    throw new Error('Funding destination account ID is required.');
  }
  if (!record.createdAt.trim() || !record.createdBy.trim()) {
    throw new Error('Funding record creation evidence is required.');
  }
  if (record.schemaVersion !== 1) {
    throw new Error('Unsupported Transfer Plan funding record schema version.');
  }

  assertSafeSignedPence(
    record.destinationBalanceBeforePence,
    'Destination balance snapshot'
  );
  assertSafeNonNegativePence(
    record.expectedTransferTotalPence,
    'Expected funding total'
  );
  if (record.expectedTransferTotalPence <= 0) {
    throw new Error('Expected funding total must be greater than zero.');
  }

  const transactionIds = new Set<string>();
  for (const leg of record.sourceLegs) {
    if (!leg.transactionId.trim() || !leg.sourceAccountId.trim()) {
      throw new Error('Funding source leg identity is required.');
    }
    if (leg.sourceAccountId === record.destinationAccountId) {
      throw new Error('Funding source and destination accounts must be different.');
    }
    if (transactionIds.has(leg.transactionId)) {
      throw new Error('Funding source transaction IDs must be unique.');
    }
    transactionIds.add(leg.transactionId);
    assertSafeNonNegativePence(leg.amountPence, 'Funding source leg');
    if (leg.amountPence <= 0) {
      throw new Error('Funding source leg amount must be greater than zero.');
    }
  }

  const sourceLegTotal = sumPence(
    record.sourceLegs.map((leg) => leg.amountPence),
    'Funding source legs'
  );
  if (sourceLegTotal !== record.expectedTransferTotalPence) {
    throw new Error('Funding source legs do not match the expected transfer total.');
  }

  const attributedByTransactionId = new Map<string, number>();
  const addShare = (share: TransferPlanFundingSourceShare, label: string) => {
    const leg = record.sourceLegs.find(
      (candidate) => candidate.transactionId === share.transactionId
    );
    if (!leg || leg.sourceAccountId !== share.sourceAccountId) {
      throw new Error(`${label} references an unknown funding source leg.`);
    }
    assertSafeNonNegativePence(share.amountPence, label);
    if (share.amountPence <= 0) {
      throw new Error(`${label} amount must be greater than zero.`);
    }
    attributedByTransactionId.set(
      share.transactionId,
      (attributedByTransactionId.get(share.transactionId) || 0) +
        share.amountPence
    );
  };

  const paymentIds = new Set<string>();
  for (const attribution of record.billAttributions) {
    if (!attribution.plannedPaymentId.trim()) {
      throw new Error('Bill attribution requires a stable PlannedPayment ID.');
    }
    if (paymentIds.has(attribution.plannedPaymentId)) {
      throw new Error('A bill may appear only once within a funding record.');
    }
    paymentIds.add(attribution.plannedPaymentId);
    if (!attribution.paymentNameSnapshot.trim()) {
      throw new Error('Bill attribution requires a payment name snapshot.');
    }
    assertSafeNonNegativePence(
      attribution.paymentAmountPenceSnapshot,
      'Payment amount snapshot'
    );
    assertSafeNonNegativePence(attribution.attributedPence, 'Bill attribution');
    if (
      attribution.attributedPence <= 0 ||
      attribution.attributedPence > attribution.paymentAmountPenceSnapshot
    ) {
      throw new Error('Bill attribution must be positive and cannot exceed the payment snapshot.');
    }
    const shareTotal = sumPence(
      attribution.sourceShares.map((share) => share.amountPence),
      'Bill attribution source shares'
    );
    if (shareTotal !== attribution.attributedPence) {
      throw new Error('Bill attribution source shares do not match the attributed amount.');
    }
    attribution.sourceShares.forEach((share) => addShare(share, 'Bill source share'));
  }

  let deficitPence = 0;
  if (record.accountDeficitRecovery) {
    deficitPence = record.accountDeficitRecovery.amountPence;
    assertSafeNonNegativePence(deficitPence, 'Account deficit recovery');
    if (deficitPence <= 0) {
      throw new Error('Account deficit recovery must be greater than zero when present.');
    }
    const deficitShareTotal = sumPence(
      record.accountDeficitRecovery.sourceShares.map((share) => share.amountPence),
      'Account deficit source shares'
    );
    if (deficitShareTotal !== deficitPence) {
      throw new Error('Account deficit source shares do not match the recovery amount.');
    }
    record.accountDeficitRecovery.sourceShares.forEach((share) =>
      addShare(share, 'Account deficit source share')
    );
  }

  const billTotal = sumPence(
    record.billAttributions.map((item) => item.attributedPence),
    'Bill attributions'
  );
  if (billTotal + deficitPence !== record.expectedTransferTotalPence) {
    throw new Error('Bill attribution plus deficit recovery does not match the funding total.');
  }

  for (const leg of record.sourceLegs) {
    if ((attributedByTransactionId.get(leg.transactionId) || 0) !== leg.amountPence) {
      throw new Error('Funding source leg is not fully and exactly attributed.');
    }
  }
}

export function buildTransferPlanFundingRecord(
  input: BuildTransferPlanFundingRecordInput
): TransferPlanFundingRecord {
  if (!input.id.trim()) throw new Error('Funding record ID is required.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) {
    throw new Error('Funding month must use YYYY-MM format.');
  }
  if (!input.destinationAccountId.trim()) {
    throw new Error('Funding destination account ID is required.');
  }
  if (!input.createdAt.trim() || !input.createdBy.trim()) {
    throw new Error('Funding creation evidence is required.');
  }
  assertSafeSignedPence(
    input.destinationBalanceBeforePence,
    'Destination balance snapshot'
  );
  assertSafeNonNegativePence(
    input.expectedTransferTotalPence,
    'Expected transfer total'
  );
  if (input.expectedTransferTotalPence <= 0) {
    throw new Error('Expected transfer total must be greater than zero.');
  }

  const selected = orderedPayments(input.selectedUnpaidPayments);
  const paymentIds = new Set<string>();
  for (const payment of selected) {
    if (paymentIds.has(payment.id)) {
      throw new Error('Selected unpaid bills must have unique stable IDs.');
    }
    paymentIds.add(payment.id);
    if (
      payment.status !== 'unpaid' ||
      payment.includeInTransferPlan !== true ||
      payment.month !== input.month ||
      payment.accountId !== input.destinationAccountId
    ) {
      throw new Error('Funding attribution may include only selected unpaid bills for the same month and destination account.');
    }
    assertSafeNonNegativePence(payment.amountPence, 'Selected bill amount');
  }

  const sourceLegs = input.sourceLegs.map((leg) => ({ ...leg }));
  const sourceTotal = sumPence(
    sourceLegs.map((leg) => leg.amountPence),
    'Funding source legs'
  );
  if (sourceTotal !== input.expectedTransferTotalPence) {
    throw new Error('Funding source allocations must exactly equal the expected transfer total.');
  }

  const remainingByLeg = sourceLegs.map((leg) => ({ ...leg }));
  let legIndex = 0;
  const takeShares = (amountPence: number): TransferPlanFundingSourceShare[] => {
    assertSafeNonNegativePence(amountPence, 'Funding purpose');
    const shares: TransferPlanFundingSourceShare[] = [];
    let remaining = amountPence;

    while (remaining > 0) {
      while (
        legIndex < remainingByLeg.length &&
        remainingByLeg[legIndex].amountPence === 0
      ) {
        legIndex += 1;
      }
      const leg = remainingByLeg[legIndex];
      if (!leg) {
        throw new Error('Funding source allocations are insufficient for attribution.');
      }
      const amount = Math.min(remaining, leg.amountPence);
      shares.push({
        transactionId: leg.transactionId,
        sourceAccountId: leg.sourceAccountId,
        amountPence: amount,
      });
      leg.amountPence -= amount;
      remaining -= amount;
    }

    return shares;
  };

  const deficitPence = Math.max(0, -input.destinationBalanceBeforePence);
  const accountDeficitRecovery =
    deficitPence > 0
      ? {
          amountPence: deficitPence,
          sourceShares: takeShares(deficitPence),
        }
      : undefined;

  let existingCoveragePool = Math.max(0, input.destinationBalanceBeforePence);
  const billAttributions: TransferPlanFundingRecord['billAttributions'] = [];

  for (const payment of selected) {
    const existingCoverage = Math.min(existingCoveragePool, payment.amountPence);
    existingCoveragePool -= existingCoverage;
    const transferNeed = payment.amountPence - existingCoverage;
    if (transferNeed <= 0) continue;

    billAttributions.push({
      plannedPaymentId: payment.id,
      paymentNameSnapshot: payment.name,
      paymentAmountPenceSnapshot: payment.amountPence,
      paymentDueDateSnapshot: payment.dueDate,
      attributedPence: transferNeed,
      sourceShares: takeShares(transferNeed),
    });
  }

  const computedTransferRequired =
    deficitPence +
    billAttributions.reduce((sum, item) => sum + item.attributedPence, 0);
  if (computedTransferRequired !== input.expectedTransferTotalPence) {
    throw new Error(
      'Expected transfer total does not match the exact selected-bill funding requirement.'
    );
  }

  if (remainingByLeg.some((leg) => leg.amountPence !== 0)) {
    throw new Error('Funding source allocations contain unattributed pence.');
  }

  const record: TransferPlanFundingRecord = {
    id: input.id,
    schemaVersion: 1,
    month: input.month,
    destinationAccountId: input.destinationAccountId,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    destinationBalanceBeforePence: input.destinationBalanceBeforePence,
    expectedTransferTotalPence: input.expectedTransferTotalPence,
    sourceLegs,
    billAttributions,
    accountDeficitRecovery,
  };

  validateTransferPlanFundingRecord(record);
  return record;
}
