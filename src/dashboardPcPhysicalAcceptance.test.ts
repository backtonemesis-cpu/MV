import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components', 'Dashboard.tsx'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(src, 'dashboard.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('PC Dashboard physical acceptance contract', () => {
  it('uses desktop width efficiently without changing Dashboard financial calculations', () => {
    expect(dashboard).toContain('mv-dashboard-overview-grid grid grid-cols-1 gap-4 lg:grid-cols-12');
    expect(dashboard).toContain('lg:col-span-4');
    expect(dashboard).toContain('lg:col-span-8');
    expect(dashboard).not.toContain('Household overview');
    expect(dashboard).toContain('Available surplus');
  });

  it('keeps the three primary PC actions in three columns at wide desktop widths', () => {
    expect(dashboardCss).toContain('@media (min-width: 80rem)');
    expect(dashboardCss).toContain('.mv-layout-pc .mv-dashboard-actions');
    expect(dashboardCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');

    const globalImport = main.indexOf("import './globalDesignSystem.css';");
    const dashboardImport = main.indexOf("import './dashboard.css';");
    expect(globalImport).toBeGreaterThanOrEqual(0);
    expect(dashboardImport).toBeGreaterThan(globalImport);
  });

  it('uses system UI tabular numerals and concise finance copy', () => {
    expect(dashboard).not.toContain('font-mono');
    expect(dashboard).toContain('tabular-nums');
    expect(dashboard).toContain("label: 'Transferred from savings'");
    expect(dashboard).toContain("note: 'Internal transfers'");
    expect(dashboard).not.toContain('Moved to fund other accounts');
    expect(dashboard).not.toContain('Authoritative Accounts');
  });

  it('renders Dashboard bill and Activity dates in UK display format', () => {
    expect(dashboard).toContain('formatDateKeyUk, formatMonthKeyUk');
    expect(dashboard).toContain("payment.dueDate ? formatDateKeyUk(payment.dueDate) : 'Flexible'");
    expect(dashboard).toContain('formatDateKeyUk(tx.date)');
  });
});
