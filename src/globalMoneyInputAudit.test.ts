import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseToPence } from './utils/currency';

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

const surfaces = {
  transaction: read('src/components/TransactionModal.tsx'),
  bills: read('src/components/PlannedPaymentModal.tsx'),
  income: read('src/components/IncomeView.tsx'),
  accounts: read('src/components/AccountsView.tsx'),
  savings: read('src/components/SavingsView.tsx'),
  funding: read('src/components/ExecuteTransferModal.tsx'),
  paid: read('src/components/MarkPaymentPaidModal.tsx'),
};

const moneyInputComponent = read('src/components/MoneyInput.tsx');
const css = read('src/index.css');
const designCss = read('src/globalDesignSystem.css');
const allSurfaceSource = Object.values(surfaces).join('\n');

describe('Global money-input audit contract', () => {
  it('routes every audited editable monetary surface through the shared GBP primitive', () => {
    expect(surfaces.transaction.match(/<MoneyInput/g)?.length).toBe(2);
    expect(surfaces.bills.match(/<MoneyInput/g)?.length).toBe(1);
    expect(surfaces.income.match(/<MoneyInput/g)?.length).toBe(2);
    expect(surfaces.accounts.match(/<MoneyInput/g)?.length).toBe(6);
    expect(surfaces.savings.match(/<MoneyInput/g)?.length).toBe(5);
    expect(surfaces.funding.match(/<MoneyInput/g)?.length).toBe(1);
    expect(surfaces.paid.match(/<MoneyInput/g)?.length).toBe(1);
  });

  it('enforces spinner-free decimal text entry across the shared MoneyInput contract', () => {
    expect(moneyInputComponent).toContain("type?: 'text'");
    expect(moneyInputComponent).toContain("inputMode?: 'decimal'");
    expect(moneyInputComponent).toContain('type="text"');
    expect(moneyInputComponent).toContain('inputMode="decimal"');
    for (const source of Object.values(surfaces)) {
      const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
      expect(blocks.every((block) => !block.includes('type="number"'))).toBe(true);
    }
  });

  it('renders numeric values only inside standard money input boxes', () => {
    expect(moneyInputComponent).not.toMatch(/>\s*£\s*</);
    expect(moneyInputComponent).not.toContain('mv-money-prefix');
    expect(allSurfaceSource).not.toContain('mv-money-input-with-prefix');
    expect(allSurfaceSource).not.toContain('className="mv-money-prefix');
    expect(css).not.toContain('.mv-money-prefix');
    expect(designCss).not.toContain('.mv-money-prefix');
  });

  it('uses normal input padding with no obsolete prefix reservation on desktop or Phone', () => {
    const desktopRule = css.match(
      /\.mv-density-root input\.mv-money-input-control\s*\{[^}]+\}/s
    )?.[0] ?? '';
    const phoneRule = css.match(
      /\.mv-layout-phone input\.mv-money-input-control\s*\{[^}]+\}/s
    )?.[0] ?? '';

    expect(desktopRule).toContain('padding-left: 12px !important');
    expect(desktopRule).toContain('padding-right: 12px !important');
    expect(phoneRule).toContain('padding-left: 12px !important');
    expect(phoneRule).toContain('padding-right: 12px !important');
    expect(css).not.toMatch(/padding-left:\s*(23|26|32)px[^\n]*money-input/);
    expect(designCss).not.toContain('padding-left: 23px !important');
  });

  it('keeps concise visible GBP context on every audited money-entry workflow', () => {
    expect(surfaces.transaction.match(/Amount \(£\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(surfaces.bills).toContain('Amount (£) *');
    expect(surfaces.income).toContain('Expected amount (£)');
    expect(surfaces.income).toContain('Actual amount (£)');
    expect(surfaces.accounts).toContain("'Starting balance owed (£) *'");
    expect(surfaces.accounts).toContain("'Starting balance (£) *'");
    expect(surfaces.accounts).toContain("'Statement balance owed (£) *'");
    expect(surfaces.accounts).toContain("'Statement balance (£) *'");
    expect(surfaces.accounts).toContain('Target (£)');
    expect(surfaces.accounts).toContain('Monthly Saving Plan (£)');
    expect(surfaces.savings).toContain('Target (£)');
    expect(surfaces.savings).toContain('Monthly Saving Plan (£)');
    expect(surfaces.savings).toContain('Amount (£)');
    expect(surfaces.funding).toContain('Amount (£)');
    expect(surfaces.paid).toContain('Actual amount (£)');
  });

  it('keeps GBP meaning programmatically clear on every shared money input', () => {
    for (const source of Object.values(surfaces)) {
      const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
      expect(blocks.every((block) => /aria-label=/.test(block))).toBe(true);
      expect(blocks.every((block) => /pounds sterling/i.test(block))).toBe(true);
      expect(blocks.every((block) => !/placeholder="£/.test(block))).toBe(true);
    }
  });

  it('preserves focus, required, disabled and error-state passthrough without forcing focus', () => {
    expect(moneyInputComponent).toContain('{...inputProps}');
    for (const source of Object.values(surfaces)) {
      const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
      expect(blocks.every((block) => !block.includes('autoFocus'))).toBe(true);
    }
    expect(css).toContain('.mv-density-root input.mv-money-input-control::placeholder');
    expect(css).toContain('.mv-modal-form input:focus');
  });

  it('keeps Transaction main and Split Categories on the same numeric-only rule', () => {
    expect(surfaces.transaction).toContain('Transaction amount in pounds sterling');
    expect(surfaces.transaction).toContain('Split ${idx + 1} amount in pounds sterling');
    expect(surfaces.transaction.match(/<MoneyInput/g)?.length).toBe(2);
    expect(surfaces.transaction.match(/Amount \(£\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('does not change penny-safe parsing semantics', () => {
    expect(parseToPence('0.00')).toBe(0);
    expect(parseToPence('12.34')).toBe(1234);
    expect(parseToPence('349.79')).toBe(34979);
    expect(parseToPence('15687.47')).toBe(1568747);
  });

  it('keeps Settings and backup/restore free of invented monetary entry fields', () => {
    const settings = read('src/components/SettingsView.tsx');
    const backup = read('src/components/BackupRestoreModal.tsx');
    expect(settings).not.toContain('<MoneyInput');
    expect(backup).not.toContain('<MoneyInput');
  });
});
