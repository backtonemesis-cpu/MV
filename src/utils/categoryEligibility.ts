import type { Category, CategoryGroup, TransactionType } from '../types';

/** Bind eligibility to this household's groups, including custom groups. */
export function createCategoryEligibility(categoryGroups: CategoryGroup[]) {
  const compatible = (category: Category, type: TransactionType | '') => {
    const group = categoryGroups.find(group => group.id === category.groupId);
    if (!group || !type || category.supersededById) return false;
    if (type === 'transfer' || type === 'repayment') return category.systemRole === 'internal-transfer';
    if (category.systemRole === 'uncategorised-expense') return type === 'expense' || type === 'refund';
    if (category.systemRole === 'uncategorised-income') return type === 'income';
    return group.scope === (type === 'income' ? 'income' : 'expense');
  };
  const isTransactionCategoryEligible = (category: Category, type: TransactionType | '') => {
    const group = categoryGroups.find(group => group.id === category.groupId);
    if (!group || group.isArchived || category.isArchived || category.supersededById) return false;
    if (type === 'transfer') return false;
    if (type === 'repayment') return compatible(category, type);
    return !category.isSystem && compatible(category, type);
  };
  const isBillEligibleCategory = (category: Category) => isTransactionCategoryEligible(category, 'expense');
  const getTransactionCategoryOptions = (categories: Category[], type: TransactionType | '', preservedCategoryIds: string[] = []) =>
    categories.filter(category => isTransactionCategoryEligible(category, type) ||
      (preservedCategoryIds.includes(category.id) && compatible(category, type)))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'en-GB'));
  const isTransactionCategorySelectionAllowed = (categories: Category[], type: TransactionType | '', selectedCategoryId: string, preservedCategoryIds: string[] = []) =>
    !!selectedCategoryId && getTransactionCategoryOptions(categories, type, preservedCategoryIds).some(category => category.id === selectedCategoryId);
  const getBillCategoryOptions = (categories: Category[], currentCategoryId?: string) =>
    getTransactionCategoryOptions(categories, 'expense', currentCategoryId ? [currentCategoryId] : []);
  const isBillCategorySelectionAllowed = (categories: Category[], selectedCategoryId: string, currentCategoryId?: string) =>
    isTransactionCategorySelectionAllowed(categories, 'expense', selectedCategoryId, currentCategoryId ? [currentCategoryId] : []);
  return { compatible, isBillEligibleCategory, getBillCategoryOptions, isBillCategorySelectionAllowed,
    isTransactionCategoryEligible, getTransactionCategoryOptions, isTransactionCategorySelectionAllowed };
}
