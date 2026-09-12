import { describe, expect, it } from 'vitest';
import type { PlannedPayment, Transaction, TransferPlanFundingRecord } from './types';
import { buildTransferPlanFundingRecord } from './utils/transferPlanFundingAttribution';
import {
  deriveActiveTransferPlanFundingRecord,
  findLatestActiveBillFunding,
} from './utils/transferPlanFundingReversal';

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

function buildRecord(params?: {
  id?: string;
  transactionId?: string;
  createdAt?: string;
  destinationBalanceBeforePence?: number;
  expectedTransferTotalPence?: number;
  bill?: PlannedPayment;
}): TransferPlanFundingRecord {
  const transactionId = params?.transactionId || 'tx-funding';
  return buildTransferPlanFundingRecord({
    id: params?.id || 'batch-1',
    month: '2026-09',
    destinationAccountId: 'dest',
    destinationBalanceBeforePence: params?.destinationBalanceBeforePence ?? 0,
    expectedTransferTotalPence: params?.expectedTransferTotalPence ?? 10_000,
    sourceLegs: [
      {
        transactionId,
        sourceAccountId: 'source',
        amountPence: params?.expectedTransferTotalPence ?? 10_000,
      },
    ],
    selectedUnpaidPayments: [params?.bill || payment('bill-1')],
    createdAt: params?.createdAt || '2026-09-12T12:00:00.000Z',
    createdBy: 'marius@local.invalid',
  });
}

function originalFundingTransaction(record: TransferPlanFundingRecord): Transaction {
  const leg = record.sourceLegs[0];
  return {
    id: leg.transactionId,
    date: '2026-09-12',
    description: 'Transfer Plan funding',
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

function reversal(params: {
  id: string;
  record: TransferPlanFundingRecord;
  amountPence: number;
  plannedPaymentId?: string;
  scope?: 'bill' | 'batch';
}): Transaction {
  const original = params.record.sourceLegs[0];
  return {
    id: params.id,
    date: '2026-09-13',
    description: 'Undo Transfer Plan funding',
    amountPence: params.amountPence,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: params.record.destinationAccountId,
    targetAccountId: original.sourceAccountId,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    originalTransactionId: original.transactionId,
    metadata: {
      transferPlanFundingReversal: true,
      transferPlanFundingRecordId: params.record.id,
      transferPlanPaymentId: params.plannedPaymentId,
      originalFundingTransactionId: original.transactionId,
      reversalScope: params.scope || 'bill',
    },
    createdAt: '2026-09-13T12:00:00.000Z',
    createdBy: 'marius@local.invalid',
  };
}

describe('GA-TP-002 active attributed funding derivation', () => {
  it('reports original explicit bill funding as fully active before reversal', () => {
    const record = buildRecord();
    const active = deriveActiveTransferPlanFundingRecord(record, [
      originalFundingTransaction(record),
    ]);

    expect(active.activePence).toBe(10_000);
    expect(active.reversedPence).toBe(0);
    expect(active.bills[0]).toEqual(
      expect.objectContaining({
        plannedPaymentId: 'bill-1',
        activePence: 10_000,
        reversedPence: 0,
      })
    );
  });

  it('subtracts only the exact linked reversal from the matching bill/source share', () => {
    const record = buildRecord();
    const active = deriveActiveTransferPlanFundingRecord(record, [
      originalFundingTransaction(record),
      reversal({
        id: 'tx-reversal',
        record,
        amountPence: 4_000,
        plannedPaymentId: 'bill-1',
      }),
    ]);

    expect(active.activePence).toBe(6_000);
    expect(active.reversedPence).toBe(4_000);
    expect(active.bills[0].sourceShares[0]).toEqual(
      expect.objectContaining({
        amountPence: 10_000,
        reversedPence: 4_000,
        activePence: 6_000,
      })
    );
  });

  it('falls back to the next older active batch after the newest bill attribution is fully reversed', () => {
    const older = buildRecord({
      id: 'batch-old',
      transactionId: 'tx-old',
      createdAt: '2026-09-10T12:00:00.000Z',
    });
    const newer = buildRecord({
      id: 'batch-new',
      transactionId: 'tx-new',
      createdAt: '2026-09-12T12:00:00.000Z',
    });
    const transactions = [
      originalFundingTransaction(older),
      originalFundingTransaction(newer),
      reversal({
        id: 'tx-new-reversed',
        record: newer,
        amountPence: 10_000,
        plannedPaymentId: 'bill-1',
      }),
    ];

    const latest = findLatestActiveBillFunding(
      [older, newer],
      transactions,
      'bill-1'
    );
    expect(latest?.activeRecord.record.id).toBe('batch-old');
    expect(latest?.bill.activePence).toBe(10_000);
  });

  it('tracks account-deficit reversal separately from bill attribution', () => {
    const record = buildRecord({
      destinationBalanceBeforePence: -4_000,
      expectedTransferTotalPence: 14_000,
    });
    const active = deriveActiveTransferPlanFundingRecord(record, [
      originalFundingTransaction(record),
      reversal({
        id: 'tx-deficit-reversal',
        record,
        amountPence: 4_000,
        scope: 'batch',
      }),
    ]);

    expect(active.deficit).toEqual(
      expect.objectContaining({
        originalPence: 4_000,
        reversedPence: 4_000,
        activePence: 0,
      })
    );
    expect(active.bills[0].activePence).toBe(10_000);
    expect(active.activePence).toBe(10_000);
  });

  it('fails closed when reversal evidence exceeds the original attributable share', () => {
    const record = buildRecord();
    expect(() =>
      deriveActiveTransferPlanFundingRecord(record, [
        originalFundingTransaction(record),
        reversal({
          id: 'tx-over-reversal',
          record,
          amountPence: 10_001,
          plannedPaymentId: 'bill-1',
        }),
      ])
    ).toThrow('exceeds the original attributable source share');
  });

  it('fails closed when the original funding transaction linkage is missing or altered', () => {
    const record = buildRecord();
    const wrong = {
      ...originalFundingTransaction(record),
      targetAccountId: 'wrong-destination',
    };

    expect(() => deriveActiveTransferPlanFundingRecord(record, [wrong])).toThrow(
      'does not match the immutable attribution record'
    );
    expect(
      findLatestActiveBillFunding([], [], 'bill-1')
    ).toBeUndefined();
  });
});
