import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { localMonthInputValue } from './utils/dateInput';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const appSource = read('App.tsx');
const plannedPaymentSource = read('components/PlannedPaymentModal.tsx');
const budgetSource = read('components/BudgetView.tsx');
const localStoreSource = read('localStore.ts');

describe('dynamic UK-local active month', () => {
  it('uses the local calendar month at month and year rollover boundaries', () => {
    expect(localMonthInputValue(new Date(2026, 8, 30, 23, 59, 59))).toBe('2026-09');
    expect(localMonthInputValue(new Date(2026, 9, 1, 0, 0, 0))).toBe('2026-10');
    expect(localMonthInputValue(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12');
    expect(localMonthInputValue(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01');
  });

  it('initialises the authoritative app working month from the shared local helper', () => {
    expect(appSource).toContain("import { localDateInputValue, localMonthInputValue } from './utils/dateInput';");
    expect(appSource).toContain('useState<string>(() => localMonthInputValue())');
    expect(appSource).not.toContain("useState<string>('2026-09')");
  });

  it('propagates that authoritative month through production month-aware views and forms', () => {
    expect(appSource).toContain('selectedMonth={selectedMonth}');
    expect(appSource).toContain('activeMonth={selectedMonth}');
    expect(appSource).toContain('commitmentMonth: selectedMonth');
    expect(appSource).toContain('setSelectedMonth(params.targetMonth)');
  });

  it('keeps standalone bill and budget fallbacks dynamic rather than September-fixed', () => {
    expect(plannedPaymentSource).toContain('activeMonth || localMonthInputValue()');
    expect(plannedPaymentSource).not.toContain("activeMonth || '2026-09'");
    expect(budgetSource).toContain('useState(() => localMonthInputValue())');
    expect(budgetSource).not.toContain("useState('2026-09')");
  });

  it('preserves the historical September migration identifier', () => {
    expect(localStoreSource).toContain(
      "export const LEGACY_SOURCE_SEED_MIGRATION_ID = 'source-budget-2026-09-v2';"
    );
  });
});
