import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components', 'Dashboard.tsx'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(src, 'dashboard.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('Dashboard v4.31 Phone actions and target sizes', () => {
  it('keeps only contextual v4.31 Dashboard actions', () => {
    expect(dashboard).toContain('<span>Add</span>');
    expect(dashboard).toContain('prepareLabel(selectedMonth, targetMonth)');
    expect(dashboard).toContain('Review Plan');
    expect(dashboard).toContain('Open Income');
    expect(dashboard).not.toContain('View All');
    expect(dashboard).not.toContain('View Plan');
    expect(dashboard).not.toContain('Add Bill');
    expect(dashboard).not.toContain('Log Transaction');
  });

  it('uses the shared 44px Phone target floor for page and row actions', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(dashboardCss).toContain('.mv-layout-phone .mv-dashboard-page-actions > button');
    expect(dashboardCss).toContain('min-height: var(--mv-ds-control-large);');
    expect(dashboardCss).toContain('.mv-layout-phone .mv-dashboard-row-action');
  });

  it('renders Phone actions after Plan work and before Upcoming', () => {
    const plan = dashboard.indexOf('mv-dashboard-plan');
    const phoneActions = dashboard.indexOf('mv-dashboard-actions-phone');
    const upcoming = dashboard.indexOf('mv-dashboard-upcoming');
    expect(plan).toBeGreaterThanOrEqual(0);
    expect(phoneActions).toBeGreaterThan(plan);
    expect(upcoming).toBeGreaterThan(phoneActions);
  });
});
