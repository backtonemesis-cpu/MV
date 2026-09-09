import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const plannedPaymentModal = fs.readFileSync(
  path.resolve(root, 'src/components/PlannedPaymentModal.tsx'),
  'utf8'
);
const launcherCss = fs.readFileSync(
  path.resolve(root, 'public/unified-add-launcher-fix.css'),
  'utf8'
);

describe('unified Bill footer proportions', () => {
  it('keeps Bill on the shared footer classes and PlannedPayment workflow', () => {
    expect(plannedPaymentModal).toContain('className="mv-modal-fixed-actions mv-add-bill-actions"');
    expect(plannedPaymentModal).toContain('className="mv-transaction-secondary"');
    expect(plannedPaymentModal).toContain('className="mv-transaction-primary disabled:opacity-50"');
    expect(plannedPaymentModal).toContain("isUnifiedAdd ? 'Record Bill' : 'Add Bill'");
  });

  it('content-sizes Cancel and lets Record Bill consume the remaining footer width', () => {
    expect(launcherCss).toMatch(
      /\.mv-add-bill-modal\[data-unified-add="true"\][\s\S]*\.mv-transaction-secondary[\s\S]*flex:\s*0 0 auto\s*!important/
    );
    expect(launcherCss).toMatch(
      /\.mv-add-bill-modal\[data-unified-add="true"\][\s\S]*\.mv-transaction-primary[\s\S]*flex:\s*1 1 auto\s*!important/
    );
    expect(launcherCss).not.toContain('grid-template-columns: 1fr 1fr');
  });
});
