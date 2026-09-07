import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_BACKUP_VERSION,
  LOCAL_ROLLBACK_STORAGE_KEY,
  LOCAL_STORAGE_KEY,
  createBlankLocalHousehold,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalTransaction,
  loadLocalHousehold,
  preflightLocalRestore,
  resetLocalHousehold,
  restoreLocalBackup,
  saveLocalHousehold,
} from '../localStore';
import { financialIdentitySnapshot } from './management';
import { setMonthlyCategoryBudget } from './budgets';

let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  saveLocalHousehold(createBlankLocalHousehold());
});

describe('V2 financial backup boundary', () => {
  it('exports a self-identifying V2 package and reports category catalogue counts', () => {
    setMonthlyCategoryBudget('2027-09', 'cat-rent', 123_45, 1);
    const backup = createLocalBackupPackage();
    expect(backup).toMatchObject({
      app: 'MV',
      storage: 'local-browser',
      formatVersion: LOCAL_BACKUP_VERSION,
      dataSchemaVersion: 2,
      state: { dataSchemaVersion: 2 },
    });
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
    expect(preflightLocalRestore(backup)).toMatchObject({
      valid: true,
      counts: { categoryGroups: 13, categories: 47, monthlyCategoryBudgets: 1 },
    });
  });

  it('rejects raw state and mismatched envelope metadata', () => {
    const backup = createLocalBackupPackage();
    const invalid = [
      backup.state,
      { ...backup, app: 'Another app' },
      { ...backup, storage: 'server' },
      { ...backup, formatVersion: 1 },
      { ...backup, dataSchemaVersion: 1 },
      { ...backup, exportedAt: 'not-a-date' },
      { ...backup, state: { ...backup.state, dataSchemaVersion: 3 } },
    ];
    for (const payload of invalid) expect(() => preflightLocalRestore(payload)).toThrow();
  });

  it('rejects missing, merged and cross-scope category relationships', () => {
    let state = loadLocalHousehold();
    createLocalAccount(
      { name: 'Current', type: 'current', startingBalancePence: 100_00, ownerMemberId: 'local-marius' },
      state.version
    );
    state = loadLocalHousehold();
    createLocalTransaction(
      {
        description: 'Groceries', amountPence: 12_34, date: '2026-09-01', type: 'expense',
        categoryId: 'cat-groceries', accountId: state.accounts[0].id, payer: 'Marius',
      },
      state.version
    );
    const backup = createLocalBackupPackage();

    const wrongScope = structuredClone(backup);
    wrongScope.state.transactions[0].categoryId = 'cat-salary-wages';
    expect(() => preflightLocalRestore(wrongScope)).toThrow(/scope/);

    const missingPlanCategory = structuredClone(backup);
    missingPlanCategory.state.plannedPayments.push({
      id: 'bill', name: 'Bill', amountPence: 100, month: '2027-01',
      responsiblePerson: 'Marius', accountId: state.accounts[0].id, status: 'unpaid',
      includeInTransferPlan: false, createdAt: '2027-01-01T00:00:00.000Z', createdBy: 'test',
    });
    expect(() => preflightLocalRestore(missingPlanCategory)).toThrow(/requires a category/);

    const mergedReference = structuredClone(backup);
    const source = mergedReference.state.categories.find((category) => category.id === 'cat-groceries')!;
    source.isArchived = true;
    source.supersededById = 'cat-household-goods';
    expect(() => preflightLocalRestore(mergedReference)).toThrow(/merged category/);

    const staleBalance = structuredClone(backup);
    staleBalance.state.accounts[0].currentBalancePence += 1;
    expect(() => preflightLocalRestore(staleBalance)).toThrow(/non-canonical/);
  });

  it('round-trips monthly budgets and financial identity without category side effects', () => {
    setMonthlyCategoryBudget('2027-09', 'cat-rent', 900_00, 1);
    let state = loadLocalHousehold();
    createLocalAccount(
      { name: 'Current', type: 'current', startingBalancePence: 1_000_00, ownerMemberId: 'local-marius' },
      state.version
    );
    state = loadLocalHousehold();
    createLocalTransaction(
      {
        description: 'Rent', amountPence: 900_00, date: '2026-09-01', type: 'expense',
        categoryId: 'cat-rent', accountId: state.accounts[0].id, payer: 'Marius',
      },
      state.version
    );
    const backup = createLocalBackupPackage();
    const expectedFinancialIdentity = financialIdentitySnapshot(backup.state);
    const expectedCatalogue = {
      categoryGroups: backup.state.categoryGroups,
      categories: backup.state.categories,
      monthlyCategoryBudgets: backup.state.monthlyCategoryBudgets,
    };

    state = loadLocalHousehold();
    resetLocalHousehold(state.version);
    state = loadLocalHousehold();
    restoreLocalBackup(backup, state.version);
    const restored = loadLocalHousehold();

    expect(financialIdentitySnapshot(restored)).toBe(expectedFinancialIdentity);
    expect({
      categoryGroups: restored.categoryGroups,
      categories: restored.categories,
      monthlyCategoryBudgets: restored.monthlyCategoryBudgets,
    }).toEqual(expectedCatalogue);
    expect(restored.auditLogs[0].action).toBe('database_restored');

    const rollback = JSON.parse(values.get(LOCAL_ROLLBACK_STORAGE_KEY)!);
    expect(() => preflightLocalRestore(rollback)).not.toThrow();
    expect(rollback.state.transactions).toEqual([]);
  });

  it('leaves active and previous rollback bytes unchanged when the primary restore write fails', () => {
    const backup = createLocalBackupPackage();
    const activeBefore = values.get(LOCAL_STORAGE_KEY);
    values.set(LOCAL_ROLLBACK_STORAGE_KEY, 'previous-rollback');
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === LOCAL_STORAGE_KEY) throw new Error('Synthetic quota failure');
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key),
    });

    expect(() => restoreLocalBackup(backup, 1)).toThrow(/quota/);
    expect(values.get(LOCAL_STORAGE_KEY)).toBe(activeBefore);
    expect(values.get(LOCAL_ROLLBACK_STORAGE_KEY)).toBe('previous-rollback');
  });
});
