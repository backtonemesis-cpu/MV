import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Activity filter overlap root-cause regression contract', () => {
  it('loads the targeted Activity filter repair after the existing presentation layers', () => {
    const main = read('main.tsx');
    const activityImport = "import './activityFilterRegression.css';";

    expect(main).toContain(activityImport);
    expect(main.indexOf(activityImport)).toBeGreaterThan(main.indexOf("import './accentContrast.css';"));
  });

  it('removes the affected leading icons from the text overlay/padding model', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).toContain('finance-filter-icon-shell finance-filter-icon-shell-leading min-w-0');
    expect(activity).toContain('finance-filter-icon-shell-leading finance-filter-icon-shell-trailing');
    expect(activity).toContain('finance-filter-embedded-control finance-filter-embedded-search');
    expect(activity).toContain('finance-filter-embedded-control appearance-none');

    expect(activity).toContain('onChange={(event) => setSearch(event.target.value)}');
    expect(activity).toContain(
      "onChange={(event) => setFilterBySelectedMonth(event.target.value === 'selected-month')}"
    );

    const searchStart = activity.indexOf('<span className="sr-only">Search transactions</span>');
    const payerStart = activity.indexOf('<span className="sr-only">Payer filter</span>');
    const affectedBlock = activity.slice(searchStart, payerStart);

    expect(affectedBlock).not.toContain('absolute left-3');
    expect(affectedBlock).not.toContain('finance-filter-control-leading');
  });

  it('uses dedicated grid columns so icon and value text cannot occupy the same layout track', () => {
    const css = read('activityFilterRegression.css');

    expect(css).toContain('grid-template-columns: 2.5rem minmax(0, 1fr);');
    expect(css).toContain('grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;');
    expect(css).toContain('position: static !important');
    expect(css).toContain('grid-column: 3');
    expect(css).toContain('padding: 0 0.75rem !important');
    expect(css).toContain('height: 38px');
  });

  it('preserves focus treatment and the 44px responsive/mobile target', () => {
    const css = read('activityFilterRegression.css');

    expect(css).toContain('.finance-filter-icon-shell:focus-within');
    expect(css).toContain('border-color: var(--border-strong)');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toContain('height: 44px');
  });

  it('documents the shared density shorthand that caused the production collision', () => {
    const globalCss = read('index.css');

    expect(globalCss).toContain(
      '.mv-density-root input:not([type="checkbox"]):not([type="radio"]),'
    );
    expect(globalCss).toContain('padding: 5px 9px !important');
  });
});
