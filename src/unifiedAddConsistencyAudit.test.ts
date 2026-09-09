import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const planned = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('unified Add consistency follow-up', () => {
  it('keeps Bill as PlannedPayment while preserving the same six-choice launcher shell', () => {
    expect(planned).toContain('data-unified-add={isUnifiedAdd');
    expect(planned).toContain('<UnifiedAddTypeTabs');
    expect(planned).toContain('activeType="bill"');
    expect(sharedUi).toContain('mv-transaction-type-tabs');
    for (const label of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) expect(sharedUi).toContain(`'${label}'`);
    expect(sharedUi).toContain('aria-pressed={activeType === type}');
    expect(planned).toContain('await onSave({');
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
  });

  it('does not couple Bill to Transaction save semantics', () => {
    expect(planned).not.toContain('createTransaction');
    expect(planned).not.toContain("type: 'bill'");
    expect(tx).not.toContain("handleTypeChange('bill'");
    expect(bridge).not.toContain('onSave');
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

  it('removes in-field helper prompts across both unified Transaction and Bill forms at runtime', () => {
    expect(bridge).toContain('removeInFieldHelperText');
    expect(bridge).toContain("querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[placeholder]')");
    expect(bridge).toContain("control.removeAttribute('placeholder')");
    expect(bridge).toContain("option.value === ''");
    expect(bridge).toContain("emptyOption.textContent = ''");
    expect(bridge).toContain('MutationObserver');
    expect(css).toContain('::placeholder');
    expect(css).toContain('color: transparent !important');
  });

  it('keeps native transaction date semantics and vertically centres its themed surface', () => {
    expect(tx).toContain('id="transaction-date" type="date"');
    expect(css).toContain('background: var(--field) !important');
    expect(css).toContain('position: relative');
    expect(css).toContain('z-index: 3');
    expect(css).toContain('line-height: 40px !important');
    expect(css).toContain('padding-block: 0 !important');
    expect(css).not.toContain('type="text" value={date}');
  });

  it('uses one fixed Phone shell geometry for all five Transaction choices and unified Bill', () => {
    expect(css).toContain('.mv-transaction-modal:has(.mv-transaction-type-tab[aria-label="Add bill"])');
    expect(css).toContain('.mv-add-bill-modal[data-unified-add="true"]');
    expect(css).toContain('width: calc(100vw - 24px) !important');
    expect(css).toContain('min-height: 92dvh !important');
    expect(css).toContain('height: 92dvh !important');
    expect(css).toContain('max-height: 92dvh !important');
  });

  it('keeps unified Bill inside the iPhone visual safe area like the Transaction shell', () => {
    expect(css).toContain('.mv-layout-phone:has(.mv-add-bill-modal[data-unified-add="true"]) .mv-nav-mobile');
    expect(css).toContain('display: none !important');
    expect(css).toContain('.mv-layout-phone:has(.mv-add-bill-modal[data-unified-add="true"]) .mv-modal-backdrop');
    expect(css).toContain('calc(8px + env(safe-area-inset-bottom)) !important');
  });

  it('uses the same semantic field surface for Transaction and unified Bill controls', () => {
    expect(css).toContain('.mv-transaction-control');
    expect(css).toMatch(/\.mv-add-bill-modal\[data-unified-add="true"\] :is\([\s\S]*background: var\(--field\) !important/);
    expect(css).toContain('border-color: var(--border) !important');
    expect(css).toContain('color: var(--text) !important');
  });

  it('uses the exact Transaction footer and button contract for unified Bill', () => {
    expect(planned).toContain('<UnifiedAddFooter');
    expect(planned).toContain('className="mv-add-bill-actions"');
    expect(sharedUi).toContain('mv-modal-fixed-actions');
    expect(sharedUi).toContain('className="mv-transaction-secondary"');
    expect(sharedUi).toContain('className="mv-transaction-primary disabled:opacity-50"');
    expect(planned).toContain("isUnifiedAdd ? 'Record Bill' : 'Add Bill'");
    expect(css).toContain('.mv-modal-fixed-actions > button');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('background: var(--primary) !important');
    expect(css).toContain('color: var(--text-on-primary) !important');
    expect(css).not.toContain('grid-template-columns: 1fr 1fr');
  });

  it('remounts the unified Transaction form when switching ordinary creation types so drafts cannot leak', () => {
    expect(bridge).toContain('openFreshUnifiedTransaction');
    expect(bridge).toContain("document.addEventListener(\n    'click'");
    expect(bridge).toContain('event.stopImmediatePropagation()');
    expect(bridge).toContain('[aria-label="Close transaction dialog"]');
    expect(bridge).toContain('openFreshUnifiedTransaction(nextType)');
    expect(bridge).toContain("const TRANSACTION_TYPES = ['expense', 'income', 'transfer', 'refund', 'repayment'] as const");
    expect(bridge).not.toContain('createTransaction');
    expect(bridge).not.toContain('createPlannedPayment');
  });

  it('does not expose an intermediate launcher frame while switching unified Add types', () => {
    expect(bridge).toContain('selectUnifiedTransactionType');
    expect(bridge).toContain('queueMicrotask(() => selectUnifiedTransactionType(type))');
    expect(bridge).not.toContain('requestAnimationFrame');
  });

  it('does not recursively intercept bridge-generated transaction tab clicks', () => {
    expect(bridge).toContain('let isSelectingUnifiedType = false');
    expect(bridge).toContain('isSelectingUnifiedType = true');
    expect(bridge).toContain('isSelectingUnifiedType = false');
    expect(bridge).toContain('if (isSelectingUnifiedType) return');
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
