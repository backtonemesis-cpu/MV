/** V2 classification model. Financial event type remains authoritative. */
export type CategoryScope = 'expense' | 'income' | 'system';
export type SystemCategoryRole = 'internal-transfer' | 'uncategorised-expense' | 'uncategorised-income';

export interface CategoryGroup {
  readonly id: string;
  name: string;
  scope: CategoryScope;
  sortOrder: number;
  isArchived: boolean;
  isSystem: boolean;
  isProtected: boolean;
}

export interface CategoryV2 {
  readonly id: string;
  name: string;
  groupId: string;
  sortOrder: number;
  isArchived: boolean;
  isSystem: boolean;
  isProtected: boolean;
  systemRole?: SystemCategoryRole;
  /** A merged source is retained permanently; it cannot be restored or reused. */
  supersededById?: string;
}

export interface MonthlyCategoryBudget {
  monthKey: string;
  categoryId: string;
  budgetAmountPence: number;
}

export interface CategoryCatalogue {
  categoryGroups: CategoryGroup[];
  categories: CategoryV2[];
  monthlyCategoryBudgets: MonthlyCategoryBudget[];
}
