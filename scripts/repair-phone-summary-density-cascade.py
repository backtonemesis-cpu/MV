from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}: found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


income_path = ROOT / "src/components/IncomeView.tsx"
savings_path = ROOT / "src/components/SavingsView.tsx"
mobile_css_path = ROOT / "src/mobileUx.css"
test_path = ROOT / "src/phoneSummaryDensityAudit.test.ts"
ledger_path = ROOT / "docs/GLOBAL-AUDIT-LEDGER.md"

replace_once(
    income_path,
    'className="grid grid-cols-3 gap-2 sm:grid-cols-3"',
    'className="mv-income-summary-grid grid grid-cols-3 gap-2 sm:grid-cols-3"',
)
replace_once(
    savings_path,
    'className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"',
    'className="mv-savings-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"',
)

mobile_css = mobile_css_path.read_text(encoding="utf-8")
css_marker = "/* PHONE-DENSITY-001 physical correction: explicit summary-grid cascade. */"
if css_marker in mobile_css:
    raise RuntimeError("PHONE-DENSITY-001 mobile CSS correction already present")
mobile_css = mobile_css.rstrip() + "\n\n\n" + css_marker + "\n" + """@media (max-width: 40rem) {
  .mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
"""
mobile_css_path.write_text(mobile_css, encoding="utf-8")

test_path.write_text(
    """import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(path.resolve(process.cwd(), 'src/components/IncomeView.tsx'), 'utf8');
const savings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SavingsView.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');
const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const mobileCss = fs.readFileSync(path.resolve(process.cwd(), 'src/mobileUx.css'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('PHONE-DENSITY-001 summary metric density', () => {
  it('gives the Income summary grid a semantic three-column phone contract', () => {
    expect(income).toContain(
      'className="mv-income-summary-grid grid grid-cols-3 gap-2 sm:grid-cols-3"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-income-summary-grid {'
    );
    expect(mobileCss).toContain(
      'grid-template-columns: repeat(3, minmax(0, 1fr)) !important;'
    );
  });

  it('gives the Savings summary grid a semantic two-column phone contract', () => {
    expect(savings).toContain(
      'className="mv-savings-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"'
    );
    expect(mobileCss).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-savings-summary-grid {'
    );
    expect(mobileCss).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'
    );
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
""",
    encoding="utf-8",
)

ledger = ledger_path.read_text(encoding="utf-8")
ledger_marker = "### 2026-09-11 PHONE-DENSITY-001 corrective reconciliation"
if ledger_marker in ledger:
    raise RuntimeError("PHONE-DENSITY-001 corrective ledger entry already present")
anchor = "\n---\n\n## 2. Device and environment baselines"
if ledger.count(anchor) != 1:
    raise RuntimeError(f"Expected one ledger section-2 anchor, found {ledger.count(anchor)}")
entry = """

### 2026-09-11 PHONE-DENSITY-001 corrective reconciliation

- PR #200 merged and deployed at `eeb19554e0bc5434534ae867ee45cec843392615`; automated CI passed `90/90` test files and `614/614` tests.
- Physical iPhone 13 Safari verification after a genuine page reload still showed the Income summary and Savings summary as single-column stacks. Therefore PR #200 is recorded as technical/deployment `PASS` but physical `FAIL` for the intended density outcome.
- Source trace found the decisive cascade: `src/index.css` forces `.mv-layout-phone .mv-workspace .grid:not(.mv-mobile-nav-grid)` to one column with `!important`. PR #200 changed Tailwind utility classes only, so those utilities could not override the stronger Phone-mode default.
- Corrective branch `repair/phone-summary-density-cascade` adds explicit semantic summary-grid classes and later `src/mobileUx.css` Phone-mode exceptions: Income = three columns, Savings = two columns. The regression test now checks both the component semantic hooks and the stylesheet/import-order cascade rather than only utility class strings.
- No financial calculations, amounts, transactions, storage, income receipt semantics, savings classification, desktop layout, navigation or theme semantics are changed.
- Physical status remains `FAIL` until the corrective PR is merged/deployed and the live iPhone is reverified.
"""
ledger_path.write_text(ledger.replace(anchor, entry + anchor, 1), encoding="utf-8")
