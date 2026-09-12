import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalPlannedPayment,
  loadLocalHousehold,
  saveLocalHousehold,
} from './localStore';
import {
  executeTransferPlanAllocations,
  undoTransferPlanFunding,
} from './utils/api';
import { generateTransferPlan } from './utils/transferPlan';
import { buildTransferPlanAccountModels } from './utils/transferPlanViewModel';

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
      checksum: 'live-attributed-api-workflow-test',
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

function destinationModel(destinationAccountId: string) {
  const state = loadLocalHousehold();
  const plan = generateTransferPlan(
    state.accounts,
    state.plannedPayments,
    '2026-09',
    state.transactions
  );
  const models = buildTransferPlanAccountModels(
    plan,
    state.transactions,
    '2026-09'
  );
  const model = models.find(
    (candidate) => candidate.requirement.account.id === destinationAccountId
  );
  if (!model) throw new Error('Destination Transfer Plan model is missing.');
  return model;
}

describe('GA-TP-002 live attributed Transfer Plan API lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installBlankFixture();
  });

  it('records attributed funding, exposes exact active card evidence, and card-undoes it append-only with exact reconciliation', async () => {
    const sourceA = addAccount('Savings A', 200_00);
    const sourceB = addAccount('Current B', 200_00);
    const destination = addAccount('Bills Current', 50_00);
    const rent = addBill('bill-rent', destination.id, 100_00, '2026-09-05');
    const councilTax = addBill(
      'bill-council-tax',
      destination.id,
      100_00,
      '2026-09-10'
    );

    const before = loadLocalHousehold();
    const funded = await executeTransferPlanAllocations({
      destinationAccountId: destination.id,
      expectedTotalPence: 150_00,
      allocations: [
        { sourceAccountId: sourceA.id, amountPence: 60_00 },
        { sourceAccountId: sourceB.id, amountPence: 90_00 },
      ],
      description: 'Transfer Plan: live attributed workflow',
      date: '2026-09-12',
      month: '2026-09',
      expectedVersion: before.version,
    });

    let state = loadLocalHousehold();
    expect(funded.fundingRecord.expectedTransferTotalPence).toBe(150_00);
    expect(state.transferPlanFundingRecords).toEqual([funded.fundingRecord]);
    expect(funded.transactions).toHaveLength(2);
    expect(
      funded.transactions.every(
        (transaction) =>
          transaction.metadata?.transferPlanFundingRecordId ===
            funded.fundingRecord.id &&
          transaction.metadata?.transferBatchId === funded.fundingRecord.id
      )
    ).toBe(true);

    const fundedModel = destinationModel(destination.id);
    expect(fundedModel.lifecycle).toBe('funded');
    expect(fundedModel.latestFundingBatch).toEqual(
      expect.objectContaining({
        kind: 'attributed',
        batchKey: funded.fundingRecord.id,
        totalPence: 150_00,
        originalTotalPence: 150_00,
      })
    );
    expect(fundedModel.latestFundingBatch?.expectedUndoBatch).toEqual({
      batchKey: funded.fundingRecord.id,
      destinationAccountId: destination.id,
      totalPence: 150_00,
      transactionIds: funded.transactions.map((transaction) => transaction.id),
    });

    const originalFundingTransactionIds = funded.transactions.map(
      (transaction) => transaction.id
    );
    const expectedUndoBatch = fundedModel.latestFundingBatch!.expectedUndoBatch;

    state = loadLocalHousehold();
    const undone = await undoTransferPlanFunding(
      destination.id,
      '2026-09',
      state.version,
      expectedUndoBatch
    );

    expect(undone.mode).toBe('attributed');
    expect(undone.reversedPence).toBe(150_00);
    expect(undone.undoneTransactions).toHaveLength(3);
    expect(
      undone.undoneTransactions.map((transaction) => transaction.amountPence).sort((a, b) => a - b)
    ).toEqual([10_00, 50_00, 90_00]);
    expect(
      undone.undoneTransactions.every(
        (transaction) =>
          transaction.metadata?.transferPlanFundingReversal === true &&
          transaction.metadata?.transferPlanFundingRecordId ===
            funded.fundingRecord.id &&
          transaction.metadata?.reversalScope === 'batch'
      )
    ).toBe(true);

    state = loadLocalHousehold();
    expect(state.accounts.find((account) => account.id === sourceA.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === sourceB.id)?.currentBalancePence).toBe(200_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence).toBe(50_00);

    expect(state.transferPlanFundingRecords).toEqual([funded.fundingRecord]);
    expect(
      originalFundingTransactionIds.every((id) =>
        state.transactions.some((transaction) => transaction.id === id)
      )
    ).toBe(true);

    expect(state.plannedPayments.find((payment) => payment.id === rent.id)).toEqual(
      expect.objectContaining({ status: 'unpaid', includeInTransferPlan: true })
    );
    expect(
      state.plannedPayments.find((payment) => payment.id === councilTax.id)
    ).toEqual(
      expect.objectContaining({ status: 'unpaid', includeInTransferPlan: true })
    );

    const afterUndoModel = destinationModel(destination.id);
    expect(afterUndoModel.lifecycle).toBe('needs_funding');
    expect(afterUndoModel.fundingBatches).toHaveLength(0);
    expect(afterUndoModel.latestFundingBatch).toBeUndefined();
    expect(afterUndoModel.requirement.transferRequiredPence).toBe(150_00);
  });
});
