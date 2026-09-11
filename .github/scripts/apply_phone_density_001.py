from pathlib import Path

ROOT = Path.cwd()
INCOME = ROOT / "src/components/IncomeView.tsx"
SAVINGS = ROOT / "src/components/SavingsView.tsx"
TEST = ROOT / "src/phoneSummaryDensityAudit.test.ts"
LEDGER = ROOT / "docs/GLOBAL-AUDIT-LEDGER.md"
WORKFLOW = ROOT / ".github/workflows/phone-density-001.yml"
SELF = ROOT / ".github/scripts/apply_phone_density_001.py"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}: found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    INCOME,
    'className="grid grid-cols-1 gap-2 sm:grid-cols-3"',
    'className="grid grid-cols-3 gap-2 sm:grid-cols-3"',
)
replace_once(
    SAVINGS,
    'className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"',
    'className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"',
)

TEST.write_text(
    """import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(path.resolve(process.cwd(), 'src/components/IncomeView.tsx'), 'utf8');
const savings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SavingsView.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');

describe('PHONE-DENSITY-001 summary metric density', () => {
  it('keeps the three Income summary metrics in one phone row', () => {
    expect(income).toContain('className="grid grid-cols-3 gap-2 sm:grid-cols-3"');
    expect(income).not.toContain('className="grid grid-cols-1 gap-2 sm:grid-cols-3"');
  });

  it('keeps the four Savings summary metrics in a two-column phone grid', () => {
    expect(savings).toContain('className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"');
    expect(savings).not.toContain('className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"');
  });

  it('preserves the already-dense Dashboard two-column phone metrics', () => {
    expect(dashboard).toContain('className="mv-dashboard-metrics grid grid-cols-2 gap-3 lg:grid-cols-4"');
  });
});
""",
    encoding="utf-8",
)

ledger = LEDGER.read_text(encoding="utf-8").rstrip()
marker = "### PHONE-DENSITY-001 — Summary metrics consume excessive iPhone vertical space"
if marker in ledger:
    raise RuntimeError("PHONE-DENSITY-001 ledger marker already exists")
ledger += """

### PHONE-DENSITY-001 — Summary metrics consume excessive iPhone vertical space

- **Evidence date:** 2026-09-11.
- **Physical evidence:** current deployed iPhone 13 / Safari / Phone mode shows Income summary metrics (`Expected`, `Received`, `Outstanding`) and Savings summary metrics as full-width stacked cards, consuming most of the initial viewport before schedule/breakdown content becomes visible.
- **Verified deployed baseline:** `e2f50739fcc0e8ba84db1a6717a888b81f45e42e` (PR #199).
- **Source diagnosis:** Dashboard already uses a two-column phone metric grid. Income explicitly uses `grid-cols-1 sm:grid-cols-3`; Savings explicitly uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. The user preference `cardDensity` only changes `.finance-ledger-row` heights and is not the cause of these summary-card layouts.
- **Repair branch:** `repair/phone-summary-density`.
- **Repair contract:** Income uses three columns for its three summary metrics on Phone mode; Savings uses two columns for its four summary metrics. Preserve desktop breakpoints, all calculations/values, card-density preference behavior, storage, navigation, themes, and Dashboard hierarchy.
- **Code/test status:** WORKING until PR CI passes.
- **Physical closure gate:** PENDING. After merge/deploy, re-check Income and Savings on iPhone 13 Phone mode for readability, no horizontal overflow, and materially improved vertical density.
"""
LEDGER.write_text(ledger.rstrip() + "\n", encoding="utf-8")

for path in (WORKFLOW, SELF):
    if path.exists():
        path.unlink()
