import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Dashboard.tsx'),
  'utf8'
);

describe('Dashboard v4.31 selected-month semantics', () => {
  it('uses the shared UK-readable month label while retaining the month key internally', () => {
    expect(dashboard).toContain('formatDateKeyUk,');
    expect(dashboard).toContain('formatMonthKeyUk,');
    expect(dashboard).toContain('localDateInputValue,');
    expect(dashboard).toContain('const visibleMonthLabel = formatMonthKeyUk(selectedMonth);');
    expect(dashboard).toContain('payment.month === selectedMonth');
    expect(dashboard).toContain('income.month === selectedMonth');
    expect(dashboard).toContain('calculateMonthlySurplus(');
    expect(dashboard).toContain('selectedMonth,');
    expect(dashboard).toContain('<h1>{visibleMonthLabel}</h1>');
  });

  it('keeps current/past/future meaning explicit and refreshes UK-local today while open', () => {
    expect(dashboard).toContain("type TemporalMode = 'past' | 'current' | 'future';");
    expect(dashboard).toContain('const currentMonth = todayKey.slice(0, 7);');
    expect(dashboard).toContain("const intervalId = window.setInterval(refreshToday, 60_000);");
    expect(dashboard).toContain("window.addEventListener('focus', refreshToday);");
    expect(dashboard).toContain("document.addEventListener('visibilitychange', refreshToday);");
    expect(dashboard).toContain("temporalMode === 'future'");
    expect(dashboard).toContain('Not started');
  });
});
