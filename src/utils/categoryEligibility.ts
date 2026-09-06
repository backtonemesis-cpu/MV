import type { Category } from '../types';

const EXCLUDED_BILL_CATEGORY_GROUPS = new Set(['income', 'transfers', 'savings']);

export function isBillEligibleCategory(category: Category): boolean {
  return !EXCLUDED_BILL_CATEGORY_GROUPS.has(category.group.trim().toLowerCase());
}

export function getBillCategoryOptions(
  categories: Category[],
  currentCategoryId?: string
): Category[] {
  return categories.filter(
    (category) =>
      isBillEligibleCategory(category) || category.id === currentCategoryId
  );
}

export function isBillCategorySelectionAllowed(
  categories: Category[],
  selectedCategoryId: string,
  currentCategoryId?: string
): boolean {
  if (!selectedCategoryId) return true;
  const category = categories.find((item) => item.id === selectedCategoryId);
  if (!category) return false;
  return isBillEligibleCategory(category) || selectedCategoryId === currentCategoryId;
}
