import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MonthImportModal.tsx'),
  'utf8'
);

describe('Prepare Next Month submenu audit contract', () => {
  it('does not force focus or text selection into the source month on open', () => {
    expect(source).not.toContain('sourceMonthRef');
    expect(source).not.toContain('sourceMonthRef.current?.focus()');
    expect(source).not.toContain('ref={sourceMonthRef}');
    expect(source).not.toMatch(/<MonthPicker[\s\S]*?autoFocus/);
  });

  it('initializes source month from the active period and target to the next month', () => {
    expect(source).toContain("const source = activeMonth || localDateInputValue().slice(0, 7)");
    expect(source).toContain('setSourceMonth(source)');
    expect(source).toContain('setTargetMonth(nextMonth(source))');
  });

  it('keeps rollover scopes explicit and non-mutating until submit', () => {
    expect(source).toContain('setIncludeIncomes(true)');
    expect(source).toContain('setIncludePayments(true)');
    expect(source).toContain('Rollover Expected Income &amp; Wages');
    expect(source).toContain('Rollover Planned Household Bills');
    expect(source).toContain('await onImport({');
  });

  it('defaults expected incomes and recurring bills only, excluding target duplicates', () => {
    expect(source).toContain('.filter((income) => !duplicateIncomeIds.has(income.id))');
    expect(source).toContain('payment.isRecurring === true');
    expect(source).toContain('!duplicatePaymentIds.has(payment.id)');
    expect(source).toContain("candidate.metadata?.copiedFromId");
  });

  it('prevents a same-month target and zero-item preparation', () => {
    expect(source).toContain("if (sourceMonth === targetMonth)");
    expect(source).toContain("Target month must be different from the source month.");
    expect(source).toContain("if (selectedItemCount === 0)");
    expect(source).toContain('disabled={isSubmitting || selectedItemCount === 0}');
  });

  it('keeps both month controls explicitly accessible', () => {
    expect(source).toContain('ariaLabel="Source month"');
    expect(source).toContain('ariaLabel="Target month"');
    expect(source.match(/<MonthPicker/g)?.length).toBe(2);
  });
});
