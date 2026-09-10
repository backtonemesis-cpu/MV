import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const consistencyCss = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');
const balanceCss = fs.readFileSync(path.join(src, 'unifiedAddDesktopTransferPromptBalance.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('desktop Transfer account prompt readability', () => {
  it('keeps the approved source and destination wording unchanged', () => {
    expect(modal).toContain("placeholder={isRepayment ? 'Select credit card' : 'Select destination account'}");
    expect(modal).toContain("? 'Select source account'");
    expect(modal).toContain("label={isRepayment ? 'Credit Card Being Repaid' : 'To Account'}");
  });

  it('uses the final balanced desktop-only account-column ratio', () => {
    expect(balanceCss).toContain('@media (min-width: 431px)');
    expect(balanceCss).toContain('.mv-transaction-modal[data-active-add-type="transfer"] .mv-transaction-dynamic > .mv-modal-grid-2');
    expect(balanceCss).toContain('grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);');
  });

  it('loads the final balance override after the shared unified Add contract', () => {
    const sharedIndex = main.indexOf("import './unifiedAddConsistency.css';");
    const balanceIndex = main.indexOf("import './unifiedAddDesktopTransferPromptBalance.css';");
    expect(sharedIndex).toBeGreaterThanOrEqual(0);
    expect(balanceIndex).toBeGreaterThan(sharedIndex);
    expect(consistencyCss).toContain('max-width: 520px !important;');
  });

  it('does not alter the Phone account-picker contract', () => {
    expect(consistencyCss).toContain('@media (max-width: 430px)');
    expect(consistencyCss).toContain('.mv-layout-phone .mv-transaction-account-select');
    expect(consistencyCss).toContain('display: none !important;');
    expect(consistencyCss).toContain('.mv-layout-phone .mv-mobile-account-trigger');
  });
});
