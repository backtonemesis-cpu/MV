import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_KEY,
  SOURCE_IMPORT_BACKUP_STORAGE_KEY,
  LEGACY_SOURCE_SEED_MIGRATION_ID,
  createBlankLocalHousehold,
  saveLocalHousehold,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalSavingsGoal,
  contributeLocalSavingsGoal,
  createLocalHouseholdMember,
  createLocalPlannedIncome,
  createLocalPlannedPayment,
  createLocalTransaction,
  updateLocalTransaction,
  deleteLocalTransaction,
  bulkToggleLocalPlannedPayments,
  executeLocalTransfer,
  executeLocalTransferAllocations,
  undoLatestLocalTransferPlanFunding,
  undoLocalTransferTransaction,
  undoLocalPaymentPaid,
  importLocalMonth,
  loadLocalHousehold,
  markLocalIncomeReceived,
  markLocalPaymentPaid,
  preflightLocalRestore,
  resetLocalHousehold,
  restoreLocalBackup,
  reconcileLocalAccount,
  updateLocalAccount,
  updateLocalHouseholdMember,
  updateLocalPlannedIncome,
  updateLocalPlannedPayment,
  changeLocalHouseholdMemberRole,
  removeLocalHouseholdMember,
} from './localStore';
import { generateTransferPlan } from './utils/transferPlan';
import { calculateFinancialSummary } from './utils/currency';
import { getLatestTransferPlanFundingByDestination } from './utils/transferPlanFunding';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function installSyntheticFixture(): void {
  const state = createBlankLocalHousehold();
  state.schemaStatus!.appliedMigrations = [
    {
      version: 1,
      name: LEGACY_SOURCE_SEED_MIGRATION_ID,
      appliedAt: '2026-09-01T00:00:00.000Z',
      executionTimeMs: 0,
      checksum: 'synthetic-test-fixture',
    },
  ];
  state.accounts = [
    {
      id: 'test-account-lloyds',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 1000_00,
      currentBalancePence: 1000_00,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
    {
      id: 'test-account-chase',
      name: 'Chase',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 20000_00,
      currentBalancePence: 20000_00,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
    {
      id: 'test-account-santander',
      name: 'Santander',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 4000_00,
      currentBalancePence: 4000_00,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
  ];
  state.plannedPayments = [
    {
      id: 'test-payment-recurring',
      name: 'Synthetic recurring bill',
      amountPence: 100_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'test-account-santander',
      dueDate: '2026-09-28',
      categoryId: 'cat-housing',
      status: 'unpaid',
      includeInTransferPlan: true,
      isRecurring: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    },
  ];
  state.plannedIncomes = [
    {
      id: 'test-income-recurring',
      name: 'Synthetic wage',
      expectedAmountPence: 500_00,
      month: '2026-09',
      sourcePerson: 'Marius',
      accountId: 'test-account-lloyds',
      categoryId: 'cat-salary',
      expectedDate: '2026-09-30',
      status: 'expected',
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    },
  ];
  saveLocalHousehold(state);
}

describe('Penny-style local MV storage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    installSyntheticFixture();
  });

  it('starts a brand-new browser with a blank local household and no embedded finance fixture', () => {
    storage.clear();
    const state = loadLocalHousehold();

    expect(state.version).toBe(1);
    expect(state.members).toEqual([
      expect.objectContaining({
        name: 'Marius',
        email: 'marius@local.invalid',
        role: 'owner',
      }),
    ]);
    expect(state.accounts).toHaveLength(0);
    expect(state.transactions).toHaveLength(0);
    expect(state.plannedPayments).toHaveLength(0);
    expect(state.plannedIncomes).toHaveLength(0);
    expect(state.categories.map((item) => item.id)).toEqual(
      expect.arrayContaining(['cat-housing', 'cat-salary', 'cat-transfer'])
    );
    expect(
      state.schemaStatus?.appliedMigrations.some(
        (migration) => migration.name === LEGACY_SOURCE_SEED_MIGRATION_ID
      )
    ).toBe(true);
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBeTruthy();
  });

  it('prepares the next month with bills and expected income while keeping people and accounts persistent', () => {
    let state = loadLocalHousehold();

    const sourcePayments = state.plannedPayments.filter((payment) => payment.month === '2026-09');
    const sourceIncomes = (state.plannedIncomes || []).filter((income) => income.month === '2026-09');
    const accountIdsBefore = state.accounts.map((account) => account.id);
    const memberIdsBefore = state.members.map((member) => member.id);

    const prepared = importLocalMonth(
      {
        sourceMonth: '2026-09',
        targetMonth: '2026-10',
        paymentIds: sourcePayments.map((payment) => payment.id),
        incomeIds: sourceIncomes.map((income) => income.id),
      },
      state.version
    );

    expect(prepared.importedPayments).toBe(sourcePayments.length);
    expect(prepared.importedIncomes).toBe(sourceIncomes.length);
    expect(prepared.imported).toBe(sourcePayments.length + sourceIncomes.length);

    state = loadLocalHousehold();

    expect(state.accounts.map((account) => account.id)).toEqual(accountIdsBefore);
    expect(state.members.map((member) => member.id)).toEqual(memberIdsBefore);

    const targetPayments = state.plannedPayments.filter((payment) => payment.month === '2026-10');
    const targetIncomes = (state.plannedIncomes || []).filter((income) => income.month === '2026-10');

    expect(targetPayments).toHaveLength(sourcePayments.length);
    expect(targetIncomes).toHaveLength(sourceIncomes.length);

    targetPayments.forEach((payment) => {
      const sourceId = String(payment.metadata?.copiedFromId || '');
      const source = sourcePayments.find((candidate) => candidate.id === sourceId);
      expect(source).toBeTruthy();
      expect(payment.status).toBe('unpaid');
      expect(payment.actualAmountPence).toBeUndefined();
      expect(payment.actualDate).toBeUndefined();
      expect(payment.actualTransactionId).toBeUndefined();
      expect(payment.accountId).toBe(source?.accountId);
      expect(payment.responsiblePerson).toBe(source?.responsiblePerson);
      expect(payment.amountPence).toBe(source?.amountPence);
      expect(payment.isRecurring).toBe(source?.isRecurring);
    });

    targetIncomes.forEach((income) => {
      const sourceId = String(income.metadata?.copiedFromId || '');
      const source = sourceIncomes.find((candidate) => candidate.id === sourceId);
      expect(source).toBeTruthy();
      expect(income.status).toBe('expected');
      expect(income.actualAmountPence).toBeUndefined();
      expect(income.actualDate).toBeUndefined();
      expect(income.actualTransactionId).toBeUndefined();
      expect(income.linkedTransactionId).toBeUndefined();
      expect(income.receivedDate).toBeUndefined();
      expect(income.accountId).toBe(source?.accountId);
      expect(income.sourcePerson).toBe(source?.sourcePerson);
      expect(income.expectedAmountPence).toBe(source?.expectedAmountPence);
    });

    const duplicateAttempt = importLocalMonth(
      {
        sourceMonth: '2026-09',
        targetMonth: '2026-10',
        paymentIds: sourcePayments.map((payment) => payment.id),
        incomeIds: sourceIncomes.map((income) => income.id),
      },
      state.version
    );

    expect(duplicateAttempt.imported).toBe(0);
  });

  it('preserves explicit recurring intent while keeping irregular bills opt-in only', () => {
    let state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Rollover Test Current',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const recurring = createLocalPlannedPayment(
      {
        name: 'Recurring Rent',
        amountPence: 900_00,
        month: '2026-11',
        accountId: account.account.id,
        responsiblePerson: 'Marius',
        categoryId: 'cat-housing',
        status: 'unpaid',
        includeInTransferPlan: true,
        isRecurring: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    const irregular = createLocalPlannedPayment(
      {
        name: 'One-off Repair',
        amountPence: 75_00,
        month: '2026-11',
        accountId: account.account.id,
        responsiblePerson: 'Marius',
        categoryId: 'cat-housing',
        status: 'unpaid',
        includeInTransferPlan: true,
        isRecurring: false,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(recurring.payment.isRecurring).toBe(true);
    expect(irregular.payment.isRecurring).toBe(false);

    importLocalMonth(
      {
        sourceMonth: '2026-11',
        targetMonth: '2026-12',
        paymentIds: [recurring.payment.id],
        incomeIds: [],
      },
      state.version
    );

    state = loadLocalHousehold();
    const december = state.plannedPayments.filter((payment) => payment.month === '2026-12');
    expect(december).toHaveLength(1);
    expect(december[0]).toEqual(
      expect.objectContaining({
        name: 'Recurring Rent',
        isRecurring: true,
        status: 'unpaid',
      })
    );
  });

  it('persists exact-pence movements and recalculates local account balances', () => {
    let state = loadLocalHousehold();

    const main = createLocalAccount(
      {
        name: 'Main',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const savings = createLocalAccount(
      {
        name: 'Savings',
        type: 'savings',
        startingBalancePence: 50_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Salary',
        amountPence: 200_00,
        type: 'income',
        categoryId: 'cat-salary',
        accountId: main.account.id,
        payer: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Groceries',
        amountPence: 25_50,
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: main.account.id,
        payer: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Refund',
        amountPence: 5_50,
        type: 'refund',
        categoryId: 'cat-groceries',
        accountId: main.account.id,
        payer: 'Marius',
        isRefund: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransfer(
      {
        sourceAccountId: main.account.id,
        destinationAccountId: savings.account.id,
        amountPence: 20_00,
        description: 'Move to savings',
        payer: 'Marius',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.accounts.find((item) => item.id === main.account.id)?.currentBalancePence).toBe(
      260_00
    );
    expect(
      state.accounts.find((item) => item.id === savings.account.id)?.currentBalancePence
    ).toBe(70_00);
    expect(state.transactions.every((tx) => Number.isSafeInteger(tx.amountPence))).toBe(true);
  });

  it('reconciles a stale £1000 duplicate-style current account to exactly £0', () => {
    let state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Vesta Current Test',
        type: 'current',
        startingBalancePence: 1000_00,
        ownerPerson: 'Vesta',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === account.account.id)?.currentBalancePence
    ).toBe(1000_00);

    reconcileLocalAccount(
      account.account.id,
      0,
      '2026-09-04',
      state.version
    );

    state = loadLocalHousehold();
    const reconciled = state.accounts.find((item) => item.id === account.account.id);
    expect(reconciled?.reconciledBalancePence).toBe(0);
    expect(reconciled?.reconciliationDate).toBe('2026-09-04');
    expect(reconciled?.currentBalancePence).toBe(0);
  });

  it('allows an account to be reconciled to exactly zero and ignores future-dated activity in the current balance', () => {
    let state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Zero Balance Test',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Past debit',
        amountPence: 12_34,
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: account.account.id,
        payer: 'Vesta',
        date: '2026-09-01',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Future wage',
        amountPence: 1000_00,
        type: 'income',
        categoryId: 'cat-salary',
        accountId: account.account.id,
        payer: 'Vesta',
        date: '2099-09-11',
      },
      state.version
    );
    state = loadLocalHousehold();

    // Future activity must not inflate what Accounts reports as the balance now.
    expect(
      state.accounts.find((item) => item.id === account.account.id)?.currentBalancePence
    ).toBe(-12_34);

    reconcileLocalAccount(
      account.account.id,
      0,
      '2026-09-04',
      state.version
    );

    state = loadLocalHousehold();
    const reconciled = state.accounts.find((item) => item.id === account.account.id);
    expect(reconciled?.reconciledBalancePence).toBe(0);
    expect(reconciled?.currentBalancePence).toBe(0);
  });

  it('records multi-source Transfer Plan funding atomically and reconciles every account by ID', () => {
    let state = loadLocalHousehold();

    const sourceA = createLocalAccount(
      {
        name: 'Funding A',
        type: 'savings',
        startingBalancePence: 80_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const sourceB = createLocalAccount(
      {
        name: 'Funding B',
        type: 'current',
        startingBalancePence: 70_00,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Bills Account',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const beforeVersion = state.version;
    const result = executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 100_00,
        allocations: [
          { sourceAccountId: sourceA.account.id, amountPence: 60_00 },
          { sourceAccountId: sourceB.account.id, amountPence: 40_00 },
        ],
        description: 'Fund bills',
        date: '2026-09-04',
      },
      beforeVersion
    );

    expect(result.version).toBe(beforeVersion + 1);
    expect(result.transactions).toHaveLength(2);

    state = loadLocalHousehold();
    expect(state.accounts.find((item) => item.id === sourceA.account.id)?.currentBalancePence).toBe(20_00);
    expect(state.accounts.find((item) => item.id === sourceB.account.id)?.currentBalancePence).toBe(30_00);
    expect(state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence).toBe(100_00);

    const batchTransfers = state.transactions.filter(
      (transaction) =>
        transaction.targetAccountId === destination.account.id &&
        transaction.description === 'Fund bills'
    );
    expect(batchTransfers).toHaveLength(2);
    expect(new Set(batchTransfers.map((transaction) => transaction.metadata?.transferBatchId)).size).toBe(1);
    expect(
      batchTransfers.map((transaction) => [transaction.accountId, transaction.payer])
    ).toEqual(
      expect.arrayContaining([
        [sourceA.account.id, 'Marius'],
        [sourceB.account.id, 'Vesta'],
      ])
    );
  });

  it('undoes a legacy untagged incoming transfer used to fund a covered account', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Legacy Funding Source',
        type: 'savings',
        startingBalancePence: 200_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Legacy Vesta Current',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    // Simulates an older untagged funding transfer created before transferBatchId existed.
    executeLocalTransfer(
      {
        description: 'Fund Vesta current',
        amountPence: 100_00,
        sourceAccountId: source.account.id,
        destinationAccountId: destination.account.id,
        payer: 'Marius',
        date: '2026-09-04',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence
    ).toBe(100_00);

    undoLatestLocalTransferPlanFunding(destination.account.id, state.version);

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence
    ).toBe(0);
    expect(
      state.accounts.find((item) => item.id === source.account.id)?.currentBalancePence
    ).toBe(200_00);
  });

  it('recovers a traceable Transfer Plan funding batch lost by a source-data migration', () => {
    let state = loadLocalHousehold();
    const pristineRaw = storage.getItem(LOCAL_STORAGE_KEY)!;
    const santander = state.accounts.find(
      (account) => account.name === 'Santander' && account.ownerPerson === 'Marius'
    )!;
    const chase = state.accounts.find(
      (account) => account.name === 'Chase' && account.ownerPerson === 'Marius'
    )!;

    createLocalPlannedPayment(
      {
        name: 'Recovery Test Bill',
        amountPence: 4_500_00,
        month: '2026-09',
        accountId: santander.id,
        responsiblePerson: 'Marius',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: santander.id,
        expectedTotalPence: 600_00,
        allocations: [{ sourceAccountId: chase.id, amountPence: 600_00 }],
        description: 'Transfer Plan: recovery test',
        date: '2026-09-05',
        month: '2026-09',
      },
      state.version
    );
    state = loadLocalHousehold();
    const fundedRaw = storage.getItem(LOCAL_STORAGE_KEY)!;
    const fundedChaseBalance = state.accounts.find(
      (account) => account.id === chase.id
    )!.currentBalancePence;

    storage.setItem(LOCAL_STORAGE_KEY, pristineRaw);
    storage.setItem(SOURCE_IMPORT_BACKUP_STORAGE_KEY, fundedRaw);

    state = loadLocalHousehold();
    const recovered = state.transactions.filter(
      (transaction) => transaction.metadata?.recoveredFromSourceImportBackup === true
    );
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toEqual(
      expect.objectContaining({
        accountId: chase.id,
        targetAccountId: santander.id,
        amountPence: 600_00,
      })
    );
    expect(
      state.accounts.find((account) => account.id === santander.id)?.currentBalancePence
    ).toBe(4_600_00);
    expect(
      state.accounts.find((account) => account.id === chase.id)?.currentBalancePence
    ).toBe(fundedChaseBalance);

    undoLatestLocalTransferPlanFunding(santander.id, state.version, '2026-09');
    state = loadLocalHousehold();
    expect(
      state.accounts.find((account) => account.id === santander.id)?.currentBalancePence
    ).toBe(4_000_00);
    expect(
      state.accounts.find((account) => account.id === chase.id)?.currentBalancePence
    ).toBe(20_000_00);
  });

  it('prevents Transfer Plan funding from draining a source account below its own selected bills', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Reserved Source Current',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Reserved Destination Current',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedPayment(
      {
        name: 'Source account bill',
        amountPence: 80_00,
        month: '2026-10',
        accountId: source.account.id,
        responsiblePerson: 'Marius',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedPayment(
      {
        name: 'Destination bill',
        amountPence: 50_00,
        month: '2026-10',
        accountId: destination.account.id,
        responsiblePerson: 'Vesta',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      executeLocalTransferAllocations(
        {
          destinationAccountId: destination.account.id,
          expectedTotalPence: 50_00,
          allocations: [
            { sourceAccountId: source.account.id, amountPence: 50_00 },
          ],
          description: 'Transfer Plan: unsafe source test',
          date: '2026-09-05',
          month: '2026-10',
        },
        state.version
      )
    ).toThrow('safe to move after its own selected unpaid bills');

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === source.account.id)
        ?.currentBalancePence
    ).toBe(100_00);
    expect(
      state.accounts.find((item) => item.id === destination.account.id)
        ?.currentBalancePence
    ).toBe(0);
  });

  it('does not let Transfer Plan Undo reverse an unrelated incoming transfer', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Ordinary Transfer Source',
        type: 'current',
        startingBalancePence: 150_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Ordinary Transfer Destination',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransfer(
      {
        sourceAccountId: source.account.id,
        destinationAccountId: destination.account.id,
        amountPence: 40_00,
        description: 'Ordinary household transfer',
        date: '2026-09-04',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(() =>
      undoLatestLocalTransferPlanFunding(
        destination.account.id,
        state.version,
        '2026-09'
      )
    ).toThrow('No Transfer Plan funding is available to undo');

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === source.account.id)?.currentBalancePence
    ).toBe(110_00);
    expect(
      state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence
    ).toBe(40_00);
  });

  it('scopes Undo Funding to the selected Transfer Plan month', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Month Scope Source',
        type: 'savings',
        startingBalancePence: 300_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Month Scope Destination',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedPayment(
      {
        name: 'September month-scope bill',
        amountPence: 60_00,
        month: '2026-09',
        responsiblePerson: 'Vesta',
        accountId: destination.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedPayment(
      {
        // After the £60 September funding reaches this account, £130 of
        // October selected bills leaves a genuine £70 October requirement.
        name: 'October month-scope bill',
        amountPence: 130_00,
        month: '2026-10',
        responsiblePerson: 'Vesta',
        accountId: destination.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 60_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 60_00 }],
        description: 'Transfer Plan: Fund September',
        date: '2026-09-04',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 70_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 70_00 }],
        description: 'Transfer Plan: Fund October',
        date: '2026-10-04',
        month: '2026-10',
      },
      state.version
    );

    state = loadLocalHousehold();
    const septemberFunding = state.transactions.find(
      (transaction) => transaction.description === 'Transfer Plan: Fund September'
    );
    const octoberFunding = state.transactions.find(
      (transaction) => transaction.description === 'Transfer Plan: Fund October'
    );
    expect(septemberFunding?.metadata?.transferPlanMonth).toBe('2026-09');
    expect(octoberFunding?.metadata?.transferPlanMonth).toBe('2026-10');

    const beforeUndoVersion = state.version;
    undoLatestLocalTransferPlanFunding(
      destination.account.id,
      beforeUndoVersion,
      '2026-09'
    );

    state = loadLocalHousehold();
    expect(
      state.transactions.some(
        (transaction) => transaction.description === 'Transfer Plan: Fund September'
      )
    ).toBe(false);
    expect(
      state.transactions.some(
        (transaction) => transaction.description === 'Transfer Plan: Fund October'
      )
    ).toBe(true);
    // October's transfer remains in the ledger, but it is future-dated
    // relative to September 5 and therefore must not alter today's balance.
    expect(
      state.accounts.find((item) => item.id === source.account.id)?.currentBalancePence
    ).toBe(300_00);
    expect(
      state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence
    ).toBe(0);
  });

  it('undoes the latest Transfer Plan funding batch and restores source and destination balances', () => {
    let state = loadLocalHousehold();

    const sourceA = createLocalAccount(
      {
        name: 'Undo Source A',
        type: 'savings',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const sourceB = createLocalAccount(
      {
        name: 'Undo Source B',
        type: 'current',
        startingBalancePence: 80_00,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Undo Destination',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 90_00,
        allocations: [
          { sourceAccountId: sourceA.account.id, amountPence: 50_00 },
          { sourceAccountId: sourceB.account.id, amountPence: 40_00 },
        ],
        description: 'Transfer Plan: Fund Undo Destination',
        date: '2026-09-04',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.accounts.find((item) => item.id === sourceA.account.id)?.currentBalancePence).toBe(50_00);
    expect(state.accounts.find((item) => item.id === sourceB.account.id)?.currentBalancePence).toBe(40_00);
    expect(state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence).toBe(90_00);

    const beforeUndoVersion = state.version;
    const undone = undoLatestLocalTransferPlanFunding(
      destination.account.id,
      beforeUndoVersion
    );

    expect(undone.version).toBe(beforeUndoVersion + 1);
    expect(undone.undoneTransactions).toHaveLength(2);

    state = loadLocalHousehold();
    expect(state.accounts.find((item) => item.id === sourceA.account.id)?.currentBalancePence).toBe(100_00);
    expect(state.accounts.find((item) => item.id === sourceB.account.id)?.currentBalancePence).toBe(80_00);
    expect(state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence).toBe(0);
    expect(
      state.transactions.some(
        (transaction) =>
          transaction.targetAccountId === destination.account.id &&
          transaction.description === 'Transfer Plan: Fund Undo Destination'
      )
    ).toBe(false);
  });

  it('keeps funding and paid state independent through fund, pay, undo payment, and undo funding', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Workflow Savings',
        type: 'savings',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Workflow Bills',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Workflow bill',
        amountPence: 40_00,
        month: '2026-09',
        responsiblePerson: 'Vesta',
        accountId: destination.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 40_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 40_00 }],
        description: 'Transfer Plan: workflow state test',
        date: '2026-09-04',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      getLatestTransferPlanFundingByDestination(
        state.transactions,
        '2026-09',
        true
      ).has(destination.account.id)
    ).toBe(true);
    expect(
      state.accounts.find((account) => account.id === source.account.id)
        ?.currentBalancePence
    ).toBe(60_00);
    expect(
      state.accounts.find((account) => account.id === destination.account.id)
        ?.currentBalancePence
    ).toBe(40_00);

    markLocalPaymentPaid(
      bill.payment.id,
      {
        actualAmountPence: 40_00,
        actualDate: '2026-09-04',
        accountId: destination.account.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)?.status
    ).toBe('paid');
    expect(
      state.accounts.find((account) => account.id === destination.account.id)
        ?.currentBalancePence
    ).toBe(0);
    expect(
      getLatestTransferPlanFundingByDestination(
        state.transactions,
        '2026-09',
        true
      ).has(destination.account.id)
    ).toBe(true);

    undoLocalPaymentPaid(bill.payment.id, state.version);
    state = loadLocalHousehold();
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)?.status
    ).toBe('unpaid');
    expect(
      state.accounts.find((account) => account.id === destination.account.id)
        ?.currentBalancePence
    ).toBe(40_00);
    expect(
      getLatestTransferPlanFundingByDestination(
        state.transactions,
        '2026-09',
        true
      ).has(destination.account.id)
    ).toBe(true);

    undoLatestLocalTransferPlanFunding(
      destination.account.id,
      state.version,
      '2026-09'
    );
    state = loadLocalHousehold();

    expect(
      state.accounts.find((account) => account.id === source.account.id)
        ?.currentBalancePence
    ).toBe(100_00);
    expect(
      state.accounts.find((account) => account.id === destination.account.id)
        ?.currentBalancePence
    ).toBe(0);
    expect(
      getLatestTransferPlanFundingByDestination(
        state.transactions,
        '2026-09',
        true
      ).has(destination.account.id)
    ).toBe(false);

    const plan = generateTransferPlan(
      state.accounts,
      state.plannedPayments,
      '2026-09',
      state.transactions
    );
    expect(
      plan.accountsNeedingFunding.find(
        (requirement) => requirement.account.id === destination.account.id
      )?.transferRequiredPence
    ).toBe(40_00);
  });

  it('completed Transfer Plan funding clears the requirement even with future reconciliation anchors', () => {
    let state = loadLocalHousehold();

    const source = createLocalAccount(
      {
        name: 'Future Snapshot Source',
        type: 'savings',
        startingBalancePence: 100_00,
        currentBalancePence: 100_00,
        ownerPerson: 'Marius',
        reconciliationDate: '2026-09-30',
        reconciledBalancePence: 100_00,
      },
      state.version
    );
    state = loadLocalHousehold();

    const destination = createLocalAccount(
      {
        name: 'Future Snapshot Bills',
        type: 'current',
        startingBalancePence: 0,
        currentBalancePence: 0,
        ownerPerson: 'Vesta',
        reconciliationDate: '2026-09-30',
        reconciledBalancePence: 0,
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedPayment(
      {
        name: 'Fund me once',
        amountPence: 50_00,
        month: '2026-09',
        responsiblePerson: 'Vesta',
        accountId: destination.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    const beforePlan = generateTransferPlan(
      state.accounts,
      state.plannedPayments,
      '2026-09'
    );
    expect(
      beforePlan.accountsNeedingFunding.find(
        (item) => item.account.id === destination.account.id
      )?.transferRequiredPence
    ).toBe(50_00);

    executeLocalTransferAllocations(
      {
        destinationAccountId: destination.account.id,
        expectedTotalPence: 50_00,
        allocations: [{ sourceAccountId: source.account.id, amountPence: 50_00 }],
        description: 'Fund September bills',
        date: '2026-09-04',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.accounts.find((item) => item.id === source.account.id)?.currentBalancePence
    ).toBe(50_00);
    expect(
      state.accounts.find((item) => item.id === destination.account.id)?.currentBalancePence
    ).toBe(50_00);

    const afterPlan = generateTransferPlan(
      state.accounts,
      state.plannedPayments,
      '2026-09'
    );
    expect(
      afterPlan.accountsNeedingFunding.some(
        (item) => item.account.id === destination.account.id
      )
    ).toBe(false);
    expect(
      afterPlan.accountsFullyFunded.some(
        (item) => item.account.id === destination.account.id
      )
    ).toBe(true);
  });

  it('persists financial household members, renames finance references, and supports removal', () => {
    let state = loadLocalHousehold();

    const created = createLocalHouseholdMember(
      {
        name: 'Alex',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.members.find((member) => member.id === created.member.id)).toEqual(
      expect.objectContaining({
        name: 'Alex',
        role: 'editor',
      })
    );

    const account = createLocalAccount(
      {
        name: 'Alex Current',
        type: 'current',
        startingBalancePence: 10000,
        ownerPerson: 'Alex',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Alex test',
        amountPence: 1000,
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: account.account.id,
        payer: 'Alex',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalPlannedIncome(
      {
        name: 'Alex wage',
        expectedAmountPence: 50000,
        month: '2026-10',
        sourcePerson: 'Alex',
        accountId: account.account.id,
        categoryId: 'cat-salary',
        status: 'expected',
      },
      state.version
    );
    state = loadLocalHousehold();

    updateLocalHouseholdMember(created.member.id, { name: 'Alex M' }, state.version);
    state = loadLocalHousehold();

    expect(state.accounts.find((item) => item.id === account.account.id)?.ownerPerson).toBe('Alex M');
    expect(state.transactions.find((item) => item.description === 'Alex test')?.payer).toBe('Alex M');
    expect(state.plannedIncomes?.find((item) => item.name === 'Alex wage')?.sourcePerson).toBe('Alex M');

    removeLocalHouseholdMember(created.member.id, state.version);
    state = loadLocalHousehold();
    expect(state.members.find((member) => member.id === created.member.id)?.role).toBe('removed');
    expect(state.accounts.find((item) => item.id === account.account.id)?.ownerPerson).toBe('Alex M');
    expect(state.members.filter((member) => member.role === 'owner')).toHaveLength(1);
  });

  it('keeps same-name accounts isolated by stable owner identity without source fixtures', () => {
    let state = loadLocalHousehold();
    const primary = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Marius'
    );
    expect(primary).toBeTruthy();

    const secondMember = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    const second = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 200_00,
        ownerMemberId: secondMember.member.id,
      },
      state.version
    ).account;

    expect(primary!.id).not.toBe(second.id);
    expect(primary!.ownerMemberId).toBe('local-marius');
    expect(second.ownerMemberId).toBe(secondMember.member.id);
  });

  it('repairs manually-created same-name bills to the matching household owner account', () => {
    let state = loadLocalHousehold();
    const mariusLloyds = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Marius'
    )!;
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();
    const vestaLloyds = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 0,
        ownerMemberId: vesta.member.id,
      },
      state.version
    ).account;
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Vesta test bill',
        amountPence: 1234,
        month: '2026-10',
        responsiblePerson: 'Vesta',
        accountId: mariusLloyds.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)?.accountId
    ).toBe(vestaLloyds.id);
  });

  it('selects paid and unpaid bills independently using linked actual payment evidence', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.name === 'Lloyds');
    expect(account).toBeTruthy();

    const unpaid = createLocalPlannedPayment(
      {
        name: 'October unpaid',
        amountPence: 1000,
        month: '2026-10',
        responsiblePerson: 'Marius',
        accountId: account!.id,
        status: 'unpaid',
        includeInTransferPlan: false,
      },
      state.version
    );
    state = loadLocalHousehold();

    const paidDraft = createLocalPlannedPayment(
      {
        name: 'October paid',
        amountPence: 2000,
        month: '2026-10',
        responsiblePerson: 'Marius',
        accountId: account!.id,
        status: 'unpaid',
        includeInTransferPlan: false,
      },
      state.version
    );
    state = loadLocalHousehold();

    markLocalPaymentPaid(
      paidDraft.payment.id,
      {
        actualAmountPence: 2000,
        actualDate: '2026-10-04',
        accountId: account!.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    bulkToggleLocalPlannedPayments(
      { month: '2026-10', include: true, status: 'unpaid' },
      state.version
    );
    state = loadLocalHousehold();
    expect(state.plannedPayments.find((item) => item.id === unpaid.payment.id)?.includeInTransferPlan).toBe(true);
    expect(state.plannedPayments.find((item) => item.id === paidDraft.payment.id)?.includeInTransferPlan).toBe(false);

    bulkToggleLocalPlannedPayments(
      { month: '2026-10', include: true, status: 'paid' },
      state.version
    );
    state = loadLocalHousehold();
    expect(state.plannedPayments.find((item) => item.id === paidDraft.payment.id)?.includeInTransferPlan).toBe(true);
    expect(state.plannedPayments.find((item) => item.id === unpaid.payment.id)?.includeInTransferPlan).toBe(false);

    expect(() =>
      updateLocalPlannedPayment(
        paidDraft.payment.id,
        { status: 'unpaid' },
        state.version
      )
    ).toThrow('A bill with a linked actual expense transaction cannot be marked unpaid.');
  });

  it('records and safely undoes a paid bill without double-counting or crossing same-name accounts', () => {
    let state = loadLocalHousehold();

    const mariusAccount = createLocalAccount(
      {
        name: 'Shared Bank',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const vestaAccount = createLocalAccount(
      {
        name: 'Shared Bank',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Vesta',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Vesta payment undo test',
        amountPence: 25_00,
        month: '2026-09',
        responsiblePerson: 'Vesta',
        accountId: vestaAccount.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    const firstPaid = markLocalPaymentPaid(
      bill.payment.id,
      {
        actualAmountPence: 25_00,
        actualDate: '2026-09-04',
        accountId: vestaAccount.account.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.accounts.find((account) => account.id === mariusAccount.account.id)
        ?.currentBalancePence
    ).toBe(100_00);
    expect(
      state.accounts.find((account) => account.id === vestaAccount.account.id)
        ?.currentBalancePence
    ).toBe(75_00);
    expect(
      state.transactions.filter(
        (transaction) => transaction.plannedPaymentId === bill.payment.id
      )
    ).toHaveLength(1);
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)
    ).toEqual(
      expect.objectContaining({
        status: 'paid',
        actualTransactionId: firstPaid.transaction.id,
      })
    );

    const undone = undoLocalPaymentPaid(bill.payment.id, state.version);
    expect(undone.transaction.id).toBe(firstPaid.transaction.id);

    state = loadLocalHousehold();
    expect(
      state.accounts.find((account) => account.id === mariusAccount.account.id)
        ?.currentBalancePence
    ).toBe(100_00);
    expect(
      state.accounts.find((account) => account.id === vestaAccount.account.id)
        ?.currentBalancePence
    ).toBe(100_00);
    expect(
      state.transactions.some(
        (transaction) => transaction.id === firstPaid.transaction.id
      )
    ).toBe(false);
    const resetPayment = state.plannedPayments.find(
      (payment) => payment.id === bill.payment.id
    );
    expect(resetPayment?.status).toBe('unpaid');
    expect(resetPayment).not.toHaveProperty('actualTransactionId');
    expect(resetPayment).not.toHaveProperty('actualAmountPence');
    expect(resetPayment).not.toHaveProperty('actualDate');

    markLocalPaymentPaid(
      bill.payment.id,
      {
        actualAmountPence: 25_00,
        actualDate: '2026-09-04',
        accountId: vestaAccount.account.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.transactions.filter(
        (transaction) => transaction.plannedPaymentId === bill.payment.id
      )
    ).toHaveLength(1);
    expect(
      state.accounts.find((account) => account.id === vestaAccount.account.id)
        ?.currentBalancePence
    ).toBe(75_00);
  });

  it('refuses to invent payment undo when there is no linked actual expense', () => {
    let state = loadLocalHousehold();
    const account = createLocalAccount(
      {
        name: 'No Evidence Current',
        type: 'current',
        startingBalancePence: 50_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'No evidence bill',
        amountPence: 10_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: account.account.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      undoLocalPaymentPaid(bill.payment.id, state.version)
    ).toThrow('no linked actual payment transaction to undo');

    state = loadLocalHousehold();
    expect(
      state.accounts.find((candidate) => candidate.id === account.account.id)
        ?.currentBalancePence
    ).toBe(50_00);
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)?.status
    ).toBe('unpaid');
  });

  it('keeps partial income open until cumulative Activity receipts satisfy the expectation', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.id === 'test-account-lloyds')!;

    const created = createLocalPlannedIncome(
      {
        name: 'Synthetic wage',
        expectedAmountPence: 1000_00,
        month: '2026-10',
        sourcePerson: 'Marius',
        accountId: account.id,
        categoryId: 'cat-salary',
        expectedDate: '2026-10-01',
        status: 'expected',
      },
      state.version
    );

    state = loadLocalHousehold();
    const first = markLocalIncomeReceived(
      created.income.id,
      {
        actualAmountPence: 400_00,
        actualDate: '2026-10-02',
        accountId: account.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)).toEqual(
      expect.objectContaining({
        status: 'partial',
        actualAmountPence: 400_00,
      })
    );

    const second = markLocalIncomeReceived(
      created.income.id,
      {
        actualAmountPence: 350_00,
        actualDate: '2026-10-05',
        accountId: account.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)).toEqual(
      expect.objectContaining({
        status: 'partial',
        actualAmountPence: 750_00,
        actualTransactionId: second.transaction.id,
      })
    );
    expect(
      state.transactions.filter((tx) => tx.plannedIncomeId === created.income.id)
    ).toHaveLength(2);

    updateLocalTransaction(
      first.transaction.id,
      { amountPence: 450_00 },
      state.version
    );
    state = loadLocalHousehold();
    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)?.actualAmountPence)
      .toBe(800_00);

    const finalReceipt = markLocalIncomeReceived(
      created.income.id,
      {
        actualAmountPence: 200_00,
        actualDate: '2026-10-10',
        accountId: account.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)).toEqual(
      expect.objectContaining({
        status: 'received',
        actualAmountPence: 1000_00,
        actualTransactionId: finalReceipt.transaction.id,
      })
    );

    expect(() =>
      markLocalIncomeReceived(
        created.income.id,
        {
          actualAmountPence: 1_00,
          actualDate: '2026-10-11',
          accountId: account.id,
        },
        state.version
      )
    ).toThrow('Planned income is already fully received');

    deleteLocalTransaction(second.transaction.id, state.version);
    state = loadLocalHousehold();
    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)).toEqual(
      expect.objectContaining({
        status: 'partial',
        actualAmountPence: 650_00,
      })
    );
    expect(
      state.transactions.filter((tx) => tx.plannedIncomeId === created.income.id)
    ).toHaveLength(2);
  });

  it('keeps planned income edits separate from actual Activity evidence', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.id === 'test-account-lloyds')!;

    const created = createLocalPlannedIncome(
      {
        name: 'Original wage plan',
        expectedAmountPence: 500_00,
        month: '2026-10',
        sourcePerson: 'Marius',
        accountId: account.id,
        categoryId: 'cat-salary',
        status: 'expected',
      },
      state.version
    );
    state = loadLocalHousehold();

    const receipt = markLocalIncomeReceived(
      created.income.id,
      {
        actualAmountPence: 200_00,
        actualDate: '2026-10-03',
        accountId: account.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    updateLocalPlannedIncome(
      created.income.id,
      {
        name: 'Corrected expected wage',
        expectedAmountPence: 600_00,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(state.plannedIncomes?.find((item) => item.id === created.income.id)).toEqual(
      expect.objectContaining({
        name: 'Corrected expected wage',
        expectedAmountPence: 600_00,
        actualAmountPence: 200_00,
        status: 'partial',
      })
    );
    expect(state.transactions.find((tx) => tx.id === receipt.transaction.id)).toEqual(
      expect.objectContaining({
        description: 'Original wage plan',
        amountPence: 200_00,
        date: '2026-10-03',
      })
    );

    expect(() =>
      updateLocalPlannedIncome(
        created.income.id,
        { actualAmountPence: 250_00 },
        state.version
      )
    ).toThrow('Actual income evidence cannot be edited from the planned-income form');
  });

  it('fails stale local writes instead of silently overwriting another tab', () => {
    const state = loadLocalHousehold();

    createLocalAccount(
      {
        name: 'Main',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Marius',
      },
      state.version
    );

    expect(() =>
      createLocalAccount(
        {
          name: 'Stale',
          type: 'current',
          startingBalancePence: 0,
          ownerPerson: 'Marius',
        },
        state.version
      )
    ).toThrow('Concurrent modification conflict');
  });

  it('validates backup packages and restores them with a new local version', () => {
    let state = loadLocalHousehold();
    createLocalAccount(
      {
        name: 'Main',
        type: 'current',
        startingBalancePence: 123_45,
        ownerPerson: 'Marius',
      },
      state.version
    );

    const backup = createLocalBackupPackage();
    const preflight = preflightLocalRestore(backup);
    expect(preflight.valid).toBe(true);
    expect(preflight.counts.accounts).toBe(4);

    state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(0);

    restoreLocalBackup(backup, state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(4);
    expect(state.accounts.find((account) => account.name === 'Main')?.startingBalancePence).toBe(123_45);
    expect(state.members.map((member) => member.name)).toEqual(
      expect.arrayContaining(['Marius'])
    );
    expect(state.members[0].email).toBe('marius@local.invalid');
    expect(state.auditLogs.map((entry) => entry.action)).toContain('database_restored');
  });

  it('rejects omitted creation choices instead of inventing financial facts', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.isActive !== false);
    expect(account).toBeTruthy();

    expect(() =>
      createLocalAccount(
        {
          name: 'No Type',
          startingBalancePence: 0,
          ownerPerson: 'Marius',
        },
        state.version
      )
    ).toThrow('Account type is required');

    expect(() =>
      createLocalTransaction(
        {
          description: 'No Type Transaction',
          amountPence: 10_00,
          categoryId: 'cat-groceries',
          accountId: account!.id,
          payer: 'Marius',
        },
        state.version
      )
    ).toThrow('Transaction type is required');

    expect(() =>
      createLocalPlannedPayment(
        {
          name: 'No Person Bill',
          amountPence: 10_00,
          month: '2026-10',
          accountId: account!.id,
        },
        state.version
      )
    ).toThrow('Responsible person is required');

    expect(() =>
      createLocalPlannedIncome(
        {
          name: 'No Person Income',
          expectedAmountPence: 10_00,
          month: '2026-10',
          accountId: account!.id,
        },
        state.version
      )
    ).toThrow('Income person is required');

    const created = createLocalPlannedPayment(
      {
        name: 'Explicit Person, No Plan Choice',
        amountPence: 10_00,
        month: '2026-10',
        accountId: account!.id,
        responsiblePerson: 'Marius',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.plannedPayments.find((item) => item.id === created.payment.id)
        ?.includeInTransferPlan
    ).toBe(false);
  });

  it('rejects direct transfer creation so transfer balance logic cannot be bypassed', () => {
    const state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const destination = state.accounts.find((account) => account.id === 'test-account-santander')!;

    expect(() =>
      createLocalTransaction(
        {
          description: 'Unsafe direct transfer',
          amountPence: 25_00,
          type: 'transfer',
          categoryId: 'cat-transfer',
          accountId: source.id,
          targetAccountId: destination.id,
          payer: 'Marius',
          isTransfer: true,
        },
        state.version
      )
    ).toThrow('Internal transfers must be recorded through the transfer workflow');
  });

  it('allows card repayments to keep a destination account without treating them as transfers', () => {
    let state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const credit = createLocalAccount(
      {
        name: 'Synthetic Credit',
        type: 'credit',
        startingBalancePence: -100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const repayment = createLocalTransaction(
      {
        description: 'Card repayment',
        amountPence: 30_00,
        type: 'repayment',
        categoryId: 'cat-transfer',
        accountId: source.id,
        targetAccountId: credit.account.id,
        payer: 'Marius',
        isRepayment: true,
      },
      state.version
    );

    expect(repayment.transaction.type).toBe('repayment');
    expect(repayment.transaction.isTransfer).toBe(false);
    expect(repayment.transaction.targetAccountId).toBe(credit.account.id);

    state = loadLocalHousehold();
    expect(
      state.accounts.find((account) => account.id === source.id)?.currentBalancePence
    ).toBe(970_00);
    expect(
      state.accounts.find((account) => account.id === credit.account.id)?.currentBalancePence
    ).toBe(-70_00);
    expect(() =>
      updateLocalTransaction(
        repayment.transaction.id,
        { description: 'Corrected card repayment' },
        state.version
      )
    ).not.toThrow();

    state = loadLocalHousehold();
    expect(() => deleteLocalTransaction(repayment.transaction.id, state.version)).not.toThrow();
  });

  it('rejects duplicate transaction IDs and duplicate idempotency keys', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((candidate) => candidate.id === 'test-account-lloyds')!;

    createLocalTransaction(
      {
        id: 'fixed-transaction-id',
        description: 'First exact request',
        amountPence: 10_00,
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: account.id,
        payer: 'Marius',
        idempotencyKey: 'request-123',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(() =>
      createLocalTransaction(
        {
          id: 'fixed-transaction-id',
          description: 'Duplicate ID',
          amountPence: 10_00,
          type: 'expense',
          categoryId: 'cat-groceries',
          accountId: account.id,
          payer: 'Marius',
        },
        state.version
      )
    ).toThrow('A transaction with this ID already exists');

    expect(() =>
      createLocalTransaction(
        {
          description: 'Duplicate request key',
          amountPence: 10_00,
          type: 'expense',
          categoryId: 'cat-groceries',
          accountId: account.id,
          payer: 'Marius',
          idempotencyKey: 'request-123',
        },
        state.version
      )
    ).toThrow('Duplicate transaction request rejected');
  });

  it('records and exactly undoes a generic transfer without leaving balance drift', () => {
    let state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const destination = state.accounts.find((account) => account.id === 'test-account-santander')!;
    const sourceBefore = source.currentBalancePence;
    const destinationBefore = destination.currentBalancePence;

    const created = executeLocalTransfer(
      {
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amountPence: 75_00,
        description: 'Exact undo test',
        date: '2026-09-06',
        idempotencyKey: 'transfer-request-1',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.transactions.find((tx) => tx.id === created.transaction.id)).toEqual(
      expect.objectContaining({
        accountId: source.id,
        targetAccountId: destination.id,
        amountPence: 75_00,
        type: 'transfer',
        isTransfer: true,
        idempotencyKey: 'transfer-request-1',
      })
    );
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence)
      .toBe(sourceBefore - 75_00);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence)
      .toBe(destinationBefore + 75_00);

    undoLocalTransferTransaction(created.transaction.id, state.version);
    state = loadLocalHousehold();

    expect(state.transactions.some((tx) => tx.id === created.transaction.id)).toBe(false);
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence)
      .toBe(sourceBefore);
    expect(state.accounts.find((account) => account.id === destination.id)?.currentBalancePence)
      .toBe(destinationBefore);

    expect(() =>
      undoLocalTransferTransaction(created.transaction.id, state.version)
    ).toThrow('Transfer transaction not found');
  });

  it('protects transfer evidence from generic edit and delete paths', () => {
    let state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const destination = state.accounts.find((account) => account.id === 'test-account-santander')!;

    const created = executeLocalTransfer(
      {
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amountPence: 20_00,
        description: 'Protected transfer',
        date: '2026-09-06',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      updateLocalTransaction(
        created.transaction.id,
        { amountPence: 19_00 },
        state.version
      )
    ).toThrow('Internal transfers cannot be edited in place');

    expect(() =>
      deleteLocalTransaction(created.transaction.id, state.version)
    ).toThrow('Internal transfers cannot be deleted directly');
  });

  it('clamps prepared-month dates at month and leap-year boundaries', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((candidate) => candidate.id === 'test-account-santander')!;

    const bill = createLocalPlannedPayment(
      {
        name: 'Month-end bill',
        amountPence: 10_00,
        month: '2027-01',
        dueDate: '2027-01-31',
        responsiblePerson: 'Marius',
        accountId: account.id,
        includeInTransferPlan: true,
        isRecurring: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    importLocalMonth(
      {
        sourceMonth: '2027-01',
        targetMonth: '2027-02',
        paymentIds: [bill.payment.id],
        incomeIds: [],
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(
      state.plannedPayments.find(
        (payment) =>
          payment.month === '2027-02' &&
          payment.metadata?.copiedFromId === bill.payment.id
      )?.dueDate
    ).toBe('2027-02-28');

    const leapBill = createLocalPlannedPayment(
      {
        name: 'Leap month-end bill',
        amountPence: 10_00,
        month: '2028-01',
        dueDate: '2028-01-31',
        responsiblePerson: 'Marius',
        accountId: account.id,
        includeInTransferPlan: true,
        isRecurring: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    importLocalMonth(
      {
        sourceMonth: '2028-01',
        targetMonth: '2028-02',
        paymentIds: [leapBill.payment.id],
        incomeIds: [],
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(
      state.plannedPayments.find(
        (payment) =>
          payment.month === '2028-02' &&
          payment.metadata?.copiedFromId === leapBill.payment.id
      )?.dueDate
    ).toBe('2028-02-29');
  });

  it('prevents ordinary transfers from spending money committed to selected bills', () => {
    let state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const destination = state.accounts.find((account) => account.id === 'test-account-chase')!;

    createLocalPlannedPayment(
      {
        name: 'Committed source bill',
        amountPence: 800_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: source.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      executeLocalTransfer(
        {
          sourceAccountId: source.id,
          destinationAccountId: destination.id,
          amountPence: 300_00,
          description: 'Would drain committed money',
          date: '2026-09-06',
          commitmentMonth: '2026-09',
        },
        state.version
      )
    ).toThrow('Transfer exceeds safe-to-move balance');

    state = loadLocalHousehold();
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence)
      .toBe(1000_00);
  });

  it('prevents savings contributions from draining selected bill commitments', () => {
    let state = loadLocalHousehold();
    const source = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const destination = state.accounts.find((account) => account.id === 'test-account-chase')!;

    createLocalPlannedPayment(
      {
        name: 'Committed before saving',
        amountPence: 800_00,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: source.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );
    state = loadLocalHousehold();

    const goal = createLocalSavingsGoal(
      {
        name: 'Synthetic goal',
        targetPence: 1000_00,
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(() =>
      contributeLocalSavingsGoal(
        {
          goalId: goal.goal.id,
          sourceAccountId: source.id,
          destinationAccountId: destination.id,
          amountPence: 300_00,
          date: '2026-09-06',
          commitmentMonth: '2026-09',
        },
        state.version
      )
    ).toThrow('Savings transfer exceeds safe-to-move balance');

    state = loadLocalHousehold();
    expect(state.accounts.find((account) => account.id === source.id)?.currentBalancePence)
      .toBe(1000_00);
  });

  it('keeps credit-card purchases as spending while repayments reduce the liability without double-counting spend', () => {
    let state = loadLocalHousehold();
    const current = state.accounts.find((account) => account.id === 'test-account-lloyds')!;
    const credit = createLocalAccount(
      {
        name: 'Liability test card',
        type: 'credit',
        startingBalancePence: -100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    createLocalTransaction(
      {
        description: 'Card purchase',
        amountPence: 40_00,
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: credit.account.id,
        payer: 'Marius',
        date: '2026-09-06',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(
      state.accounts.find((account) => account.id === credit.account.id)?.currentBalancePence
    ).toBe(-140_00);

    createLocalTransaction(
      {
        description: 'Card repayment',
        amountPence: 30_00,
        type: 'repayment',
        categoryId: 'cat-transfer',
        accountId: current.id,
        targetAccountId: credit.account.id,
        payer: 'Marius',
        isRepayment: true,
        date: '2026-09-06',
      },
      state.version
    );
    state = loadLocalHousehold();

    expect(
      state.accounts.find((account) => account.id === credit.account.id)?.currentBalancePence
    ).toBe(-110_00);
    expect(
      state.accounts.find((account) => account.id === current.id)?.currentBalancePence
    ).toBe(970_00);

    const summary = calculateFinancialSummary(
      state.transactions.filter((transaction) => transaction.date.startsWith('2026-09'))
    );
    expect(summary.grossExpensesPence).toBe(40_00);
    expect(summary.cardRepaymentsPence).toBe(30_00);
  });

  it('blocks new financial activity on archived accounts while preserving historical references', () => {
    let state = loadLocalHousehold();
    const account = createLocalAccount(
      {
        name: 'Archive guard current',
        type: 'current',
        startingBalancePence: 100_00,
        ownerPerson: 'Marius',
      },
      state.version
    );
    state = loadLocalHousehold();

    const bill = createLocalPlannedPayment(
      {
        name: 'Pre-archive bill',
        amountPence: 10_00,
        month: '2026-10',
        responsiblePerson: 'Marius',
        accountId: account.account.id,
        includeInTransferPlan: false,
      },
      state.version
    );
    state = loadLocalHousehold();

    const income = createLocalPlannedIncome(
      {
        name: 'Pre-archive income',
        expectedAmountPence: 20_00,
        month: '2026-10',
        sourcePerson: 'Marius',
        accountId: account.account.id,
        categoryId: 'cat-salary',
      },
      state.version
    );
    state = loadLocalHousehold();

    updateLocalAccount(account.account.id, { isActive: false }, state.version);
    state = loadLocalHousehold();

    expect(() =>
      createLocalTransaction(
        {
          description: 'Post-archive expense',
          amountPence: 1_00,
          type: 'expense',
          categoryId: 'cat-groceries',
          accountId: account.account.id,
          payer: 'Marius',
        },
        state.version
      )
    ).toThrow('Archived accounts cannot receive new financial activity');

    expect(() =>
      markLocalPaymentPaid(
        bill.payment.id,
        {
          actualAmountPence: 10_00,
          actualDate: '2026-10-02',
          accountId: account.account.id,
        },
        state.version
      )
    ).toThrow('Archived accounts cannot receive new financial activity');

    expect(() =>
      markLocalIncomeReceived(
        income.income.id,
        {
          actualAmountPence: 20_00,
          actualDate: '2026-10-02',
          accountId: account.account.id,
        },
        state.version
      )
    ).toThrow('Archived accounts cannot receive new financial activity');

    state = loadLocalHousehold();
    expect(state.plannedPayments.some((item) => item.id === bill.payment.id)).toBe(true);
    expect(state.plannedIncomes?.some((item) => item.id === income.income.id)).toBe(true);
  });

  it('retains audit history beyond 500 entries', () => {
    let state = loadLocalHousehold();
    state.auditLogs = Array.from({ length: 501 }, (_, index) => ({
      id: `historic-audit-${index}`,
      timestamp: '2026-01-01T00:00:00.000Z',
      actorEmail: 'audit@local.invalid',
      action: 'historic_test',
      entityType: 'system' as const,
      entityId: `historic-${index}`,
      summary: `Historic audit ${index}`,
    }));
    saveLocalHousehold(state);

    state = loadLocalHousehold();
    createLocalAccount(
      {
        name: 'Audit retention account',
        type: 'current',
        startingBalancePence: 0,
        ownerPerson: 'Marius',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.auditLogs).toHaveLength(502);
    expect(state.auditLogs.some((entry) => entry.id === 'historic-audit-500')).toBe(true);
  });

  it('locks out malformed stored JSON rather than overwriting it', () => {
    storage.setItem(LOCAL_STORAGE_KEY, '{not-json');

    expect(() => loadLocalHousehold()).toThrow(
      'Saved MV data could not be read'
    );
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBe('{not-json');
  });
});
