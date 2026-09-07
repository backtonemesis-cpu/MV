import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDateKeyUk } from './utils/dateInput';

const modalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/BulkPaymentStatusModal.tsx'),
  'utf8'
);

describe('Undo Paid UK date display regression', () => {
  it('formats stored YYYY-MM-DD date keys as UK DD/MM/YYYY for display', () => {
    expect(formatDateKeyUk('2026-09-06')).toBe('06/09/2026');
    expect(formatDateKeyUk('2026-01-02')).toBe('02/01/2026');
    expect(formatDateKeyUk('not-a-date')).toBe('not-a-date');
  });

  it('uses the shared formatter in the Undo Paid evidence row', () => {
    expect(modalSource).toContain("import { formatDateKeyUk, localDateInputValue } from '../utils/dateInput'");
    expect(modalSource).toContain('Paid {formatDateKeyUk(evidence.date)}');
    expect(modalSource).not.toContain('Paid {evidence.date}');
  });
});
