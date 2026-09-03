import { describe, it, expect } from 'vitest';
import { calculateAccountFunding, generateTransferPlan } from '../src/utils/transferPlan';
import { Account, PlannedPayment } from '../src/types';

describe('Transfer Plan Calculations', () => {
  const baseAccount: Account = {
    id: 'acc-joint',
    name: 'Joint Bills Account',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 20000,
    currentBalancePence: 20000, // £200.00 available
    ownerPerson: 'Joint',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  it('excludes obligations that have already been marked paid from funding requirement', () => {
    const payments: PlannedPayment[] = [
      {
        id: 'bill-rent',
        name: 'Rent',
        amountPence: 100000, // £1000.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-joint',
        dueDate: '2026-09-01',
        status: 'paid', // ALREADY PAID - cleared from account!
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
      {
        id: 'bill-water',
        name: 'Water Rates',
        amountPence: 4500, // £45.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-joint',
        dueDate: '2026-09-15',
        status: 'unpaid', // UNPAID - requires funding
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
    ];

    const funding = calculateAccountFunding(baseAccount, payments);

    // Paid rent MUST NOT be added to future transfer requirement
    expect(funding.paidPayments.length).toBe(1);
    expect(funding.unpaidPayments.length).toBe(1);
    expect(funding.totalSelectedPaymentsPence).toBe(4500); // Only unpaid £45.00

    // Account has £200.00 balance, which fully covers the £45.00 unpaid bill
    expect(funding.transferRequiredPence).toBe(0);
    expect(funding.isFullyFunded).toBe(true);
  });

  it('respects chronological due dates and identifies funded vs unfunded obligations', () => {
    const payments: PlannedPayment[] = [
      {
        id: 'bill-later',
        name: 'Late Bill',
        amountPence: 15000, // £150.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-joint',
        dueDate: '2026-09-25',
        status: 'unpaid',
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
      {
        id: 'bill-early',
        name: 'Early Bill',
        amountPence: 12000, // £120.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-joint',
        dueDate: '2026-09-05',
        status: 'unpaid',
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
    ];

    // Account balance is £200.00 (20000p)
    // Early bill is £120.00 -> funded (£80.00 remaining)
    // Late bill is £150.00 -> exceeds remaining £80.00 -> unfunded!
    // Total unpaid = £270.00, balance = £200.00, transfer required = £70.00
    const funding = calculateAccountFunding(baseAccount, payments);

    expect(funding.fundedPayments.length).toBe(1);
    expect(funding.fundedPayments[0].id).toBe('bill-early');

    expect(funding.unfundedPayments.length).toBe(1);
    expect(funding.unfundedPayments[0].id).toBe('bill-later');

    expect(funding.transferRequiredPence).toBe(7000); // Exactly £70.00
    expect(funding.isFullyFunded).toBe(false);
  });

  it('correctly handles overdrawn / negative balances requiring full coverage', () => {
    const overdrawnAccount: Account = {
      ...baseAccount,
      currentBalancePence: -10000, // Overdrawn by £100.00 (-10000p)
    };

    const payments: PlannedPayment[] = [
      {
        id: 'bill-council-tax',
        name: 'Council Tax',
        amountPence: 18000, // £180.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-joint',
        dueDate: '2026-09-10',
        status: 'unpaid',
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
    ];

    // Formula: Math.max(0, bills - balance) = 18000 - (-10000) = 28000p (£280.00)
    // To clear the £100 overdraft AND fund the £180 bill, £280 is required!
    const funding = calculateAccountFunding(overdrawnAccount, payments);
    expect(funding.amountAvailablePence).toBe(0);
    expect(funding.transferRequiredPence).toBe(28000);
    expect(funding.isFullyFunded).toBe(false);
  });

  it('generates household transfer plan separating accounts needing funding from fully funded accounts', () => {
    const account1: Account = {
      ...baseAccount,
      id: 'acc-1',
      currentBalancePence: 5000, // £50.00
    };
    const account2: Account = {
      ...baseAccount,
      id: 'acc-2',
      currentBalancePence: 30000, // £300.00
    };

    const payments: PlannedPayment[] = [
      {
        id: 'p-1',
        name: 'Gas',
        amountPence: 8000, // £80.00 -> Acc 1 needs £30.00
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-1',
        status: 'unpaid',
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
      {
        id: 'p-2',
        name: 'Internet',
        amountPence: 4000, // £40.00 -> Acc 2 has £300.00 -> Fully funded
        month: '2026-09',
        responsiblePerson: 'Joint',
        accountId: 'acc-2',
        status: 'unpaid',
        includeInTransferPlan: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'marius@example.com',
      },
    ];

    const plan = generateTransferPlan([account1, account2], payments, '2026-09');

    expect(plan.accountsNeedingFunding.length).toBe(1);
    expect(plan.accountsNeedingFunding[0].account.id).toBe('acc-1');
    expect(plan.accountsNeedingFunding[0].transferRequiredPence).toBe(3000); // £30.00

    expect(plan.accountsFullyFunded.length).toBe(1);
    expect(plan.accountsFullyFunded[0].account.id).toBe('acc-2');
    expect(plan.totalTransferRequiredPence).toBe(3000);
  });
});
