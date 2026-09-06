import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Activity filter overlap regression contract', () => {
  it('loads the targeted Activity filter repair after the existing presentation layers', () => {
    const main = read('main.tsx');
    const activityImport = "import './activityFilterRegression.css';";

    expect(main).toContain(activityImport);
    expect(main.indexOf(activityImport)).toBeGreaterThan(main.indexOf("import './accentContrast.css';"));
  });

  it('reserves explicit leading and trailing icon space without changing filter behaviour', () => {
    const css = read('activityFilterRegression.css');
    const activity = read('components/TransactionList.tsx');

    expect(css).toContain('.finance-activity-workspace .finance-filter-control.finance-filter-control-leading');
    expect(css).toContain('padding-left: 2.75rem !important');
    expect(css).toContain('.finance-activity-workspace .finance-filter-control.finance-filter-control-trailing');
    expect(css).toContain('padding-right: 2.75rem !important');
    expect(css).toContain('box-sizing: border-box');
    expect(css).toContain('min-width: 0');

    expect(activity).toContain("const filterInputClassName = 'finance-filter-control';");
    expect(activity).toContain('finance-filter-control-leading');
    expect(activity).toContain('finance-filter-control-trailing');
    expect(activity).toContain('onChange={(event) => setSearch(event.target.value)}');
    expect(activity).toContain('onChange={(event) => setFilterBySelectedMonth(event.target.value === \'selected-month\')}');
  });

  it('keeps the same reserved spacing in responsive/mobile layouts', () => {
    const css = read('activityFilterRegression.css');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toContain('padding-left: 2.75rem !important');
    expect(css).toContain('padding-right: 2.75rem !important');
  });
});
