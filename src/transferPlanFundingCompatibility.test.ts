import { describe, expect, it } from 'vitest';
import type { PlannedPayment, Transaction, TransferPlanFundingRecord } from './types';
import { buildTransferPlanFundingRecord } from './utils/transferPlanFundingAttribution';
import {
  getActiveBillFundingByPaymentId,
  getLatestReversibleFundingEvidence,
  getTrulyLegacyFundingBatches,
} from './utils/transferPlanFundingCompatibility';

function payment(id: string, amountPence = 10_000): PlannedPayment {
  return {
    id,
    name: id,
    amountPence,
    month: '2026-09',
    responsiblePerson: 'Marius',
    accountId: 'dest',
    dueDate: '2026-09-05',
    categoryId: 'cat-rent',
    status: 'unpaid',
    includeInTransferPlan: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'test',
  };
}

function attributedRecord(
  id: string,
  transactionId: string,
  createdAt: string,
  plannedPaymentId = 'bill-1'
): TransferPlanFundingRecord {
  return buildTransferPlanFundingRecord({
    id,
    month: '2026-09',
    destinationAccountId: 'dest',
    destinationBalanceBeforePence: 0,
    expectedTransferTotalPence: 10_000,
    sourceLegs: [
      { transactionId, sourceAccountId: 'source', amountPence: 10_000 },
    ],
    selectedUnpaidPayments: [payment(plannedPaymentId)],
    createdAt,
    createdBy: 'marius@local.invalid',
  });
}

function fundingTransaction(record: TransferPlanFundingRecord): Transaction {
  const leg = record.sourceLegs[0];
  return {
    id: leg.transactionId,
    date: '2026-09-12',
    description: 'Transfer Plan: Fund Bills',
    amountPence: leg.amountPence,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: leg.sourceAccountId,
    targetAccountId: record.destinationAccountId,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    metadata: {
      transferBatchId: record.id,
      transferPlanMonth: record.month,
      transferPlanFundingRecordId: record.id,
      allocationIndex: 0,
      allocationCount: 1,
    },
    createdAt: record.createdAt,
    createdBy: 'marius@local.invalid',
  };
}

function reversal(
  record: TransferPlanFundingRecord,
  plannedPaymentId: string,
  createdAt = '2026-09-13T12:00:00.000Z'
): Transaction {
  const leg = record.sourceLegs[0];
  return {
    id: `reverse-${record.id}`,
    date: '2026-09-13',
    description: `Undo funding: ${plannedPaymentId}`,
    amountPence: leg.amountPence,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: record.destinationAccountId,
    targetAccountId: leg.sourceAccountId,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    originalTransactionId: leg.transactionId,
    metadata: {
      transferPlanFundingReversal: true,
      transferPlanFundingRecordId: record.id,
      transferPlanPaymentId: plannedPaymentId,
      originalFundingTransactionId: leg.transactionId,
      reversalScope: 'bill',
    },
    createdAt,
    createdBy: 'marius@local.invalid',
  };
}

function legacyBatch(createdAt = '2026-09-11T12:00:00.000Z'): Transaction {
  return {
    id: 'legacy-tx',
    date: '2026-09-11',
    description: 'Transfer Plan: Fund legacy bills',
    amountPence: 7_000,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: 'legacy-source',
    targetAccountId: 'dest',
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    metadata: {
      transferBatchId: 'legacy-batch',
      transferPlanMonth: '2026-09',
      allocationIndex: 0,
      allocationCount: 1,
    },
    createdAt,
    createdBy: 'marius@local.invalid',
  };
}

describe('GA-TP-002 attributed/legacy funding compatibility', () => {
  it('never reclassifies a fully reversed attributed original batch as legacy funding', () => {
    const record = attributedRecord(
      'batch-attributed',
      'tx-attributed',
      '2026-09-12T12:00:00.000Z'
    );
    const transactions = [
      fundingTransaction(record),
      reversal(record, 'bill-1'),
    ];

    expect(getTrulyLegacyFundingBatches([record], transactions, '2026-09')).toEqual([]);
    expect(
      getLatestReversibleFundingEvidence([record], transactions, 'dest', '2026-09')
    ).toBeUndefined();
  });

  it('preserves a truly unattributed legacy batch as reversible compatibility evidence', () => {
    const evidence = getLatestReversibleFundingEvidence(
      [],
      [legacyBatch()],
      'dest',
      '2026-09'
    );

    expect(evidence).toEqual(
      expect.objectContaining({
        kind: 'legacy',
        activePence: 7_000,
      })
    );
    if (evidence?.kind === 'legacy') {
      expect(evidence.batch.batchKey).toBe('legacy-batch');
    }
  });

  it('chooses the newest genuinely active evidence when attributed and legacy funding coexist', () => {
    const olderAttributed = attributedRecord(
      'batch-old',
      'tx-old',
      '2026-09-10T12:00:00.000Z'
    );
    const newerLegacy = legacyBatch('2026-09-11T12:00:00.000Z');

    const evidence = getLatestReversibleFundingEvidence(
      [olderAttributed],
      [fundingTransaction(olderAttributed), newerLegacy],
      'dest',
      '2026-09'
    );
    expect(evidence?.kind).toBe('legacy');

    const newerAttributed = attributedRecord(
      'batch-new',
      'tx-new',
      '2026-09-12T12:00:00.000Z'
    );
    const latest = getLatestReversibleFundingEvidence(
      [olderAttributed, newerAttributed],
      [
        fundingTransaction(olderAttributed),
        newerLegacy,
        fundingTransaction(newerAttributed),
      ],
      'dest',
      '2026-09'
    );
    expect(latest?.kind).toBe('attributed');
    if (latest?.kind === 'attributed') {
      expect(latest.activeRecord.record.id).toBe('batch-new');
    }
  });

  it('reports only the newest active attributed funding per bill', () => {
    const older = attributedRecord(
      'batch-old',
      'tx-old',
      '2026-09-10T12:00:00.000Z'
    );
    const newer = attributedRecord(
      'batch-new',
      'tx-new',
      '2026-09-12T12:00:00.000Z'
    );
    const active = getActiveBillFundingByPaymentId(
      [older, newer],
      [fundingTransaction(older), fundingTransaction(newer)],
      '2026-09'
    );

    expect(active.get('bill-1')).toEqual({
      fundingRecordId: 'batch-new',
      activePence: 10_000,
      createdAt: '2026-09-12T12:00:00.000Z',
    });
  });

  it('falls back to the older active bill attribution after the newest one is fully reversed', () => {
    const older = attributedRecord(
      'batch-old',
      'tx-old',
      '2026-09-10T12:00:00.000Z'
    );
    const newer = attributedRecord(
      'batch-new',
      'tx-new',
      '2026-09-12T12:00:00.000Z'
    );
    const active = getActiveBillFundingByPaymentId(
      [older, newer],
      [
        fundingTransaction(older),
        fundingTransaction(newer),
        reversal(newer, 'bill-1'),
      ],
      '2026-09'
    );

    expect(active.get('bill-1')?.fundingRecordId).toBe('batch-old');
  });
});
