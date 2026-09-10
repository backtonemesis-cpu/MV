import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = path.resolve(root, 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddIphoneDateContainment.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('iPhone unified Add Bill Due Date containment', () => {
  it('loads the focused containment override after the existing unified Add styles', () => {
    expect(main).toContain("import './unifiedAddConsistency.css';");
    expect(main).toContain("import './unifiedAddIphoneDateContainment.css';");
    expect(main.indexOf("import './unifiedAddIphoneDateContainment.css';"))
      .toBeGreaterThan(main.indexOf("import './unifiedAddConsistency.css';"));
  });

  it('constrains the native Bill Due Date grid item and input on Phone without replacing the native picker', () => {
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('.mv-transaction-modal[data-active-add-type="bill"]');
    expect(css).toContain('> div:has(> label[for="unified-bill-due-date"])');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain('#unified-bill-due-date');
    expect(css).toContain('display: block;');
    expect(css).toContain('width: 100% !important;');
    expect(css).toContain('min-width: 0 !important;');
    expect(css).toContain('max-width: 100% !important;');
    expect(css).toContain('inline-size: 100% !important;');
    expect(css).toContain('min-inline-size: 0 !important;');
    expect(css).toContain('max-inline-size: 100% !important;');
    expect(css).not.toContain('-webkit-appearance: none');
  });

  it('keeps Due Date optional and separate from month-only Billing Month persistence', () => {
    expect(tx).toMatch(/htmlFor="unified-bill-due-date"[\s\S]{0,180}>\s*Due Date \(optional\)\s*<\/label>/);
    expect(tx).toMatch(/id="unified-bill-due-date"[\s\S]{0,120}type="date"/);
    expect(tx).toContain('value={billDueDate}');
    expect(tx).toContain('dueDate: billDueDate || undefined');
    expect(tx).toContain('Billing Month');
    expect(tx).toContain('value={billMonth}');
    expect(tx).toContain('month: billMonth.trim()');
    expect(types).toContain('month: string;');
    expect(types).toContain('dueDate?: string;');
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
  });
});
