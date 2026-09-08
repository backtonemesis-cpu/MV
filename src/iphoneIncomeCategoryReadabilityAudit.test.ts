import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanonicalCatalogue } from './categories/registry';
import { createCategoryEligibility } from './utils/categoryEligibility';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Step 44 iPhone income category readability contract', () => {
  it('keeps the canonical long income category intact with stable id/value semantics', () => {
    const catalogue = createCanonicalCatalogue();
    const category = catalogue.categories.find((item) => item.id === 'cat-child-maintenance-received');

    expect(category).toBeDefined();
    expect(category?.name).toBe('Child Maintenance Received');
    expect(category?.id).toBe('cat-child-maintenance-received');
  });

  it('keeps ordinary Income category options correctly scoped', () => {
    const catalogue = createCanonicalCatalogue();
    const eligibility = createCategoryEligibility(catalogue.categoryGroups);
    const options = eligibility.getTransactionCategoryOptions(catalogue.categories, 'income', []);
    const names = options.map((item) => item.name);

    expect(names).toEqual([
      'Salary & Wages',
      'Universal Credit',
      'Child Benefit',
      'Child Maintenance Received',
      'Interest',
      'Bonus & Rewards',
      'Other Income',
    ]);
    expect(names).not.toContain('Uncategorised Income');
    expect(options.every((item) => !item.isSystem)).toBe(true);
  });

  it('preserves the native Category select and categoryId binding in TransactionModal', () => {
    const modal = read('components/TransactionModal.tsx');

    expect(modal).toContain('id="transaction-category"');
    expect(modal).toContain('value={categoryId}');
    expect(modal).toContain('onChange={(e) => setCategoryId(e.target.value)}');
    expect(modal).toContain('transactionCategoryOptions.map((cat) =>');
    expect(modal).toContain('<option key={cat.id} value={cat.id}>');
    expect(modal).toContain('{cat.name}');
  });

  it('keeps native iPhone picker activation while containing the Phone Category control', () => {
    const mobileCss = read('mobileUx.css');

    expect(mobileCss).toContain('.mv-layout-phone #transaction-category.mv-transaction-control');
    expect(mobileCss).toContain('-webkit-appearance: menulist;');
    expect(mobileCss).toContain('appearance: auto;');
    expect(mobileCss).toContain('width: 100% !important;');
    expect(mobileCss).toContain('max-width: 100% !important;');
    expect(mobileCss).toContain('margin-inline: 0 !important;');
    expect(mobileCss).toContain('padding-inline: 16px 36px !important;');
    expect(mobileCss).not.toContain('width: calc(100% + 12px)');
    expect(mobileCss).not.toContain('margin-inline-end: -12px');

    // Physical iPhone evidence showed appearance:none made the selected Category
    // field unreliable to reopen. Do not reintroduce custom select chrome here.
    expect(mobileCss).not.toContain('#transaction-category.mv-transaction-control {\n    -webkit-appearance: none;');
    expect(mobileCss).not.toContain('#transaction-category.mv-transaction-control {\n    appearance: none;');

    // Guard against broadening this narrow treatment to unrelated selects.
    expect(mobileCss).not.toContain('.mv-layout-phone select.mv-transaction-control {');
  });
});
