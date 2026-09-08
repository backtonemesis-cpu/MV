import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const mobileCss = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');

describe('iPhone Add Bill containment and field geometry', () => {
  it('uses a dedicated Phone-contained Add Bill contract without changing modal logic', () => {
    expect(mobileCss).toContain('.mv-layout-phone .mv-modal-card:has(#planned-payment-name)');
    expect(mobileCss).toContain('.mv-layout-phone .mv-modal-form:has(#planned-payment-name)');
    expect(mobileCss).toContain('overflow-x: clip');
    expect(mobileCss).toContain('overscroll-behavior-inline: none');
    expect(mobileCss).toContain('grid-template-columns: minmax(0, 1fr) !important');
  });

  it('keeps Add Bill controls inside the containing width without oversized hacks', () => {
    const start = mobileCss.indexOf('/* Add Bill iPhone containment');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = mobileCss.slice(start);
    expect(block).toContain('width: 100%');
    expect(block).toContain('min-width: 0');
    expect(block).toContain('max-width: 100%');
    expect(block).toContain('box-sizing: border-box');
    expect(block).not.toContain('calc(100% +');
    expect(block).not.toContain('margin-right: -');
    expect(block).not.toContain('margin-inline: -');
  });

  it('preserves exact PlannedPayment submission semantics and identifiers', () => {
    expect(modal).toContain('amountPence: pence');
    expect(modal).toContain('month: month.trim()');
    expect(modal).toContain('accountId,');
    expect(modal).toContain('responsiblePerson: responsiblePerson as Payer');
    expect(modal).toContain('dueDate: dueDate || undefined');
    expect(modal).toContain('categoryId: categoryId || undefined');
    expect(modal).toContain('includeInTransferPlan,');
    expect(modal).toContain('isRecurring,');
    expect(modal).toContain('await onSave({');
  });

  it('preserves exact account and category option IDs and eligibility paths', () => {
    expect(modal).toContain('<option key={acc.id} value={acc.id}>');
    expect(modal).toContain('{accountOptionLabel(acc)}');
    expect(modal).toContain('<option key={c.id} value={c.id}>');
    expect(modal).toContain('getBillCategoryOptions');
    expect(modal).toContain('isBillCategorySelectionAllowed');
  });

  it('does not alter New Transaction-specific selectors', () => {
    const start = mobileCss.indexOf('/* Add Bill iPhone containment');
    const block = mobileCss.slice(start);
    expect(block).not.toContain('#transaction-account');
    expect(block).not.toContain('#transaction-category');
    expect(block).not.toContain('.mv-transaction-body');
  });
});
