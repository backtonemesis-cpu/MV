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
const launcherCss = fs.readFileSync(
  path.resolve(root, 'public/unified-add-launcher-fix.css'),
  'utf8'
);
const sharedUi = fs.readFileSync(
  path.resolve(root, 'src/components/UnifiedAddUi.tsx'),
  'utf8'
);

describe('unified Bill footer proportions', () => {
  it('keeps both unified creation and direct Bill editing on the shared footer component', () => {
    expect(transactionModal).toContain('<UnifiedAddFooter');
    expect(plannedPaymentModal).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-modal-fixed-actions');
    expect(sharedUi).toContain('className="mv-transaction-secondary"');
    expect(sharedUi).toContain('className="mv-transaction-primary disabled:opacity-50"');
    expect(transactionModal).toContain("'Record Bill'");
  });

  it('uses the same content-sized Cancel and flexible primary action for all six Add types', () => {
    expect(unifiedCss).toMatch(
      /\.mv-transaction-modal:has\(\.mv-transaction-type-tab\[aria-label="Add bill"\]\)[\s\S]*\.mv-modal-fixed-actions > \.mv-transaction-secondary[\s\S]*flex:\s*0 0 auto\s*!important/
    );
    expect(unifiedCss).toMatch(
      /\.mv-transaction-modal:has\(\.mv-transaction-type-tab\[aria-label="Add bill"\]\)[\s\S]*\.mv-modal-fixed-actions > \.mv-transaction-primary[\s\S]*flex:\s*1 1 auto\s*!important/
    );
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-secondary');
    expect(launcherCss).not.toContain('.mv-add-bill-actions .mv-transaction-primary');
    expect(unifiedCss).not.toContain('grid-template-columns: 1fr 1fr');
  });
});
