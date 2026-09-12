import type {
  Transaction,
  TransferPlanFundingBillAttribution,
  TransferPlanFundingRecord,
  TransferPlanFundingSourceShare,
} from '../types';
import { validateTransferPlanFundingRecord } from './transferPlanFundingAttribution';

export interface ActiveTransferPlanFundingShare extends TransferPlanFundingSourceShare {
  reversedPence: number;
  activePence: number;
}

export interface ActiveTransferPlanBillFunding {
  plannedPaymentId: string;
  original: TransferPlanFundingBillAttribution;
  reversedPence: number;
  activePence: number;
  sourceShares: ActiveTransferPlanFundingShare[];
}

export interface ActiveTransferPlanDeficitFunding {
  originalPence: number;
  reversedPence: number;
  activePence: number;
  sourceShares: ActiveTransferPlanFundingShare[];
}

export interface ActiveTransferPlanFundingRecord {
  record: TransferPlanFundingRecord;
  bills: ActiveTransferPlanBillFunding[];
  deficit?: ActiveTransferPlanDeficitFunding;
  reversedPence: number;
  activePence: number;
}

function metadataString(transaction: Transaction, key: string): string | undefined {
  const value = transaction.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function metadataBoolean(transaction: Transaction, key: string): boolean {
  return transaction.metadata?.[key] === true;
}

function assertSafePositivePence(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be exact positive integer pence.`);
  }
}

function sourceShareKey(
  purpose: string,
  originalFundingTransactionId: string
): string {
  return `${purpose}::${originalFundingTransactionId}`;
}

function billPurpose(plannedPaymentId: string): string {
  return `bill:${plannedPaymentId}`;
}

const DEFICIT_PURPOSE = 'deficit';

export function deriveActiveTransferPlanFundingRecord(
  record: TransferPlanFundingRecord,
  transactions: Transaction[]
): ActiveTransferPlanFundingRecord {
  validateTransferPlanFundingRecord(record);

  const originalsById = new Map<string, Transaction>();
  for (const leg of record.sourceLegs) {
    const matches = transactions.filter((transaction) => transaction.id === leg.transactionId);
    if (matches.length !== 1) {
      throw new Error('Funding evidence is missing or duplicated; nothing can be reversed safely.');
    }
    const transaction = matches[0];
    const valid =
      transaction.type === 'transfer' &&
      transaction.isTransfer === true &&
      transaction.accountId === leg.sourceAccountId &&
      transaction.targetAccountId === record.destinationAccountId &&
      transaction.amountPence === leg.amountPence &&
      metadataString(transaction, 'transferBatchId') === record.id &&
      metadataString(transaction, 'transferPlanFundingRecordId') === record.id &&
      metadataString(transaction, 'transferPlanMonth') === record.month;
    if (!valid) {
      throw new Error('Funding transaction linkage does not match the immutable attribution record.');
    }
    originalsById.set(transaction.id, transaction);
  }

  const availableByKey = new Map<string, TransferPlanFundingSourceShare>();
  for (const attribution of record.billAttributions) {
    for (const share of attribution.sourceShares) {
      availableByKey.set(
        sourceShareKey(billPurpose(attribution.plannedPaymentId), share.transactionId),
        share
      );
    }
  }
  for (const share of record.accountDeficitRecovery?.sourceShares || []) {
    availableByKey.set(sourceShareKey(DEFICIT_PURPOSE, share.transactionId), share);
  }

  const reversedByKey = new Map<string, number>();
  const reversalTransactions = transactions.filter(
    (transaction) =>
      metadataBoolean(transaction, 'transferPlanFundingReversal') &&
      metadataString(transaction, 'transferPlanFundingRecordId') === record.id
  );

  for (const reversal of reversalTransactions) {
    if (
      reversal.type !== 'transfer' ||
      reversal.isTransfer !== true ||
      reversal.accountId !== record.destinationAccountId
    ) {
      throw new Error('Funding reversal transaction has invalid transfer semantics.');
    }
    assertSafePositivePence(reversal.amountPence, 'Funding reversal amount');

    const originalFundingTransactionId = metadataString(
      reversal,
      'originalFundingTransactionId'
    );
    if (!originalFundingTransactionId || !originalsById.has(originalFundingTransactionId)) {
      throw new Error('Funding reversal does not reference a valid original funding transaction.');
    }
    if (
      reversal.originalTransactionId !== undefined &&
      reversal.originalTransactionId !== originalFundingTransactionId
    ) {
      throw new Error('Funding reversal original transaction linkage is inconsistent.');
    }

    const reversalScope = metadataString(reversal, 'reversalScope');
    if (reversalScope !== 'bill' && reversalScope !== 'batch') {
      throw new Error('Funding reversal scope is invalid.');
    }

    const plannedPaymentId = metadataString(reversal, 'transferPlanPaymentId');
    const purpose = plannedPaymentId ? billPurpose(plannedPaymentId) : DEFICIT_PURPOSE;
    const key = sourceShareKey(purpose, originalFundingTransactionId);
    const originalShare = availableByKey.get(key);
    if (!originalShare) {
      throw new Error('Funding reversal does not match an attributable source share.');
    }
    if (reversal.targetAccountId !== originalShare.sourceAccountId) {
      throw new Error('Funding reversal destination does not match the original funding source.');
    }

    const nextReversed = (reversedByKey.get(key) || 0) + reversal.amountPence;
    if (!Number.isSafeInteger(nextReversed) || nextReversed > originalShare.amountPence) {
      throw new Error('Funding reversal exceeds the original attributable source share.');
    }
    reversedByKey.set(key, nextReversed);
  }

  const activeShare = (
    purpose: string,
    share: TransferPlanFundingSourceShare
  ): ActiveTransferPlanFundingShare => {
    const reversedPence =
      reversedByKey.get(sourceShareKey(purpose, share.transactionId)) || 0;
    return {
      ...share,
      reversedPence,
      activePence: share.amountPence - reversedPence,
    };
  };

  const bills: ActiveTransferPlanBillFunding[] = record.billAttributions.map(
    (attribution) => {
      const sourceShares = attribution.sourceShares.map((share) =>
        activeShare(billPurpose(attribution.plannedPaymentId), share)
      );
      const activePence = sourceShares.reduce(
        (sum, share) => sum + share.activePence,
        0
      );
      return {
        plannedPaymentId: attribution.plannedPaymentId,
        original: attribution,
        reversedPence: attribution.attributedPence - activePence,
        activePence,
        sourceShares,
      };
    }
  );

  let deficit: ActiveTransferPlanDeficitFunding | undefined;
  if (record.accountDeficitRecovery) {
    const sourceShares = record.accountDeficitRecovery.sourceShares.map((share) =>
      activeShare(DEFICIT_PURPOSE, share)
    );
    const activePence = sourceShares.reduce(
      (sum, share) => sum + share.activePence,
      0
    );
    deficit = {
      originalPence: record.accountDeficitRecovery.amountPence,
      reversedPence: record.accountDeficitRecovery.amountPence - activePence,
      activePence,
      sourceShares,
    };
  }

  const activePence =
    bills.reduce((sum, bill) => sum + bill.activePence, 0) +
    (deficit?.activePence || 0);
  const reversedPence = record.expectedTransferTotalPence - activePence;
  if (!Number.isSafeInteger(activePence) || activePence < 0 || reversedPence < 0) {
    throw new Error('Active funding derivation is not exact; nothing can be reversed safely.');
  }

  return { record, bills, deficit, activePence, reversedPence };
}

export function findLatestActiveBillFunding(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  plannedPaymentId: string
): {
  activeRecord: ActiveTransferPlanFundingRecord;
  bill: ActiveTransferPlanBillFunding;
} | undefined {
  const ordered = [...(records || [])].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id)
  );

  for (const record of ordered) {
    if (!record.billAttributions.some((item) => item.plannedPaymentId === plannedPaymentId)) {
      continue;
    }
    const activeRecord = deriveActiveTransferPlanFundingRecord(record, transactions);
    const bill = activeRecord.bills.find(
      (item) => item.plannedPaymentId === plannedPaymentId && item.activePence > 0
    );
    if (bill) return { activeRecord, bill };
  }
  return undefined;
}

export function findLatestActiveAttributedFundingBatch(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  destinationAccountId: string,
  month: string
): ActiveTransferPlanFundingRecord | undefined {
  const ordered = [...(records || [])]
    .filter(
      (record) =>
        record.destinationAccountId === destinationAccountId && record.month === month
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id)
    );

  for (const record of ordered) {
    const active = deriveActiveTransferPlanFundingRecord(record, transactions);
    if (active.activePence > 0) return active;
  }
  return undefined;
}
