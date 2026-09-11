import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = path.resolve(root, 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddIphoneDateContainment.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('iPhone unified Add Bill Due Date containment', () => {
  it('loads the focused containment override after the existing unified Add styles', () => {
    expect(main).toContain("import './unifiedAddConsistency.css';");
    expect(main).toContain("import './unifiedAddIphoneDateContainment.css';");
    expect(main.indexOf("import './unifiedAddIphoneDateContainment.css';"))
      .toBeGreaterThan(main.indexOf("import './unifiedAddConsistency.css';"));
  });

  it('uses the established Safari native-date paint containment pattern in the top Bill grid', () => {
    expect(mobileCss).toContain('#planned-payment-due-date');
    expect(mobileCss).toContain('-webkit-appearance: none');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('.mv-transaction-modal[data-active-add-type="bill"]');
    expect(css).toContain('.mv-modal-grid-2');
    expect(css).toContain('> div:has(> label[for="unified-bill-due-date"])');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('> div:has(> label[for="unified-bill-due-date"])::after');
    expect(css).toContain('height: 40px;');
    expect(css).toContain('border: 1px solid var(--border);');
    expect(css).toContain('#unified-bill-due-date');
    expect(css).toContain('width: 100% !important;');
    expect(css).toContain('min-width: 0 !important;');
    expect(css).toContain('max-width: 100% !important;');
    expect(css).toContain('inline-size: 100% !important;');
    expect(css).toContain('-webkit-appearance: none;');
    expect(css).toContain('#unified-bill-due-date::-webkit-date-and-time-value');
    expect(css).toContain('#unified-bill-due-date::-webkit-calendar-picker-indicator');
    expect(css).toContain('opacity: 0;');
  });

  it('keeps a real optional Due Date separate from an invisible active-month Bill value', () => {
    expect(tx).toMatch(/htmlFor="unified-bill-due-date"[\s\S]{0,180}>\s*Due Date \(optional\)\s*<\/label>/);
    expect(tx).toMatch(/id="unified-bill-due-date"[\s\S]{0,120}type="date"/);
    expect(tx).toContain("const [billDueDate, setBillDueDate] = useState('')");
    expect(tx).toContain('value={billDueDate}');
    expect(tx).toContain('onChange={(event) => setBillDueDate(event.target.value)}');
    expect(tx).toContain('dueDate: billDueDate || undefined');
    expect(tx).toContain('const [billMonth, setBillMonth] = useState(activeMonth);');
    expect(tx).toContain('setBillMonth(activeMonth || localMonthInputValue())');
    expect(tx).toContain('month: billMonth.trim()');
    expect(tx).not.toContain('Billing Month');
    expect(tx).not.toContain('id="unified-bill-month"');
    expect(tx).not.toContain('<MonthPicker');
    expect(types).toContain('month: string;');
    expect(types).toContain('dueDate?: string;');
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
  });
});
