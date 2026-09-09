import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const transactionModal = fs.readFileSync(
  path.resolve(root, 'src/components/TransactionModal.tsx'),
  'utf8'
);
const plannedPaymentModal = fs.readFileSync(
  path.resolve(root, 'src/components/PlannedPaymentModal.tsx'),
  'utf8'
);
const unifiedCss = fs.readFileSync(
  path.resolve(root, 'src/unifiedAddConsistency.css'),
  'utf8'
);
const sharedUi = fs.readFileSync(
  path.resolve(root, 'src/components/UnifiedAddUi.tsx'),
  'utf8'
);

describe('unified Add footer geometry', () => {
  it('uses the same footer component for unified creation and direct Bill workflows', () => {
    expect(transactionModal).toContain('<UnifiedAddFooter');
    expect(plannedPaymentModal).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-modal-fixed-actions mv-unified-add-footer');
  });

  it('keeps Cancel content-sized and the primary action flexible for every Add choice', () => {
    expect(unifiedCss).toContain('.mv-unified-add-footer {');
    expect(unifiedCss).toContain('grid-template-columns: max-content minmax(0, 1fr) !important');
    expect(unifiedCss).toContain('.mv-unified-add-footer > .mv-transaction-secondary');
    expect(unifiedCss).toContain('min-width: max-content');
    expect(unifiedCss).toContain('.mv-unified-add-footer > .mv-transaction-primary');
    expect(unifiedCss).toContain('width: 100% !important');
    expect(unifiedCss).not.toContain('grid-template-columns: 1fr 1fr');
  });
});
