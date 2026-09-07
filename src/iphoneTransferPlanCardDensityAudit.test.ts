import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const view = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransferPlanView.tsx'),
  'utf8'
);
const css = fs.readFileSync(
  path.resolve(process.cwd(), 'src/index.css'),
  'utf8'
);

describe('iPhone Transfer Plan collapsed card density regression', () => {
  it('keeps all four financial metrics while giving the card a dedicated mobile layout hook', () => {
    expect(view).toContain('mv-transfer-card-metrics');
    expect(view).toContain('Current balance');
    expect(view).toContain('Selected bills');
    expect(view).toContain('Unpaid in plan');
    expect(view).toContain('{stateMetric.label}');
    expect(view).toContain('{formatPence(requirement.currentBalancePence)}');
    expect(view).toContain('{formatPence(requirement.totalSelectedPaymentsPence)}');
    expect(view).toContain('{formatPence(requirement.totalUnpaidSelectedPaymentsPence)}');
    expect(view).toContain('{formatPence(stateMetric.value)}');
  });

  it('uses a 2x2 metric grid on actual iPhone width instead of stacking four full-width boxes', () => {
    expect(css).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-transfer-card-metrics'
    );
    expect(css).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr)) !important'
    );
    expect(css).toContain(
      '.mv-layout-phone .mv-transfer-card-metrics > div'
    );
  });

  it('does not touch payment, funding, balance or storage mutation logic', () => {
    expect(view).toContain('onMarkPaymentsPaid');
    expect(view).toContain('onUndoPaymentsPaid');
    expect(view).toContain('onUndoFunding');
    expect(css).not.toContain('localStorage');
  });
});
