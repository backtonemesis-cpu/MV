import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const planned = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(src, 'components/Dashboard.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('unified Add consistency follow-up', () => {
  it('keeps one six-choice launcher and renders Bill inside the same visible modal shell', () => {
    expect(tx).toContain('<UnifiedAddTypeTabs');
    expect(tx).toContain("isBillEntry ? 'bill'");
    expect(tx).toContain('data-active-add-type={isBillEntry ? \'bill\'');
    for (const label of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) {
      expect(sharedUi).toContain(`'${label}'`);
    }
    expect(sharedUi).toContain('aria-pressed={activeType === type}');
    expect(types).toContain(
      "export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';"
    );
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
  });

  it('keeps Bill financially separate as PlannedPayment despite sharing the visible shell', () => {
    expect(planned).toContain('Partial<PlannedPayment>');
    expect(tx).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(tx).toContain('await onSaveBill({');
    expect(tx).not.toContain("type: 'bill'");
    expect(sharedUi).not.toContain('onSave');
    expect(sharedUi).not.toContain('PlannedPayment');
  });

  it('makes all launcher choices button-like using semantic appearance tokens', () => {
    expect(css).toContain('.mv-transaction-type-tab {');
    expect(css).toContain('var(--border-strong)');
    expect(css).toContain('var(--field)');
    expect(css).toContain('var(--primary)');
    expect(css).toContain('var(--card-radius,');
    expect(css).toContain('[aria-pressed="true"]');
    expect(css).toContain('display: inline-flex');
    expect(css).toContain('white-space: nowrap');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('keeps Repayment contained on Phone without widening the launcher', () => {
    expect(css).toMatch(/\.mv-layout-phone \.mv-transaction-type-tab[\s\S]*font-size: 0\.8125rem/);
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).not.toContain('calc(100% +');
    expect(css).not.toContain('margin-right: -');
  });

  it('removes redundant person entry while preserving account-derived attribution and transfer validation', () => {
    expect(tx).not.toContain('transaction-person-label');
    expect(tx).not.toContain("if (!isTransfer && !payer)");
    expect(tx).toContain('resolveAccountOwnerPayer(sourceAccount, members)');
    expect(tx).toContain("if (newType === 'transfer')");
  });

  it('suppresses text-input helper placeholders while preserving selector prompts and in-place tab navigation', () => {
    expect(bridge).toContain('removeTextInputHelperText');
    expect(bridge).toContain(
      "querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[placeholder]')"
    );
    expect(bridge).toContain("control.removeAttribute('placeholder')");
    expect(bridge).not.toContain("option.value === ''");
    expect(bridge).not.toContain("emptyOption.textContent = ''");
    expect(bridge).toContain('MutationObserver');
    expect(bridge).not.toContain('openFreshUnifiedTransaction');
    expect(bridge).not.toContain('stopImmediatePropagation');
    expect(sharedUi).toContain("<option value=\"\">{placeholder}</option>");
    expect(sharedUi).toContain("selectedAccount ? accountIdentityLabel(selectedAccount) : placeholder");
    expect(css).toContain('::placeholder');
    expect(css).toContain('color: transparent !important');
    expect(css).toContain('.mv-mobile-account-trigger.is-placeholder');
  });

  it('keeps native transaction date semantics and vertically centres its themed surface', () => {
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('value={date}');
    expect(tx).toContain('onChange={(e) => setDate(e.target.value)}');
    expect(css).toContain('background: var(--field) !important');
    expect(css).toContain('position: relative');
    expect(css).toContain('z-index: 3');
    expect(css).toContain('line-height: 40px !important');
    expect(css).toContain('padding-block: 0 !important');
  });

  it('uses one fixed Phone shell geometry for all six Add choices', () => {
    expect(tx).toContain('className="mv-modal-card mv-transaction-modal"');
    expect(tx).toContain('data-active-add-type={isBillEntry ? \'bill\'');
    expect(css).toContain(
      '.mv-transaction-modal:has(.mv-transaction-type-tab[aria-label="Add bill"])'
    );
    expect(css).toContain('width: calc(100vw - 24px) !important');
    expect(css).toContain('min-height: 92dvh !important');
    expect(css).toContain('height: 92dvh !important');
    expect(css).toContain('max-height: 92dvh !important');
  });

  it('uses the same field surface and fixed footer for Transaction and Bill content', () => {
    expect(tx).toContain('id="unified-bill-amount"');
    expect(tx).toContain('id="unified-bill-name"');
    expect(tx).toContain('id="unified-bill-account"');
    expect(tx).toContain('className="mv-transaction-control w-full"');
    expect(tx).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-modal-fixed-actions');
    expect(sharedUi).toContain('className="mv-transaction-secondary"');
    expect(sharedUi).toContain('className="mv-transaction-primary disabled:opacity-50"');
    expect(css).toContain('background: var(--field) !important');
    expect(css).toContain('border-color: var(--border) !important');
    expect(css).toContain('color: var(--text) !important');
  });

  it('switches all six choices in place instead of closing and reopening another modal', () => {
    expect(tx).toContain('const handleUnifiedChoiceChange = (choice: UnifiedAddChoice) =>');
    expect(tx).toContain("if (choice === 'bill')");
    expect(tx).toContain('setIsBillEntry(true)');
    expect(tx).toContain('handleTypeChange(choice)');
    expect(tx).not.toContain('OPEN_BILL_EVENT');
    expect(tx).not.toContain('dispatchEvent(new CustomEvent');
    expect(dashboard).not.toContain('OPEN_BILL_EVENT');
    expect(bridge).not.toContain('document.addEventListener');
  });

  it('keeps fresh-state isolation inside the modal while preserving Date across tab switches', () => {
    expect(tx).toContain('const clearSharedDraft = () =>');
    expect(tx).toContain("setDescription('')");
    expect(tx).toContain("setAmountStr('')");
    expect(tx).toContain("setAccountId('')");
    expect(tx).toContain("setCategoryId('')");
    expect(tx).toContain("setNotes('')");
    const clearDraftStart = tx.indexOf('const clearSharedDraft = () =>');
    const clearDraftEnd = tx.indexOf('\n  };', clearDraftStart);
    expect(tx.slice(clearDraftStart, clearDraftEnd)).not.toContain('setDate(');
    expect(bridge).not.toContain('requestAnimationFrame');
  });

  it('keeps the initial launcher genuinely unselected', () => {
    expect(css).toContain(':not(:has(.mv-transaction-type-tab[aria-pressed="true"]))');
    expect(css).toContain('.mv-transaction-primary');
    expect(css).toContain('display: none !important');
  });

  it('keeps phone launcher contained without width hacks', () => {
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('max-width: 100%');
    expect(css).not.toContain('calc(100% +');
    expect(css).not.toContain('margin-right: -');
  });
});
