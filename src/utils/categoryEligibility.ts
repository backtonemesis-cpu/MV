import type { Category } from '../types';

const EXCLUDED_BILL_CATEGORY_GROUPS = new Set(['income', 'transfers', 'savings']);

export function isBillEligibleCategory(category: Category): boolean {
  return !EXCLUDED_BILL_CATEGORY_GROUPS.has(category.group.trim().toLowerCase());
}
