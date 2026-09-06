import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveLocalAccount,
  createBlankLocalHousehold,
  createLocalAccount,
  loadLocalHousehold,
  reactivateLocalAccount,
  saveLocalHousehold,
  updateLocalAccount,
} from './localStore';
import { getAccountPermanentDeleteEligibility } from './utils/accountDeletion';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

describe('dedicated account archive/reactivate mutations', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    saveLocalHousehold(createBlankLocalHousehold());
  });

  it('archives and reactivates without changing balances or financial history', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount({
      name: 'Workflow account',
      type: 'current',
      ownerPerson: 'Marius',
      startingBalancePence: 12345,
    }, state.version);
    state = loadLocalHousehold();

    archiveLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    let account = state.accounts.find((item) => item.id === created.account.id)!;
    expect(account.isActive).toBe(false);
    expect(account.startingBalancePence).toBe(12345);
    expect(account.currentBalancePence).toBe(12345);
    expect(state.auditLogs.some((entry) => entry.action === 'account_archived' && entry.entityId === created.account.id)).toBe(true);

    reactivateLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    account = state.accounts.find((item) => item.id === created.account.id)!;
    expect(account.isActive).toBe(true);
    expect(account.startingBalancePence).toBe(12345);
    expect(account.currentBalancePence).toBe(12345);
    expect(state.auditLogs.some((entry) => entry.action === 'account_reactivated' && entry.entityId === created.account.id)).toBe(true);
  });

  it('blocks generic account updates from bypassing dedicated status audit actions', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount({
      name: 'Guarded account',
      type: 'current',
      ownerPerson: 'Marius',
      startingBalancePence: 0,
    }, state.version);
    state = loadLocalHousehold();
    expect(() =>
      updateLocalAccount(created.account.id, { isActive: false }, state.version)
    ).toThrow('Use the dedicated archive or reactivate account action');
  });

  it('treats archive/reactivate audit rows as harmless administration for otherwise unused accounts', () => {
    let state = loadLocalHousehold();
    const created = createLocalAccount({
      name: 'Disposable account',
      type: 'current',
      ownerPerson: 'Marius',
      startingBalancePence: 0,
    }, state.version);
    state = loadLocalHousehold();
    archiveLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    reactivateLocalAccount(created.account.id, state.version);
    state = loadLocalHousehold();
    expect(getAccountPermanentDeleteEligibility(state, created.account.id).canDeletePermanently).toBe(true);
  });
});
