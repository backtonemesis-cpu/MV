import type { Transaction, TransferPlanFundingRecord } from '../types';
import { validateTransferPlanFundingRecord } from './transferPlanFundingAttribution';
import { deriveActiveTransferPlanFundingRecord } from './transferPlanFundingReversal';

/**
 * Normalizes the additive Transfer Plan funding-evidence collection without
 * reconstructing attribution for legacy transaction-only funding batches.
 */
export function normalizeTransferPlanFundingRecords(
  value: TransferPlanFundingRecord[] | undefined
): TransferPlanFundingRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('Transfer Plan funding records must be an array.');
  }

  const ids = new Set<string>();
  return value.map((record) => {
    validateTransferPlanFundingRecord(record);
    if (ids.has(record.id)) {
      throw new Error(`Transfer Plan funding record ID '${record.id}' is duplicated.`);
    }
    ids.add(record.id);
    return structuredClone(record);
  });
}

function metadataString(transaction: Transaction, key: string): string | undefined {
  const value = transaction.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reconciles persisted attribution against the immutable original transfer legs
 * and any append-only reversal transactions. Legacy transaction-only funding has
 * no record ID and is deliberately outside this validator.
 */
export function assertTransferPlanFundingEvidenceIntegrity(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[]
): void {
  const normalizedRecords = records || [];
  const recordsById = new Map(normalizedRecords.map((record) => [record.id, record]));

  for (const record of normalizedRecords) {
    deriveActiveTransferPlanFundingRecord(record, transactions);
  }

  for (const transaction of transactions) {
    const recordId = metadataString(transaction, 'transferPlanFundingRecordId');
    if (!recordId) continue;

    const record = recordsById.get(recordId);
    if (!record) {
      throw new Error(
        `Transaction '${transaction.id}' references missing Transfer Plan funding record '${recordId}'.`
      );
    }

    if (transaction.metadata?.transferPlanFundingReversal === true) {
      // deriveActiveTransferPlanFundingRecord validates exact reversal linkage,
      // scope, source share, direction and over-reversal for this record.
      continue;
    }

    if (!record.sourceLegs.some((leg) => leg.transactionId === transaction.id)) {
      throw new Error(
        `Transaction '${transaction.id}' is not an original source leg of Transfer Plan funding record '${recordId}'.`
      );
    }
  }
}
