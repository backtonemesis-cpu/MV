import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment, Transaction } from './types';
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

const bill = (accountId: string): PlannedPayment => ({
  id: 'bill-1',
  name: 'Rent',
  amountPence: 10_000,
  month: '2026-09',
  responsiblePerson: 'Marius',
  accountId,
  dueDate: '2026-09-15',
  status: 'unpaid',
  includeInTransferPlan: true,
  createdAt: '2026-09-01T08:00:00.000Z',
  createdBy: 'test',
});

function originalFunding(
  sourceAccountId: string,
  destinationAccountId: string
): Transaction {
  return {
    id: 'tx-original',
    date: '2026-09-12',
    description: 'Transfer Plan: Fund Bills',
    amountPence: 10_000,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: sourceAccountId,
    targetAccountId: destinationAccountId,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    metadata: {
      transferBatchId: 'batch-1',
      transferPlanMonth: '2026-09',
      transferPlanFundingRecordId: 'batch-1',
      allocationIndex: 0,
      allocationCount: 1,
    },
    createdAt: '2026-09-12T09:00:00.000Z',
    createdBy: 'test',
  };
}

function reversal(
  sourceAccountId: string,
  destinationAccountId: string,
  amountPence: number
): Transaction {
  return {
    id: `tx-reversal-${amountPence}`,
    date: '2026-09-13',
    description: 'Undo funding: Rent',
    amountPence,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: destinationAccountId,
    targetAccountId: sourceAccountId,
    payer: 'Marius',
    isTransfer: true,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    originalTransactionId: 'tx-original',
    metadata: {
      transferPlanFundingReversal: true,
      transferPlanFundingRecordId: 'batch-1',
      transferPlanPaymentId: 'bill-1',
      originalFundingTransactionId: 'tx-original',
      reversalScope: 'bill',
    },
    createdAt: '2026-09-13T09:00:00.000Z',
    createdBy: 'test',
  };
}

describe('GA-TP-002 transaction-linked active funding fallback', () => {
  it('shows only the exact active remainder without requiring the funding record prop', () => {
    const destination = account('dest', 6_000);
    const source = account('source', 50_000);
    const payment = bill(destination.id);
    const original = originalFunding(source.id, destination.id);
    const transactions = [reversal(source.id, destination.id, 4_000), original];
    const plan = generateTransferPlan(
      [destination, source],
      [payment],
      '2026-09',
      transactions
    );

    const [model] = buildTransferPlanAccountModels(
      plan,
      transactions,
      '2026-09'
    );

    expect(model.lifecycle).toBe('needs_funding');
    expect(model.fundingTotalPence).toBe(6_000);
    expect(model.latestFundingBatch).toEqual(
      expect.objectContaining({
        kind: 'attributed',
        batchKey: 'batch-1',
        totalPence: 6_000,
        originalTotalPence: 10_000,
        sourceAccountIds: [source.id],
        allocations: [{ sourceAccountId: source.id, amountPence: 6_000 }],
        expectedUndoBatch: {
          batchKey: 'batch-1',
          destinationAccountId: destination.id,
          totalPence: 10_000,
          transactionIds: [original.id],
        },
      })
    );
  });

  it('does not expose a fully reversed record-backed original as current or legacy funding', () => {
    const destination = account('dest', 0);
    const source = account('source', 50_000);
    const payment = bill(destination.id);
    const original = originalFunding(source.id, destination.id);
    const transactions = [reversal(source.id, destination.id, 10_000), original];
    const plan = generateTransferPlan(
      [destination, source],
      [payment],
      '2026-09',
      transactions
    );

    const [model] = buildTransferPlanAccountModels(
      plan,
      transactions,
      '2026-09'
    );

    expect(model.lifecycle).toBe('needs_funding');
    expect(model.fundingBatches).toEqual([]);
    expect(model.fundingTotalPence).toBe(0);
    expect(model.latestFundingBatch).toBeUndefined();
  });

  it('fails closed when linked reversals exceed the original transaction amount', () => {
    const destination = account('dest', 0);
    const source = account('source', 50_000);
    const payment = bill(destination.id);
    const original = originalFunding(source.id, destination.id);
    const transactions = [reversal(source.id, destination.id, 10_001), original];
    const plan = generateTransferPlan(
      [destination, source],
      [payment],
      '2026-09',
      transactions
    );

    expect(() =>
      buildTransferPlanAccountModels(plan, transactions, '2026-09')
    ).toThrow('reversal exceeds original funding');
  });
});
