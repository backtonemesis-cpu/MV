import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_KEY,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalHouseholdMember,
  createLocalPlannedIncome,
  createLocalTransaction,
  executeLocalTransfer,
  loadLocalHousehold,
  markLocalIncomeReceived,
  preflightLocalRestore,
  resetLocalHousehold,
  restoreLocalBackup,
  updateLocalHouseholdMember,
  updateLocalPlannedIncome,
  changeLocalHouseholdMemberRole,
  removeLocalHouseholdMember,
} from './localStore';

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
        (migration) => migration.name === 'source-budget-2026-09-v1'
      )
    ).toBe(true);
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBeTruthy();
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
    expect(preflight.counts.accounts).toBe(7);

    state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(0);

    restoreLocalBackup(backup, state.version);
    state = loadLocalHousehold();
    expect(state.accounts).toHaveLength(7);
    expect(state.accounts.find((account) => account.name === 'Main')?.startingBalancePence).toBe(123_45);
    expect(state.members.map((member) => member.name)).toEqual(
      expect.arrayContaining(['Marius', 'Vesta'])
    );
    expect(state.members[0].email).toBe('marius@local.invalid');
    expect(state.auditLogs.map((entry) => entry.action)).toContain('database_restored');
  });

  it('locks out malformed stored JSON rather than overwriting it', () => {
    storage.setItem(LOCAL_STORAGE_KEY, '{not-json');

    expect(() => loadLocalHousehold()).toThrow(
      'Saved MV data could not be read'
    );
    expect(storage.getItem(LOCAL_STORAGE_KEY)).toBe('{not-json');
  });
});
