import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_KEY,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalTransaction,
  executeLocalTransfer,
  loadLocalHousehold,
  preflightLocalRestore,
  resetLocalHousehold,
  restoreLocalBackup,
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
    expect(state.members).toEqual([
      expect.objectContaining({
        email: 'marius@local.invalid',
        role: 'owner',
      }),
    ]);
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
    expect(state.members).toHaveLength(1);
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
