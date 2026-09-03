import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../src/types';
import { calculateCurrentBalancePence } from './reconciliation';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-main',
  name: 'Main',
  type: 'current',
  currency: 'GBP',
  startingBalancePence: 10_000,
  currentBalancePence: 10_000,
  ownerPerson: 'Marius',
  ...overrides,
});

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  date: '2026-09-04',
  description: 'Test',
  amountPence: 1_000,
  type: 'expense',
  categoryId: 'cat-test',
  accountId: 'acc-main',
  payer: 'Marius',
  isTransfer: false,
  isRepayment: false,
  isSavings: false,
  isRefund: false,
  createdAt: '2026-09-04T10:00:00.000Z',
  createdBy: 'marius@example.com',
  ...overrides,
});

describe('storage-neutral account reconciliation', () => {
  it('uses the reconciled balance as the anchor and ignores movements already included in it', () => {
    const reconciled = account({
      startingBalancePence: 50_000,
      reconciledBalancePence: 124_782,
      reconciliationDate: '2026-09-03',
    });

    const transactions = [
      tx({ id: 'old-expense', date: '2026-09-02', amountPence: 5_000 }),
      tx({ id: 'same-day-expense', date: '2026-09-03', amountPence: 2_000 }),
      tx({ id: 'new-expense', date: '2026-09-04', amountPence: 1_500 }),
      tx({ id: 'new-income', date: '2026-09-05', type: 'income', amountPence: 3_000 }),
    ];

    expect(calculateCurrentBalancePence(reconciled, transactions)).toBe(126_282);
  });

  it('credits refunds back to the account without erasing original gross spending', () => {
    const transactions = [
      tx({ id: 'purchase', amountPence: 4_000 }),
      tx({ id: 'refund', date: '2026-09-05', type: 'refund', isRefund: true, amountPence: 1_500 }),
    ];

    expect(calculateCurrentBalancePence(account(), transactions)).toBe(7_500);
  });

  it('moves internal transfers out of the source and into the destination exactly once', () => {
    const destination = account({ id: 'acc-savings', name: 'Savings', type: 'savings', startingBalancePence: 20_000 });
    const transfer = tx({
      id: 'transfer',
      type: 'transfer',
      isTransfer: true,
      amountPence: 2_500,
      accountId: 'acc-main',
      targetAccountId: 'acc-savings',
    });

    expect(calculateCurrentBalancePence(account(), [transfer])).toBe(7_500);
    expect(calculateCurrentBalancePence(destination, [transfer])).toBe(22_500);
  });

  it('does not count a card repayment as an inflow to an unrelated current account', () => {
    const repayment = tx({
      id: 'repayment',
      type: 'repayment',
      isRepayment: true,
      amountPence: 3_000,
      accountId: 'acc-main',
      targetAccountId: 'credit-card',
    });

    expect(calculateCurrentBalancePence(account(), [repayment])).toBe(7_000);
  });
});
