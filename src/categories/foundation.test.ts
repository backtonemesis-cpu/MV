import { describe, expect, it } from 'vitest';
import { createCanonicalCatalogue } from './registry';
import { assertCategoryCatalogue, categoryScope } from './validation';
import { CATEGORY_STORAGE_KEY, createCleanCategoryHousehold, loadOrCreateCategoryState } from './schema';

const identity = { id: 'synthetic-household', name: 'Synthetic household', members: [] };
const seed = () => createCleanCategoryHousehold(identity);

describe('V2 category foundation', () => {
  it('provides exactly the agreed starter taxonomy with distinct identities and no category budgets', () => {
    const catalogue = createCanonicalCatalogue();
    expect(() => assertCategoryCatalogue(catalogue)).not.toThrow();
    expect(catalogue.categoryGroups).toHaveLength(13);
    expect(catalogue.categories).toHaveLength(47);
    for (const id of ['cat-rent', 'cat-mortgage', 'cat-broadband', 'cat-mobile', 'cat-bank-fees', 'cat-child-maintenance-received']) {
      expect(catalogue.categories.some(category => category.id === id)).toBe(true);
    }
    expect(catalogue.categories.some(category => ['Fixed', 'Rent / Mortgage', 'Broadband / Mobile'].includes(category.name))).toBe(false);
    expect(catalogue.categories.some(category => 'monthlyBudgetPence' in category)).toBe(false);
    expect(catalogue.monthlyCategoryBudgets).toEqual([]);
  });

  it('returns independent deterministic seeds and resolves scope without group-name semantics', () => {
    const first = createCanonicalCatalogue();
    const second = createCanonicalCatalogue();
    expect(first).toEqual(second);
    first.categoryGroups.find(group => group.id === 'group-income')!.name = 'Earnings';
    first.categories.find(category => category.id === 'cat-rent')!.name = 'Tenancy';
    expect(second.categories.find(category => category.id === 'cat-rent')!.name).toBe('Rent');
    expect(categoryScope(first, first.categories.find(category => category.id === 'cat-salary-wages')!)).toBe('income');
  });

  it.each(['isProtected', 'isSystem', 'isArchived'] as const)('rejects corruption of system flag %s', flag => {
    const catalogue = createCanonicalCatalogue();
    const transfer = catalogue.categories.find(category => category.id === 'cat-transfer')!;
    transfer[flag] = !transfer[flag];
    expect(() => assertCategoryCatalogue(catalogue)).toThrow();
  });

  it('rejects missing system roles, invalid groups, duplicate IDs and case-colliding names', () => {
    const mutations = [
      (c: ReturnType<typeof createCanonicalCatalogue>) => { c.categories = c.categories.filter(x => x.id !== 'cat-transfer'); },
      (c: ReturnType<typeof createCanonicalCatalogue>) => { c.categories[0].groupId = 'absent'; },
      (c: ReturnType<typeof createCanonicalCatalogue>) => { c.categories.push({ ...c.categories[0] }); },
      (c: ReturnType<typeof createCanonicalCatalogue>) => { c.categories[1].name = 'RENT'; },
      (c: ReturnType<typeof createCanonicalCatalogue>) => { c.categories[0].isArchived = true; c.categories[1].name = 'rent'; },
    ];
    for (const mutate of mutations) {
      const catalogue = createCanonicalCatalogue();
      mutate(catalogue);
      expect(() => assertCategoryCatalogue(catalogue)).toThrow();
    }
  });

  it('rejects cyclic and cross-scope supersession', () => {
    const catalogue = createCanonicalCatalogue();
    const rent = catalogue.categories.find(x => x.id === 'cat-rent')!;
    rent.isArchived = true;
    rent.supersededById = rent.id;
    expect(() => assertCategoryCatalogue(catalogue)).toThrow(/cyclic/);
    rent.supersededById = 'cat-salary-wages';
    expect(() => assertCategoryCatalogue(catalogue)).toThrow();
  });

  it('validates period budgets independently, retaining archived historical classification', () => {
    const catalogue = createCanonicalCatalogue();
    catalogue.categories.find(x => x.id === 'cat-rent')!.isArchived = true;
    catalogue.monthlyCategoryBudgets = [
      { monthKey: '2027-01', categoryId: 'cat-rent', budgetAmountPence: 12345 },
      { monthKey: '2027-02', categoryId: 'cat-rent', budgetAmountPence: 54321 },
    ];
    expect(() => assertCategoryCatalogue(catalogue)).not.toThrow();
    catalogue.monthlyCategoryBudgets[1].budgetAmountPence = 0.1;
    expect(() => assertCategoryCatalogue(catalogue)).toThrow(/integer-pence/);
  });

  it('rejects invalid month, duplicate budget and missing budget category', () => {
    for (const budget of [
      { monthKey: '2027-13', categoryId: 'cat-rent', budgetAmountPence: 1 },
      { monthKey: '2027-01', categoryId: 'absent', budgetAmountPence: 1 },
      { monthKey: '2027-01', categoryId: 'cat-salary-wages', budgetAmountPence: 1 },
    ]) {
      const catalogue = createCanonicalCatalogue();
      catalogue.monthlyCategoryBudgets = [budget];
      expect(() => assertCategoryCatalogue(catalogue)).toThrow();
    }
    const catalogue = createCanonicalCatalogue();
    const budget = { monthKey: '2027-01', categoryId: 'cat-rent', budgetAmountPence: 1 };
    catalogue.monthlyCategoryBudgets = [budget, { ...budget }];
    expect(() => assertCategoryCatalogue(catalogue)).toThrow(/Duplicate/);
  });

  it('initialises only V2, leaving every byte of legacy financial state untouched', () => {
    const oldRaw = '{ "synthetic": "legacy test data" }';
    const entries = new Map([['mv_local_state_v1', oldRaw]]);
    const reads: string[] = [];
    const storage = {
      getItem: (key: string) => { reads.push(key); return entries.get(key) ?? null; },
      setItem: (key: string, value: string) => { entries.set(key, value); },
    };
    let validated = 0;
    const result = loadOrCreateCategoryState(storage, seed, () => { validated++; });
    expect(validated).toBe(1);
    expect(reads).toEqual([CATEGORY_STORAGE_KEY]);
    expect(entries.get('mv_local_state_v1')).toBe(oldRaw);
    for (const key of ['accounts', 'transactions', 'plannedPayments', 'plannedIncomes', 'savingsGoals', 'auditLogs'] as const) {
      expect(result[key]).toEqual([]);
    }
    expect(loadOrCreateCategoryState(storage, () => { throw new Error('Must not reseed'); }, () => {})).toEqual(result);
  });

  it('does not overwrite corrupt or incompatible V2 data and never partially saves a failed validation', () => {
    for (const raw of ['broken JSON', JSON.stringify({ ...seed(), dataSchemaVersion: 99 }), JSON.stringify({ ...seed(), dataSchemaVersion: 1 })]) {
      const storage = { getItem: () => raw, setItem: () => { throw new Error('Unexpected write'); } };
      expect(() => loadOrCreateCategoryState(storage, seed, () => {})).toThrow();
    }
    let writes = 0;
    expect(() => loadOrCreateCategoryState({ getItem: () => null, setItem: () => { writes++; } }, seed, () => { throw new Error('Invalid financial references'); })).toThrow(/financial/);
    expect(writes).toBe(0);
  });
});
