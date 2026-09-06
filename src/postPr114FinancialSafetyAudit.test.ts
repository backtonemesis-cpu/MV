import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Account,
  HouseholdData,
  HouseholdMember,
  PlannedPayment,
  Transaction,
} from './types';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalBackupPackage,
  importLocalMonth,
  loadLocalHousehold,
  markLocalPaymentPaid,
  markLocalPaymentsPaid,
  preflightLocalRestore,
  reconcileLocalAccount,
  restoreLocalBackup,
  saveLocalHousehold,
  undoLatestLocalTransferPlanFunding,
  undoLocalPaymentsPaid,
  updateLocalPlannedPayment,
  executeLocalTransferAllocations,
} from './localStore';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateSavingsPosition,
} from './utils/currency';
import { generateTransferPlan } from './utils/transferPlan';
import {
  buildTransferPlanAccountModels,
  groupTransferPlanAccountModels,
} from './utils/transferPlanViewModel';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const month = '2026-09';
const paymentDate = '2026-09-06';

function member(id: string, name: string): HouseholdMember {
  return {
    id,
    email: `${name.toLowerCase()}@local.invalid`,
    name,
    role: 'editor',
    joinedAt: '2026-09-01T00:00:00.000Z',
  };
}

function account(
  id: string,
  name: string,
  ownerPerson: string,
  ownerMemberId: string,
  type: Account['type'],
  startingBalancePence: number
): Account {
  return {
    id,
    name,
    type,
    currency: 'GBP',
    startingBalancePence,
    currentBalancePence: startingBalancePence,
    ownerPerson,
    ownerMemberId,
    isActive: true,
  };
}

function payment(
  id: string,
  name: string,
  amountPence: number,
  accountId: string,
  responsiblePerson = 'Marius'
): PlannedPayment {
  return {
    id,
    name,
    amountPence,
    month,
    responsiblePerson,
    accountId,
    categoryId: 'cat-housing',
    status: 'unpaid',
    includeInTransferPlan: true,
    isRecurring: true,
    dueDate: '2026-09-20',
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'test',
  };
}

function installBase(
  payments: PlannedPayment[] = [
    payment('rent', 'Rent', 349_79, 'lloyds-marius'),
    payment('phone', 'Phone', 12_34, 'lloyds-vesta', 'Vesta'),
  ]
): HouseholdData {
  const state = createBlankLocalHousehold();
  state.schemaStatus!.appliedMigrations = [{
    version: 1,
    name: LEGACY_SOURCE_SEED_MIGRATION_ID,
    appliedAt: '2026-09-01T00:00:00.000Z',
    executionTimeMs: 0,
    checksum: 'post-pr114-audit',
  }];
  const marius = state.members.find((item) => item.name === 'Marius')!;
  const vesta = member('member-vesta', 'Vesta');
  state.members.push(vesta);
  state.accounts = [
    account('savings', 'Santander', 'Marius', marius.id, 'savings', 1000_00),
    account('lloyds-marius', 'Lloyds', 'Marius', marius.id, 'current', 0),
    account('lloyds-vesta', 'Lloyds', 'Vesta', vesta.id, 'current', 500_00),
    account('joint-current', 'Lloyds', 'Joint', 'joint', 'joint', 250_00),
  ];
  state.plannedPayments = payments;
  saveLocalHousehold(state);
  return loadLocalHousehold();
}

function currentPayments(ids: string[]): PlannedPayment[] {
  const state = loadLocalHousehold();
  return ids.map((id) => {
    const found = state.plannedPayments.find((item) => item.id === id);
    if (!found) throw new Error(`Missing test bill ${id}`);
    return found;
  });
}

function linkedTransactions(state: HouseholdData): Transaction[] {
  return state.transactions.filter((tx) => Boolean(tx.plannedPaymentId));
}

