import { beforeEach, describe, expect, it } from 'vitest';
import type { HouseholdData, Transaction } from './types';
import {
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  LOCAL_STORAGE_KEY,
  archiveLocalAccount,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalHouseholdMember,
  createLocalPlannedPayment,
  loadLocalHousehold,
  permanentlyDeleteLocalAccount,
  preflightLocalRestore,
  saveLocalHousehold,
} from './localStore';
import { getAccountPermanentDeleteEligibility } from './utils/accountDeletion';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

function markSourceBudgetHandledForTest(state: HouseholdData): void {
  state.schemaStatus = state.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };
  state.schemaStatus.appliedMigrations = [
    {
      version: 1,
      name: LEGACY_SOURCE_SEED_MIGRATION_ID,
      appliedAt: '2026-09-06T00:00:00.000Z',
      executionTimeMs: 0,
      checksum: 'safe-delete-test',
    },
  ];
}

function addTransactionReference(
  state: HouseholdData,
  accountId: string,
  options: { targetAccountId?: string; metadata?: Record<string, unknown> } = {}
): void {
  const tx: Transaction = {
    id: `tx-ref-${state.transactions.length + 1}`,
    date: '2026-09-06',
    description: 'Reference transaction',
    amountPence: 1_00,
    type: options.targetAccountId ? 'transfer' : 'expense',
    categoryId: options.targetAccountId ? 'cat-transfer' : 'cat-groceries',
    accountId,
    targetAccountId: options.targetAccountId,
    payer: 'Marius',
    isTransfer: Boolean(options.targetAccountId),
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    metadata: options.metadata,
    createdAt: '2026-09-06T12:00:00.000Z',
    createdBy: 'marius@local.invalid',
  };
  state.transactions.push(tx);
}

