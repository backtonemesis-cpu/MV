import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Dashboard.tsx'),
  'utf8'
);

describe('GLOBAL-COPY-001 Dashboard month display', () => {
  it('uses the shared readable month label for all user-facing month text', () => {
    expect(dashboard).toContain("import { formatMonthKeyUk } from '../utils/dateInput';");
    expect(dashboard).toContain('const visibleMonthLabel = formatMonthKeyUk(selectedMonth);');
    expect(dashboard).toContain('<span>{visibleMonthLabel}</span>');
    expect(dashboard).toContain('>{visibleMonthLabel}</h2>');
    expect(dashboard).toContain('>{visibleMonthLabel} • {monthPlannedPayments.length} bill');
    expect(dashboard).toContain('No bills for {visibleMonthLabel}');
    expect(dashboard).toContain('>{visibleMonthLabel} • {monthTransactions.length} transaction');
    expect(dashboard).toContain('No transactions for {visibleMonthLabel}');
  });

  it('keeps selectedMonth as the internal month key for filters and calculations', () => {
    expect(dashboard).toContain('tx.date.startsWith(selectedMonth)');
    expect(dashboard).toContain('p.month === selectedMonth');
    expect(dashboard).toContain('calculateMonthlySurplus(household.transactions, household.plannedPayments || [], selectedMonth');
  });
});
