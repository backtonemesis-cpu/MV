import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment } from './types';
import {
  calculateAccountFunding,
  generateTransferPlan,
} from './utils/transferPlan';
import {
  buildTransferPlanAccountModels,
  groupTransferPlanAccountModels,
} from './utils/transferPlanViewModel';

const MONTH = '2026-09';

function account(currentBalancePence: number): Account {
  return {
    id: 'destination-account',
    name: 'Lloyds',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: currentBalancePence,
    currentBalancePence,
    ownerMemberId: 'marius',
    ownerPerson: 'Marius',
    isActive: true,
  };
}

function payment(
  id: string,
  status: 'paid' | 'unpaid',
  amountPence: number
): PlannedPayment {
  return {
    id,
    name: id,
    amountPence,
    month: MONTH,
    responsiblePerson: 'Marius',
    accountId: 'destination-account',
    status,
    includeInTransferPlan: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    createdBy: 'test',
  };
}

describe('Transfer Plan paid-only negative-balance funding safety', () => {
  it('never manufactures a transfer requirement from a negative balance when every selected bill is already paid', () => {
    const destination = account(-247_998);
    const paid = payment('paid-bill', 'paid', 19_99);

    const funding = calculateAccountFunding(destination, [paid]);

    expect(funding.totalUnpaidSelectedPaymentsPence).toBe(0);
    expect(funding.transferRequiredPence).toBe(0);
    expect(funding.unpaidPayments).toHaveLength(0);
    expect(funding.paidPayments).toHaveLength(1);
    expect(funding.isFullyFunded).toBe(true);

    const plan = generateTransferPlan([destination], [paid], MONTH);
    const groups = groupTransferPlanAccountModels(
      buildTransferPlanAccountModels(plan, [], MONTH)
    );

    expect(plan.totalTransferRequiredPence).toBe(0);
    expect(plan.accountsNeedingFunding).toHaveLength(0);
    expect(plan.accountsFullyFunded).toHaveLength(1);
    expect(plan.totalPaidSelectedPaymentsCount).toBe(1);
    expect(groups.needsFunding).toHaveLength(0);
    expect(groups.paid).toHaveLength(1);
  });

  it('still includes an overdrawn destination balance when an unpaid selected bill genuinely needs funding', () => {
    const destination = account(-10_000);
    const unpaid = payment('unpaid-bill', 'unpaid', 30_000);

    const funding = calculateAccountFunding(destination, [unpaid]);

    expect(funding.totalUnpaidSelectedPaymentsPence).toBe(30_000);
    expect(funding.transferRequiredPence).toBe(40_000);
    expect(funding.isFullyFunded).toBe(false);
  });

  it('funds only the unpaid portion in a mixed paid/unpaid selection while still accounting for a negative destination balance', () => {
    const destination = account(-10_000);
    const paid = payment('paid-bill', 'paid', 20_000);
    const unpaid = payment('unpaid-bill', 'unpaid', 30_000);

    const funding = calculateAccountFunding(destination, [paid, unpaid]);
    const plan = generateTransferPlan(
      [destination],
      [paid, unpaid],
      MONTH
    );

    expect(funding.totalSelectedPaymentsPence).toBe(50_000);
    expect(funding.totalUnpaidSelectedPaymentsPence).toBe(30_000);
    expect(funding.transferRequiredPence).toBe(40_000);
    expect(plan.totalTransferRequiredPence).toBe(40_000);
    expect(plan.accountsNeedingFunding).toHaveLength(1);
    expect(plan.totalPaidSelectedPaymentsCount).toBe(1);
  });
});
