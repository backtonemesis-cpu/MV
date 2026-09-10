import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Step 44 iPhone Account coherent selected-state presentation', () => {
  it('uses the shared MVSelect account field in every layout mode without a Phone-only sheet', () => {
    const modal = read('components/TransactionModal.tsx');
    const shared = read('components/UnifiedAddUi.tsx');
    const select = read('components/MVSelect.tsx');

    expect(modal).toContain('id="transaction-account"');
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('<UnifiedAddAccountField');
    expect(shared).toContain('<MVSelect');
    expect(shared).toContain('onValueChange={onChange}');
    expect(shared).not.toContain('mv-mobile-account-trigger');
    expect(shared).not.toContain('mv-mobile-account-picker');
    expect(select).toContain('className="mv-select-popover"');
    expect(select).toContain('role="listbox"');
  });

  it('keeps authoritative account identity in the shared trigger and balance secondary', () => {
    const shared = read('components/UnifiedAddUi.tsx');

    expect(shared).toContain('label: accountIdentityLabel(account)');
    expect(shared).toContain('trailing: formatPence(account.currentBalancePence)');
    expect(shared).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(shared).toContain('mv-selected-account-balance');
  });

  it('keeps the shared popup contained and scrollable on narrow physical viewports', () => {
    const css = read('mvSelect.css');
    const select = read('components/MVSelect.tsx');

    expect(css).toContain('position: fixed');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(select).toContain('window.visualViewport');
    expect(select).toContain('PREFERRED_MAX_HEIGHT = 320');
    expect(select).toContain('spaceBelow < MIN_USEFUL_HEIGHT && spaceAbove > spaceBelow');
  });

  it('does not reintroduce the rejected secondary mobile account modal architecture', () => {
    const shared = read('components/UnifiedAddUi.tsx');
    expect(shared).not.toContain('role="dialog"');
    expect(shared).not.toContain('aria-modal="true"');
    expect(shared).not.toContain('mv-mobile-account-picker-backdrop');
  });
});