describe('Safe conditional permanent account deletion', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    const blank = createBlankLocalHousehold();
    markSourceBudgetHandledForTest(blank);
    saveLocalHousehold(blank);
  });

  it('allows a brand-new unused £0.00 account to be permanently deleted', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      {
        name: 'Test',
        type: 'current',
        startingBalancePence: 0,
        ownerMemberId: state.members[0].id,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).canDeletePermanently)
      .toBe(true);

    permanentlyDeleteLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    expect(state.accounts.some((account) => account.id === created.account.id)).toBe(false);
  });

  it('blocks a brand-new unused account with a non-zero opening balance because the opening balance is financial state', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      {
        name: 'Opening balance account',
        type: 'current',
        startingBalancePence: 25_00,
        ownerMemberId: state.members[0].id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const eligibility = getAccountPermanentDeleteEligibility(state, created.account.id);
    expect(eligibility.canDeletePermanently).toBe(false);
    expect(eligibility.reasons.join(' ')).toMatch(/opening balance/i);
    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version))
      .toThrow(/cannot be permanently deleted/i);
  });

  it('blocks an account with one Activity / ledger entry', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Ledger account', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    addTransactionReference(state, created.account.id);
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).reasons.join(' '))
      .toMatch(/Activity \/ ledger/i);
    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version)).toThrow();
  });

  it('blocks an account used as a transfer source', () => {
    let state = loadLocalHousehold();
    const source = createLocalAccount(
      { name: 'Source', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    const destination = createLocalAccount(
      { name: 'Destination', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    addTransactionReference(state, source.account.id, { targetAccountId: destination.account.id });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, source.account.id).canDeletePermanently).toBe(false);
  });

  it('blocks an account used as a transfer destination', () => {
    let state = loadLocalHousehold();
    const source = createLocalAccount(
      { name: 'Source', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    const destination = createLocalAccount(
      { name: 'Destination', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    addTransactionReference(state, source.account.id, { targetAccountId: destination.account.id });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, destination.account.id).canDeletePermanently).toBe(false);
  });

  it('blocks an account with Transfer Plan funding history', () => {
    let state = loadLocalHousehold();
    const source = createLocalAccount(
      { name: 'Funding source', type: 'savings', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    const destination = createLocalAccount(
      { name: 'Funded current', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    addTransactionReference(state, source.account.id, {
      targetAccountId: destination.account.id,
      metadata: { transferBatchId: 'batch-safe-delete', transferPlanMonth: '2026-09' },
    });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, source.account.id).canDeletePermanently).toBe(false);
    expect(getAccountPermanentDeleteEligibility(state, destination.account.id).canDeletePermanently).toBe(false);
  });

  it('blocks an account linked to a planned bill', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Bill account', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    createLocalPlannedPayment(
      {
        name: 'Linked bill',
        amountPence: 10_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: created.account.id,
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).reasons.join(' '))
      .toMatch(/planned bill|payment record/i);
    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version)).toThrow();
  });

  it('blocks an account with payment history', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Paid history', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    const payment = {
      id: 'payment-history',
      name: 'Historic bill',
      amountPence: 5_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: created.account.id,
      status: 'paid' as const,
      includeInTransferPlan: false,
      actualAmountPence: 5_00,
      actualDate: '2026-09-06',
      actualTransactionId: 'tx-payment-history',
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'marius@local.invalid',
    };
    state.plannedPayments.push(payment);
    state.transactions.push({
      id: 'tx-payment-history',
      date: '2026-09-06',
      description: 'Historic bill',
      amountPence: 5_00,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: created.account.id,
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      plannedPaymentId: payment.id,
      createdAt: '2026-09-06T00:00:00.000Z',
      createdBy: 'marius@local.invalid',
    });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).canDeletePermanently).toBe(false);
  });

  it('blocks an account with savings/history reference', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Savings link', type: 'savings', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    state.savingsGoals.push({
      id: 'goal-linked-account',
      name: 'Legacy linked savings goal',
      targetPence: 100_00,
      currentPence: 0,
      accountId: created.account.id,
    });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).reasons.join(' '))
      .toMatch(/savings data/i);
  });

  it('blocks an archived account that retains historical financial references', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Archived historic', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    addTransactionReference(state, created.account.id);
    saveLocalHousehold(state);
    state = loadLocalHousehold();
    archiveLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((account) => account.id === created.account.id)?.isActive).toBe(false);
    expect(getAccountPermanentDeleteEligibility(state, created.account.id).canDeletePermanently).toBe(false);
    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version)).toThrow();
  });

  it('uses stable account IDs so duplicate names with different owners cannot cross-delete', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();
    const marius = state.members.find((member) => member.name === 'Marius')!;

    const mariusLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 0, ownerMemberId: marius.id },
      state.version
    );
    state = loadLocalHousehold();
    const vestaLloyds = createLocalAccount(
      { name: 'Lloyds', type: 'current', startingBalancePence: 0, ownerMemberId: vesta.member.id },
      state.version
    );
    state = loadLocalHousehold();

    permanentlyDeleteLocalAccount(vestaLloyds.account.id, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.some((account) => account.id === vestaLloyds.account.id)).toBe(false);
    expect(state.accounts.some((account) => account.id === mariusLloyds.account.id)).toBe(true);
    expect(state.accounts.find((account) => account.id === mariusLloyds.account.id)?.ownerMemberId)
      .toBe(marius.id);
  });

  it('keeps repeated delete attempts idempotently safe with no duplicate mutation or corruption', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Double click guard', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();

    permanentlyDeleteLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    const versionAfterDelete = state.version;
    const accountCountAfterDelete = state.accounts.length;

    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version))
      .toThrow(/Account not found/);

    state = loadLocalHousehold();
    expect(state.version).toBe(versionAfterDelete);
    expect(state.accounts.length).toBe(accountCountAfterDelete);
  });

  it('re-checks current state and blocks deletion when a reference appears after initial eligibility', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Stale UI account', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();

    const initialEligibility = getAccountPermanentDeleteEligibility(state, created.account.id);
    expect(initialEligibility.canDeletePermanently).toBe(true);

    createLocalPlannedPayment(
      {
        name: 'Reference added after UI render',
        amountPence: 1_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: created.account.id,
        includeInTransferPlan: false,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version))
      .toThrow(/cannot be permanently deleted/i);
    expect(loadLocalHousehold().accounts.some((account) => account.id === created.account.id)).toBe(true);
  });

  it('keeps backup/export referential integrity valid after a safe permanent deletion', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Export-safe delete', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();

    permanentlyDeleteLocalAccount(created.account.id, state.version);
    const backup = createLocalBackupPackage();

    expect(backup.state.accounts.some((account: { id: string }) => account.id === created.account.id))
      .toBe(false);
    expect(preflightLocalRestore(backup).valid).toBe(true);
    expect(JSON.stringify(backup.state.transactions)).not.toContain(created.account.id);
    expect(JSON.stringify(backup.state.plannedPayments)).not.toContain(created.account.id);
    expect(JSON.stringify(backup.state.plannedIncomes || [])).not.toContain(created.account.id);
    expect(JSON.stringify(backup.state.savingsGoals)).not.toContain(created.account.id);
    expect(JSON.stringify(backup.state.auditLogs)).not.toContain(created.account.id);
  });

  it('blocks deletion when retained audit history references the account after an undo', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Undo-audited account', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    state.auditLogs.unshift({
      id: 'audit-funding-undo',
      timestamp: '2026-09-06T13:00:00.000Z',
      actorEmail: 'marius@local.invalid',
      action: 'transfer_plan_funding_undone',
      entityType: 'account',
      entityId: created.account.id,
      summary: 'Undid Transfer Plan funding',
    });
    saveLocalHousehold(state);
    state = loadLocalHousehold();

    expect(getAccountPermanentDeleteEligibility(state, created.account.id).reasons.join(' '))
      .toMatch(/retained audit history/i);
    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version)).toThrow();
  });

  it('archives without deleting the account record or its history', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Archive only', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    archiveLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();

    const archived = state.accounts.find((account) => account.id === created.account.id);
    expect(archived).toBeDefined();
    expect(archived?.isActive).toBe(false);
  });

  it('does not mutate raw storage when a blocked delete is attempted', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount(
      { name: 'Storage integrity', type: 'current', startingBalancePence: 0, ownerMemberId: state.members[0].id },
      state.version
    );
    state = loadLocalHousehold();
    createLocalPlannedPayment(
      {
        name: 'Protected bill',
        amountPence: 2_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: created.account.id,
        includeInTransferPlan: false,
      },
      state.version
    );
    state = loadLocalHousehold();
    const before = storage.getItem(LOCAL_STORAGE_KEY);

    expect(() => permanentlyDeleteLocalAccount(created.account.id, state.version)).toThrow();
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBe(before);
  });
});
