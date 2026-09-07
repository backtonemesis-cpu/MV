import type { Category, TransactionType } from '../types';
import { RETIRED_LEGACY_CATEGORY_IDS } from './legacyCategoryMigration';

const EXCLUDED_BILL_CATEGORY_GROUPS = new Set(['income', 'transfers', 'savings']);

function normalizedGroup(category: Category): string {
  return category.group.trim().toLowerCase();
}

function isRetiredLegacyCategory(category: Category): boolean {
  return RETIRED_LEGACY_CATEGORY_IDS.has(category.id);
}

export function isBillEligibleCategory(category: Category): boolean {
  return (
    !isRetiredLegacyCategory(category) &&
    !EXCLUDED_BILL_CATEGORY_GROUPS.has(normalizedGroup(category))
  );
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

export function isTransactionCategoryEligible(
  category: Category,
  type: TransactionType | ''
): boolean {
  if (isRetiredLegacyCategory(category)) return false;
  if (!type) return true;
  const group = normalizedGroup(category);
  if (type === 'income') return group === 'income';
  if (type === 'repayment') return group === 'transfers';
  if (type === 'transfer') return false;
  return !EXCLUDED_BILL_CATEGORY_GROUPS.has(group);
}

export function getTransactionCategoryOptions(
  categories: Category[],
  type: TransactionType | '',
  preservedCategoryIds: string[] = []
): Category[] {
  const preserved = new Set(preservedCategoryIds.filter(Boolean));
  return categories.filter(
    (category) =>
      isTransactionCategoryEligible(category, type) || preserved.has(category.id)
  );
}

export function isTransactionCategorySelectionAllowed(
  categories: Category[],
  type: TransactionType | '',
  selectedCategoryId: string,
  preservedCategoryIds: string[] = []
): boolean {
  if (!selectedCategoryId) return true;
  const category = categories.find((item) => item.id === selectedCategoryId);
  if (!category) return false;
  return (
    isTransactionCategoryEligible(category, type) ||
    preservedCategoryIds.includes(selectedCategoryId)
  );
}