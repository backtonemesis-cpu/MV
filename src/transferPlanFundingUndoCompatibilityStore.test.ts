import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedPayment,
  createLocalTransaction,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  saveLocalHousehold,
} from './localStore';
import type { TransferPlanFundingMutationExpectation } from './types';
import { deriveActiveTransferPlanFundingRecord } from './utils/transferPlanFundingReversal';
import { undoAttributedTransferPlanBillFunding } from './utils/transferPlanFundingReversalStore';
import { executeAttributedTransferPlanAllocations } from './utils/transferPlanFundingStore';
import { undoCompatibleTransferPlanFunding } from './utils/transferPlanFundingUndoCompatibilityStore';

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
      checksum: 'unified-undo-compatibility-test',
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

function addBill(id: string, accountId: string, amountPence: number) {
  const state = loadLocalHousehold();
  return createLocalPlannedPayment(
    {
      id,
      categoryId: 'cat-rent',
      name: id,
      amountPence,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId,
      dueDate: '2026-09-15',
      status: 'unpaid',
      includeInTransferPlan: true,
    },
    state.version
  ).payment;
}

function attributedExpectation(
  funded: ReturnType<typeof executeAttributedTransferPlanAllocations>
): TransferPlanFundingMutationExpectation {
  return {
    batchKey: funded.fundingRecord.id,
    destinationAccountId: funded.fundingRecord.destinationAccountId,
    totalPence: funded.fundingRecord.expectedTransferTotalPence,
    transactionIds: funded.transactions.map((transaction) => transaction.id),
  };
}

function legacyExpectation(
  destinationAccountId: string,
  funded: ReturnType<typeof executeLocalTransferAllocations>
): TransferPlanFundingMutationExpectation {
  const batchKey = funded.transactions[0].metadata?.transferBatchId;
  if (typeof batchKey !== 'string') throw new Error('Legacy test batch ID missing.');
  return {
    batchKey,
    destinationAccountId,
    totalPence: funded.transactions.reduce(
      (sum, transaction) => sum + transaction.amountPence,
      0
    ),
    transactionIds: funded.transactions.map((transaction) => transaction.id),
  };
}

describe('GA-TP-002 unified attributed/legacy Undo Funding compatibility', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('uses append-only exact reversal for attributed funding and preserves originals', () => {
    const sourceA = addAccount('Savings A', 100_00);
    const sourceB = addAccount('Current B', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill('bill-rent', destination.id, 100_00);

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
    const undone = undoCompatibleTransferPlanFunding(
      destination.id,
      '2026-09',
      state.version,
      attributedExpectation(funded)
    );

    expect(undone.mode).toBe('attributed');
    expect(undone.reversedPence).toBe(100_00);
    expect(undone.fundingRecordId).toBe(funded.fundingRecord.id);

    state = loadLocalHousehold();
    expect(
      funded.transactions.every((original) =>
        state.transactions.some((transaction) => transaction.id === original.id)
      )
    ).toBe(true);
    expect(state.transferPlanFundingRecords?.[0]).toEqual(funded.fundingRecord);
    expect(
      undone.undoneTransactions.every(
        (transaction) => transaction.metadata?.transferPlanFundingReversal === true
      )
    ).toBe(true);
    expect(
      deriveActiveTransferPlanFundingRecord(funded.fundingRecord, state.transactions)
        .activePence
    ).toBe(0);
  });

  it('preserves exact legacy delete-and-reverse semantics for a truly legacy batch', () => {
    const source = addAccount('Savings Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill('bill-rent', destination.id, 50_00);

    let state = loadLocalHousehold();
    const funded = executeLocalTransferAllocations(
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
    const undone = undoCompatibleTransferPlanFunding(
      destination.id,
      '2026-09',
      state.version,
      legacyExpectation(destination.id, funded)
    );

    expect(undone.mode).toBe('legacy');
    expect(undone.reversedPence).toBe(50_00);
    state = loadLocalHousehold();
    expect(
      funded.transactions.some((original) =>
        state.transactions.some((transaction) => transaction.id === original.id)
      )
    ).toBe(false);
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence).toBe(100_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(0);
  });

  it('can undo an older truly legacy batch after a newer attributed batch was fully reversed', () => {
    const legacySource = addAccount('Savings Legacy', 200_00);
    const attributedSource = addAccount('Savings Attributed', 200_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-rent', destination.id, 50_00);

    let state = loadLocalHousehold();
    const legacyFunded = executeLocalTransferAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 50_00,
        allocations: [{ sourceAccountId: legacySource.id, amountPence: 50_00 }],
        date: '2026-09-05',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    createLocalTransaction(
      {
        date: '2026-09-10',
        description: 'Unrelated household expense',
        amountPence: 50_00,
        type: 'expense',
        categoryId: 'cat-rent',
        accountId: destination.id,
        payer: 'Marius',
        isTransfer: false,
        isRepayment: false,
        isSavings: false,
        isRefund: false,
      },
      state.version
    );

    state = loadLocalHousehold();
    const attributedFunded = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 50_00,
        allocations: [
          { sourceAccountId: attributedSource.id, amountPence: 50_00 },
        ],
        date: '2026-09-12',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    undoAttributedTransferPlanBillFunding(bill.id, state.version);
    state = loadLocalHousehold();
    expect(
      deriveActiveTransferPlanFundingRecord(
        attributedFunded.fundingRecord,
        state.transactions
      ).activePence
    ).toBe(0);

    const undone = undoCompatibleTransferPlanFunding(
      destination.id,
      '2026-09',
      state.version,
      legacyExpectation(destination.id, legacyFunded)
    );
    expect(undone.mode).toBe('legacy');

    state = loadLocalHousehold();
    expect(
      attributedFunded.transactions.every((original) =>
        state.transactions.some((transaction) => transaction.id === original.id)
      )
    ).toBe(true);
    expect(
      legacyFunded.transactions.some((original) =>
        state.transactions.some((transaction) => transaction.id === original.id)
      )
    ).toBe(false);
    expect(state.accounts.find((account) => account.id === legacySource.id)?.currentBalancePence).toBe(200_00);
  });

  it('fails closed when the confirmation expectation no longer matches the attributed batch', () => {
    const source = addAccount('Savings Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill('bill-rent', destination.id, 50_00);

    let state = loadLocalHousehold();
    const funded = executeAttributedTransferPlanAllocations(
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
      undoCompatibleTransferPlanFunding(
        destination.id,
        '2026-09',
        state.version,
        { ...attributedExpectation(funded), totalPence: 49_99 }
      )
    ).toThrow('changed after the confirmation was opened');
    expect(JSON.stringify(loadLocalHousehold())).toBe(beforeJson);
  });
});
