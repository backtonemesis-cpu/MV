import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedPayment,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  saveLocalHousehold,
} from './localStore';
import { executeAttributedTransferPlanAllocations } from './utils/transferPlanFundingStore';
import { deriveActiveTransferPlanFundingRecord } from './utils/transferPlanFundingReversal';
import {
  undoAttributedTransferPlanBatchFunding,
  undoAttributedTransferPlanBillFunding,
} from './utils/transferPlanFundingReversalStore';

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
      checksum: 'attributed-reversal-test',
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

function addBill(
  id: string,
  destinationAccountId: string,
  amountPence: number,
  dueDate: string
) {
  const state = loadLocalHousehold();
  return createLocalPlannedPayment(
    {
      id,
      categoryId: 'cat-rent',
      name: id,
      amountPence,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: destinationAccountId,
      dueDate,
      status: 'unpaid',
      includeInTransferPlan: true,
    },
    state.version
  ).payment;
}

describe('GA-TP-002 append-only attributed funding reversals', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('undoes one bill by exact source shares while preserving original funding evidence', () => {
    const sourceA = addAccount('Savings A', 100_00);
    const sourceB = addAccount('Current B', 100_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-rent', destination.id, 100_00, '2026-09-05');

    let state = loadLocalHousehold();
    const funded = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 100_00,
        allocations: [
          { sourceAccountId: sourceA.id, amountPence: 60_00 },
          { sourceAccountId: sourceB.id, amountPence: 40_00 },
        ],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    const undone = undoAttributedTransferPlanBillFunding(bill.id, state.version);
    expect(undone.reversedPence).toBe(100_00);
    expect(undone.reversalTransactions.map((tx) => tx.amountPence).sort()).toEqual([
      40_00,
      60_00,
    ]);

    state = loadLocalHousehold();
    expect(state.transferPlanFundingRecords).toEqual([funded.fundingRecord]);
    for (const original of funded.transactions) {
      expect(state.transactions.some((tx) => tx.id === original.id)).toBe(true);
    }
    for (const reversal of undone.reversalTransactions) {
      expect(reversal.metadata?.transferPlanFundingReversal).toBe(true);
      expect(reversal.metadata?.transferPlanPaymentId).toBe(bill.id);
      expect(reversal.metadata?.reversalScope).toBe('bill');
      expect(reversal.description.startsWith('Transfer Plan:')).toBe(false);
      expect(reversal.metadata?.transferBatchId).toBeUndefined();
      expect(reversal.metadata?.transferPlanMonth).toBeUndefined();
    }

    expect(state.accounts.find((account) => account.id === sourceA.id)?.currentBalancePence).toBe(100_00);
    expect(state.accounts.find((account) => account.id === sourceB.id)?.currentBalancePence).toBe(100_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(0);
    expect(state.plannedPayments.find((payment) => payment.id === bill.id)).toEqual(
      expect.objectContaining({ status: 'unpaid', includeInTransferPlan: true })
    );

    const active = deriveActiveTransferPlanFundingRecord(
      funded.fundingRecord,
      state.transactions
    );
    expect(active.activePence).toBe(0);
  });

  it('rejects a repeated bill undo after the exact attribution is fully reversed without changing state', () => {
    const source = addAccount('Savings Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-rent', destination.id, 50_00, '2026-09-05');

    let state = loadLocalHousehold();
    executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 50_00,
        allocations: [{ sourceAccountId: source.id, amountPence: 50_00 }],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );
    state = loadLocalHousehold();
    undoAttributedTransferPlanBillFunding(bill.id, state.version);

    state = loadLocalHousehold();
    const beforeJson = JSON.stringify(state);
    expect(() => undoAttributedTransferPlanBillFunding(bill.id, state.version)).toThrow(
      'No active exact bill-level funding attribution'
    );
    expect(JSON.stringify(loadLocalHousehold())).toBe(beforeJson);
  });

  it('batch undo reverses only the active remainder after a bill-level undo, including deficit recovery', () => {
    const sourceA = addAccount('Savings A', 200_00);
    const sourceB = addAccount('Current B', 200_00);
    const destination = addAccount('Bills Negative', -20_00);
    const billA = addBill('bill-a', destination.id, 50_00, '2026-09-05');
    addBill('bill-b', destination.id, 50_00, '2026-09-10');

    let state = loadLocalHousehold();
    const funded = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 120_00,
        allocations: [
          { sourceAccountId: sourceA.id, amountPence: 70_00 },
          { sourceAccountId: sourceB.id, amountPence: 50_00 },
        ],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    const billUndo = undoAttributedTransferPlanBillFunding(billA.id, state.version);
    expect(billUndo.reversedPence).toBe(50_00);

    state = loadLocalHousehold();
    const batchUndo = undoAttributedTransferPlanBatchFunding(
      destination.id,
      '2026-09',
      state.version
    );
    expect(batchUndo.reversedPence).toBe(70_00);
    expect(batchUndo.reversalTransactions).toHaveLength(2);

    state = loadLocalHousehold();
    expect(state.accounts.find((account) => account.id === sourceA.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === sourceB.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(-20_00);
    expect(state.transferPlanFundingRecords?.[0]).toEqual(funded.fundingRecord);
    expect(
      deriveActiveTransferPlanFundingRecord(funded.fundingRecord, state.transactions)
        .activePence
    ).toBe(0);

    const originals = funded.transactions.map((transaction) => transaction.id);
    expect(originals.every((id) => state.transactions.some((tx) => tx.id === id))).toBe(true);
  });

  it('never guesses bill attribution for legacy transaction-only funding', () => {
    const source = addAccount('Savings Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill('bill-rent', destination.id, 50_00, '2026-09-05');

    let state = loadLocalHousehold();
    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 50_00,
        allocations: [{ sourceAccountId: source.id, amountPence: 50_00 }],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    const beforeJson = JSON.stringify(state);
    expect(() =>
      undoAttributedTransferPlanBatchFunding(destination.id, '2026-09', state.version)
    ).toThrow('No active exact attributed Transfer Plan funding');
    expect(JSON.stringify(loadLocalHousehold())).toBe(beforeJson);
  });
});
