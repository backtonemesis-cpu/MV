import { describe, expect, it } from 'vitest';
import type { Account, PlannedPayment, Transaction } from './types';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateNetSavingsMovementPence,
  calculateSavingsPosition,
  calculateLiquidFundsPence,
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

describe('liquid funds and savings integrity', () => {
  it('excludes credit balances from household liquid funds', () => {
    const accounts: Account[] = [
      {
        id: 'current-1',
        name: 'Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 100_00,
        currentBalancePence: 100_00,
      },
      {
        id: 'savings-1',
        name: 'Savings',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 500_00,
        currentBalancePence: 500_00,
      },
      {
        id: 'credit-1',
        name: 'Credit',
        type: 'credit',
        currency: 'GBP',
        startingBalancePence: 0,
        currentBalancePence: 38_98,
        balanceOwedPence: 0,
      },
    ];

    expect(calculateLiquidFundsPence(accounts)).toBe(600_00);
  });

  it('uses every active Savings and Cash balance as the household savings basis', () => {
    const accounts: Account[] = [
      {
        id: 'savings-1',
        name: 'Chase',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 800_00,
        currentBalancePence: 800_00,
      },
      {
        id: 'savings-2',
        name: 'Santander',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 300_00,
        currentBalancePence: 300_00,
      },
      {
        id: 'cash-1',
        name: 'Cash',
        type: 'cash',
        currency: 'GBP',
        startingBalancePence: 50_00,
        currentBalancePence: 50_00,
      },
      {
        id: 'current-1',
        name: 'Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 500_00,
        currentBalancePence: 500_00,
      },
      {
        id: 'credit-1',
        name: 'Credit',
        type: 'credit',
        currency: 'GBP',
        startingBalancePence: 0,
        currentBalancePence: 100_00,
      },
    ];

    const position = calculateSavingsPosition(accounts, [], [], '2026-09');

    expect(position.currentSavingsPence).toBe(1150_00);
    expect(position.savingsAccounts.map((account) => account.id)).toEqual([
      'savings-1',
      'savings-2',
      'cash-1',
    ]);
    expect(position.projectedEndSavingsPence).toBe(1150_00);
  });
});

describe('savings transfer classification', () => {
  it('tracks an isSavings transfer as savings, not as a generic internal transfer', () => {
    const tx = savingsTransfer();
    const summary = calculateFinancialSummary([tx]);

    expect(summary.savingsTransfersPence).toBe(25000);
    expect(summary.internalTransfersPence).toBe(0);
    expect(summary.grossExpensesPence).toBe(0);
    expect(summary.grossIncomePence).toBe(0);
    expect(summary.netCashflowPence).toBe(0);
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

  it('keeps excess refunds in net household cashflow rather than clamping them away', () => {
    const refund: Transaction = {
      id: 'refund-1',
      date: '2026-09-20',
      description: 'Returned purchase',
      amountPence: 75_00,
      type: 'refund',
      categoryId: 'cat-groceries',
      accountId: 'current-1',
      payer: 'Joint',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: true,
      createdAt: '2026-09-20T00:00:00.000Z',
      createdBy: 'test',
    };

    const summary = calculateFinancialSummary([refund]);
    expect(summary.refundsPence).toBe(75_00);
    expect(summary.netExpensesPence).toBe(0);
    expect(summary.netCashflowPence).toBe(75_00);
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

  it('counts ordinary internal transfers crossing the savings boundary even without isSavings flag', () => {
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
        name: 'Savings',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 500_00,
        currentBalancePence: 500_00,
      },
    ];

    const tx: Transaction = {
      id: 'fund-bills',
      date: '2026-09-04',
      description: 'Transfer Plan: Fund Current',
      amountPence: 125_00,
      type: 'transfer',
      categoryId: 'cat-transfer',
      accountId: 'savings-1',
      targetAccountId: 'current-1',
      payer: 'Marius',
      isTransfer: true,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-04T10:00:00.000Z',
      createdBy: 'test',
    };

    expect(calculateNetSavingsMovementPence(accounts, [tx], '2026-09')).toBe(-125_00);
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
