import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment } from '../types';
import { calculateAccountFunding, generateTransferPlan } from './transferPlan';

const account = (
  id: string,
  name: string,
  ownerPerson: string,
  currentBalancePence: number
): Account => ({
  id,
  name,
  type: 'current',
  currency: 'GBP',
  startingBalancePence: currentBalancePence,
  currentBalancePence,
  ownerPerson,
  isActive: true,
});

const payment = (
  id: string,
  accountId: string,
  amountPence: number,
  status: 'paid' | 'unpaid' = 'unpaid',
  actualTransactionId?: string
): PlannedPayment => ({
  id,
  name: id,
  amountPence,
  month: '2026-10',
  responsiblePerson: 'Marius',
  accountId,
  status,
  includeInTransferPlan: true,
  actualTransactionId,
  createdAt: '2026-09-04T00:00:00.000Z',
  createdBy: 'test',
});

describe('Transfer Plan account identity and funding calculations', () => {
  it('keeps same-named bank accounts separate by account ID', () => {
    const mariusLloyds = account('lloyds-marius', 'Lloyds', 'Marius', 0);
    const vestaLloyds = account('lloyds-vesta', 'Lloyds', 'Vesta', 0);

    const plan = generateTransferPlan(
      [mariusLloyds, vestaLloyds],
      [
        payment('marius-bill', mariusLloyds.id, 20_000),
        {
          ...payment('vesta-bill', vestaLloyds.id, 16_700),
          responsiblePerson: 'Vesta',
        },
      ],
      '2026-10'
    );

    expect(plan.accountsNeedingFunding).toHaveLength(2);
    expect(
      plan.accountsNeedingFunding.find((item) => item.account.id === mariusLloyds.id)
        ?.transferRequiredPence
    ).toBe(20_000);
    expect(
      plan.accountsNeedingFunding.find((item) => item.account.id === vestaLloyds.id)
        ?.transferRequiredPence
    ).toBe(16_700);
  });

  it('does not call accounts with no unpaid selected bills fully funded', () => {
    const chase = {
      ...account('chase', 'Chase', 'Marius', 1_500_000),
      type: 'savings' as const,
    };
    const current = account('current', 'Current', 'Marius', 5_000);

    const plan = generateTransferPlan(
      [chase, current],
      [payment('bill', current.id, 3_000)],
      '2026-10'
    );

    expect(plan.accountsNeedingFunding).toHaveLength(0);
    expect(plan.accountsFullyFunded.map((item) => item.account.id)).toEqual(['current']);
    expect(plan.accountsFullyFunded.some((item) => item.account.id === chase.id)).toBe(false);
  });

  it('treats a linked actual transaction as paid even if stale status says unpaid', () => {
    const current = account('current', 'Current', 'Marius', 0);
    const stale = payment('recorded-bill', current.id, 12_000, 'unpaid', 'actual-1');

    const funding = calculateAccountFunding(current, [stale]);
    expect(funding.paidPayments).toHaveLength(1);
    expect(funding.unpaidPayments).toHaveLength(0);
    expect(funding.transferRequiredPence).toBe(0);

    const plan = generateTransferPlan([current], [stale], '2026-10');
    expect(plan.accountsNeedingFunding).toHaveLength(0);
    expect(plan.accountsFullyFunded).toHaveLength(0);
    expect(plan.totalSelectedPaymentsCount).toBe(0);
    expect(plan.totalPaidSelectedPaymentsCount).toBe(1);
  });
});
