import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalPlannedPayment,
  loadLocalHousehold,
  preflightLocalRestore,
  restoreLocalBackup,
  saveLocalHousehold,
} from './localStore';
import { calculateFinancialSummary, calculateMonthlySurplus } from './utils/currency';
import { executeAttributedTransferPlanAllocations } from './utils/transferPlanFundingStore';
import { undoAttributedTransferPlanBillFunding } from './utils/transferPlanFundingReversalStore';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

function installBlankFixture(): void {
  const state = createBlankLocalHousehold();
  state.schemaStatus!.appliedMigrations = [
    {
      version: 1,
      name: LEGACY_SOURCE_SEED_MIGRATION_ID,
      appliedAt: '2026-09-01T00:00:00.000Z',
      executionTimeMs: 0,
      checksum: 'attribution-closure-audit',
    },
  ];
  saveLocalHousehold(state);
}

function addAccount(name: string, startingBalancePence: number) {
  const state = loadLocalHousehold();
  return createLocalAccount(
    {
      name,
      type: name.includes('Savings') ? 'savings' : 'current',
      startingBalancePence,
      ownerPerson: 'Marius',
    },
    state.version
  ).account;
}

function addBill(destinationAccountId: string) {
  const state = loadLocalHousehold();
  return createLocalPlannedPayment(
    {
      id: 'bill-rent',
      categoryId: 'cat-rent',
      name: 'Rent',
      amountPence: 100_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: destinationAccountId,
      dueDate: '2026-09-20',
      status: 'unpaid',
      includeInTransferPlan: true,
    },
    state.version
  ).payment;
}

describe('GA-TP-002 final attribution evidence closure', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('keeps original funding and reversal as traceable internal transfers and preserves them exactly through backup/restore', () => {
    const sourceA = addAccount('Savings A', 100_00);
    const sourceB = addAccount('Current B', 100_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill(destination.id);

    let state = loadLocalHousehold();
    const funded = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 100_00,
        allocations: [
          { sourceAccountId: sourceA.id, amountPence: 60_00 },
          { sourceAccountId: sourceB.id, amountPence: 40_00 },
        ],
        description: 'Transfer Plan: Fund Rent',
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    const undone = undoAttributedTransferPlanBillFunding(bill.id, state.version);
    state = loadLocalHousehold();

    const financialSummary = calculateFinancialSummary(state.transactions);
    expect(financialSummary).toMatchObject({
      grossIncomePence: 0,
      grossExpensesPence: 0,
      refundsPence: 0,
      cardRepaymentsPence: 0,
      savingsTransfersPence: 0,
      internalTransfersPence: 200_00,
      netCashflowPence: 0,
    });

    const monthly = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      '2026-09',
      state.plannedIncomes
    );
    expect(monthly.actualIncomeReceivedPence).toBe(0);
    expect(monthly.grossOtherSpendingPence).toBe(0);
    expect(monthly.internalTransfersPence).toBe(200_00);

    expect(state.transferPlanFundingRecords).toEqual([funded.fundingRecord]);
    for (const reversal of undone.reversalTransactions) {
      const originalId = reversal.metadata?.originalFundingTransactionId;
      expect(typeof originalId).toBe('string');
      expect(
        state.transactions.some(
          (transaction) =>
            transaction.id === originalId &&
            transaction.metadata?.transferPlanFundingRecordId === funded.fundingRecord.id
        )
      ).toBe(true);
      expect(reversal.metadata).toMatchObject({
        transferPlanFundingReversal: true,
        transferPlanFundingRecordId: funded.fundingRecord.id,
        transferPlanPaymentId: bill.id,
        reversalScope: 'bill',
      });
    }

    const backup = createLocalBackupPackage();
    expect(preflightLocalRestore(backup).valid).toBe(true);

    state = loadLocalHousehold();
    createLocalAccount(
      {
        name: 'Temporary account after backup',
        type: 'current',
        startingBalancePence: 1,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();
    restoreLocalBackup(backup, state.version);
    state = loadLocalHousehold();

    expect(state.transferPlanFundingRecords).toEqual([funded.fundingRecord]);
    for (const original of funded.transactions) {
      expect(state.transactions.find((transaction) => transaction.id === original.id)).toEqual(original);
    }
    for (const reversal of undone.reversalTransactions) {
      expect(state.transactions.find((transaction) => transaction.id === reversal.id)).toEqual(reversal);
    }
  });

  it('rejects a backup whose immutable funding record no longer matches its original transfer transaction', () => {
    const source = addAccount('Savings Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill(destination.id);

    let state = loadLocalHousehold();
    const funded = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 100_00,
        allocations: [{ sourceAccountId: source.id, amountPence: 100_00 }],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    const corrupted = structuredClone(createLocalBackupPackage());
    const original = corrupted.state.transactions.find(
      (transaction) => transaction.id === funded.transactions[0].id
    );
    if (!original) throw new Error('Missing test funding transaction.');
    original.metadata = {
      ...original.metadata,
      transferPlanFundingRecordId: 'wrong-record-id',
    };

    expect(() => preflightLocalRestore(corrupted)).toThrow(
      /funding transaction linkage|missing Transfer Plan funding record/
    );
  });
});
