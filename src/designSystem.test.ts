import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const COMPONENT_DIR = path.join(SRC_DIR, 'components');

function collectTsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

describe('semantic design system enforcement', () => {
  it('keeps application JSX free of hardcoded palette utilities', () => {
    const files = [
      path.join(SRC_DIR, 'App.tsx'),
      ...collectTsxFiles(COMPONENT_DIR),
    ];

    const bannedPatterns: { label: string; regex: RegExp }[] = [
      {
        label: 'hardcoded Tailwind palette color',
        regex:
          /\b(?:bg|text|border|divide|ring|outline|fill|stroke)-(?:slate|zinc|neutral|white|black|emerald|amber|rose|cyan|blue|purple|teal|indigo|red|green|orange|yellow)(?:-|\/|\b)/g,
      },
      {
        label: 'arbitrary hex color utility',
        regex: /\b(?:bg|text|border|divide|ring|outline|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
      },
      {
        label: 'direct primary-token arbitrary utility',
        regex: /\b(?:bg|text|border|ring)-\[var\(--primary(?:-light)?\)\]/g,
      },
      {
        label: 'legacy dark color override',
        regex: /\bdark:(?:bg|text|border|divide|ring)-/g,
      },
      {
        label: 'legacy MV color helper',
        regex:
          /\b(?:mv-surface|mv-surface-muted|mv-text|mv-text-muted|mv-border|mv-primary-bg|mv-primary-text|mv-primary-soft|mv-primary-border|mv-primary-button|mv-secondary-button|mv-input|mv-table|mv-overlay|mv-on-primary|mv-on-primary-muted)\b/g,
      },
    ];

    const failures: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const rule of bannedPatterns) {
        const matches = [...source.matchAll(rule.regex)].map((match) => match[0]);
        if (matches.length > 0) {
          failures.push(
            `${path.relative(process.cwd(), file)}: ${rule.label}: ${[...new Set(matches)].join(', ')}`
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('locks the high-density finance regression contracts', () => {
    const dashboard = fs.readFileSync(path.join(COMPONENT_DIR, 'Dashboard.tsx'), 'utf8');
    const plan = fs.readFileSync(path.join(COMPONENT_DIR, 'TransferPlanView.tsx'), 'utf8');
    const income = fs.readFileSync(path.join(COMPONENT_DIR, 'IncomeView.tsx'), 'utf8');
    const savings = fs.readFileSync(path.join(COMPONENT_DIR, 'SavingsView.tsx'), 'utf8');
    const fundingHistory = fs.readFileSync(
      path.join(SRC_DIR, 'utils', 'transferPlanFunding.ts'),
      'utf8'
    );
    const css = fs.readFileSync(path.join(SRC_DIR, 'index.css'), 'utf8');

    // Dashboard telemetry: total fixed bills belong on the primary metric,
    // while outstanding unpaid bills are explanatory secondary text only.
    expect(dashboard).toContain("label: 'Fixed Bills'");
    expect(dashboard).toContain('value: surplusCalculation.fixedBillsTotalPence');
    expect(dashboard).not.toContain(
      "label: 'Fixed Bills',\n      value: surplusCalculation.fixedBillsUnpaidPence"
    );

    // Transfer Plan V2 is a selection + funding workflow, not a second bill
    // editor. Bulk inclusion remains fast, while bill facts stay read-only.
    expect(plan).toContain('Select Unpaid');
    expect(plan).toContain('Select Paid');
    expect(plan).toContain('Select All');
    expect(plan).toContain('Deselect All');
    expect(plan).toContain('Selection only');
    expect(plan).toContain('Bill details are read-only here');
    expect(plan).not.toContain('<PlannedPaymentModal');
    expect(plan).not.toContain('onCreatePlannedPayment');
    expect(plan).not.toContain('onDeletePlannedPayment');
    expect(plan).not.toContain('editingPayment');
    expect(plan).not.toContain('isAddingPayment');

    // Lifecycle states remain explicit and funding evidence is derived through
    // the clean view-model layer rather than ad-hoc component flags.
    expect(plan).toContain('Funding received');
    expect(plan).toContain('Undo Funding');
    expect(plan).toContain('Paid / Complete');
    expect(plan).not.toContain('Accounts Covered / Funded');
    expect(plan).toContain('Funded by Transfer');
    expect(plan).toContain('Covered by Existing Balance');
    expect(plan).toContain('Needs Funding');
    expect(plan).toContain('Paid');
    expect(plan).toContain('Unpaid');
    expect(plan).toContain('buildTransferPlanAccountModels');
    expect(plan).toContain('groupTransferPlanAccountModels');

    // V2 must remain inside the same application-wide visual language used by
    // Dashboard, Accounts and Activity rather than introducing tab-only skin.
    expect(plan).toContain('finance-workspace');
    expect(plan).toContain('finance-panel');
    expect(plan).toContain('finance-summary-card');
    expect(plan).toContain('mv-card');
    expect(plan).toContain('finance-semantic-positive');

    expect(fundingHistory).toContain('transferPlanMonth');
    expect(fundingHistory).toContain('Transfer Plan:');
    expect(fundingHistory).toContain('legacy_incoming');
    expect(fundingHistory).toContain('fund(?:ing|ed)?');

    // Income rows: long semantic strings must be shrinkable/truncatable.
    expect(income).toContain('finance-metadata-token');
    expect(css).toContain('.finance-metadata-token');
    expect(css).toContain('text-overflow: ellipsis');

    // Household savings goals must use the complete Savings + Cash position;
    // legacy linked-account allocation warnings must not return.
    expect(savings).toContain('Progress uses total Savings + Cash balances');
    expect(savings).not.toContain('Allocation integrity warning');
    expect(savings).not.toContain('recorded allocations exceed');
  });

  it('locks the app-wide PC and Phone layout modes', () => {
    const app = fs.readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf8');
    const header = fs.readFileSync(path.join(COMPONENT_DIR, 'Header.tsx'), 'utf8');
    const navigation = fs.readFileSync(path.join(COMPONENT_DIR, 'Navigation.tsx'), 'utf8');
    const transactionList = fs.readFileSync(path.join(COMPONENT_DIR, 'TransactionList.tsx'), 'utf8');
    const css = fs.readFileSync(path.join(SRC_DIR, 'index.css'), 'utf8');

    expect(app).toContain("type LayoutMode = 'pc' | 'phone'");
    expect(app).toContain("mv-layout-mode-v1");
    expect(app).toContain("layoutMode === 'phone' ? 'mv-layout-phone' : 'mv-layout-pc'");
    expect(app).toContain('onLayoutModeChange={setLayoutMode}');
    expect(app).not.toContain('isMobilePreview');

    expect(header).toContain('header-layout-pc-btn');
    expect(header).toContain('header-layout-phone-btn');
    expect(header).toContain('App display mode');
    expect(header).toContain("onLayoutModeChange('pc')");
    expect(header).toContain("onLayoutModeChange('phone')");
    expect(header).not.toContain('Mobile View');
    expect(transactionList).toContain('finance-filter-control-leading');
    expect(transactionList).toContain('finance-filter-control-trailing');
    expect(transactionList).toContain('finance-filter-grid');
    expect(transactionList).toContain('finance-ledger-panel');

    expect(css).toContain('DEVICE-OPTIMISED LAYOUT MODES — HP OMNIBOOK 7 + IPHONE 13');
    expect(css).toContain('.mv-layout-pc .mv-workspace');
    expect(css).toContain('.mv-layout-phone .mv-workspace');
    expect(css).toContain('DEVICE MODE CORRECTION PASS — FULL PC + USABLE PHONE');
    expect(css).toContain('max-width: none !important');
    expect(css).toContain('width: min(760px, calc(100vw - 32px))');
    expect(css).toContain('.mv-layout-phone .mv-settings-tabs');
    expect(css).toContain('.mv-layout-phone :is(');
    expect(css).toContain('.submenu');
    expect(css).toContain('.mv-layout-pc .mv-nav-desktop');
    expect(css).toContain('.mv-layout-phone .mv-nav-mobile');
    expect(navigation).toContain("const mobilePrimaryIds: NavTab[] = ['dashboard', 'activity', 'accounts', 'transfer_plan']");
    expect(navigation).toContain('mobile-nav-tab-more');
    expect(navigation).toContain('mv-mobile-more-menu');
    expect(navigation).toContain('Income');
    expect(navigation).toContain('Savings');
    expect(navigation).toContain('Settings');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(css).toContain('.mv-mobile-more-menu');
    expect(css).toContain('SCREEN REAL-ESTATE PASS — VIEWPORT-FIRST PC + PHONE');
    expect(css).toContain('width: 100vw !important');
    expect(css).toContain('.finance-filter-control.finance-filter-control-leading');
    expect(css).toContain('.finance-filter-control.finance-filter-control-trailing');
    expect(css).toContain('.mv-layout-pc .finance-ledger-row');
    expect(css).toContain('.mv-layout-phone .finance-filter-grid');
    expect(css).toContain('PC READABILITY FLOOR — HP OMNIBOOK 7 AT 150% WINDOWS SCALE');
    expect(css).toContain('@media (min-width: 641px)');
    expect(css).toContain('.mv-layout-pc .text-xs { font-size: 14px !important; }');
    expect(css).toContain('.mv-layout-pc .text-base { font-size: 17px !important; }');
    expect(css).toContain('.mv-layout-pc .text-\\[10px\\]');
    expect(css).toContain('.mv-layout-pc .finance-row-title');
    expect(css).toContain('font-size: 15px !important');
    expect(navigation).toContain('mobile-nav-tab-more');
  });

});
