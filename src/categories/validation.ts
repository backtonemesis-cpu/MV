import type { CategoryCatalogue, CategoryScope, CategoryV2 } from './model';
import { SYSTEM_CATEGORY_IDS } from './registry';

export function normalizedCategoryName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
}

export function validateCategoryName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.length > 80) {
    throw new Error('Name must be trimmed and contain 1–80 characters.');
  }
}

export function categoryScope(catalogue: CategoryCatalogue, category: CategoryV2): CategoryScope {
  if (category.systemRole === 'uncategorised-expense') return 'expense';
  if (category.systemRole === 'uncategorised-income') return 'income';
  const group = catalogue.categoryGroups.find(item => item.id === category.groupId);
  if (!group) throw new Error('Category references a missing group.');
  return group.scope;
}

/** Validates structure without changing any field or guessing missing classifications. */
export function assertCategoryCatalogue(value: unknown): asserts value is CategoryCatalogue {
  if (!value || typeof value !== 'object') throw new Error('Missing category catalogue.');
  const catalogue = value as CategoryCatalogue;
  for (const key of ['categoryGroups', 'categories', 'monthlyCategoryBudgets'] as const) {
    if (!Array.isArray(catalogue[key])) throw new Error(`Missing ${key}.`);
  }
  for (const list of [catalogue.categoryGroups, catalogue.categories]) {
    const ids = new Set<string>();
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) {
        throw new Error('Invalid or duplicate category/group ID.');
      }
      ids.add(item.id);
      validateCategoryName(item.name);
      if (!Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0) throw new Error('Invalid sort order.');
      for (const key of ['isArchived', 'isSystem', 'isProtected'] as const) {
        if (typeof item[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
      }
    }
  }
  const groupNames = new Set<string>();
  for (const group of catalogue.categoryGroups) {
    if (!['expense', 'income', 'system'].includes(group.scope)) throw new Error('Invalid group scope.');
    if (group.isSystem !== (group.scope === 'system')) throw new Error('Invalid system group.');
    if (group.isSystem && (!group.isProtected || group.isArchived || group.id !== 'group-system')) {
      throw new Error('Protected system group is invalid.');
    }
    const key = `${group.scope}:${normalizedCategoryName(group.name)}`;
    if (groupNames.has(key)) throw new Error('Duplicate group name in scope.');
    groupNames.add(key);
  }
  const names = new Set<string>();
  const roles = new Set<string>();
  for (const category of catalogue.categories) {
    const group = catalogue.categoryGroups.find(item => item.id === category.groupId);
    if (!group) throw new Error('Category references a missing group.');
    if (group.isArchived && !category.isArchived) throw new Error('Active category has an archived group.');
    if (category.isSystem !== !!category.systemRole || category.isSystem !== group.isSystem) {
      throw new Error('Invalid system category assignment.');
    }
    if (category.systemRole) {
      if (!Object.hasOwn(SYSTEM_CATEGORY_IDS, category.systemRole) ||
          category.id !== SYSTEM_CATEGORY_IDS[category.systemRole] ||
          !category.isProtected || category.isArchived || category.supersededById || roles.has(category.systemRole)) {
        throw new Error('Protected system category is invalid.');
      }
      roles.add(category.systemRole);
    }
    if (category.supersededById) {
      if (!category.isArchived) throw new Error('Merged source must be archived.');
      const seen = new Set([category.id]);
      let targetId: string | undefined = category.supersededById;
      while (targetId) {
        const target = catalogue.categories.find(item => item.id === targetId);
        if (!target || seen.has(targetId) || target.isSystem || categoryScope(catalogue, target) !== categoryScope(catalogue, category)) {
          throw new Error('Invalid or cyclic category merge lineage.');
        }
        seen.add(targetId);
        targetId = target.supersededById;
      }
    } else {
      // Archived names remain reserved, allowing restore of the same identity.
      const key = `${categoryScope(catalogue, category)}:${normalizedCategoryName(category.name)}`;
      if (names.has(key)) throw new Error('Duplicate category name; restore the archived category instead.');
      names.add(key);
    }
  }
  if (roles.size !== Object.keys(SYSTEM_CATEGORY_IDS).length) throw new Error('Required system category missing.');
  const budgetKeys = new Set<string>();
  for (const budget of catalogue.monthlyCategoryBudgets) {
    const category = catalogue.categories.find(item => item.id === budget?.categoryId);
    if (!category || category.supersededById || categoryScope(catalogue, category) !== 'expense') {
      throw new Error('Monthly budget references an invalid expense category.');
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.monthKey) ||
        !Number.isSafeInteger(budget.budgetAmountPence) || budget.budgetAmountPence < 0) {
      throw new Error('Invalid monthly budget period or integer-pence amount.');
    }
    const key = `${budget.monthKey}:${budget.categoryId}`;
    if (budgetKeys.has(key)) throw new Error('Duplicate monthly category budget.');
    budgetKeys.add(key);
  }
}
