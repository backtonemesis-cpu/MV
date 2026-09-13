import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components', 'Dashboard.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'dashboard.css'), 'utf8');

describe('Dashboard v4.31 implementation contract', () => {
  it('consumes existing authoritative finance helpers instead of defining new headline arithmetic', () => {
    expect(dashboard).toContain('calculateMonthlySurplus(');
    expect(dashboard).toContain('calculateLiquidFundsPence(household.accounts)');
    expect(dashboard).toContain('calculateSavingsPosition(');
    expect(dashboard).toContain('isPlannedPaymentEffectivelyPaid(');
    expect(dashboard).toContain('generateTransferPlan(');
    expect(dashboard).not.toContain('calculateTransferredFromSavingsPence');
  });

  it('implements the two horizon frame and exactly the three selected-month movement classes', () => {
    expect(dashboard).toContain('Selected month');
    expect(dashboard).toContain('Available surplus');
    expect(dashboard).toContain('Current cash &amp; savings');
    expect(dashboard).toContain('in savings &amp; cash accounts');
    expect(dashboard).toContain('mv-dashboard-movement-layer');
    expect(dashboard.match(/className="mv-dashboard-movement"/g)?.length).toBe(3);
    expect(dashboard).not.toContain('Spending Attribution');
    expect(dashboard).not.toContain('Recent Activity');
    expect(dashboard).not.toContain('Actual Inflow');
    expect(dashboard).not.toContain('Transferred from savings');
  });

  it('keeps funding separate from payment and uses the paid-state resolver for bill status', () => {
    expect(dashboard).toContain("? 'Outstanding'");
    expect(dashboard).toContain("? 'All paid'");
    expect(dashboard).toContain('Funding to review');
    expect(dashboard).toContain('Review Plan');
    expect(dashboard).not.toContain("payment.status === 'paid'");
  });

  it('implements deterministic Attention and Upcoming limits with real date eligibility', () => {
    expect(dashboard).toContain('payment.dueDate < todayKey');
    expect(dashboard).toContain('income.expectedDate < todayKey');
    expect(dashboard).toContain('payment.dueDate >= todayKey');
    expect(dashboard).toContain('income.expectedDate >= todayKey');
    expect(dashboard).toContain("if (temporalMode === 'past') return [] as DashboardEvent[];");
    expect(dashboard).toContain('events.sort(eventSort).slice(0, 2)');
    expect(dashboard).toContain('attentionEvents.slice(0, 3)');
    expect(dashboard).toContain("if (a.kind !== b.kind) return a.kind === 'bill' ? -1 : 1;");
  });

  it('makes Prepare target-relative, calendar-gated and duplicate-aware', () => {
    expect(dashboard).toContain('targetMonth < currentMonth');
    expect(dashboard).toContain('isRolloverPaymentDuplicate(');
    expect(dashboard).toContain('isRolloverIncomeDuplicate(');
    expect(dashboard).toContain('prepareLabel(selectedMonth, targetMonth)');
    expect(dashboard).toContain('from ${visibleMonthLabel}');
    expect(dashboard).not.toContain('Prepare Next Month');
  });

  it('keeps View-only free of edit actions and separates PC/Phone action placement', () => {
    expect(dashboard).toContain("const canEdit = userRole === 'owner' || userRole === 'editor';");
    expect(dashboard).toContain('const actionControls = canEdit ? (');
    expect(dashboard).toContain('mv-dashboard-actions-pc');
    expect(dashboard).toContain('mv-dashboard-actions-phone');
    expect(css).toContain('.mv-layout-phone .mv-dashboard-actions-pc');
    expect(css).toContain('.mv-layout-pc .mv-dashboard-actions-phone');
  });

  it('protects exact Dashboard money and sign cues when balances are masked', () => {
    expect(dashboard).toContain('mv-dashboard-private-money mv-private-value tabular-nums');
    expect(css).toContain('.mv-privacy-mask .mv-dashboard-v431 .mv-dashboard-private-money');
    expect(css).toContain('visibility: hidden;');
    expect(css).toContain('content: "••••••";');
    expect(css).toContain('.mv-dashboard-value-state,');
    expect(css).toContain('.mv-dashboard-current-adverse');
  });

  it('includes the required <=352px global-shell compatibility repair', () => {
    expect(css).toContain('@media (max-width: 22rem)');
    expect(css).toContain('.mv-layout-switcher-option > span');
    expect(css).toContain('grid-template-columns: repeat(2, var(--mv-ds-control-large)) !important;');
    expect(css).toContain('width: var(--mv-ds-control-large) !important;');
    expect(css).toContain('min-width: var(--mv-ds-control-large) !important;');
  });
});
