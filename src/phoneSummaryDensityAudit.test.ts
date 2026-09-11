import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(path.resolve(process.cwd(), 'src/components/IncomeView.tsx'), 'utf8');
const savings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SavingsView.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');
const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const mobileCss = fs.readFileSync(path.resolve(process.cwd(), 'src/mobileUx.css'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('PHONE-DENSITY-001 summary metric density', () => {
  it('uses a readable two-column Income summary with Outstanding spanning the second row', () => {
    expect(income).toContain(
      'className="mv-income-summary-grid grid grid-cols-3 gap-2 sm:grid-cols-3"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {'
    );
    expect(mobileCss).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-income-summary-grid > :last-child {'
    );
    expect(mobileCss).toContain('grid-column: 1 / -1;');
  });

  it('keeps Savings at two columns while constraining phone card typography and padding', () => {
    expect(savings).toContain(
      'className="mv-savings-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {'
    );
    expect(mobileCss).toContain('gap: 10px !important;');
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid > article {'
    );
    expect(mobileCss).toContain('padding: 12px !important;');
    expect(mobileCss).toContain('font-size: 18px !important;');
    expect(mobileCss).toContain('letter-spacing: 0.04em !important;');
  });

  it('proves the late mobile stylesheet can override the one-column Phone default', () => {
    expect(indexCss).toContain(
      '.mv-layout-phone .mv-workspace .grid:not(.mv-mobile-nav-grid) {'
    );
    expect(indexCss).toContain(
      'grid-template-columns: minmax(0, 1fr) !important;'
    );

    const indexImport = main.indexOf("import './index.css';");
    const mobileImport = main.indexOf("import './mobileUx.css';");
    expect(indexImport).toBeGreaterThanOrEqual(0);
    expect(mobileImport).toBeGreaterThan(indexImport);
  });

  it('preserves the already-dense Dashboard two-column phone metrics', () => {
    expect(dashboard).toContain(
      'className="mv-dashboard-metrics grid grid-cols-2 gap-3 lg:grid-cols-4"'
    );
  });
});
