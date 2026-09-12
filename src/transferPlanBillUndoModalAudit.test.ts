import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modal = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UndoBillFundingModal.tsx'),
  'utf8'
);

describe('GA-TP-002 bill-level Undo Funding modal contract', () => {
  it('shows the exact reversible amount and preserves payment/inclusion evidence in its warning copy', () => {
    expect(modal).toContain('Undo funding ${formatPence(activeFundingPence)}');
    expect(modal).toContain(
      'Paid/Unpaid status, Transfer Plan inclusion and linked Activity payment evidence are unchanged.'
    );
    expect(modal).toContain(
      'The destination account may become underfunded or negative after the exact funding reversal.'
    );
    expect(modal).toContain(
      'Its recorded payment will remain recorded after funding is undone.'
    );
  });

  it('uses the shared accessible modal contract and 44px action floor', () => {
    expect(modal).toContain('useModalAccessibility<HTMLElement>(true, onClose)');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('data-modal-initial-focus');
    expect((modal.match(/min-h-11/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
