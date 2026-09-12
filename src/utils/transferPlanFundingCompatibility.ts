import type { Transaction, TransferPlanFundingRecord } from '../types';
import {
  getLegacyIncomingFundingBatches,
  getTransferPlanFundingBatches,
  type TransferPlanFundingBatch,
} from './transferPlanFunding';
import {
  deriveActiveTransferPlanFundingRecord,
  type ActiveTransferPlanFundingRecord,
} from './transferPlanFundingReversal';

export type TransferPlanReversibleFundingEvidence =
  | {
      kind: 'attributed';
      createdAt: string;
      destinationAccountId: string;
      month: string;
      activePence: number;
      activeRecord: ActiveTransferPlanFundingRecord;
    }
  | {
      kind: 'legacy';
      createdAt: string;
      destinationAccountId: string;
      month: string;
      activePence: number;
      batch: TransferPlanFundingBatch;
    };

export function getActiveAttributedFundingRecords(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  month?: string
): ActiveTransferPlanFundingRecord[] {
  return [...(records || [])]
    .filter((record) => !month || record.month === month)
    .map((record) => deriveActiveTransferPlanFundingRecord(record, transactions))
    .filter((active) => active.activePence > 0)
    .sort(
      (a, b) =>
        b.record.createdAt.localeCompare(a.record.createdAt) ||
        b.record.id.localeCompare(a.record.id)
    );
}

export function getTrulyLegacyFundingBatches(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  month?: string
): TransferPlanFundingBatch[] {
  const attributedRecordIds = new Set((records || []).map((record) => record.id));

  return [
    ...getTransferPlanFundingBatches(transactions, month),
    ...getLegacyIncomingFundingBatches(transactions, month),
  ]
    .filter((batch) => !attributedRecordIds.has(batch.batchKey))
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        b.batchKey.localeCompare(a.batchKey)
    );
}

export function getLatestReversibleFundingEvidence(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  destinationAccountId: string,
  month: string
): TransferPlanReversibleFundingEvidence | undefined {
  const attributed: TransferPlanReversibleFundingEvidence[] =
    getActiveAttributedFundingRecords(records, transactions, month)
      .filter(
        (active) => active.record.destinationAccountId === destinationAccountId
      )
      .map((activeRecord) => ({
        kind: 'attributed' as const,
        createdAt: activeRecord.record.createdAt,
        destinationAccountId,
        month,
        activePence: activeRecord.activePence,
        activeRecord,
      }));

  const legacy: TransferPlanReversibleFundingEvidence[] =
    getTrulyLegacyFundingBatches(records, transactions, month)
      .filter((batch) => batch.destinationAccountId === destinationAccountId)
      .map((batch) => ({
        kind: 'legacy' as const,
        createdAt: batch.createdAt,
        destinationAccountId,
        month,
        activePence: batch.totalPence,
        batch,
      }));

  return [...attributed, ...legacy].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      (b.kind === 'attributed' ? 1 : 0) - (a.kind === 'attributed' ? 1 : 0)
  )[0];
}

export function getActiveBillFundingByPaymentId(
  records: TransferPlanFundingRecord[] | undefined,
  transactions: Transaction[],
  month?: string
): Map<
  string,
  {
    fundingRecordId: string;
    activePence: number;
    createdAt: string;
  }
> {
  const result = new Map<
    string,
    { fundingRecordId: string; activePence: number; createdAt: string }
  >();

  for (const activeRecord of getActiveAttributedFundingRecords(
    records,
    transactions,
    month
  )) {
    for (const bill of activeRecord.bills) {
      if (bill.activePence <= 0 || result.has(bill.plannedPaymentId)) continue;
      result.set(bill.plannedPaymentId, {
        fundingRecordId: activeRecord.record.id,
        activePence: bill.activePence,
        createdAt: activeRecord.record.createdAt,
      });
    }
  }

  return result;
}
