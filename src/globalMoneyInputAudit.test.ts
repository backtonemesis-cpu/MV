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

  it('removes legacy one-off money-prefix markup from audited surfaces', () => {
    expect(allSurfaceSource).not.toContain('mv-money-input-with-prefix');
    expect(allSurfaceSource).not.toContain('className="mv-money-prefix');
    expect(allSurfaceSource).not.toContain("className='mv-money-prefix");
  });

  it('keeps GBP meaning programmatically clear on every shared money input', () => {
    for (const source of Object.values(surfaces)) {
      const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
      expect(blocks.every((block) => /aria-label=/.test(block))).toBe(true);
      expect(blocks.every((block) => /pounds sterling/i.test(block))).toBe(true);
    }
  });

  it('does not force autofocus into any shared money input', () => {
    for (const source of Object.values(surfaces)) {
      const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
      expect(blocks.every((block) => !block.includes('autoFocus'))).toBe(true);
    }
  });

  it('keeps transaction split amounts on the same primitive as the main amount', () => {
    expect(surfaces.transaction).toContain('Transaction amount in pounds sterling');
    expect(surfaces.transaction).toContain('Split ${idx + 1} amount in pounds sterling');
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
