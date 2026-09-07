import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDateKeyUk } from './utils/dateInput';

const activity = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionList.tsx'),
  'utf8'
);

describe('Activity UK date display regression', () => {
  it('formats stored transaction date keys as UK dates for display', () => {
    expect(formatDateKeyUk('2026-09-01')).toBe('01/09/2026');
    expect(formatDateKeyUk('2026-12-31')).toBe('31/12/2026');
  });

  it('uses the shared UK formatter in Activity rows', () => {
    expect(activity).toContain("import { formatDateKeyUk } from '../utils/dateInput'");
    expect(activity).toContain('<span>{formatDateKeyUk(tx.date)}</span>');
    expect(activity).not.toContain('<span>{tx.date}</span>');
  });

  it('does not alter stored transaction dates or mutation logic', () => {
    expect(activity).toContain('transactions={');
    expect(activity).not.toContain('tx.date =');
    expect(activity).not.toContain('updateTransaction(');
  });
});
