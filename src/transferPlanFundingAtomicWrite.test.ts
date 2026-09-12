import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedPayment,
  loadLocalHousehold,
  saveLocalHousehold,
} from './localStore';
import { executeAttributedTransferPlanAllocations } from './utils/transferPlanFundingStore';

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
      checksum: 'atomic-attribution-test',
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

describe('GA-TP-002 atomic Transfer Plan funding evidence write', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('commits transfer legs and their exact bill-attribution record together', () => {
    const sourceA = addAccount('Savings A', 200_00);
    const sourceB = addAccount('Current B', 200_00);
    const destination = addAccount('Bills Current', 50_00);
    addBill('bill-rent', destination.id, 100_00, '2026-09-05');
    addBill('bill-council-tax', destination.id, 100_00, '2026-09-10');

    const before = loadLocalHousehold();
    const result = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 150_00,
        allocations: [
          { sourceAccountId: sourceA.id, amountPence: 60_00 },
          { sourceAccountId: sourceB.id, amountPence: 90_00 },
        ],
        description: 'Transfer Plan: exact attribution',
        date: '2026-09-12',
        month: '2026-09',
      },
      before.version
    );

    expect(result.version).toBe(before.version + 1);
    expect(result.transactions).toHaveLength(2);
    expect(result.fundingRecord.billAttributions.map((item) => [item.plannedPaymentId, item.attributedPence])).toEqual([
      ['bill-rent', 50_00],
      ['bill-council-tax', 100_00],
    ]);

    const after = loadLocalHousehold();
    expect(after.transferPlanFundingRecords).toHaveLength(1);
    expect(after.transferPlanFundingRecords?.[0]).toEqual(result.fundingRecord);

    const transactionIds = result.transactions.map((transaction) => transaction.id).sort();
    const recordTransactionIds = result.fundingRecord.sourceLegs
      .map((leg) => leg.transactionId)
      .sort();
    expect(recordTransactionIds).toEqual(transactionIds);
    for (const transaction of result.transactions) {
      expect(transaction.metadata?.transferPlanFundingRecordId).toBe(result.fundingRecord.id);
      expect(transaction.metadata?.transferBatchId).toBe(result.fundingRecord.id);
    }

    expect(after.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(200_00);
    expect(after.accounts.find((account) => account.id === sourceA.id)?.currentBalancePence).toBe(140_00);
    expect(after.accounts.find((account) => account.id === sourceB.id)?.currentBalancePence).toBe(110_00);
  });

  it('records negative destination balance recovery separately from bill funding', () => {
    const source = addAccount('Savings Source', 200_00);
    const destination = addAccount('Bills Negative', -40_00);
    addBill('bill-rent', destination.id, 100_00, '2026-09-05');

    const before = loadLocalHousehold();
    const result = executeAttributedTransferPlanAllocations(
      {
        destinationAccountId: destination.id,
        expectedTotalPence: 140_00,
        allocations: [{ sourceAccountId: source.id, amountPence: 140_00 }],
        date: '2026-09-12',
        month: '2026-09',
      },
      before.version
    );

    expect(result.fundingRecord.accountDeficitRecovery).toEqual({
      amountPence: 40_00,
      sourceShares: [
        expect.objectContaining({
          sourceAccountId: source.id,
          amountPence: 40_00,
        }),
      ],
    });
    expect(result.fundingRecord.billAttributions).toEqual([
      expect.objectContaining({
        plannedPaymentId: 'bill-rent',
        attributedPence: 100_00,
      }),
    ]);
  });

  it('fails closed when the submitted total is stale and leaves all financial state unchanged', () => {
    const source = addAccount('Savings Source', 200_00);
    const destination = addAccount('Bills Current', 50_00);
    addBill('bill-rent', destination.id, 100_00, '2026-09-05');
    addBill('bill-council-tax', destination.id, 100_00, '2026-09-10');

    const before = loadLocalHousehold();
    const beforeJson = JSON.stringify(before);

    expect(() =>
      executeAttributedTransferPlanAllocations(
        {
          destinationAccountId: destination.id,
          expectedTotalPence: 160_00,
          allocations: [{ sourceAccountId: source.id, amountPence: 160_00 }],
          date: '2026-09-12',
          month: '2026-09',
        },
        before.version
      )
    ).toThrow('Transfer Plan funding changed before submission');

    expect(JSON.stringify(loadLocalHousehold())).toBe(beforeJson);
  });

  it('fails closed when a source allocation would consume money reserved for its own selected bills', () => {
    const source = addAccount('Savings Reserved Source', 100_00);
    const destination = addAccount('Bills Current', 0);
    addBill('destination-bill', destination.id, 50_00, '2026-09-05');

    const state = loadLocalHousehold();
    createLocalPlannedPayment(
      {
        id: 'source-bill',
        categoryId: 'cat-rent',
        name: 'source-bill',
        amountPence: 80_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: source.id,
        dueDate: '2026-09-06',
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );

    const before = loadLocalHousehold();
    const beforeJson = JSON.stringify(before);
    expect(() =>
      executeAttributedTransferPlanAllocations(
        {
          destinationAccountId: destination.id,
          expectedTotalPence: 50_00,
          allocations: [{ sourceAccountId: source.id, amountPence: 50_00 }],
          date: '2026-09-12',
          month: '2026-09',
        },
        before.version
      )
    ).toThrow('safe to move after its own selected unpaid bills');

    expect(JSON.stringify(loadLocalHousehold())).toBe(beforeJson);
  });
});
