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
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('removes only redundant payer/recipient helper presentation and leaves transfer logic untouched', () => {
    expect(css).toContain('[aria-labelledby="transaction-person-label"] + .text-subtle');
    expect(tx).toContain("if (!isTransfer && !payer)");
    expect(tx).toContain("if (newType === 'transfer')");
  });

  it('keeps native transaction date semantics while correcting themed surface and vertical geometry', () => {
    expect(tx).toContain('id="transaction-date" type="date"');
    expect(css).toContain('background:var(--field)');
    expect(css).toContain('line-height:40px');
  });

  it('keeps phone launcher contained without width hacks', () => {
    expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(css).toContain('max-width:100%');
    expect(css).not.toContain('calc(100% +');
    expect(css).not.toContain('margin-right:-');
  });
});
