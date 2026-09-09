import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const css = fs.readFileSync(path.join(src, 'unifiedAddBillTypography.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('unified Add Bill typography parity', () => {
  it('loads the Bill typography parity rules in the application stylesheet chain', () => {
    expect(main).toContain("import './unifiedAddBillTypography.css';");
  });

  it('matches unified Bill field-label weight to the Transaction forms', () => {
    expect(css).toContain('.mv-add-bill-modal[data-unified-add="true"] label[for^="planned-payment-"]');
    expect(css).toContain('font-size: 0.75rem !important');
    expect(css).toContain('font-weight: 600 !important');
    expect(css).toContain('color: var(--text-muted) !important');
  });

  it('normalises unified Bill field values, including Month, without touching PlannedPayment semantics', () => {
    expect(css).toContain('#planned-payment-name');
    expect(css).toContain('#planned-payment-account');
    expect(css).toContain('.mv-month-picker-input');
    expect(css).toContain('font-size: 0.875rem !important');
    expect(css).toContain('font-weight: 400 !important');
  });
});
