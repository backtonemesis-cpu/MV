import { describe, expect, it } from 'vitest';
import type { Transaction } from './types';
import { calculateFinancialSummary, calculateMonthlySurplus } from './utils/currency';

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
