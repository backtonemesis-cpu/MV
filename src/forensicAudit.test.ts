import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalAccount,
  createLocalPlannedPayment,
  createLocalPlannedIncome,
  createLocalSavingsGoal,
  contributeLocalSavingsGoal,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  reconcileLocalAccount,
  resetLocalHousehold,
  undoLatestLocalTransferPlanFunding,
  updateLocalPlannedPayment,
  updateLocalTransaction,
  deleteLocalTransaction,
  markLocalIncomeReceived,
  LOCAL_STORAGE_KEY,
} from './localStore';
import { calculateAccountFunding } from './utils/transferPlan';
import { calculateSavingsPosition, calculateMonthlySurplus } from './utils/currency';
import type { Account, PlannedPayment } from './types';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

describe('Forensic Financial Audit Regression Suite', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    storage.removeItem(LOCAL_STORAGE_KEY);
  });

  it('1. Reconciles an account with existing balance to exactly £0.00', () => {
    let state = loadLocalHousehold();
    const account = createLocalAccount(
      {
        name: 'Lloyds Checking',
        type: 'current',
        startingBalancePence: 1000_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === account.account.id)?.currentBalancePence).toBe(1000_00);

    reconcileLocalAccount(account.account.id, 0, '2026-09-04', state.version);
    state = loadLocalHousehold();

    const reconciled = state.accounts.find((a) => a.id === account.account.id);
    expect(reconciled?.reconciledBalancePence).toBe(0);
    expect(reconciled?.currentBalancePence).toBe(0);
  });

  it('2. Supports positive and negative reconciliation balances (overdraft / credit)', () => {
    let state = loadLocalHousehold();
    const overdraftAccount = createLocalAccount(
      {
        name: 'Overdraft Account',
        type: 'current',
        startingBalancePence: 50_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    reconcileLocalAccount(overdraftAccount.account.id, -250_00, '2026-09-04', state.version);
    state = loadLocalHousehold();

    const updated = state.accounts.find((a) => a.id === overdraftAccount.account.id);
    expect(updated?.reconciledBalancePence).toBe(-250_00);
    expect(updated?.currentBalancePence).toBe(-250_00);

    reconcileLocalAccount(overdraftAccount.account.id, 450_50, '2026-09-05', state.version);
    state = loadLocalHousehold();
    const updatedPositive = state.accounts.find((a) => a.id === overdraftAccount.account.id);
    expect(updatedPositive?.reconciledBalancePence).toBe(450_50);
    expect(updatedPositive?.currentBalancePence).toBe(450_50);
  });

  it('3. Executes single-source transfer plan funding accurately', () => {
    let state = loadLocalHousehold();
    const source = createLocalAccount(
      { name: 'Main Savings', type: 'savings', startingBalancePence: 500_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();
    const dest = createLocalAccount(
      { name: 'Bills Hub', type: 'current', startingBalancePence: 20_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: dest.account.id,
        expectedTotalPence: 80_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 80_00 }],
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === source.account.id)?.currentBalancePence).toBe(420_00);
    expect(state.accounts.find((a) => a.id === dest.account.id)?.currentBalancePence).toBe(100_00);
  });

  it('4. Executes split-source transfer plan funding atomically across multiple accounts', () => {
    let state = loadLocalHousehold();
    const sourceA = createLocalAccount(
      { name: 'Vault A', type: 'savings', startingBalancePence: 300_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();
    const sourceB = createLocalAccount(
      { name: 'Vault B', type: 'savings', startingBalancePence: 200_00, ownerPerson: 'Vesta' },
      state.version
    );
    state = loadLocalHousehold();
    const dest = createLocalAccount(
      { name: 'Joint Current', type: 'current', startingBalancePence: 50_00, ownerPerson: 'Joint' },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: dest.account.id,
        expectedTotalPence: 175_00,
        allocations: [
          { sourceAccountId: sourceA.account.id, amountPence: 100_00 },
          { sourceAccountId: sourceB.account.id, amountPence: 75_00 },
        ],
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === sourceA.account.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((a) => a.id === sourceB.account.id)?.currentBalancePence).toBe(125_00);
    expect(state.accounts.find((a) => a.id === dest.account.id)?.currentBalancePence).toBe(225_00);
  });

  it('5. Undoes latest funding transfer batch and restores exact previous balances', () => {
    let state = loadLocalHousehold();
    const source = createLocalAccount(
      { name: 'Reserve', type: 'savings', startingBalancePence: 1000_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();
    const dest = createLocalAccount(
      { name: 'Current Spend', type: 'current', startingBalancePence: 100_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: dest.account.id,
        expectedTotalPence: 250_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 250_00 }],
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === source.account.id)?.currentBalancePence).toBe(750_00);
    expect(state.accounts.find((a) => a.id === dest.account.id)?.currentBalancePence).toBe(350_00);

    undoLatestLocalTransferPlanFunding(dest.account.id, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === source.account.id)?.currentBalancePence).toBe(1000_00);
    expect(state.accounts.find((a) => a.id === dest.account.id)?.currentBalancePence).toBe(100_00);
  });

  it('6. Vesta Lloyds Undo does NOT touch Marius Lloyds (Strict Same-Name Separation)', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const mariusLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 50_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();
    const vestaLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 20_00, ownerPerson: 'Vesta' },
      state.version
    );
    state = loadLocalHousehold();
    const fundingPool = createLocalAccount(
      { name: 'Funding Hub', type: 'savings', startingBalancePence: 1000_00, ownerPerson: 'Joint' },
      state.version
    );
    state = loadLocalHousehold();

    expect(mariusLloyds.account.id).not.toBe(vestaLloyds.account.id);

    executeLocalTransferAllocations(
      {
        destinationAccountId: mariusLloyds.account.id,
        expectedTotalPence: 150_00,
        allocations: [{ sourceAccountId: fundingPool.account.id, amountPence: 150_00 }],
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: vestaLloyds.account.id,
        expectedTotalPence: 200_00,
        allocations: [{ sourceAccountId: fundingPool.account.id, amountPence: 200_00 }],
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === mariusLloyds.account.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((a) => a.id === vestaLloyds.account.id)?.currentBalancePence).toBe(220_00);
    expect(state.accounts.find((a) => a.id === fundingPool.account.id)?.currentBalancePence).toBe(650_00);

    undoLatestLocalTransferPlanFunding(vestaLloyds.account.id, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === vestaLloyds.account.id)?.currentBalancePence).toBe(20_00);
    expect(state.accounts.find((a) => a.id === fundingPool.account.id)?.currentBalancePence).toBe(850_00);
    expect(state.accounts.find((a) => a.id === mariusLloyds.account.id)?.currentBalancePence).toBe(200_00);
  });

  it('7. Planned payments on Marius Lloyds vs Vesta Lloyds remain completely isolated', () => {
    let state = loadLocalHousehold();
    const mariusLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 100_00, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();
    const vestaLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 80_00, ownerPerson: 'Vesta' },
      state.version
    );
    state = loadLocalHousehold();

    const mariusBill = createLocalPlannedPayment(
      {
        name: 'Marius Gym',
        amountPence: 45_00,
        month: '2026-09',
        accountId: mariusLloyds.account.id,
        responsiblePerson: 'Marius',
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    const vestaBill = createLocalPlannedPayment(
      {
        name: 'Vesta Phone',
        amountPence: 30_00,
        month: '2026-09',
        accountId: vestaLloyds.account.id,
        responsiblePerson: 'Vesta',
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    updateLocalPlannedPayment(mariusBill.payment.id, { status: 'paid' }, state.version);
    state = loadLocalHousehold();

    const updatedMariusBill = state.plannedPayments.find((p) => p.id === mariusBill.payment.id);
    const updatedVestaBill = state.plannedPayments.find((p) => p.id === vestaBill.payment.id);

    expect(updatedMariusBill?.status).toBe('paid');
    expect(updatedVestaBill?.status).toBe('unpaid');
    expect(updatedVestaBill?.accountId).toBe(vestaLloyds.account.id);
  });

  it('8. Select Paid / Select Unpaid calculates transfer requirements correctly and prevents duplicate funding of paid bills', () => {
    const account: Account = {
      id: 'acc-test',
      name: 'Test Current',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 50_00,
      currentBalancePence: 50_00,
    };

    const billA: PlannedPayment = {
      id: 'bill-1',
      name: 'Council Tax',
      amountPence: 120_00,
      month: '2026-09',
      accountId: 'acc-test',
      status: 'unpaid',
      includeInTransferPlan: true,
      responsiblePerson: 'Marius',
      createdAt: '2026-09-01',
      createdBy: 'test',
    };

    const billB: PlannedPayment = {
      id: 'bill-2',
      name: 'Broadband',
      amountPence: 40_00,
      month: '2026-09',
      accountId: 'acc-test',
      status: 'paid',
      includeInTransferPlan: true,
      responsiblePerson: 'Marius',
      createdAt: '2026-09-01',
      createdBy: 'test',
    };

    const funding1 = calculateAccountFunding(account, [billA, billB]);
    expect(funding1.totalSelectedPaymentsPence).toBe(120_00);
    expect(funding1.transferRequiredPence).toBe(70_00);

    const funding2 = calculateAccountFunding(account, [
      billA,
      { ...billB, status: 'unpaid', includeInTransferPlan: true },
    ]);
    expect(funding2.totalSelectedPaymentsPence).toBe(160_00);
    expect(funding2.transferRequiredPence).toBe(110_00);

    const funding3 = calculateAccountFunding(account, [
      { ...billA, includeInTransferPlan: false },
      { ...billB, includeInTransferPlan: false },
    ]);
    expect(funding3.totalSelectedPaymentsPence).toBe(0);
    expect(funding3.transferRequiredPence).toBe(0);
  });

  it('9. Income received vs expected accurately updates surplus and outstanding amounts', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const account = createLocalAccount(
      { name: 'Income Hub', type: 'current', startingBalancePence: 0, ownerPerson: 'Marius' },
      state.version
    );
    state = loadLocalHousehold();

    const mariusWage = createLocalPlannedIncome(
      {
        name: 'Marius Wage',
        expectedAmountPence: 3361_02,
        month: '2026-09',
        accountId: account.account.id,
        sourcePerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const vestaWage = createLocalPlannedIncome(
      {
        name: 'Vesta Wage',
        expectedAmountPence: 2400_00,
        month: '2026-09',
        accountId: account.account.id,
        sourcePerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const initialSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(initialSummary.expectedIncomePence).toBe(3361_02 + 2400_00);
    expect(initialSummary.actualIncomeReceivedPence).toBe(0);

    markLocalIncomeReceived(
      mariusWage.income.id,
      { actualAmountPence: 3361_02, actualDate: '2026-09-01' },
      state.version
    );
    state = loadLocalHousehold();

    const afterMariusSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(afterMariusSummary.actualIncomeReceivedPence).toBe(3361_02);

    markLocalIncomeReceived(
      vestaWage.income.id,
      { actualAmountPence: 1200_00, actualDate: '2026-09-02' },
      state.version
    );
    state = loadLocalHousehold();

    const finalSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(finalSummary.actualIncomeReceivedPence).toBe(3361_02 + 1200_00);
  });

  it('10. Savings contribution is atomic, updates both balances and pot once, and remains non-spending', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const current = createLocalAccount(
      {
        name: 'Savings Funding Current',
        type: 'current',
        startingBalancePence: 500_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const saver = createLocalAccount(
      {
        name: 'Savings Vault',
        type: 'savings',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const goal = createLocalSavingsGoal(
      {
        name: 'Emergency Fund',
        targetPence: 1000_00,
        currentPence: 100_00,
        accountId: saver.account.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const versionBefore = state.version;
    const transactionsBefore = state.transactions.length;

    const result = contributeLocalSavingsGoal(
      {
        goalId: goal.goal.id,
        sourceAccountId: current.account.id,
        amountPence: 125_00,
        payer: 'Marius',
        date: '2026-09-04',
      },
      state.version
    );

    expect(result.version).toBe(versionBefore + 1);

    state = loadLocalHousehold();
    expect(state.transactions).toHaveLength(transactionsBefore + 1);

    const transfer = state.transactions.find((tx) => tx.id === result.transaction.id);
    expect(transfer).toEqual(
      expect.objectContaining({
        amountPence: 125_00,
        type: 'transfer',
        isTransfer: true,
        isSavings: true,
        accountId: current.account.id,
        targetAccountId: saver.account.id,
      })
    );

    expect(state.accounts.find((a) => a.id === current.account.id)?.currentBalancePence).toBe(375_00);
    expect(state.accounts.find((a) => a.id === saver.account.id)?.currentBalancePence).toBe(225_00);
    expect(state.savingsGoals.find((item) => item.id === goal.goal.id)?.currentPence).toBe(225_00);

    const monthly = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(monthly.savingsTransfersPence).toBe(125_00);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.actualIncomeReceivedPence).toBe(0);
    expect(monthly.availableSurplusPence).toBe(0);

    const position = calculateSavingsPosition(
      state.accounts,
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(position.currentSavingsPence).toBe(225_00);
    expect(position.savingsTransfersPence).toBe(125_00);
  });

  it('11. Savings contribution rejects credit funding without partial writes', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const credit = createLocalAccount(
      {
        name: 'Credit Funding',
        type: 'credit',
        startingBalancePence: 500_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const saver = createLocalAccount(
      {
        name: 'Protected Savings',
        type: 'savings',
        startingBalancePence: 200_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const goal = createLocalSavingsGoal(
      {
        name: 'Protected Goal',
        targetPence: 1000_00,
        currentPence: 200_00,
        accountId: saver.account.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const snapshot = {
      version: state.version,
      transactions: state.transactions.length,
      creditBalance: state.accounts.find((a) => a.id === credit.account.id)?.currentBalancePence,
      savingsBalance: state.accounts.find((a) => a.id === saver.account.id)?.currentBalancePence,
      goalCurrent: state.savingsGoals.find((item) => item.id === goal.goal.id)?.currentPence,
    };

    expect(() =>
      contributeLocalSavingsGoal(
        {
          goalId: goal.goal.id,
          sourceAccountId: credit.account.id,
          amountPence: 50_00,
          payer: 'Marius',
          date: '2026-09-04',
        },
        state.version
      )
    ).toThrow('Credit accounts cannot be used to fund savings.');

    state = loadLocalHousehold();
    expect(state.version).toBe(snapshot.version);
    expect(state.transactions).toHaveLength(snapshot.transactions);
    expect(state.accounts.find((a) => a.id === credit.account.id)?.currentBalancePence).toBe(snapshot.creditBalance);
    expect(state.accounts.find((a) => a.id === saver.account.id)?.currentBalancePence).toBe(snapshot.savingsBalance);
    expect(state.savingsGoals.find((item) => item.id === goal.goal.id)?.currentPence).toBe(snapshot.goalCurrent);
  });

  it('12. Savings goals cannot be linked to Current or Credit accounts', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const current = createLocalAccount(
      {
        name: 'Not A Savings Account',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      createLocalSavingsGoal(
        {
          name: 'Invalid Goal',
          targetPence: 500_00,
          currentPence: 0,
          accountId: current.account.id,
        },
        state.version
      )
    ).toThrow('Savings goals must be linked to an active Savings or Cash account.');

    const after = loadLocalHousehold();
    expect(after.version).toBe(state.version);
    expect(after.savingsGoals).toHaveLength(0);
  });

  it('13. Editing a linked paid-bill transaction keeps the bill and savings surplus reconciled', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Bills Current',
        type: 'current',
        startingBalancePence: 1000_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Energy',
        amountPence: 100_00,
        month: '2026-09',
        accountId: account.account.id,
        responsiblePerson: 'Marius',
        categoryId: 'cat-utilities',
        status: 'unpaid',
      },
      state.version
    );
    state = loadLocalHousehold();

    const paid = markLocalPaymentPaid(
      bill.payment.id,
      {
        actualAmountPence: 110_00,
        actualDate: '2026-09-03',
      },
      state.version
    );
    state = loadLocalHousehold();

    updateLocalTransaction(
      paid.transaction.id,
      {
        amountPence: 125_00,
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    const syncedBill = state.plannedPayments.find((item) => item.id === bill.payment.id);
    expect(syncedBill?.actualAmountPence).toBe(125_00);
    expect(syncedBill?.actualDate).toBe('2026-09-04');
    expect(syncedBill?.status).toBe('paid');

    const monthly = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(monthly.fixedBillsTotalPence).toBe(125_00);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.availableSurplusPence).toBe(-125_00);
  });

  it('14. Deleting a linked actual bill transaction safely returns the bill to unpaid', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Delete Test Current',
        type: 'current',
        startingBalancePence: 500_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Broadband',
        amountPence: 40_00,
        month: '2026-09',
        accountId: account.account.id,
        responsiblePerson: 'Marius',
        categoryId: 'cat-internet',
        status: 'unpaid',
      },
      state.version
    );
    state = loadLocalHousehold();

    const paid = markLocalPaymentPaid(
      bill.payment.id,
      {
        actualAmountPence: 42_00,
        actualDate: '2026-09-03',
      },
      state.version
    );
    state = loadLocalHousehold();

    deleteLocalTransaction(paid.transaction.id, state.version);
    state = loadLocalHousehold();

    const reverted = state.plannedPayments.find((item) => item.id === bill.payment.id);
    expect(reverted?.status).toBe('unpaid');
    expect(reverted?.actualAmountPence).toBeUndefined();
    expect(reverted?.actualDate).toBeUndefined();
    expect(reverted?.actualTransactionId).toBeUndefined();

    const monthly = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(monthly.fixedBillsTotalPence).toBe(40_00);
    expect(monthly.fixedBillsUnpaidPence).toBe(40_00);
  });

  it('15. Savings goal contribution transactions cannot be edited or deleted outside Savings', () => {
    let state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Protected Current',
        type: 'current',
        startingBalancePence: 300_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const saver = createLocalAccount(
      {
        name: 'Protected Saver',
        type: 'savings',
        startingBalancePence: 50_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const goal = createLocalSavingsGoal(
      {
        name: 'Protected Pot',
        targetPence: 500_00,
        currentPence: 50_00,
        accountId: saver.account.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const contribution = contributeLocalSavingsGoal(
      {
        goalId: goal.goal.id,
        sourceAccountId: source.account.id,
        amountPence: 25_00,
        payer: 'Marius',
        date: '2026-09-04',
      },
      state.version
    );
    state = loadLocalHousehold();

    const snapshotVersion = state.version;
    const snapshotGoal = state.savingsGoals.find((item) => item.id === goal.goal.id)?.currentPence;
    const snapshotSavings = state.accounts.find((item) => item.id === saver.account.id)?.currentBalancePence;

    expect(() =>
      updateLocalTransaction(
        contribution.transaction.id,
        { amountPence: 30_00 },
        state.version
      )
    ).toThrow('Savings goal contributions must be managed from the Savings view.');

    state = loadLocalHousehold();
    expect(state.version).toBe(snapshotVersion);

    expect(() =>
      deleteLocalTransaction(contribution.transaction.id, state.version)
    ).toThrow('Savings goal contributions must be managed from the Savings view.');

    state = loadLocalHousehold();
    expect(state.version).toBe(snapshotVersion);
    expect(state.savingsGoals.find((item) => item.id === goal.goal.id)?.currentPence).toBe(snapshotGoal);
    expect(state.accounts.find((item) => item.id === saver.account.id)?.currentBalancePence).toBe(snapshotSavings);
    expect(state.transactions.some((tx) => tx.id === contribution.transaction.id)).toBe(true);
  });

  it('16. Savings position uses true account balances and excludes goal allocations', () => {
    const savingsAcc: Account = {
      id: 'savings-1',
      name: 'Chase Saver',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 15000_00,
      currentBalancePence: 15000_00,
    };

    const currentAcc: Account = {
      id: 'current-1',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 1000_00,
      currentBalancePence: 1000_00,
    };

    const position = calculateSavingsPosition([savingsAcc, currentAcc], [], [], '2026-09');
    expect(position.currentSavingsPence).toBe(15000_00);
    expect(position.savingsAccounts).toHaveLength(1);
    expect(position.savingsAccounts[0].id).toBe('savings-1');
  });
});
