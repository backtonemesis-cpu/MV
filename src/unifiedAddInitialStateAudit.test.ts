import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const tx = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');

describe('unified Add initial unselected state', () => {
  it('keeps the six-choice launcher unselected by default', () => {
    expect(tx).toContain("const [type, setType] = useState<TransactionType | ''>('');");
    expect(tx).toContain('aria-label="Add bill"');
    expect(tx).toContain('aria-pressed="false"');
    expect(tx).not.toContain("setType('expense')");
  });

  it('hides transaction fields and submit action until a real transaction type is selected', () => {
    expect(css).toContain('.mv-transaction-type-tab[aria-label="Add bill"]');
    expect(css).toContain(':not(:has(.mv-transaction-type-tab[aria-pressed="true"]))');
    expect(css).toContain('.mv-transaction-body > div:has(.mv-transaction-type-tabs) ~ *');
    expect(css).toContain('.mv-transaction-primary');
    expect(css).toContain('display: none !important;');
  });

  it('does not alter transaction or Bill financial models', () => {
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
    expect(tx).toContain('await onSave({');
    expect(tx).not.toContain("handleTypeChange('bill'");
  });
});
