import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components', 'Dashboard.tsx'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(src, 'dashboard.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('Dashboard v4.31 PC and narrow-PC source contract', () => {
  it('uses the integrated dual-horizon frame rather than the legacy card wall', () => {
    expect(dashboard).toContain('mv-dashboard-financial-frame');
    expect(dashboard).toContain('mv-dashboard-horizons');
    expect(dashboard).toContain('Available surplus');
    expect(dashboard).toContain('Current cash &amp; savings');
    expect(dashboard).toContain('mv-dashboard-movement-layer');
    expect(dashboard).toContain('>Income</span>');
    expect(dashboard).toContain('>Spending</span>');
    expect(dashboard).toContain('>Bills</span>');
    expect(dashboard).not.toContain('Spending Attribution');
    expect(dashboard).not.toContain('Recent Activity');
    expect(dashboard).not.toContain('View All');
  });

  it('keeps PC actions compact while narrow PC reflows instead of clipping money', () => {
    expect(dashboardCss).toContain('.mv-dashboard-command-row');
    expect(dashboardCss).toContain('@media (max-width: 64rem)');
    expect(dashboardCss).toContain('.mv-layout-pc .mv-dashboard-horizons');
    expect(dashboardCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(dashboardCss).toContain('@media (max-width: 48rem)');
    expect(dashboardCss).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(dashboardCss).toContain('white-space: nowrap;');
    expect(dashboardCss).not.toContain('text-overflow: ellipsis');
    expect(dashboardCss).not.toContain('zoom:');
    expect(dashboardCss).not.toContain('transform: scale(');
  });

  it('keeps the Dashboard stylesheet after the global/mobile layers', () => {
    const globalImport = main.indexOf("import './globalDesignSystem.css';");
    const mobileImport = main.indexOf("import './mobileUx.css';");
    const dashboardImport = main.indexOf("import './dashboard.css';");
    expect(globalImport).toBeGreaterThanOrEqual(0);
    expect(mobileImport).toBeGreaterThan(globalImport);
    expect(dashboardImport).toBeGreaterThan(mobileImport);
  });

  it('uses system UI tabular numerals without a monospace money treatment', () => {
    expect(dashboard).not.toContain('font-mono');
    expect(dashboard).toContain('tabular-nums');
    expect(dashboard).toContain('formatDateKeyUk(event.date)');
  });
});