describe('Final post-PR #114 financial safety audit', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('keeps funding, Mark Paid, Undo Paid and Undo Funding as four independent operations', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);

    executeLocalTransferAllocations({
      destinationAccountId: 'lloyds-marius',
      expectedTotalPence: 349_79,
      allocations: [{ sourceAccountId: 'savings', amountPence: 349_79 }],
      description: 'Transfer Plan: fund Rent',
      date: '2026-09-05',
      month,
    }, state.version);
    state = loadLocalHousehold();

    const fundingId = state.transactions.find((tx) => tx.type === 'transfer')!.id;
    expect(state.plannedPayments[0].status).toBe('unpaid');
    expect(linkedTransactions(state)).toHaveLength(0);

    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    const paymentTx = linkedTransactions(state)[0];
    expect(paymentTx.amountPence).toBe(349_79);
    expect(state.transactions.some((tx) => tx.id === fundingId)).toBe(true);
    expect(state.plannedPayments[0].status).toBe('paid');

    undoLocalPaymentsPaid(currentPayments(['rent']), state.version);
    state = loadLocalHousehold();
    expect(state.plannedPayments[0].status).toBe('unpaid');
    expect(linkedTransactions(state)).toHaveLength(0);
    expect(state.transactions.some((tx) => tx.id === fundingId)).toBe(true);

    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    const secondPaymentTxId = linkedTransactions(state)[0].id;

    undoLatestLocalTransferPlanFunding('lloyds-marius', state.version, month);
    state = loadLocalHousehold();
    expect(state.plannedPayments[0].status).toBe('paid');
    expect(state.plannedPayments[0].actualTransactionId).toBe(secondPaymentTxId);
    expect(state.transactions.some((tx) => tx.id === secondPaymentTxId)).toBe(true);
    expect(state.transactions.filter((tx) => tx.type === 'transfer')).toHaveLength(0);
  });

  it('reconciles Accounts, Activity, Dashboard math, Savings and Transfer Plan exactly before/after bulk pay and undo', () => {
    const edgePayments = [
      payment('p001', 'Edge £0.01', 1, 'lloyds-marius'),
      payment('p010', 'Edge £0.10', 10, 'lloyds-marius'),
      payment('p099', 'Edge £0.99', 99, 'lloyds-marius'),
      payment('p1234', 'Edge £12.34', 12_34, 'lloyds-marius'),
      payment('p34979', 'Edge £349.79', 349_79, 'lloyds-marius'),
    ];
    let state = installBase(edgePayments);
    const exactTotal = 36_323;

    executeLocalTransferAllocations({
      destinationAccountId: 'lloyds-marius',
      expectedTotalPence: exactTotal,
      allocations: [{ sourceAccountId: 'savings', amountPence: exactTotal }],
      date: '2026-09-05',
      month,
    }, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(exactTotal);
    expect(state.accounts.find((a) => a.id === 'savings')?.currentBalancePence).toBe(63_677);

    const beforeSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      month,
      state.plannedIncomes
    );
    expect(beforeSummary.fixedBillsTotalPence).toBe(exactTotal);
    expect(beforeSummary.fixedBillsPaidPence).toBe(0);
    expect(beforeSummary.fixedBillsUnpaidPence).toBe(exactTotal);
    expect(beforeSummary.availableSurplusPence).toBe(-exactTotal);

    let models = buildTransferPlanAccountModels(
      generateTransferPlan(state.accounts, state.plannedPayments, month, state.transactions),
      state.transactions,
      month
    );
    expect(groupTransferPlanAccountModels(models).funded).toHaveLength(1);

    const snapshots = currentPayments(edgePayments.map((p) => p.id));
    markLocalPaymentsPaid(snapshots, paymentDate, state.version);
    state = loadLocalHousehold();

    const actuals = linkedTransactions(state);
    expect(actuals).toHaveLength(5);
    expect(actuals.reduce((sum, tx) => sum + tx.amountPence, 0)).toBe(exactTotal);
    expect(actuals.map((tx) => tx.amountPence).sort((a, b) => a - b)).toEqual(
      [1, 10, 99, 12_34, 349_79]
    );
    expect(actuals.every((tx) => Number.isSafeInteger(tx.amountPence))).toBe(true);
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(0);

    const paidSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      month,
      state.plannedIncomes
    );
    expect(paidSummary.fixedBillsTotalPence).toBe(exactTotal);
    expect(paidSummary.fixedBillsPaidPence).toBe(exactTotal);
    expect(paidSummary.fixedBillsUnpaidPence).toBe(0);
    expect(paidSummary.grossOtherSpendingPence).toBe(0);
    expect(paidSummary.availableSurplusPence).toBe(-exactTotal);

    const financial = calculateFinancialSummary(state.transactions);
    expect(financial.grossExpensesPence).toBe(exactTotal);
    expect(financial.internalTransfersPence).toBe(exactTotal);

    const savings = calculateSavingsPosition(
      state.accounts,
      state.transactions,
      state.plannedPayments,
      month,
      state.plannedIncomes
    );
    expect(savings.currentSavingsPence).toBe(63_677);
    expect(savings.savedThisMonthPence).toBe(-exactTotal);
    expect(savings.savingsTransfersPence).toBe(-exactTotal);

    models = buildTransferPlanAccountModels(
      generateTransferPlan(state.accounts, state.plannedPayments, month, state.transactions),
      state.transactions,
      month
    );
    expect(groupTransferPlanAccountModels(models).paid).toHaveLength(1);

    undoLocalPaymentsPaid(currentPayments(edgePayments.map((p) => p.id)), state.version);
    state = loadLocalHousehold();

    expect(linkedTransactions(state)).toHaveLength(0);
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(exactTotal);
    expect(state.transactions.filter((tx) => tx.type === 'transfer')).toHaveLength(1);
    const undoneSummary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      month,
      state.plannedIncomes
    );
    expect(undoneSummary.fixedBillsPaidPence).toBe(0);
    expect(undoneSummary.fixedBillsUnpaidPence).toBe(exactTotal);
    expect(undoneSummary.availableSurplusPence).toBe(-exactTotal);
  });

  it('deduplicates repeated IDs but stale/double submissions cannot create a second Activity expense', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    const staleSnapshot = currentPayments(['rent'])[0];

    markLocalPaymentsPaid([staleSnapshot, staleSnapshot], paymentDate, state.version);
    state = loadLocalHousehold();
    expect(linkedTransactions(state)).toHaveLength(1);

    const versionAfterFirst = state.version;
    expect(() =>
      markLocalPaymentsPaid([staleSnapshot], paymentDate, versionAfterFirst - 1)
    ).toThrow(/Concurrent modification conflict/);
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(1);

    // A fresh snapshot of an already-paid bill is idempotent and returns the
    // exact existing evidence rather than creating a second expense.
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    expect(linkedTransactions(state)).toHaveLength(1);
  });

  it('blocks orphan or duplicated reverse payment evidence instead of creating/deleting ambiguously', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    const orphan: Transaction = {
      id: 'orphan-evidence',
      date: paymentDate,
      description: 'Rent',
      amountPence: 349_79,
      type: 'expense',
      categoryId: 'cat-housing',
      accountId: 'lloyds-marius',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      plannedPaymentId: 'rent',
      createdAt: '2026-09-07T10:00:00.000Z',
      createdBy: 'test',
    };
    state.transactions.push(orphan);
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(() =>
      markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version)
    ).toThrow(/already has or references actual payment evidence/);
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(1);

    state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    const linked = linkedTransactions(state)[0];
    state.transactions.push({ ...linked, id: 'duplicate-evidence' });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(() =>
      undoLocalPaymentsPaid(currentPayments(['rent']), state.version)
    ).toThrow(/missing, duplicated, or mismatched/);
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(2);
  });

  it('revalidates stale modal amount/account/status/inclusion state and commits no partial batch', () => {
    let state = installBase([
      payment('rent', 'Rent', 349_79, 'lloyds-marius'),
      payment('phone', 'Phone', 12_34, 'lloyds-vesta', 'Vesta'),
    ]);
    const stale = currentPayments(['rent', 'phone']);

    updateLocalPlannedPayment('phone', { amountPence: 15_00 }, state.version);
    state = loadLocalHousehold();

    expect(() =>
      markLocalPaymentsPaid(stale, paymentDate, state.version)
    ).toThrow(/changed after the confirmation was opened/);
    state = loadLocalHousehold();
    expect(linkedTransactions(state)).toHaveLength(0);
    expect(state.plannedPayments.every((item) => item.status === 'unpaid')).toBe(true);

    const staleAccount = currentPayments(['rent']);
    updateLocalPlannedPayment('rent', { accountId: 'joint-current' }, state.version);
    state = loadLocalHousehold();
    expect(() =>
      markLocalPaymentsPaid(staleAccount, paymentDate, state.version)
    ).toThrow(/changed after the confirmation was opened/);
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(0);

    const staleSelection = currentPayments(['rent']);
    updateLocalPlannedPayment('rent', { includeInTransferPlan: false }, state.version);
    state = loadLocalHousehold();
    expect(() =>
      markLocalPaymentsPaid(staleSelection, paymentDate, state.version)
    ).toThrow(/changed after the confirmation was opened/);
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(0);
  });

  it('keeps duplicate bank names and Marius/Vesta/Joint IDs isolated in one batch', () => {
    let state = installBase([
      payment('marius', 'Marius bill', 10_01, 'lloyds-marius', 'Marius'),
      payment('vesta', 'Vesta bill', 20_02, 'lloyds-vesta', 'Vesta'),
      payment('joint', 'Joint bill', 30_03, 'joint-current', 'Joint'),
    ]);

    markLocalPaymentsPaid(currentPayments(['marius', 'vesta', 'joint']), paymentDate, state.version);
    state = loadLocalHousehold();

    const byBill = new Map(linkedTransactions(state).map((tx) => [tx.plannedPaymentId, tx]));
    expect(byBill.get('marius')).toMatchObject({
      accountId: 'lloyds-marius',
      payer: 'Marius',
      amountPence: 10_01,
    });
    expect(byBill.get('vesta')).toMatchObject({
      accountId: 'lloyds-vesta',
      payer: 'Vesta',
      amountPence: 20_02,
    });
    expect(byBill.get('joint')).toMatchObject({
      accountId: 'joint-current',
      payer: 'Joint',
      amountPence: 30_03,
    });
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(-10_01);
    expect(state.accounts.find((a) => a.id === 'lloyds-vesta')?.currentBalancePence).toBe(479_98);
    expect(state.accounts.find((a) => a.id === 'joint-current')?.currentBalancePence).toBe(219_97);
  });

  it('requires a real calendar date and applies the exact confirmed local date to every Activity record', () => {
    let state = installBase();
    for (const badDate of ['', '2026-02-31', '2026-13-01', '2026-09-00']) {
      expect(() =>
        markLocalPaymentsPaid(currentPayments(['rent']), badDate, state.version)
      ).toThrow(/valid YYYY-MM-DD calendar date/);
      expect(linkedTransactions(loadLocalHousehold())).toHaveLength(0);
    }

    markLocalPaymentsPaid(currentPayments(['rent', 'phone']), '2026-09-07', state.version);
    state = loadLocalHousehold();
    expect(linkedTransactions(state).every((tx) => tx.date === '2026-09-07')).toBe(true);
    expect(state.plannedPayments.every((p) => p.actualDate === '2026-09-07')).toBe(true);
  });

  it('treats one unsafe item as ALL FAIL / NONE COMMITTED for both mark and undo', () => {
    let state = installBase();
    const markSnapshots = currentPayments(['rent', 'phone']);
    updateLocalPlannedPayment('phone', { amountPence: 99_99 }, state.version);
    state = loadLocalHousehold();

    expect(() =>
      markLocalPaymentsPaid(markSnapshots, paymentDate, state.version)
    ).toThrow();
    expect(linkedTransactions(loadLocalHousehold())).toHaveLength(0);

    state = installBase();
    markLocalPaymentsPaid(currentPayments(['rent', 'phone']), paymentDate, state.version);
    state = loadLocalHousehold();
    const undoSnapshots = currentPayments(['rent', 'phone']);
    const phone = state.plannedPayments.find((p) => p.id === 'phone')!;
    state.transactions = state.transactions.filter((tx) => tx.id !== phone.actualTransactionId);
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(() =>
      undoLocalPaymentsPaid(undoSnapshots, state.version)
    ).toThrow(/missing, duplicated, or mismatched/);
    state = loadLocalHousehold();
    expect(state.plannedPayments.find((p) => p.id === 'rent')?.status).toBe('paid');
    expect(state.transactions.some((tx) => tx.plannedPaymentId === 'rent')).toBe(true);
  });

  it('repeated Undo cannot delete unrelated Activity and broken reciprocal linkage stops reversal', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    const undoSnapshot = currentPayments(['rent'])[0];

    const unrelated: Transaction = {
      id: 'unrelated',
      date: paymentDate,
      description: 'Groceries',
      amountPence: 55_55,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'lloyds-marius',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-07T11:00:00.000Z',
      createdBy: 'test',
    };
    state.transactions.push(unrelated);
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    undoLocalPaymentsPaid([undoSnapshot], state.version);
    state = loadLocalHousehold();
    expect(state.transactions.some((tx) => tx.id === 'unrelated')).toBe(true);

    expect(() =>
      undoLocalPaymentsPaid([undoSnapshot], state.version)
    ).toThrow(/changed after the confirmation was opened|no longer Paid/);
    expect(state.transactions.some((tx) => tx.id === 'unrelated')).toBe(true);
  });

  it('preserves individual exception payments and prevents bulk duplicate evidence', () => {
    let state = installBase([payment('electric', 'Electric', 100_00, 'lloyds-marius')]);

    const result = markLocalPaymentPaid('electric', {
      actualAmountPence: 125_67,
      actualDate: '2026-09-05',
      accountId: 'lloyds-vesta',
    }, state.version);
    state = loadLocalHousehold();

    expect(result.transaction).toMatchObject({
      amountPence: 125_67,
      date: '2026-09-05',
      accountId: 'lloyds-vesta',
      plannedPaymentId: 'electric',
    });
    expect(state.plannedPayments[0]).toMatchObject({
      status: 'paid',
      actualAmountPence: 125_67,
      actualDate: '2026-09-06',
      actualTransactionId: result.transaction.id,
    });

    markLocalPaymentsPaid(currentPayments(['electric']), paymentDate, state.version);
    state = loadLocalHousehold();
    expect(linkedTransactions(state)).toHaveLength(1);

    const summary = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      month,
      state.plannedIncomes
    );
    expect(summary.fixedBillsTotalPence).toBe(125_67);
    expect(summary.fixedBillsPaidPence).toBe(125_67);
  });

  it('blocks unsafe legacy bulk Undo/Mark while preserving valid historical state', () => {
    let state = installBase([payment('legacy', 'Legacy bill', 42_42, 'lloyds-marius')]);
    state.plannedPayments[0] = {
      ...state.plannedPayments[0],
      status: 'paid',
      actualAmountPence: 42_42,
      actualDate: '2026-09-01',
      actualTransactionId: undefined,
    };
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    const plan = generateTransferPlan(state.accounts, state.plannedPayments, month, state.transactions);
    expect(plan.totalPaidSelectedPaymentsCount).toBe(1);
    expect(plan.totalTransferRequiredPence).toBe(0);

    expect(() =>
      undoLocalPaymentsPaid(currentPayments(['legacy']), state.version)
    ).toThrow(/missing, duplicated, or mismatched/);
    expect(() =>
      markLocalPaymentsPaid(currentPayments(['legacy']), paymentDate, state.version)
    ).toThrow(/missing, duplicated, or mismatched/);
    expect(loadLocalHousehold().plannedPayments[0].status).toBe('paid');
  });

  it('preserves reciprocal IDs across reload and backup/restore and rejects corrupted backup linkage', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();

    const txId = state.plannedPayments[0].actualTransactionId!;
    expect(loadLocalHousehold().transactions.find((tx) => tx.id === txId)?.plannedPaymentId).toBe('rent');

    const backup = createLocalBackupPackage();
    expect(preflightLocalRestore(backup).valid).toBe(true);

    undoLocalPaymentsPaid(currentPayments(['rent']), state.version);
    state = loadLocalHousehold();
    restoreLocalBackup(backup, state.version);
    state = loadLocalHousehold();

    expect(state.plannedPayments[0].status).toBe('paid');
    expect(state.plannedPayments[0].actualTransactionId).toBe(txId);
    expect(state.transactions.find((tx) => tx.id === txId)?.plannedPaymentId).toBe('rent');

    const corrupted = structuredClone(backup);
    const original = corrupted.state.transactions.find(
      (tx: Transaction) => tx.plannedPaymentId === 'rent'
    );
    corrupted.state.transactions.push({ ...original, id: 'duplicate-backup-payment' });
    expect(() => preflightLocalRestore(corrupted)).toThrow(/duplicated/);
  });

  it('month rollover creates a fresh unpaid bill with no inherited Activity evidence or ID collision', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    const oldTxId = state.plannedPayments[0].actualTransactionId!;

    importLocalMonth({
      sourceMonth: '2026-09',
      targetMonth: '2026-10',
      paymentIds: ['rent'],
      incomeIds: [],
    }, state.version);
    state = loadLocalHousehold();

    const copied = state.plannedPayments.find((p) => p.month === '2026-10')!;
    expect(copied.id).not.toBe('rent');
    expect(copied.status).toBe('unpaid');
    expect(copied.actualAmountPence).toBeUndefined();
    expect(copied.actualDate).toBeUndefined();
    expect(copied.actualTransactionId).toBeUndefined();
    expect(state.transactions.filter((tx) => tx.id === oldTxId)).toHaveLength(1);
    expect(state.transactions.some((tx) => tx.plannedPaymentId === copied.id)).toBe(false);
  });

  it('recognises a valid linked payment in its planned month even when Activity date crosses month-end', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentPaid('rent', {
      actualAmountPence: 349_79,
      actualDate: '2026-10-01',
      accountId: 'lloyds-marius',
    }, state.version);
    state = loadLocalHousehold();

    const september = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(september.fixedBillsTotalPence).toBe(349_79);
    expect(september.fixedBillsPaidPence).toBe(349_79);
    expect(september.fixedBillsUnpaidPence).toBe(0);
  });

  it('respects account reconciliation anchors and Undo restores the exact reconciled position', () => {
    let state = installBase([payment('rent', 'Rent', 100_00, 'lloyds-marius')]);
    reconcileLocalAccount('lloyds-marius', 500_00, '2026-09-04', state.version);
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(500_00);

    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(400_00);

    undoLocalPaymentsPaid(currentPayments(['rent']), state.version);
    state = loadLocalHousehold();
    expect(state.accounts.find((a) => a.id === 'lloyds-marius')?.currentBalancePence).toBe(500_00);
  });

  it('payment evidence remains an expense and cannot become transfer/refund/repayment/savings classification', () => {
    let state = installBase([payment('rent', 'Rent', 349_79, 'lloyds-marius')]);
    markLocalPaymentsPaid(currentPayments(['rent']), paymentDate, state.version);
    state = loadLocalHousehold();

    const tx = linkedTransactions(state)[0];
    expect(tx).toMatchObject({
      type: 'expense',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
    });
    const summary = calculateFinancialSummary(state.transactions);
    expect(summary.grossExpensesPence).toBe(349_79);
    expect(summary.internalTransfersPence).toBe(0);
    expect(summary.cardRepaymentsPence).toBe(0);
    expect(summary.refundsPence).toBe(0);
    expect(summary.savingsTransfersPence).toBe(0);
  });
});
