import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_KEY,
  SOURCE_IMPORT_BACKUP_STORAGE_KEY,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalHouseholdMember,
  createLocalPlannedIncome,
  createLocalPlannedPayment,
  createLocalTransaction,
  bulkToggleLocalPlannedPayments,
  executeLocalTransfer,
  executeLocalTransferAllocations,
  undoLatestLocalTransferPlanFunding,
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
import { SOURCE_BUDGET_IMPORT_ID } from './sourceBudgetData';

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

describe('Penny-style local MV storage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  it('starts with the audited September source budget and Marius owner', () => {
    const state = loadLocalHousehold();

    expect(state.version).toBe(1);
    expect(state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Marius',
          email: 'marius@local.invalid',
          role: 'owner',
        }),
        expect.objectContaining({
          name: 'Vesta',
          role: 'editor',
        }),
      ])
    );
    expect(state.accounts.map((item) => item.name)).toEqual(
      expect.arrayContaining(['Chase', 'Santander', 'Cash', 'Lloyds', 'NatWest', 'Credit Card'])
    );
    expect(state.transactions).toHaveLength(19);
    expect(state.plannedPayments).toHaveLength(13);
    expect(state.plannedIncomes).toHaveLength(5);
    expect(state.categories.map((item) => item.id)).toEqual(
      expect.arrayContaining(['cat-housing', 'cat-salary', 'cat-transfer', 'src-cat-fixed'])
    );
    expect(
      state.schemaStatus?.appliedMigrations.some(
        (migration) => migration.name === SOURCE_BUDGET_IMPORT_ID
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

    // Simulates an older funding transfer created before transferBatchId existed.
    createLocalTransaction(
      {
        description: 'Fund Vesta current',
        amountPence: 100_00,
        type: 'transfer',
        categoryId: 'cat-transfer',
        accountId: source.account.id,
        targetAccountId: destination.account.id,
        payer: 'Marius',
        isTransfer: true,
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
        expectedTotalPence: 500_00,
        allocations: [{ sourceAccountId: chase.id, amountPence: 500_00 }],
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
        amountPence: 500_00,
      })
    );
    expect(
      state.accounts.find((account) => account.id === santander.id)?.currentBalancePence
    ).toBe(4_500_00);
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
    ).toBe(15_687_47);
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

  it('keeps imported same-name Lloyds routing isolated by explicit owner', () => {
    const state = loadLocalHousehold();
    const mariusLloyds = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Marius'
    );
    const vestaLloyds = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Vesta'
    );

    expect(mariusLloyds).toBeTruthy();
    expect(vestaLloyds).toBeTruthy();
    expect(mariusLloyds!.id).not.toBe(vestaLloyds!.id);

    const vestaImportedBills = state.plannedPayments.filter(
      (payment) =>
        payment.responsiblePerson === 'Vesta' &&
        payment.metadata?.sourceImportId === SOURCE_BUDGET_IMPORT_ID &&
        ['Council tax', 'Internet - Vodafone', 'Phone', 'Lloyds'].includes(payment.name)
    );
    expect(vestaImportedBills).toHaveLength(4);
    expect(
      vestaImportedBills.every((payment) => payment.accountId === vestaLloyds!.id)
    ).toBe(true);

    const mariusImportedLloydsBills = state.plannedPayments.filter(
      (payment) =>
        payment.responsiblePerson === 'Marius' &&
        payment.metadata?.sourceImportId === SOURCE_BUDGET_IMPORT_ID &&
        ['Child Maintenance', 'National Trust'].includes(payment.name)
    );
    expect(mariusImportedLloydsBills).toHaveLength(2);
    expect(
      mariusImportedLloydsBills.every((payment) => payment.accountId === mariusLloyds!.id)
    ).toBe(true);

    const vestaLloydsIncome = state.plannedIncomes?.find(
      (income) =>
        income.name === 'Paycheck' &&
        income.sourcePerson === 'Vesta' &&
        income.metadata?.sourceImportId === SOURCE_BUDGET_IMPORT_ID
    );
    expect(vestaLloydsIncome?.accountId).toBe(vestaLloyds!.id);

    const mariusLloydsIncome = state.plannedIncomes?.find(
      (income) =>
        income.name === 'Paycheck' &&
        income.sourcePerson === 'Marius' &&
        income.metadata?.sourceImportId === SOURCE_BUDGET_IMPORT_ID
    );
    expect(mariusLloydsIncome?.accountId).toBe(mariusLloyds!.id);
  });

  it('repairs manually-created same-name bills to the matching household owner account', () => {
    let state = loadLocalHousehold();
    const mariusLloyds = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Marius'
    );
    const vestaLloyds = state.accounts.find(
      (account) => account.name === 'Lloyds' && account.ownerPerson === 'Vesta'
    );
    expect(mariusLloyds).toBeTruthy();
    expect(vestaLloyds).toBeTruthy();

    const bill = createLocalPlannedPayment(
      {
        name: 'Vesta test bill',
        amountPence: 1234,
        month: '2026-10',
        responsiblePerson: 'Vesta',
        accountId: mariusLloyds!.id,
        status: 'unpaid',
        includeInTransferPlan: true,
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)?.accountId
    ).toBe(vestaLloyds!.id);
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
    expect(
      state.plannedPayments.find((payment) => payment.id === bill.payment.id)
    ).toEqual(
      expect.objectContaining({
        status: 'unpaid',
        actualTransactionId: undefined,
        actualAmountPence: undefined,
        actualDate: undefined,
      })
    );

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

  it('keeps received income and its linked Activity transaction reconciled when edited', () => {
    let state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.name === 'Lloyds');
    expect(account).toBeTruthy();

    const created = createLocalPlannedIncome(
      {
        name: 'Test Wage',
        expectedAmountPence: 120000,
        month: '2026-10',
        sourcePerson: 'Marius',
        accountId: account!.id,
        categoryId: 'cat-salary',
        expectedDate: '2026-10-01',
        status: 'expected',
      },
      state.version
    );

    state = loadLocalHousehold();
    const received = markLocalIncomeReceived(
      created.income.id,
      {
        actualAmountPence: 119500,
        actualDate: '2026-10-02',
        accountId: account!.id,
      },
      state.version
    );

    state = loadLocalHousehold();
    updateLocalPlannedIncome(
      created.income.id,
      {
        name: 'Corrected Wage',
        expectedAmountPence: 120500,
        actualAmountPence: 120000,
        actualDate: '2026-10-03',
        sourcePerson: 'Marius',
        accountId: account!.id,
        categoryId: 'cat-salary',
        status: 'partial',
      },
      state.version
    );

    state = loadLocalHousehold();
    const income = state.plannedIncomes?.find((item) => item.id === created.income.id);
    const linkedTx = state.transactions.find((tx) => tx.id === received.transaction.id);

    expect(income).toEqual(
      expect.objectContaining({
        name: 'Corrected Wage',
        expectedAmountPence: 120500,
        actualAmountPence: 120000,
        actualDate: '2026-10-03',
      })
    );
    expect(linkedTx).toEqual(
      expect.objectContaining({
        description: 'Corrected Wage',
        amountPence: 120000,
        date: '2026-10-03',
        categoryId: 'cat-salary',
        accountId: account!.id,
        plannedIncomeId: created.income.id,
      })
    );
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
    expect(preflight.counts.accounts).toBe(8);

    state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(0);

    restoreLocalBackup(backup, state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(8);
    expect(state.accounts.find((account) => account.name === 'Main')?.startingBalancePence).toBe(123_45);
    expect(state.members.map((member) => member.name)).toEqual(
      expect.arrayContaining(['Marius', 'Vesta'])
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

  it('locks out malformed stored JSON rather than overwriting it', () => {
    storage.setItem(LOCAL_STORAGE_KEY, '{not-json');

    expect(() => loadLocalHousehold()).toThrow(
      'Saved MV data could not be read'
    );
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBe('{not-json');
  });
});
