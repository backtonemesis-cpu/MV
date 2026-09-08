import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const planned = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const bridge = fs.readFileSync(path.join(src, 'unifiedAddBridge.ts'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('unified Add consistency follow-up', () => {
  it('keeps Bill as PlannedPayment while preserving the same six-choice launcher shell', () => {
    expect(planned).toContain('data-unified-add={isUnifiedAdd');
    expect(planned).toContain('mv-transaction-type-tabs');
    for (const label of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) expect(planned).toContain(label);
    expect(planned).toContain('aria-pressed="true"');
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

  it('makes launcher choices button-like using semantic appearance tokens', () => {
    expect(css).toContain('.mv-transaction-type-tab {');
    expect(css).toContain('var(--border-strong)');
    expect(css).toContain('var(--field)');
    expect(css).toContain('var(--primary)');
    expect(css).toContain('[aria-pressed="true"]');
    expect(css).toContain('display: inline-flex');
    expect(css).toContain('white-space: nowrap');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('keeps the Repayment label contained on Phone without widening the launcher', () => {
    expect(css).toMatch(/\.mv-layout-phone \.mv-transaction-type-tab[\s\S]*font-size: 0\.8125rem/);
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).not.toContain('calc(100% +');
    expect(css).not.toContain('margin-right: -');
  });

  it('removes only redundant payer/recipient helper presentation and leaves transfer logic untouched', () => {
    expect(css).toContain('[aria-labelledby="transaction-person-label"] + .text-subtle');
    expect(tx).toContain("if (!isTransfer && !payer)");
    expect(tx).toContain("if (newType === 'transfer')");
  });

  it('keeps native transaction date semantics and paints the value above the themed frame', () => {
    expect(tx).toContain('id="transaction-date" type="date"');
    expect(css).toContain('background: var(--field) !important');
    expect(css).toContain('position: relative');
    expect(css).toContain('z-index: 3');
    expect(css).toContain('line-height: 40px !important');
    expect(css).not.toContain('type="text" value={date}');
  });

  it('uses one fixed Phone shell geometry for transaction choices and unified Bill', () => {
    expect(css).toContain('.mv-add-bill-modal[data-unified-add="true"]');
    expect(css).toMatch(/\.mv-layout-phone :is\([\s\S]*\.mv-transaction-modal,[\s\S]*\.mv-add-bill-modal\[data-unified-add="true"\][\s\S]*height: 92dvh !important/);
    expect(css).toContain('min-height: 92dvh !important');
    expect(css).toContain('max-height: 92dvh !important');
  });

  it('uses the shared semantic field surface and Transaction-style footer for unified Bill only', () => {
    expect(css).toMatch(/\.mv-add-bill-modal\[data-unified-add="true"\] :is\([\s\S]*background: var\(--field\) !important/);
    expect(css).toContain('.mv-add-bill-actions > button:first-child');
    expect(css).toContain('.mv-add-bill-actions > button:last-child');
    expect(css).toContain('background: var(--primary) !important');
    expect(css).toContain('color: var(--text-on-primary) !important');
    expect(planned).toContain('className="mv-modal-actions mv-add-bill-actions"');
  });

  it('keeps phone launcher contained without width hacks', () => {
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('max-width: 100%');
    expect(css).not.toContain('calc(100% +');
    expect(css).not.toContain('margin-right: -');
  });
});
