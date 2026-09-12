import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src/components');
const read = (name: string) => fs.readFileSync(path.join(SRC, name), 'utf8');

const plannedPayment = read('PlannedPaymentModal.tsx');
const budgets = read('CategoryBudgets.tsx');
const correction = read('CategoryCorrection.tsx');
const adapter = read('CategorySelect.tsx');

describe('adaptive long-category consumer migration', () => {
  it('routes Bill category selection through the adaptive category field without changing bill eligibility validation', () => {
    expect(plannedPayment).toContain("import { CategorySelect } from './CategorySelect';");
    expect(plannedPayment).toContain('id="planned-payment-category"');
    expect(plannedPayment).toContain('categories={billCategoryOptions}');
    expect(plannedPayment).toContain('categoryGroups={categoryGroups}');
    expect(plannedPayment).toContain('onValueChange={setCategoryId}');
    expect(plannedPayment).toContain(
      'isBillCategorySelectionAllowed(categories, categoryId, payment?.categoryId)'
    );
    expect(plannedPayment).not.toMatch(
      /<select[^>]*id="planned-payment-category"/
    );
  });

  it('uses the adaptive field for the long category-budget list and retains explicit required-category validation', () => {
    expect(budgets).toContain("import { CategorySelect } from './CategorySelect';");
    expect(budgets).toContain('id="category-budget-category"');
    expect(budgets).toContain('categories={budgetCategories}');
    expect(budgets).toContain('onValueChange={choose}');
    expect(budgets).toContain("if (!categoryId) throw new Error('Choose a category.');");
    expect(budgets).toContain('setMonthlyCategoryBudget(');
    expect(budgets).not.toMatch(/<select[^>]*category-budget-category/);
  });

  it('uses searchable-capable category fields only for correction source/destination while short policy choices stay native', () => {
    expect(correction).toContain('id="category-correction-source"');
    expect(correction).toContain('id="category-correction-destination"');
    expect(correction).toContain('categories={candidates}');
    expect(correction).toContain('categories={destinations}');
    expect(correction).toContain("category.isArchived ? ' (archived)' : ''");

    // Operation and budget-conflict policy are intentionally short fixed-choice
    // selectors and must remain native rather than being swept into custom UI.
    expect(correction).toContain('<select');
    expect(correction).toContain('<option value="merge">');
    expect(correction).toContain('<option value="sum">');
    expect(correction).toContain('<option value="keep-destination">');
    expect(correction).toContain('<option value="keep-source">');
  });

  it('keeps the adapter count-driven rather than device-driven and preserves stable category ids', () => {
    expect(adapter).toContain('categories.length >= searchableThreshold');
    expect(adapter).not.toContain('window.innerWidth');
    expect(adapter).not.toContain('navigator.userAgent');
    expect(adapter).toContain('value: category.id');
    expect(adapter).toContain('onValueChange={onValueChange}');
  });

  it('preserves custom category display identity in both native and searchable branches', () => {
    expect(adapter).toContain('getCategoryLabel = defaultCategoryLabel');
    expect(adapter).toContain('const displayLabel = getCategoryLabel(category);');
    expect(adapter).toContain('{getCategoryLabel(category)}');
    expect(adapter).toContain('textValue: `${displayLabel} ${category.name} ${groupName}`');
  });
});
