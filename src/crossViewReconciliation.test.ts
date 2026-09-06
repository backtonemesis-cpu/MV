import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedIncome,
  createLocalPlannedPayment,
  createLocalTransaction,
  executeLocalTransfer,
  loadLocalHousehold,
  markLocalIncomeReceived,
  markLocalPaymentPaid,
  saveLocalHousehold,
  undoLocalPaymentPaid,
  undoLocalTransferTransaction,
  LEGACY_SOURCE_SEED_MIGRATION_ID,
} from './localStore';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateSavingsPosition,
} from './utils/currency';
import { generateTransferPlan } from './utils/transferPlan';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

function installFixture() {
  const state = createBlankLocalHousehold();
  state.schemaStatus!.appliedMigrations = [{
    version: 1,
    name: LEGACY_SOURCE_SEED_MIGRATION_ID,
    appliedAt: '2026-09-01T00:00:00.000Z',
    executionTimeMs: 0,
    checksum: 'cross-view-fixture',
  }];
  saveLocalHousehold(state);
}

describe('Cross-view financial reconciliation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installFixture();
  });

  it('keeps Accounts, Activity, Dashboard calculations, Savings, Income and Transfer Plan on one financial truth', () => {
    let state = loadLocalHousehold();

    const current = createLocalAccount({
      name: 'Household Current',
      type: 'current',
      startingBalancePence: 1000_00,
      ownerPerson: 'Marius',
    }, state.version).account;
    state = loadLocalHousehold();

    const savings = createLocalAccount({
      name: 'Household Savings',
      type: 'savings',
      startingBalancePence: 500_00,
      ownerPerson: 'Marius',
    }, state.version).account;
    state = loadLocalHousehold();

    const income = createLocalPlannedIncome({
      name: 'Salary',
      expectedAmountPence: 1000_00,
      month: '2026-09',
      sourcePerson: 'Marius',
      accountId: current.id,
      categoryId: 'cat-salary',
      expectedDate: '2026-09-01',
    }, state.version).income;
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment({
      name: 'Rent / fixed bill',
      amountPence: 300_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: current.id,
      categoryId: 'cat-housing',
      includeInTransferPlan: true,
      dueDate: '2026-09-15',
    }, state.version).payment;
    state = loadLocalHousehold();

    markLocalIncomeReceived(income.id, {
      actualAmountPence: 1000_00,
      actualDate: '2026-09-02',
      accountId: current.id,
    }, state.version);
    state = loadLocalHousehold();

    createLocalTransaction({
      description: 'Returned purchase',
      amountPence: 20_00,
      type: 'refund',
      categoryId: 'cat-groceries',
      accountId: current.id,
      payer: 'Marius',
      isRefund: true,
      date: '2026-09-03',
    }, state.version);
    state = loadLocalHousehold();

    createLocalTransaction({
      description: 'Groceries',
      amountPence: 100_00,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: current.id,
      payer: 'Marius',
      date: '2026-09-04',
    }, state.version);
    state = loadLocalHousehold();

    const beforeTransferSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(beforeTransferSummary).toEqual(expect.objectContaining({
      actualIncomeReceivedPence: 1000_00,
      refundsPence: 20_00,
      fixedBillsTotalPence: 300_00,
      grossOtherSpendingPence: 100_00,
      availableSurplusPence: 620_00,
    }));

    const fundingTransfer = executeLocalTransfer({
      sourceAccountId: current.id,
      destinationAccountId: savings.id,
      amountPence: 500_00,
      description: 'Move available money to savings',
      date: '2026-09-05',
      commitmentMonth: '2026-09',
    }, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === current.id)?.currentBalancePence).toBe(1420_00);
    expect(state.accounts.find((a) => a.id === savings.id)?.currentBalancePence).toBe(1000_00);

    const afterTransferSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(afterTransferSummary.availableSurplusPence).toBe(620_00);
    expect(afterTransferSummary.internalTransfersPence).toBe(0);
    expect(afterTransferSummary.savingsTransfersPence).toBe(500_00);

    const planBeforePayment = generateTransferPlan(
      state.accounts,
      state.plannedPayments,
      '2026-09',
      state.transactions
    );
    expect(planBeforePayment.totalTransferRequiredPence).toBe(0);
    expect(planBeforePayment.accountsFullyFunded).toHaveLength(1);
    expect(planBeforePayment.accountsFullyFunded[0].account.id).toBe(current.id);

    const paid = markLocalPaymentPaid(bill.id, {
      actualAmountPence: 300_00,
      actualDate: '2026-09-15',
      accountId: current.id,
    }, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === current.id)?.currentBalancePence).toBe(1120_00);
    expect(state.transactions.find((tx) => tx.id === paid.transaction.id)).toEqual(
      expect.objectContaining({
        plannedPaymentId: bill.id,
        amountPence: 300_00,
        type: 'expense',
      })
    );

    const paidSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(paidSummary.fixedBillsPaidPence).toBe(300_00);
    expect(paidSummary.fixedBillsUnpaidPence).toBe(0);
    expect(paidSummary.grossOtherSpendingPence).toBe(100_00);
    expect(paidSummary.availableSurplusPence).toBe(620_00);

    const savingsPosition = calculateSavingsPosition(
      state.accounts,
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(savingsPosition.currentSavingsPence).toBe(1000_00);
    expect(savingsPosition.savedThisMonthPence).toBe(620_00);
    expect(savingsPosition.projectedEndSavingsPence).toBe(1620_00);
    expect(savingsPosition.savingsTransfersPence).toBe(500_00);

    const incomeState = state.plannedIncomes?.find((item) => item.id === income.id);
    expect(incomeState).toEqual(expect.objectContaining({
      status: 'received',
      actualAmountPence: 1000_00,
    }));

    undoLocalPaymentPaid(bill.id, state.version);
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === current.id)?.currentBalancePence).toBe(1420_00);
    expect(state.transactions.some((tx) => tx.id === paid.transaction.id)).toBe(false);

    undoLocalTransferTransaction(fundingTransfer.transaction.id, state.version);
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === current.id)?.currentBalancePence).toBe(1920_00);
    expect(state.accounts.find((a) => a.id === savings.id)?.currentBalancePence).toBe(500_00);
    expect(state.transactions.some((tx) => tx.id === fundingTransfer.transaction.id)).toBe(false);
  });

  it('treats a card repayment as balance movement but never as household spending', () => {
    let state = loadLocalHousehold();
    const current = createLocalAccount({
      name: 'Current',
      type: 'current',
      startingBalancePence: 1000_00,
      ownerPerson: 'Marius',
    }, state.version).account;
    state = loadLocalHousehold();

    const credit = createLocalAccount({
      name: 'Credit',
      type: 'credit',
      startingBalancePence: -200_00,
      ownerPerson: 'Marius',
    }, state.version).account;
    state = loadLocalHousehold();

    createLocalTransaction({
      description: 'Card repayment',
      amountPence: 50_00,
      type: 'repayment',
      categoryId: 'cat-transfer',
      accountId: current.id,
      targetAccountId: credit.id,
      payer: 'Marius',
      isRepayment: true,
      date: '2026-09-06',
    }, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === current.id)?.currentBalancePence).toBe(950_00);
    expect(state.accounts.find((a) => a.id === credit.id)?.currentBalancePence).toBe(-150_00);

    const summary = calculateFinancialSummary(state.transactions);
    expect(summary.cardRepaymentsPence).toBe(50_00);
    expect(summary.grossExpensesPence).toBe(0);
    expect(summary.grossIncomePence).toBe(0);
    expect(summary.netCashflowPence).toBe(0);

    const monthly = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(monthly.cardRepaymentsPence).toBe(50_00);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.availableSurplusPence).toBe(0);
  });
});
