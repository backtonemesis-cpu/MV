import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

const billDateIndex = tx.indexOf('id="unified-bill-due-date"');
const billDescriptionIndex = tx.indexOf('id="unified-bill-name"');
const billAccountIndex = tx.indexOf('id="unified-bill-account"');
const billCategoryIndex = tx.indexOf('id="unified-bill-category"');
const billingPeriodIndex = tx.indexOf('id="unified-bill-month"');

describe('unified Add Bill Date parity', () => {
  it('uses an actual date input in the same visible slot as every other Add type', () => {
    expect(tx).toMatch(/htmlFor="unified-bill-due-date"[\s\S]{0,180}>\s*Date\s*<\/label>/);
    expect(tx).toMatch(/id="unified-bill-due-date"[\s\S]{0,140}type="date"/);
    expect(tx).toMatch(/id="unified-bill-due-date"[\s\S]{0,300}className="mv-transaction-control w-full"/);
    expect(tx).toMatch(/id="transaction-date"[\s\S]{0,140}type="date"/);
    expect(tx).toMatch(/id="transaction-date"[\s\S]{0,300}className="mv-transaction-control w-full"/);
  });

  it('keeps the common visual sequence aligned before Bill-specific fields', () => {
    expect(billDateIndex).toBeGreaterThan(-1);
    expect(billDateIndex).toBeLessThan(billDescriptionIndex);
    expect(billDescriptionIndex).toBeLessThan(billAccountIndex);
    expect(billAccountIndex).toBeLessThan(billCategoryIndex);
    expect(billCategoryIndex).toBeLessThan(billingPeriodIndex);
  });

  it('stores the selected Bill Date only as the existing optional dueDate', () => {
    expect(tx).toContain('value={billDueDate}');
    expect(tx).toContain('onChange={(event) => setBillDueDate(event.target.value)}');
    expect(tx).toContain('dueDate: billDueDate || undefined');
    expect(tx).toContain("setBillDueDate('')");
    expect(tx).not.toContain("setBillDueDate(localDateInputValue())");
    expect(types).toContain('dueDate?: string;');
  });

  it('keeps Billing Period separately month-only for Transfer Plan/month grouping', () => {
    expect(tx).toContain('Billing Period');
    expect(tx).toContain('value={billMonth}');
    expect(tx).toContain('onChange={setBillMonth}');
    expect(tx).toContain('month: billMonth.trim()');
    expect(tx).toContain("setError('Billing period is required.')");
    expect(types).toContain('month: string;');
    expect(tx).not.toContain("billMonth + '-01'");
  });

  it('does not alter the Bill/Transaction financial boundary', () => {
    expect(tx).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(tx).toContain('await onSaveBill({');
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
    expect(tx).not.toContain("type: 'bill'");
  });
});
