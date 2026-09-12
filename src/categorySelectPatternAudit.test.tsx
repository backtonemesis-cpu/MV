import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createCanonicalCatalogue } from './categories/registry';
import { createCategoryEligibility } from './utils/categoryEligibility';
import {
  CategorySelect,
  CATEGORY_SEARCH_THRESHOLD,
} from './components/CategorySelect';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/CategorySelect.tsx'),
  'utf8'
);

const catalogue = createCanonicalCatalogue();
const eligibility = createCategoryEligibility(catalogue.categoryGroups);
const expenseCategories = eligibility.getTransactionCategoryOptions(
  catalogue.categories,
  'expense',
  []
);
const incomeCategories = eligibility.getTransactionCategoryOptions(
  catalogue.categories,
  'income',
  []
);

function render(categories = expenseCategories, value = '') {
  return renderToStaticMarkup(
    <CategorySelect
      id="category-test"
      value={value}
      categories={categories}
      categoryGroups={catalogue.categoryGroups}
      onValueChange={vi.fn()}
      ariaLabel="Category"
      className="test-category-control"
    />
  );
}

describe('adaptive category selector pattern', () => {
  it('classifies the canonical expense catalogue as a genuinely long list', () => {
    expect(expenseCategories).toHaveLength(37);
    expect(expenseCategories.length).toBeGreaterThanOrEqual(CATEGORY_SEARCH_THRESHOLD);
  });

  it('keeps the canonical seven-option income category picker native', () => {
    expect(incomeCategories).toHaveLength(7);
    expect(incomeCategories.length).toBeLessThan(CATEGORY_SEARCH_THRESHOLD);

    const html = render(incomeCategories);
    expect(html).toContain('<select');
    expect(html).toContain('id="category-test"');
    expect(html).not.toContain('data-mv-searchable-select');
  });

  it('uses one searchable custom picker for the long expense category list', () => {
    const html = render(expenseCategories);
    expect(html).toContain('data-mv-searchable-select="true"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).not.toContain('<select');
  });

  it('preserves exact category ids as stored values and never substitutes labels', () => {
    const selected = expenseCategories[0];
    const html = render(expenseCategories, selected.id);

    expect(html).toContain(selected.name);
    expect(source).toContain('value: category.id');
    expect(source).toContain('onValueChange={onValueChange}');
  });

  it('searches category name plus group identity while short lists stay native', () => {
    expect(source).toContain('textValue: `${category.name} ${groupName}`');
    expect(source).toContain('secondary: groupName');
    expect(source).toContain('categories.length >= searchableThreshold');
    expect(source).toContain('<select');
    expect(source).toContain('<MVSearchableSelect');
  });
});
