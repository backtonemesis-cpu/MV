import { beforeEach, describe, expect, it } from 'vitest';
import { JOINT_ACCOUNT_OWNER_ID } from './types';
import type { Account, HouseholdMember } from './types';
import {
  LOCAL_STORAGE_KEY,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalHouseholdMember,
  loadLocalHousehold,
  removeLocalHouseholdMember,
  saveLocalHousehold,
  updateLocalAccount,
  updateLocalHouseholdMember,
} from './localStore';
import { resolveCompatibleAccount, SOURCE_BUDGET_IMPORT_ID } from './sourceBudgetData';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function markSourceBudgetHandledForTest(state: ReturnType<typeof createBlankLocalHousehold>): void {
  state.schemaStatus = state.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };
  state.schemaStatus.appliedMigrations = [
    ...state.schemaStatus.appliedMigrations.filter(
      (migration) => migration.name !== SOURCE_BUDGET_IMPORT_ID
    ),
    {
      version: 1,
      name: SOURCE_BUDGET_IMPORT_ID,
      appliedAt: '2026-09-04T00:00:00.000Z',
      executionTimeMs: 0,
      checksum: 'test-account-ownership',
    },
  ];
}

describe('Stable account ownership', () => {
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

  it('migrates a legacy ownerPerson to the matching household member ID without changing the account ID', () => {
    const legacy = createBlankLocalHousehold();
    markSourceBudgetHandledForTest(legacy);
    const vesta: HouseholdMember = {
      id: 'member-vesta-stable',
      email: 'vesta@local.invalid',
      name: 'Vesta',
      role: 'editor',
      joinedAt: '2026-09-04T00:00:00.000Z',
    };
    legacy.members.push(vesta);
    legacy.accounts.push({
      id: 'legacy-vesta-lloyds',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 123_45,
      currentBalancePence: 123_45,
      ownerPerson: 'Vesta',
    });
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacy));

    const state = loadLocalHousehold();
    const account = state.accounts.find((item) => item.id === 'legacy-vesta-lloyds');

    expect(account?.id).toBe('legacy-vesta-lloyds');
    expect(account?.ownerMemberId).toBe(vesta.id);
    expect(account?.ownerPerson).toBe('Vesta');
    expect(account?.currentBalancePence).toBe(123_45);
  });

  it('creates an account using the selected stable household-member ID and canonical member name', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    const created = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 0,
        ownerMemberId: vesta.member.id,
        ownerPerson: 'Wrong display name',
      },
      state.version
    );

    expect(created.account.ownerMemberId).toBe(vesta.member.id);
    expect(created.account.ownerPerson).toBe('Vesta');
  });

  it('keeps account and owner IDs stable when a household member is renamed', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    const created = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 500_00,
        ownerMemberId: vesta.member.id,
      },
      state.version
    );
    const accountId = created.account.id;

    state = loadLocalHousehold();
    updateLocalHouseholdMember(vesta.member.id, { name: 'Vesta M' }, state.version);
    state = loadLocalHousehold();

    const account = state.accounts.find((item) => item.id === accountId);
    expect(account?.id).toBe(accountId);
    expect(account?.ownerMemberId).toBe(vesta.member.id);
    expect(account?.ownerPerson).toBe('Vesta M');
  });

  it('keeps Marius Lloyds and Vesta Lloyds separate by account ID and owner member ID', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    const marius = state.members.find((member) => member.name === 'Marius');
    expect(marius).toBeDefined();

    const mariusAccount = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 100_00,
        ownerMemberId: marius!.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const vestaAccount = createLocalAccount(
      {
        name: 'Lloyds',
        type: 'current',
        startingBalancePence: 200_00,
        ownerMemberId: vesta.member.id,
      },
      state.version
    );

    expect(mariusAccount.account.id).not.toBe(vestaAccount.account.id);
    expect(mariusAccount.account.ownerMemberId).toBe(marius!.id);
    expect(vestaAccount.account.ownerMemberId).toBe(vesta.member.id);
  });

  it('stores Joint as an explicit stable ownership sentinel', () => {
    const state = loadLocalHousehold();
    const created = createLocalAccount(
      {
        name: 'Joint Current',
        type: 'current',
        startingBalancePence: 0,
        ownerMemberId: JOINT_ACCOUNT_OWNER_ID,
      },
      state.version
    );

    expect(created.account.ownerMemberId).toBe(JOINT_ACCOUNT_OWNER_ID);
    expect(created.account.ownerPerson).toBe('Joint');
  });

  it('rejects account creation when no owner is supplied', () => {
    const state = loadLocalHousehold();
    expect(() =>
      createLocalAccount(
        {
          name: 'Ownerless Account',
          type: 'current',
          startingBalancePence: 0,
        },
        state.version
      )
    ).toThrow(/Account owner is required/);
  });

  it('does not allow a removed household member to be selected as a new account owner', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    removeLocalHouseholdMember(vesta.member.id, state.version);
    state = loadLocalHousehold();

    expect(() =>
      createLocalAccount(
        {
          name: 'New Vesta Account',
          type: 'current',
          startingBalancePence: 0,
          ownerMemberId: vesta.member.id,
        },
        state.version
      )
    ).toThrow(/active household member or Joint/);
  });

  it('allows an existing account to retain a removed owner link during unrelated edits', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();

    const account = createLocalAccount(
      {
        name: 'Legacy Vesta Account',
        type: 'current',
        startingBalancePence: 300_00,
        ownerMemberId: vesta.member.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    removeLocalHouseholdMember(vesta.member.id, state.version);
    state = loadLocalHousehold();

    updateLocalAccount(
      account.account.id,
      {
        notes: 'Updated after household member removal',
        ownerMemberId: vesta.member.id,
      },
      state.version
    );
    state = loadLocalHousehold();

    const updated = state.accounts.find((item) => item.id === account.account.id);
    expect(updated?.ownerMemberId).toBe(vesta.member.id);
    expect(updated?.ownerPerson).toBe('Vesta');
    expect(updated?.notes).toBe('Updated after household member removal');
  });

  it('changes an account owner atomically without changing the account ID', () => {
    let state = loadLocalHousehold();
    const vesta = createLocalHouseholdMember({ name: 'Vesta' }, state.version);
    state = loadLocalHousehold();
    const marius = state.members.find((member) => member.name === 'Marius')!;

    const account = createLocalAccount(
      {
        name: 'Savings',
        type: 'savings',
        startingBalancePence: 1000_00,
        ownerMemberId: marius.id,
      },
      state.version
    );
    const accountId = account.account.id;

    state = loadLocalHousehold();
    updateLocalAccount(accountId, { ownerMemberId: vesta.member.id }, state.version);
    state = loadLocalHousehold();

    const updated = state.accounts.find((item) => item.id === accountId);
    expect(updated?.id).toBe(accountId);
    expect(updated?.ownerMemberId).toBe(vesta.member.id);
    expect(updated?.ownerPerson).toBe('Vesta');
    expect(updated?.currentBalancePence).toBe(1000_00);
  });

  it('prefers stable owner member IDs when disambiguating same-name legacy account candidates', () => {
    const oldAccount: Pick<
      Account,
      'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'
    > = {
      id: 'legacy-lloyds',
      name: 'Lloyds',
      type: 'current',
      ownerMemberId: 'member-vesta',
      ownerPerson: 'Stale Name',
    };
    const candidates: Pick<
      Account,
      'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'
    >[] = [
      {
        id: 'candidate-marius',
        name: 'Lloyds',
        type: 'current',
        ownerMemberId: 'member-marius',
        ownerPerson: 'Marius',
      },
      {
        id: 'candidate-vesta',
        name: 'Lloyds',
        type: 'current',
        ownerMemberId: 'member-vesta',
        ownerPerson: 'Vesta',
      },
    ];

    expect(resolveCompatibleAccount(oldAccount, candidates)?.id).toBe('candidate-vesta');
  });
});
