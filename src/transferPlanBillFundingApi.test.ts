import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedPayment,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  reconcileLocalAccount,
  saveLocalHousehold,
} from './localStore';
import {
  executeTransferPlanAllocations,
  markPaymentPaid,
} from './utils/api';
import { undoTransferPlanBillFunding } from './utils/transferPlanBillFundingApi';
import { getActiveBillFundingByPaymentId } from './utils/transferPlanFundingCompatibility';

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
      checksum: 'bill-funding-api-test',
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

function addBill(id: string, destinationAccountId: string, amountPence: number) {
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
      dueDate: '2026-09-20',
      status: 'unpaid',
      includeInTransferPlan: true,
    },
    state.version
  ).payment;
}

describe('GA-TP-002 bill-level Undo Funding API', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('returns exact multi-source bill funding to the original stable source account IDs', async () => {
    const sourceA = addAccount('Savings A', 200_00);
    const sourceB = addAccount('Current B', 200_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-rent', destination.id, 100_00);

    let state = loadLocalHousehold();
    await executeTransferPlanAllocations({
      destinationAccountId: destination.id,
      expectedTotalPence: 100_00,
      allocations: [
        { sourceAccountId: sourceA.id, amountPence: 60_00 },
        { sourceAccountId: sourceB.id, amountPence: 40_00 },
      ],
      date: '2026-09-12',
      month: '2026-09',
      expectedVersion: state.version,
    });

    state = loadLocalHousehold();
    const result = await undoTransferPlanBillFunding(bill.id, state.version);

    expect(result.reversedPence).toBe(100_00);
    expect(result.reversalTransactions).toHaveLength(2);
    expect(
      result.reversalTransactions
        .map((transaction) => [transaction.targetAccountId, transaction.amountPence])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    ).toEqual(
      [
        [sourceA.id, 60_00],
        [sourceB.id, 40_00],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    );

    state = loadLocalHousehold();
    expect(state.accounts.find((account) => account.id === sourceA.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === sourceB.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(0);
  });

  it('leaves paid status and linked Activity payment evidence untouched when funding is undone', async () => {
    const source = addAccount('Savings Source', 200_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-paid', destination.id, 100_00);

    let state = loadLocalHousehold();
    await executeTransferPlanAllocations({
      destinationAccountId: destination.id,
      expectedTotalPence: 100_00,
      allocations: [{ sourceAccountId: source.id, amountPence: 100_00 }],
      date: '2026-09-12',
      month: '2026-09',
      expectedVersion: state.version,
    });

    state = loadLocalHousehold();
    const currentBill = state.plannedPayments.find((payment) => payment.id === bill.id)!;
    await markPaymentPaid(currentBill, {
      actualAmountPence: 100_00,
      actualDate: '2026-09-13',
      accountId: destination.id,
      expectedVersion: state.version,
    });

    state = loadLocalHousehold();
    const paidBeforeUndo = state.plannedPayments.find((payment) => payment.id === bill.id)!;
    const paymentTransactionId = paidBeforeUndo.actualTransactionId;
    expect(paidBeforeUndo.status).toBe('paid');
    expect(paymentTransactionId).toBeTruthy();

    await undoTransferPlanBillFunding(bill.id, state.version);

    state = loadLocalHousehold();
    const paidAfterUndo = state.plannedPayments.find((payment) => payment.id === bill.id)!;
    expect(paidAfterUndo.status).toBe('paid');
    expect(paidAfterUndo.actualTransactionId).toBe(paymentTransactionId);
    expect(
      state.transactions.some((transaction) => transaction.id === paymentTransactionId)
    ).toBe(true);
    expect(paidAfterUndo.includeInTransferPlan).toBe(true);
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence).toBe(200_00);
  });

  it('reverses only the newest active attribution first and then exposes the older active batch', async () => {
    const sourceOld = addAccount('Savings Old', 200_00);
    const sourceNew = addAccount('Savings New', 200_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-repeat', destination.id, 100_00);

    let state = loadLocalHousehold();
    const first = await executeTransferPlanAllocations({
      destinationAccountId: destination.id,
      expectedTotalPence: 100_00,
      allocations: [{ sourceAccountId: sourceOld.id, amountPence: 100_00 }],
      date: '2026-09-10',
      month: '2026-09',
      expectedVersion: state.version,
    });

    state = loadLocalHousehold();
    reconcileLocalAccount(destination.id, 70_00, '2026-09-11', state.version);

    state = loadLocalHousehold();
    const second = await executeTransferPlanAllocations({
      destinationAccountId: destination.id,
      expectedTotalPence: 30_00,
      allocations: [{ sourceAccountId: sourceNew.id, amountPence: 30_00 }],
      date: '2026-09-12',
      month: '2026-09',
      expectedVersion: state.version,
    });

    state = loadLocalHousehold();
    let active = getActiveBillFundingByPaymentId(
      state.transferPlanFundingRecords,
      state.transactions,
      '2026-09'
    ).get(bill.id);
    expect(active).toEqual(
      expect.objectContaining({ fundingRecordId: second.fundingRecord.id, activePence: 30_00 })
    );

    const firstUndo = await undoTransferPlanBillFunding(bill.id, state.version);
    expect(firstUndo.fundingRecordId).toBe(second.fundingRecord.id);
    expect(firstUndo.reversedPence).toBe(30_00);

    state = loadLocalHousehold();
    active = getActiveBillFundingByPaymentId(
      state.transferPlanFundingRecords,
      state.transactions,
      '2026-09'
    ).get(bill.id);
    expect(active).toEqual(
      expect.objectContaining({ fundingRecordId: first.fundingRecord.id, activePence: 100_00 })
    );

    const secondUndo = await undoTransferPlanBillFunding(bill.id, state.version);
    expect(secondUndo.fundingRecordId).toBe(first.fundingRecord.id);
    expect(secondUndo.reversedPence).toBe(100_00);

    state = loadLocalHousehold();
    expect(() => undoTransferPlanBillFunding(bill.id, state.version)).rejects.toThrow(
      'No active exact bill-level funding attribution'
    );
  });

  it('refuses bill-level undo for legacy transaction-only funding instead of inventing attribution', async () => {
    const source = addAccount('Savings Legacy', 100_00);
    const destination = addAccount('Bills Current', 0);
    const bill = addBill('bill-legacy', destination.id, 50_00);

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
    await expect(
      undoTransferPlanBillFunding(bill.id, state.version)
    ).rejects.toThrow('No active exact bill-level funding attribution');
  });
});
