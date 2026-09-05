import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment, Transaction } from '../types';
import { generateTransferPlan } from './transferPlan';
import {
  buildTransferPlanAccountModels,
  groupTransferPlanAccountModels,
} from './transferPlanViewModel';

const account = (id: string, balancePence: number): Account => ({
  id,
  name: id,
  type: 'current',
  currency: 'GBP',
  startingBalancePence: balancePence,
  currentBalancePence: balancePence,
  ownerPerson: 'Marius',
  isActive: true,
});

const bill = (
  id: string,
  accountId: string,
  amountPence: number,
  status: 'paid' | 'unpaid' = 'unpaid'
): PlannedPayment => ({
  id,
  name: id,
  amountPence,
  month: '2026-09',
  responsiblePerson: 'Marius',
  accountId,
  status,
  includeInTransferPlan: true,
  createdAt: '2026-09-01T08:00:00.000Z',
  createdBy: 'test',
});

const fundingTx = (
  id: string,
  sourceAccountId: string,
  destinationAccountId: string,
  amountPence: number
): Transaction => ({
  id,
  date: '2026-09-01',
  description: 'Transfer Plan: test funding',
  amountPence,
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
  },
  createdAt: '2026-09-01T09:00:00.000Z',
  createdBy: 'test',
});

describe('Transfer Plan V2 lifecycle view model', () => {
  it('keeps needs funding, covered, funded and paid as distinct states', () => {
    const needs = account('needs', 0);
    const covered = account('covered', 10_000);
    const funded = account('funded', 10_000);
    const paid = account('paid', 0);
    const source = account('source', 50_000);

    const payments = [
      bill('needs-bill', needs.id, 5_000),
      bill('covered-bill', covered.id, 5_000),
      bill('funded-bill', funded.id, 5_000),
      bill('paid-bill', paid.id, 5_000, 'paid'),
    ];

    const txs = [fundingTx('funding-1', source.id, funded.id, 5_000)];
    const plan = generateTransferPlan(
      [needs, covered, funded, paid, source],
      payments,
      '2026-09',
      txs
    );

    const groups = groupTransferPlanAccountModels(
      buildTransferPlanAccountModels(plan, txs, '2026-09')
    );

    expect(groups.needsFunding.map((item) => item.requirement.account.id)).toEqual([
      'needs',
    ]);
    expect(groups.covered.map((item) => item.requirement.account.id)).toEqual([
      'covered',
    ]);
    expect(groups.funded.map((item) => item.requirement.account.id)).toEqual([
      'funded',
    ]);
    expect(groups.paid.map((item) => item.requirement.account.id)).toEqual([
      'paid',
    ]);
  });

  it('surfaces a new shortfall even when earlier funding history still exists', () => {
    const destination = account('destination', 1_000);
    const source = account('source', 50_000);
    const payments = [bill('bill-1', destination.id, 5_000)];
    const txs = [fundingTx('funding-1', source.id, destination.id, 4_000)];

    const plan = generateTransferPlan(
      [destination, source],
      payments,
      '2026-09',
      txs
    );
    const [model] = buildTransferPlanAccountModels(plan, txs, '2026-09');

    expect(model.lifecycle).toBe('needs_funding');
    expect(model.latestFundingBatch?.totalPence).toBe(4_000);
  });

  it('never labels existing-balance coverage as funded without funding evidence', () => {
    const destination = account('destination', 10_000);
    const payments = [bill('bill-1', destination.id, 5_000)];

    const plan = generateTransferPlan(
      [destination],
      payments,
      '2026-09',
      []
    );
    const [model] = buildTransferPlanAccountModels(plan, [], '2026-09');

    expect(model.lifecycle).toBe('covered');
    expect(model.fundingBatches).toHaveLength(0);
    expect(model.latestFundingBatch).toBeUndefined();
  });
});
