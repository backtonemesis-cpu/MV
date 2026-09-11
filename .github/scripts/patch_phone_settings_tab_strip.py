from pathlib import Path

CSS_PATH = Path('src/globalDesignSystem.css')
TEST_PATH = Path('src/phoneSettingsTabStripAudit.test.ts')
LEDGER_PATH = Path('docs/GLOBAL-AUDIT-LEDGER.md')

CSS_MARKER = '/* PHONE-SET-001: keep the five Settings tabs in one horizontal strip in Phone mode. */'
CSS_BLOCK = r'''

/* PHONE-SET-001: keep the five Settings tabs in one horizontal strip in Phone mode. */
.mv-layout-phone .mv-settings-tabs > .grid {
  display: flex !important;
  flex: 0 0 auto !important;
  width: max-content !important;
  min-width: 100% !important;
  flex-wrap: nowrap !important;
  align-items: stretch !important;
  gap: var(--mv-ds-space-1) !important;
}

.mv-layout-phone .mv-settings-tabs > .grid > .mv-settings-tab {
  flex: 0 0 auto !important;
  white-space: nowrap !important;
}
'''

TEST_CONTENT = r'''import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsPath = path.resolve(process.cwd(), 'src/components/SettingsView.tsx');
const cssPath = path.resolve(process.cwd(), 'src/globalDesignSystem.css');
const settings = fs.readFileSync(settingsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const phoneRepairStart = css.indexOf(
  '/* PHONE-SET-001: keep the five Settings tabs in one horizontal strip in Phone mode. */'
);
const phoneRepair = phoneRepairStart >= 0 ? css.slice(phoneRepairStart) : '';

describe('PHONE-SET-001 Settings tab strip', () => {
  it('keeps all five Settings destinations in the semantic tablist', () => {
    expect(settings).toContain('aria-label="Settings sections"');
    expect(settings.match(/role="tab"/g)?.length).toBe(5);
    expect(settings).toContain('>\n            Categories\n          </button>');
    expect(settings).toContain('>Appearance</span>');
    expect(settings).toContain('>Household</span>');
    expect(settings).toContain('>Audit</span>');
    expect(settings).toContain('>Backup</span>');
  });

  it('turns the existing two-column wrapper into one non-wrapping horizontal row in Phone mode', () => {
    expect(phoneRepairStart).toBeGreaterThanOrEqual(0);
    expect(phoneRepair).toContain('.mv-layout-phone .mv-settings-tabs > .grid');
    expect(phoneRepair).toContain('display: flex !important;');
    expect(phoneRepair).toContain('width: max-content !important;');
    expect(phoneRepair).toContain('min-width: 100% !important;');
    expect(phoneRepair).toContain('flex-wrap: nowrap !important;');
  });

  it('keeps each Phone-mode tab as an individual non-wrapping scroll item', () => {
    expect(phoneRepair).toContain('.mv-layout-phone .mv-settings-tabs > .grid > .mv-settings-tab');
    expect(phoneRepair).toContain('flex: 0 0 auto !important;');
    expect(phoneRepair).toContain('white-space: nowrap !important;');
  });

  it('preserves horizontal overflow on the Settings tablist instead of clipping destinations', () => {
    expect(css).toContain('.mv-layout-phone .mv-settings-tabs');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('-webkit-overflow-scrolling: touch');
  });
});
'''

LEDGER_MARKER = '### PHONE-SET-001 — Settings tabs stack instead of forming the Phone-mode tab strip'
LEDGER_BLOCK = r'''

### PHONE-SET-001 — Settings tabs stack instead of forming the Phone-mode tab strip

- **Evidence date:** 2026-09-11.
- **Physical evidence:** current deployed iPhone 13 / Safari / Phone mode shows `Categories` visually detached above `Appearance`, `Household`, `Audit`, and `Backup`, with the remaining tabs stacked vertically inside a tall Settings navigation card.
- **Verified deployed baseline:** `8f44092df25ecd733136e16598e49f7e12c45909` (PR #198).
- **Source root cause:** `SettingsView.tsx` correctly exposes five ARIA tabs but nests them in a responsive `grid grid-cols-2 ... sm:grid-cols-5` wrapper. Phone-mode CSS makes the outer `.mv-settings-tabs` horizontally scrollable and styles `.mv-settings-tab`, but does not neutralise the nested grid, so the two-column grid wins visually.
- **Repair branch:** `repair/phone-settings-tab-strip`.
- **Repair contract:** in `.mv-layout-phone` only, convert the existing nested grid wrapper to a single non-wrapping max-content flex row so all five tabs participate in one horizontally scrollable strip. Preserve the five tab identities, ARIA semantics, keyboard behavior, desktop layout, category functionality, finance/storage truth, and theme data.
- **Code/test status:** WORKING until PR CI passes.
- **Physical closure gate:** PENDING. After merge/deploy, re-check Settings on iPhone 13 Phone mode and laptop Phone mode. Do not claim physical PASS from source or CI alone.
'''

css = CSS_PATH.read_text()
if CSS_MARKER in css:
    raise SystemExit('PHONE-SET-001 CSS marker already exists; refusing duplicate patch')
if '.mv-layout-phone .mv-settings-tabs' not in css or 'overflow-x: auto' not in css:
    raise SystemExit('Expected existing Phone-mode Settings tab scroll contract not found')
CSS_PATH.write_text(css.rstrip() + CSS_BLOCK + '\n')

if TEST_PATH.exists():
    raise SystemExit(f'{TEST_PATH} already exists; refusing overwrite')
TEST_PATH.write_text(TEST_CONTENT)

ledger = LEDGER_PATH.read_text()
if LEDGER_MARKER in ledger:
    raise SystemExit('PHONE-SET-001 ledger marker already exists; refusing duplicate entry')
LEDGER_PATH.write_text(ledger.rstrip() + LEDGER_BLOCK + '\n')

Path('.github/scripts/patch_phone_settings_tab_strip.py').unlink()
Path('.github/workflows/phone-settings-tab-strip-patch.yml').unlink()
