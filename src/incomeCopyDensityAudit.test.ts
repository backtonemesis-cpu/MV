import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/IncomeView.tsx'),
  'utf8'
);
const mobileCss = fs.readFileSync(
  path.resolve(process.cwd(), 'src/mobileUx.css'),
  'utf8'
);

describe('PHONE-DENSITY-001 / GLOBAL-COPY-001 Income copy density', () => {
  it('uses a readable visible month label instead of exposing raw YYYY-MM in schedule and empty state copy', () => {
    expect(income).toContain('function incomeMonthLabel(month: string): string {');
    expect(income).toContain("new Intl.DateTimeFormat('en-GB', {");
    expect(income).toContain("month: 'long'");
    expect(income).toContain("year: 'numeric'");
    expect(income).toContain('const visibleMonthLabel = incomeMonthLabel(selectedMonth);');
    expect(income).toContain('{visibleMonthLabel} · {monthIncomes.length} source');
    expect(income).toContain('No income sources for {visibleMonthLabel}');
    expect(income).not.toContain('{selectedMonth} · {monthIncomes.length} source');
    expect(income).not.toContain('No income sources for {selectedMonth}');
  });

  it('removes redundant explanatory copy while retaining concise summary counts', () => {
    expect(income).not.toContain('Expected and received household income for the active month.');
    expect(income).toContain("{monthIncomes.length} source{monthIncomes.length === 1 ? '' : 's'}");
    expect(income).toContain('{monthFullyReceivedCount}/{monthIncomes.length} received');
    expect(income).toContain('{monthRemainingCount} remaining');
    expect(income).not.toContain("payment{monthRemainingCount === 1 ? '' : 's'} remaining");
  });

  it('preserves the approved Phone two-column Income summary geometry', () => {
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

  it('does not alter the financial calculation or write contracts', () => {
    expect(income).toContain('const monthOutstandingPence = Math.max(0, monthExpectedPence - monthReceivedPence);');
    expect(income).toContain('expectedAmountPence,');
    expect(income).toContain('await onMarkIncomeReceived(selectedIncome.id, {');
    expect(income).toContain('await onCreateIncome(payload);');
    expect(income).toContain('await onUpdateIncome(selectedIncome.id, payload);');
  });
});
