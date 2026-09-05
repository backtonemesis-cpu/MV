import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment, Transaction } from '../types';
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

  it('keeps Transfer Plan funding independent from linked actual evidence', () => {
    const current = account('current', 'Current', 'Marius', 0);
    const linkedUnpaid = payment('recorded-bill', current.id, 12_000, 'unpaid', 'actual-1');
    const actual: Transaction = {
      id: 'actual-1',
      date: '2026-10-04',
      description: 'recorded-bill',
      amountPence: 12_000,
      type: 'expense',
      categoryId: 'cat-housing',
      accountId: current.id,
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      plannedPaymentId: linkedUnpaid.id,
      createdAt: '2026-10-04T10:00:00.000Z',
      createdBy: 'test',
    };

    const funding = calculateAccountFunding(current, [linkedUnpaid], [actual]);
    expect(funding.paidPayments).toHaveLength(0);
    expect(funding.unpaidPayments).toHaveLength(1);
    expect(funding.transferRequiredPence).toBe(12_000);

    const plan = generateTransferPlan([current], [linkedUnpaid], '2026-10', [actual]);
    expect(plan.accountsNeedingFunding).toHaveLength(1);
    expect(plan.totalSelectedPaymentsCount).toBe(1);
    expect(plan.totalPaidSelectedPaymentsCount).toBe(0);
  });
});
