import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const mobileCss = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('iPhone Add Bill containment and field geometry', () => {
  it('uses a dedicated Phone-contained Add Bill contract without changing modal logic', () => {
    expect(mobileCss).toContain('.mv-layout-phone .mv-modal-card:has(#planned-payment-name)');
    expect(mobileCss).toContain('.mv-layout-phone .mv-modal-form:has(#planned-payment-name)');
    expect(mobileCss).toContain('overflow-x: clip');
    expect(mobileCss).toContain('overscroll-behavior-inline: none');
    expect(mobileCss).toContain('grid-template-columns: minmax(0, 1fr) !important');
  });

  it('keeps Add Bill controls inside the containing width without oversized hacks', () => {
    const start = mobileCss.indexOf('.mv-layout-phone .mv-modal-card:has(#planned-payment-name)');
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

  it('contains Safari native Due Date paint in the same 40px dark field box', () => {
    expect(modal).toContain('id="planned-payment-due-date"');
    expect(modal).toContain('type="date"');
    expect(modal).toContain('value={dueDate}');
    expect(modal).toContain('onChange={(e) => setDueDate(e.target.value)}');

    const wrapperSelector = '.mv-layout-phone .mv-add-bill-scroll .mv-modal-grid-2 > div:has(> #planned-payment-due-date)';
    expect(mobileCss).toContain(wrapperSelector);
    expect(mobileCss).toContain(`${wrapperSelector}::after`);
    expect(mobileCss).toContain('background: var(--field);');

    const selector = '.mv-layout-phone #planned-payment-due-date {';
    const start = mobileCss.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = mobileCss.indexOf('\n  }', start);
    const block = mobileCss.slice(start, end + 4);
    expect(block).toContain('inline-size: 100% !important');
    expect(block).toContain('width: 100% !important');
    expect(block).toContain('min-inline-size: 0 !important');
    expect(block).toContain('max-inline-size: 100% !important');
    expect(block).toContain('height: 40px !important');
    expect(block).toContain('min-height: 40px !important');
    expect(block).toContain('max-height: 40px !important');
    expect(block).toContain('box-sizing: border-box !important');
    expect(block).toContain('background: transparent !important');
    expect(block).toContain('-webkit-appearance: none');
    expect(block).toContain('appearance: none');

    expect(mobileCss).toContain('#planned-payment-due-date::-webkit-date-and-time-value');
    expect(mobileCss).toContain('#planned-payment-due-date::-webkit-calendar-picker-indicator');
  });

  it('separates scrollable bill fields from the non-overlapping action footer', () => {
    expect(modal).toContain('className="mv-modal-card mv-add-bill-modal"');
    expect(modal).toContain('className="mv-modal-form mv-add-bill-form');
    expect(modal).toContain('className="mv-add-bill-scroll mv-modal-scroll-body mv-transaction-body"');
    expect(modal).toContain('<UnifiedAddFooter');
    expect(modal).toContain('className="mv-add-bill-actions"');
    expect(sharedUi).toContain('mv-modal-fixed-actions');

    const scrollStart = modal.indexOf('className="mv-add-bill-scroll');
    const notesIndex = modal.indexOf('id="planned-payment-notes"');
    const actionsIndex = modal.indexOf('<UnifiedAddFooter');
    expect(scrollStart).toBeGreaterThanOrEqual(0);
    expect(notesIndex).toBeGreaterThan(scrollStart);
    expect(actionsIndex).toBeGreaterThan(notesIndex);

    expect(mobileCss).toContain('.mv-layout-phone .mv-add-bill-form');
    expect(mobileCss).toContain('.mv-layout-phone .mv-add-bill-scroll');
    expect(mobileCss).toContain('.mv-layout-phone .mv-add-bill-actions');
    expect(mobileCss).toContain('position: static !important');
    expect(mobileCss).toContain('flex: 0 0 auto');
    expect(mobileCss).toContain('overflow-y: auto');
    expect(mobileCss).toContain('safe-area-inset-bottom');
  });

  it('preserves PlannedPayment submission semantics while deriving or preserving responsibility safely', () => {
    expect(modal).toContain('amountPence: pence');
    expect(modal).toContain('month: month.trim()');
    expect(modal).toContain('accountId,');
    expect(modal).toContain('const selectedAccount = accounts.find((account) => account.id === accountId)');
    expect(modal).toContain('payment && payment.accountId === accountId');
    expect(modal).toContain('? payment.responsiblePerson');
    expect(modal).toContain(': resolveAccountOwnerPayer(selectedAccount, members)');
    expect(modal).toContain('responsiblePerson, dueDate: dueDate || undefined');
    expect(modal).toContain('categoryId: categoryId || undefined');
    expect(modal).toContain('includeInTransferPlan,');
    expect(modal).toContain('isRecurring,');
    expect(modal).toContain('await onSave({');
    expect(modal).not.toContain('planned-payment-person');
  });

  it('preserves exact account and category option IDs and eligibility paths', () => {
    expect(modal).toContain('options={paymentAccountOptions}');
    expect(sharedUi).toContain('<option key={account.id} value={account.id}>');
    expect(sharedUi).toContain('{accountOptionLabel(account)}');
    expect(modal).toContain('<option key={c.id} value={c.id}>');
    expect(modal).toContain('getBillCategoryOptions');
    expect(modal).toContain('isBillCategorySelectionAllowed');
  });

  it('does not alter New Transaction-specific selectors', () => {
    const start = mobileCss.indexOf('.mv-layout-phone .mv-modal-card:has(#planned-payment-name)');
    const block = mobileCss.slice(start);
    expect(block).not.toContain('#transaction-account');
    expect(block).not.toContain('#transaction-category');
    expect(block).not.toContain('.mv-transaction-body');
  });
});
