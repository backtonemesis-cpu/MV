import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const css = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');

describe('desktop Transfer destination prompt readability', () => {
  it('keeps the approved source and destination wording unchanged', () => {
    expect(modal).toContain("placeholder={isRepayment ? 'Select credit card' : 'Select destination account'}");
    expect(modal).toContain("? 'Select source account'");
    expect(modal).toContain("label={isRepayment ? 'Credit Card Being Repaid' : 'To Account'}");
  });

  it('gives the longer destination selector proportionally more width on desktop only', () => {
    expect(css).toContain('@media (min-width: 431px)');
    expect(css).toContain('.mv-transaction-modal[data-active-add-type="transfer"] .mv-transaction-dynamic > .mv-modal-grid-2');
    expect(css).toContain('grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);');
  });

  it('does not widen the shared modal or alter the Phone account-picker contract', () => {
    expect(css).toContain('max-width: 520px !important;');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(css).toContain('display: none !important;');
    expect(css).toContain('.mv-layout-phone .mv-mobile-account-trigger');
  });
});
