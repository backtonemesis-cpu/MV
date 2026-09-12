import { describe, expect, it } from 'vitest';
import { formatMonthKeyUk } from './utils/dateInput';

describe('GLOBAL-COPY-001 month display formatting', () => {
  it('formats canonical month keys for user-facing UK display', () => {
    expect(formatMonthKeyUk('2026-09')).toBe('September 2026');
    expect(formatMonthKeyUk('2026-01')).toBe('January 2026');
  });

  it('preserves non-canonical values instead of guessing', () => {
    expect(formatMonthKeyUk('September 2026')).toBe('September 2026');
    expect(formatMonthKeyUk('2026-9')).toBe('2026-9');
    expect(formatMonthKeyUk('')).toBe('');
  });
});
