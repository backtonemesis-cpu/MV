import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(src, relativePath), 'utf8');

const design = read('globalDesignSystem.css');
const indexCss = read('index.css');
const mobileCss = read('mobileUx.css');
const consistencyCss = read('unifiedAddConsistency.css');
const selectIndicatorCss = read('unifiedAddSelectIndicator.css');
const iphoneDueDateCss = read('unifiedAddIphoneDateContainment.css');
const transactionDateCss = fs.readFileSync(
  path.resolve(process.cwd(), 'public', 'iphone-transaction-date-fix.css'),
  'utf8'
);
const sharedUi = read('components/UnifiedAddUi.tsx');
const fundingModal = read('components/ExecuteTransferModal.tsx');
const sharedSelect = read('components/MVSelect.tsx');
const selectCss = read('mvSelect.css');
const plannedPaymentModal = read('components/PlannedPaymentModal.tsx');
const main = read('main.tsx');

describe('global control-value typography contract', () => {
  it('defines the exact approved desktop and Phone value tokens', () => {
    expect(design).toContain('--mv-control-value-size: 0.8125rem;');
    expect(design).toContain('--mv-control-value-leading: 1.25rem;');
    expect(design).toContain('--mv-control-value-phone-size: 1rem;');
    expect(design).toContain('--mv-control-value-phone-leading: 1.5rem;');
    expect(design).toContain('.mv-density-root.mv-layout-phone');
    expect(design).toContain('--mv-control-value-size: var(--mv-control-value-phone-size);');
    expect(design).toContain('--mv-control-value-leading: var(--mv-control-value-phone-leading);');
  });

  it('protects all four desktop/Phone and wide/iPhone-sized combinations', () => {
    expect(design).toContain('--mv-control-value-size: 0.8125rem;');
    expect(design).toContain('--mv-control-value-leading: 1.25rem;');
    expect(design).toMatch(
      /\.mv-density-root\.mv-layout-phone\s*\{[\s\S]*?--mv-control-value-size:\s*var\(--mv-control-value-phone-size\);[\s\S]*?--mv-control-value-leading:\s*var\(--mv-control-value-phone-leading\);[\s\S]*?\}/
    );
    const narrowViewportGuard = mobileCss.match(
      /@media \(max-width: 47\.999rem\)\s*\{[\s\S]*?\.mv-density-root:is\(\.mv-layout-pc, \.mv-layout-phone\)\s*\{[\s\S]*?--mv-control-value-size:\s*var\(--mv-control-value-phone-size\);[\s\S]*?--mv-control-value-leading:\s*var\(--mv-control-value-phone-leading\);[\s\S]*?\}[\s\S]*?\}/
    );
    expect(narrowViewportGuard).not.toBeNull();
    expect(narrowViewportGuard?.[0]).not.toContain('--mv-control-value-size: 0.8125rem');
    expect(mobileCss).not.toMatch(/@media \(max-width: 47\.999rem\)[\s\S]*?font-size:\s*13px/);
  });

  it('applies one rule to editable controls, native selected values and custom primary values', () => {
    expect(design).toContain('.mv-density-root:is(.mv-layout-pc, .mv-layout-phone) :where(');
    expect(design).toContain('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),');
    expect(design).toContain('select,');
    expect(design).toContain('textarea,');
    expect(design).toContain('[data-mv-value-primary]');
    expect(design).toContain('font-size: var(--mv-control-value-size);');
    expect(design).toContain('line-height: var(--mv-control-value-leading);');
  });

  it('keeps placeholders and native option text on the same value token', () => {
    expect(design).toContain('input:not([type="checkbox"]):not([type="radio"]):not([type="range"])::placeholder');
    expect(design).toContain('textarea::placeholder');
    expect(design).toContain('select option');
  });

  it('uses shared primary-value markers while keeping option metadata subordinate', () => {
    expect(sharedUi).toContain('label: accountIdentityLabel(account)');
    expect(sharedUi).toContain('trailing: formatPence(account.currentBalancePence)');
    expect(fundingModal).toContain('label: accountIdentityLabel(account)');
    expect(fundingModal).toContain('disabledReason: disabledReason || undefined');
    expect(sharedSelect).toContain('data-mv-value-primary');
    expect(selectCss).toContain('.mv-select-option-secondary');
    expect(selectCss).toContain('font-size: 0.75rem;');
  });

  it('keeps money controls on the shared size while retaining numeric emphasis', () => {
    expect(indexCss).toContain('.mv-density-root input.mv-money-input-control');
    expect(indexCss).toContain('font-weight: 600 !important;');
    expect(indexCss).toContain('font-variant-numeric: tabular-nums lining-nums;');
    expect(indexCss).not.toMatch(/input\.mv-money-input-control\s*\{[^}]*font-size:/s);
  });

  it('covers all six unified Add choices and the direct PlannedPayment control path', () => {
    for (const type of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) {
      expect(sharedUi).toContain(`'${type}'`);
    }
    expect(plannedPaymentModal).toContain('className="mv-modal-card mv-add-bill-modal"');
    expect(plannedPaymentModal).toContain('<MoneyInput');
    expect(plannedPaymentModal).toContain('<MonthPicker');
    expect(plannedPaymentModal).toContain('<UnifiedAddAccountField');
  });

  it('retires unified-only typography patches without adding a new local typography exception', () => {
    expect(main).not.toContain("import './unifiedAddFieldTypography.css';");
    expect(main).not.toContain("import './unifiedAddBillTypography.css';");
    expect(fs.existsSync(path.join(src, 'unifiedAddFieldTypography.css'))).toBe(false);
    expect(fs.existsSync(path.join(src, 'unifiedAddBillTypography.css'))).toBe(false);
    expect(consistencyCss).not.toContain('font-size: 13px !important;');
    expect(selectCss).toContain('font-size: var(--mv-control-value-size);');
  });

  it('does not opt labels, tabs, navigation, metrics or action buttons into the field-value marker', () => {
    expect(sharedUi).not.toMatch(/mv-transaction-type-tab[^>]*data-mv-value-primary/);
    expect(sharedUi).not.toMatch(/mv-unified-add-footer[^>]*data-mv-value-primary/);
    expect(plannedPaymentModal).not.toMatch(/<label[^>]*data-mv-value-primary/);
    expect(design).not.toMatch(/(?:button|\.finance-amount|\.mv-layout-switcher-option)[^,{]*,?\s*\[data-mv-value-primary\]/);
  });

  it('retains iPhone date containment and native date indicators as separate browser contracts', () => {
    expect(transactionDateCss).toContain('input remains');
    expect(transactionDateCss).toContain('line-height: 40px !important;');
    expect(iphoneDueDateCss).toContain('#unified-bill-due-date');
    expect(iphoneDueDateCss).toContain('::-webkit-calendar-picker-indicator');
    expect(selectIndicatorCss).toContain('-webkit-appearance: none !important;');
    expect(selectIndicatorCss).toContain('background-position: right 14px center !important;');
    expect(sharedUi).toContain('<MVSelect');
    expect(sharedUi).not.toContain('mv-mobile-account-picker');
  });

  it('keeps iPhone dropdown values at 16px without tying them to selected layout mode', () => {
    expect(selectCss).toContain('@media (max-width: 47.999rem)');
    expect(selectCss).toContain('font-size: var(--mv-control-value-phone-size);');
    expect(selectCss).toContain('line-height: var(--mv-control-value-phone-leading);');
    expect(selectCss).not.toContain('.mv-layout-phone .mv-select');
    expect(selectCss).not.toContain('.mv-layout-pc .mv-select');
  });
});
