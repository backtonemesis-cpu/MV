import { describe, expect, it } from 'vitest';
import type {
  Account,
  PlannedPayment,
  Transaction,
  TransferPlanFundingRecord,
} from './types';
import { generateTransferPlan } from './utils/transferPlan';
import { buildTransferPlanAccountModels } from './utils/transferPlanViewModel';

const account = (id: string, currentBalancePence: number): Account => ({
  id,
  name: id,
  type: 'current',
  currency: 'GBP',
  startingBalancePence: currentBalancePence,
  currentBalancePence,
  ownerPerson: 'Marius',
  isActive: true,
});

const bill = (id: string, accountId: string, amountPence: number): PlannedPayment => ({
  id,
  name: id,
  amountPence,
  month: '2026-09',
  responsiblePerson: 'Marius',
  accountId,
  dueDate: '2026-09-15',
  status: 'unpaid',
  includeInTransferPlan: true,
  createdAt: '2026-09-01T08:00:00.000Z',
  createdBy: 'test',
});

function attributedFixture(reversedPence: number) {
  const destination = account('dest', 10_000 - reversedPence);
  const source = account('source', 50_000 + reversedPence);
  const payment = bill('bill-1', destination.id, 10_000);
  const original: Transaction = {
    id: 'tx-original',
    date: '2026-09-12',
    description: 'Transfer Plan: Fund dest',
    amountPence: 10_000,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: source.id,
    targetAccountId: destination.id,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    metadata: {
      transferBatchId: 'batch-1',
      transferPlanMonth: '2026-09',
      transferPlanFundingRecordId: 'batch-1',
    },
    createdAt: '2026-09-12T09:00:00.000Z',
    createdBy: 'test',
  };
  const transactions: Transaction[] = [original];
  if (reversedPence > 0) {
    transactions.unshift({
      id: 'tx-reversal',
      date: '2026-09-13',
      description: 'Undo funding: bill-1',
      amountPence: reversedPence,
      type: 'transfer',
      categoryId: 'cat-transfer',
      accountId: destination.id,
      targetAccountId: source.id,
      payer: 'Marius',
      isTransfer: true,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      originalTransactionId: original.id,
      metadata: {
        transferPlanFundingReversal: true,
        transferPlanFundingRecordId: 'batch-1',
        transferPlanPaymentId: payment.id,
        originalFundingTransactionId: original.id,
        reversalScope: 'bill',
      },
      createdAt: '2026-09-13T09:00:00.000Z',
      createdBy: 'test',
    });
  }

  const record: TransferPlanFundingRecord = {
    id: 'batch-1',
    schemaVersion: 1,
    month: '2026-09',
    destinationAccountId: destination.id,
    createdAt: original.createdAt,
    createdBy: 'test',
    destinationBalanceBeforePence: 0,
    expectedTransferTotalPence: 10_000,
    sourceLegs: [
      {
        transactionId: original.id,
        sourceAccountId: source.id,
        amountPence: 10_000,
      },
    ],
    billAttributions: [
      {
        plannedPaymentId: payment.id,
        paymentNameSnapshot: payment.name,
        paymentAmountPenceSnapshot: payment.amountPence,
        paymentDueDateSnapshot: payment.dueDate,
        attributedPence: 10_000,
        sourceShares: [
          {
            transactionId: original.id,
            sourceAccountId: source.id,
            amountPence: 10_000,
          },
        ],
      },
    ],
  };

  return { destination, source, payment, original, transactions, record };
}

describe('GA-TP-002 active attributed funding view model', () => {
  it('shows the active remainder while retaining immutable original undo identity', () => {
    const fixture = attributedFixture(4_000);
    const plan = generateTransferPlan(
      [fixture.destination, fixture.source],
      [fixture.payment],
      '2026-09',
      fixture.transactions
    );

    const [model] = buildTransferPlanAccountModels(
      plan,
      fixture.transactions,
      '2026-09',
      [fixture.record]
    );

    expect(model.lifecycle).toBe('needs_funding');
    expect(model.fundingTotalPence).toBe(6_000);
    expect(model.latestFundingBatch).toEqual(
      expect.objectContaining({
        kind: 'attributed',
        batchKey: fixture.record.id,
        totalPence: 6_000,
        originalTotalPence: 10_000,
        sourceAccountIds: [fixture.source.id],
        allocations: [
          { sourceAccountId: fixture.source.id, amountPence: 6_000 },
        ],
        expectedUndoBatch: {
          batchKey: fixture.record.id,
          destinationAccountId: fixture.destination.id,
          totalPence: 10_000,
          transactionIds: [fixture.original.id],
        },
      })
    );
  });

  it('does not reclassify a fully reversed attributed original as current funding', () => {
    const fixture = attributedFixture(10_000);
    const coveredDestination = {
      ...fixture.destination,
      currentBalancePence: 10_000,
    };
    const plan = generateTransferPlan(
      [coveredDestination, fixture.source],
      [fixture.payment],
      '2026-09',
      fixture.transactions
    );

    const [model] = buildTransferPlanAccountModels(
      plan,
      fixture.transactions,
      '2026-09',
      [fixture.record]
    );

    expect(model.fundingBatches).toHaveLength(0);
    expect(model.fundingTotalPence).toBe(0);
    expect(model.latestFundingBatch).toBeUndefined();
    expect(model.lifecycle).toBe('covered');
  });
});
