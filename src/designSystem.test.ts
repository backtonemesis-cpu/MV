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

    // Plan roster: preserve the full former-glory interaction model.
    // Bill inclusion and status stay independent, and explicit Edit/Delete
    // controls remain visible instead of being collapsed into icon-only rows.
    expect(plan).toContain('Select Unpaid');
    expect(plan).toContain('Select Paid');
    expect(plan).toContain('Select All');
    expect(plan).toContain('Deselect All');
    expect(plan).toContain('Edit');
    expect(plan).toContain('Delete');
    expect(plan).not.toContain('mv-plan-bill-row');
    expect(plan).toContain('Funding received');
    expect(plan).toContain('Undo Funding');
    expect(plan).not.toContain('Paid / Complete');
    expect(plan).toContain('Accounts Covered / Funded');
    expect(plan).toContain('Needs funds');
    expect(plan).toContain('Paid');
    expect(plan).toContain('Unpaid');
    expect(plan).toContain('selectedPlanTotalPence');
    expect(plan).toContain('getLatestTransferPlanFundingByDestination');
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

});
