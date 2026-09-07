import { describe, expect, it } from 'vitest';
import { createCanonicalCatalogue } from '../categories/registry';
import { createCategoryEligibility } from './categoryEligibility';

describe('semantic category eligibility', () => {
  it('filters bill, income, refund, repayment and transfer contexts', () => {
    const { categories, categoryGroups } = createCanonicalCatalogue();
    const rules = createCategoryEligibility(categoryGroups);
    const ids = (type: 'expense' | 'income' | 'refund' | 'repayment' | 'transfer') => rules.getTransactionCategoryOptions(categories, type).map(c => c.id);
    expect(ids('expense')).toContain('cat-rent');
    expect(ids('expense')).not.toContain('cat-salary-wages');
    expect(ids('income')).toContain('cat-child-maintenance-received');
    expect(ids('income')).not.toContain('cat-rent');
    expect(ids('refund')).toEqual(ids('expense'));
    expect(ids('repayment')).toEqual(['cat-transfer']);
    expect(ids('transfer')).toEqual([]);
    expect(ids('expense')).not.toContain('cat-uncategorised-expense');
    expect(ids('income')).not.toContain('cat-uncategorised-income');
    expect(rules.getBillCategoryOptions(categories).map(c => c.id)).toEqual(ids('expense'));
  });
  it('uses household group scope after renaming and supports custom groups', () => {
    const { categories, categoryGroups } = createCanonicalCatalogue();
    categoryGroups.find(g => g.id === 'group-income')!.name = 'Anything';
    categoryGroups.push({ id: 'custom', name: 'Income', scope: 'expense', sortOrder: 20, isArchived: false, isSystem: false, isProtected: false });
    categories.find(c => c.id === 'cat-rent')!.groupId = 'custom';
    const rules = createCategoryEligibility(categoryGroups);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-rent')).toBe(true);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-salary-wages')).toBe(false);
  });
  it('preserves same-scope historical archived assignments only, never allowing cross-scope bypass', () => {
    const { categories, categoryGroups } = createCanonicalCatalogue();
    categories.find(c => c.id === 'cat-rent')!.isArchived = true;
    const rules = createCategoryEligibility(categoryGroups);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-rent')).toBe(false);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-rent', 'cat-rent')).toBe(true);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-salary-wages', 'cat-salary-wages')).toBe(false);
    expect(rules.isBillCategorySelectionAllowed(categories, 'cat-uncategorised-expense', 'cat-uncategorised-expense')).toBe(true);
    expect(rules.isBillCategorySelectionAllowed(categories, '')).toBe(false);
    expect(rules.isBillCategorySelectionAllowed(categories, 'absent')).toBe(false);
  });
  it('does not offer archived-group or superseded categories', () => {
    const { categories, categoryGroups } = createCanonicalCatalogue();
    const rent = categories.find(c => c.id === 'cat-rent')!;
    rent.isArchived = true;
    rent.supersededById = 'cat-mortgage';
    const rules = createCategoryEligibility(categoryGroups);
    expect(rules.isBillCategorySelectionAllowed(categories, rent.id, rent.id)).toBe(false);
    categoryGroups.find(g => g.id === 'group-income')!.isArchived = true;
    expect(rules.getTransactionCategoryOptions(categories, 'income')).toEqual([]);
  });
});
