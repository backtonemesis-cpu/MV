import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatMonthShortUk } from './components/MonthPicker';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const monthPicker = fs.readFileSync(path.join(src, 'components/MonthPicker.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('unified Add Billing Month UK-short display', () => {
  it('formats a YYYY-MM value as abbreviated UK month plus year', () => {
    expect(formatMonthShortUk('2026-09')).toBe('Sep 2026');
    expect(formatMonthShortUk('2026-01')).toBe('Jan 2026');
    expect(formatMonthShortUk('')).toBe('');
    expect(formatMonthShortUk('2026-13')).toBe('');
  });

  it('uses the short display only for the unified Bill Billing Month', () => {
    expect(tx).toContain('id="unified-bill-month"');
    expect(tx).toContain('displayFormat="short-uk"');
    expect(tx).toContain('Billing Month');
    expect(monthPicker).toContain("type MonthPickerDisplayFormat = 'native' | 'short-uk'");
    expect(monthPicker).toContain("displayFormat = 'native'");
    expect(monthPicker).toContain('mv-month-picker-short-display');
  });

  it('keeps the native month input and exact month storage unchanged', () => {
    expect(monthPicker).toContain('type="month"');
    expect(monthPicker).toContain('value={value}');
    expect(monthPicker).toContain('onChange={(event) => onChange(event.target.value)}');
    expect(tx).toContain('month: billMonth.trim()');
    expect(types).toContain('month: string;');
    expect(tx).not.toContain("billMonth + '-01'");
    expect(tx).not.toContain('Date.UTC');
  });

  it('overlays only the visible month text and preserves the existing field geometry', () => {
    expect(css).toContain('.mv-unified-add-month.has-short-uk-display');
    expect(css).toContain('-webkit-text-fill-color: transparent !important');
    expect(css).toContain('.mv-month-picker-short-display');
    expect(css).toContain('font-size: 13px');
    expect(css).toContain('font-weight: 500');
    expect(css).toContain('font-size: var(--mv-ds-text-body)');
    expect(css).toContain('line-height: 40px');
    expect(css).toContain('pointer-events: none');
  });
});
