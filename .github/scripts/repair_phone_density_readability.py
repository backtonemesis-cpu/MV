from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]

mobile_path = ROOT / 'src/mobileUx.css'
test_path = ROOT / 'src/phoneSummaryDensityAudit.test.ts'
ledger_path = ROOT / 'docs/GLOBAL-AUDIT-LEDGER.md'

mobile = mobile_path.read_text()
old_mobile = '''/* PHONE-DENSITY-001 physical correction: explicit summary-grid cascade. */
@media (max-width: 40rem) {
  .mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
'''
new_mobile = '''/* PHONE-DENSITY-001 physical correction: readable summary-grid density. */
@media (max-width: 40rem) {
  .mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-income-summary-grid > :last-child {
    grid-column: 1 / -1;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid > article {
    padding: 12px !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid > article > h2 {
    font-size: 12px !important;
    line-height: 1.25 !important;
    letter-spacing: 0.04em !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid > article > div {
    font-size: 18px !important;
    line-height: 1.4 !important;
    letter-spacing: -0.02em !important;
  }
}
'''
if old_mobile not in mobile:
    raise SystemExit('Expected PHONE-DENSITY-001 mobile CSS block was not found; refusing to patch.')
mobile_path.write_text(mobile.replace(old_mobile, new_mobile, 1))

new_test = '''import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(path.resolve(process.cwd(), 'src/components/IncomeView.tsx'), 'utf8');
const savings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SavingsView.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');
const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const mobileCss = fs.readFileSync(path.resolve(process.cwd(), 'src/mobileUx.css'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('PHONE-DENSITY-001 summary metric density', () => {
  it('uses a readable two-column Income summary with Outstanding spanning the second row', () => {
    expect(income).toContain(
      'className="mv-income-summary-grid grid grid-cols-3 gap-2 sm:grid-cols-3"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {'
    );
    expect(mobileCss).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-income-summary-grid > :last-child {'
    );
    expect(mobileCss).toContain('grid-column: 1 / -1;');
  });

  it('keeps Savings at two columns while constraining phone card typography and padding', () => {
    expect(savings).toContain(
      'className="mv-savings-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {'
    );
    expect(mobileCss).toContain('gap: 10px !important;');
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid > article {'
    );
    expect(mobileCss).toContain('padding: 12px !important;');
    expect(mobileCss).toContain('font-size: 18px !important;');
    expect(mobileCss).toContain('letter-spacing: 0.04em !important;');
  });

  it('proves the late mobile stylesheet can override the one-column Phone default', () => {
    expect(indexCss).toContain(
      '.mv-layout-phone .mv-workspace .grid:not(.mv-mobile-nav-grid) {'
    );
    expect(indexCss).toContain(
      'grid-template-columns: minmax(0, 1fr) !important;'
    );

    const indexImport = main.indexOf("import './index.css';");
    const mobileImport = main.indexOf("import './mobileUx.css';");
    expect(indexImport).toBeGreaterThanOrEqual(0);
    expect(mobileImport).toBeGreaterThan(indexImport);
  });

  it('preserves the already-dense Dashboard two-column phone metrics', () => {
    expect(dashboard).toContain(
      'className="mv-dashboard-metrics grid grid-cols-2 gap-3 lg:grid-cols-4"'
    );
  });
});
'''
test_path.write_text(new_test)

ledger = ledger_path.read_text()
needle = '- Physical status remains `FAIL` until the corrective PR is merged/deployed and the live iPhone is reverified.\n'
addition = '''- PR #201 then merged/deployed at `f7c24e2c394527618aa94bb34d270a8a582338fd` with `90/90` test files and `615/615` tests passing. Physical iPhone screenshots proved the cascade correction took effect: Savings rendered 2x2 and Income rendered three columns. However, the three-column Income design was physically unreadable: Expected/Received money values collided across card boundaries and the Outstanding heading was visibly clipped. Savings was structurally correct but remained cramped for long labels and large balances.
- Therefore PHONE-DENSITY-001 remains physical `FAIL`: the defect has moved from cascade failure to responsive readability. The next narrow correction changes only Phone presentation: Income becomes two columns with the third/Outstanding card spanning the second row; Savings remains 2x2 with tighter summary-card padding, heading tracking and money typography.
- This follow-up does not change financial calculations, values, transaction/storage semantics, income/savings classification, desktop layout, navigation or themes. Physical iPhone re-verification remains mandatory after deployment.
'''
if needle not in ledger:
    raise SystemExit('Expected PHONE-DENSITY-001 ledger status line was not found; refusing to patch.')
ledger_path.write_text(ledger.replace(needle, needle + addition, 1))

subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
