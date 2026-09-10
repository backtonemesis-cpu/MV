import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const typographyCss = fs.readFileSync(path.join(src, 'unifiedAddFieldTypography.css'), 'utf8');
const unifiedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('unified Add shared 13px field typography', () => {
  it('keeps all six unified Add choices inside the shared shell contract', () => {
    for (const type of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) {
      expect(unifiedUi).toContain(`'${type}'`);
    }
  });

  it('applies exactly 13px to editable field/control text and Phone account triggers', () => {
    expect(typographyCss).toContain('input:not([type="checkbox"]):not([type="radio"])');
    expect(typographyCss).toContain('select,');
    expect(typographyCss).toContain('textarea,');
    expect(typographyCss).toContain('.mv-mobile-account-trigger');
    expect(typographyCss).toContain('font-size: 13px !important;');
  });

  it('does not flatten headings, type tabs or footer-action hierarchy to 13px', () => {
    expect(typographyCss).not.toContain('.mv-transaction-type-tab,');
    expect(typographyCss).not.toContain('.mv-unified-add-footer');
    expect(typographyCss).not.toContain('.mv-modal-header');
  });

  it('loads after older Bill/iPhone typography layers so the shared field contract wins consistently', () => {
    const billIndex = main.indexOf("import './unifiedAddBillTypography.css';");
    const iphoneIndex = main.indexOf("import './unifiedAddIphoneDateContainment.css';");
    const sharedIndex = main.indexOf("import './unifiedAddFieldTypography.css';");
    expect(billIndex).toBeGreaterThanOrEqual(0);
    expect(iphoneIndex).toBeGreaterThan(billIndex);
    expect(sharedIndex).toBeGreaterThan(iphoneIndex);
  });
});
