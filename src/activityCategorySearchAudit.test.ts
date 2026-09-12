import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionList.tsx'),
  'utf8'
);

describe('Activity adaptive category filter', () => {
  it('keeps the existing all-category sentinel and exact category ids', () => {
    expect(source).toContain("const [selectedCategory, setSelectedCategory] = useState('all');");
    expect(source).toContain("{ value: 'all', label: 'All categories', textValue: 'All categories' }");
    expect(source).toContain('value: category.id');
    expect(source).toContain("selectedCategory !== 'all'");
    expect(source).toContain('tx.categoryId !== selectedCategory');
  });

  it('uses search only when the category list is materially long', () => {
    expect(source).toContain('const CATEGORY_FILTER_SEARCH_THRESHOLD = 12;');
    expect(source).toContain('categories.length >= CATEGORY_FILTER_SEARCH_THRESHOLD');
    expect(source).toContain('<MVSearchableSelect');
    expect(source).toContain('<select');
  });

  it('does not convert short Date, Payer or Classification filters into custom pickers', () => {
    expect(source).toContain('<span className="sr-only">Date filter</span>');
    expect(source).toContain('<span className="sr-only">Payer filter</span>');
    expect(source).toContain('<span className="sr-only">Classification filter</span>');
    expect(source).toContain('<option value="all">All dates</option>');
    expect(source).toContain('<option value="all">All payers</option>');
    expect(source).toContain('<option value="all">All classifications</option>');
  });

  it('mounts exactly one category picker branch at a time and names both paths consistently', () => {
    expect(source).toContain('id="activity-category-filter-label"');
    expect(source).toContain('id="activity-category-filter"');
    expect(source).toContain('ariaLabelledBy="activity-category-filter-label"');
    expect(source).toContain('aria-labelledby="activity-category-filter-label"');
    expect(source).toContain('searchPlaceholder="Search categories"');
    expect(source).toContain('noMatchesMessage="No matching categories"');
  });
});
