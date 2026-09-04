import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment, Transaction } from './types';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateNetSavingsMovementPence,
  calculateSavingsPosition,
} from './utils/currency';

function savingsTransfer(): Transaction {
  return {
    id: 'savings-transfer-1',
    date: '2026-09-15',
    description: 'Move to savings',
    amountPence: 25000,
    type: 'transfer',
    categoryId: 'cat-transfer',
    accountId: 'current-1',
    targetAccountId: 'savings-1',
    payer: 'Joint',
    isTransfer: true,
    isRepayment: false,
    isSavings: true,
    isRefund: false,
    createdAt: '2026-09-15T10:00:00.000Z',
    createdBy: 'test',
  };
}

describe('savings transfer classification', () => {
  it('tracks an isSavings transfer as savings, not as a generic internal transfer', () => {
    const tx = savingsTransfer();
    const summary = calculateFinancialSummary([tx]);

    expect(summary.savingsTransfersPence).toBe(25000);
    expect(summary.internalTransfersPence).toBe(0);
    expect(summary.grossExpensesPence).toBe(0);
    expect(summary.grossIncomePence).toBe(0);
  });

  it('keeps savings transfers out of monthly income and spending while exposing them separately', () => {
    const tx = savingsTransfer();
    const monthly = calculateMonthlySurplus([tx], [], '2026-09', []);

    expect(monthly.savingsTransfersPence).toBe(25000);
    expect(monthly.internalTransfersPence).toBe(0);
    expect(monthly.actualIncomeReceivedPence).toBe(0);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.availableSurplusPence).toBe(0);
  });
});


describe('savings calculation reconciliation', () => {
  it('uses the actual paid fixed-bill amount when it differs from the plan', () => {
    const bill: PlannedPayment = {
      id: 'bill-actual-diff',
      name: 'Electric',
      amountPence: 100_00,
      actualAmountPence: 125_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'current-1',
      status: 'paid',
      includeInTransferPlan: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    };

    const income: Transaction = {
      id: 'income-1',
      date: '2026-09-01',
      description: 'Salary',
      amountPence: 1000_00,
      type: 'income',
      categoryId: 'cat-salary',
      accountId: 'current-1',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    };

    const linkedBillTx: Transaction = {
      id: 'expense-1',
      date: '2026-09-02',
      description: 'Electric',
      amountPence: 125_00,
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'current-1',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      plannedPaymentId: bill.id,
      createdAt: '2026-09-02T00:00:00.000Z',
      createdBy: 'test',
    };

    const monthly = calculateMonthlySurplus(
      [income, linkedBillTx],
      [bill],
      '2026-09',
      []
    );

    expect(monthly.fixedBillsTotalPence).toBe(125_00);
    expect(monthly.fixedBillsPaidPence).toBe(125_00);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.availableSurplusPence).toBe(875_00);
  });

  it('calculates net savings movement by direction without treating savings-to-savings transfers as new savings', () => {
    const accounts: Account[] = [
      {
        id: 'current-1',
        name: 'Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 1000_00,
        currentBalancePence: 1000_00,
      },
      {
        id: 'savings-1',
        name: 'Savings A',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 500_00,
        currentBalancePence: 500_00,
      },
      {
        id: 'savings-2',
        name: 'Savings B',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 200_00,
        currentBalancePence: 200_00,
      },
    ];

    const makeTransfer = (
      id: string,
      source: string,
      target: string,
      amountPence: number
    ): Transaction => ({
      id,
      date: '2026-09-10',
      description: id,
      amountPence,
      type: 'transfer',
      categoryId: 'cat-transfer',
      accountId: source,
      targetAccountId: target,
      payer: 'Joint',
      isTransfer: true,
      isRepayment: false,
      isSavings: true,
      isRefund: false,
      createdAt: '2026-09-10T00:00:00.000Z',
      createdBy: 'test',
    });

    const transfers = [
      makeTransfer('into-savings', 'current-1', 'savings-1', 300_00),
      makeTransfer('out-of-savings', 'savings-1', 'current-1', 50_00),
      makeTransfer('between-savings', 'savings-1', 'savings-2', 75_00),
    ];

    expect(calculateNetSavingsMovementPence(accounts, transfers, '2026-09')).toBe(250_00);

    const position = calculateSavingsPosition(accounts, transfers, [], '2026-09', []);
    expect(position.savingsTransfersPence).toBe(250_00);
  });
});
