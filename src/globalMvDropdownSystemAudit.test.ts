import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Account } from './types';
import { accountIdentityLabel } from './utils/accountDisplay';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');
const selectSource = read('components/MVSelect.tsx');
const selectCss = read('mvSelect.css');
const main = read('main.tsx');
const unified = read('components/UnifiedAddUi.tsx');
const funding = read('components/ExecuteTransferModal.tsx');
const transaction = read('components/TransactionModal.tsx');
const monthPicker = read('components/MonthPicker.tsx');
const inventory = fs.readFileSync(path.join(ROOT, 'audit_notes/global-dropdown-inventory.md'), 'utf8');

function componentSources(): string[] {
  return fs
    .readdirSync(path.join(SRC, 'components'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(SRC, 'components', file), 'utf8'));
}

describe('global MV dropdown system', () => {
  it('records the complete migration inventory before implementation', () => {
    expect(inventory).toContain('28 ordinary native `<select>` render points');
    expect(inventory).toContain('UnifiedAddUi / Add Entry account fields');
    expect(inventory).toContain('ExecuteTransferModal / funding source');
    expect(inventory).toContain('TransactionList / Activity');
    expect(inventory).toContain('CategoryCorrection');
    expect(inventory).toContain('Deliberately native/system controls');
    expect(inventory).toContain('Direct MVSelect empty-state contract');
  });

  it('mounts one shared native-select bridge and one shared explicit MVSelect implementation', () => {
    expect(main).toContain("import { MVNativeSelectBridge } from './components/MVSelect';");
    expect(main).toContain('<MVNativeSelectBridge />');
    expect(main).toContain("import './mvSelect.css';");
    expect(selectSource).toContain('export const MVSelect: React.FC<MVSelectProps>');
    expect(selectSource).toContain('export const MVNativeSelectBridge: React.FC');
    expect(selectSource).toContain('const MVSelectPopover: React.FC<MVSelectPopoverProps>');
  });

  it('routes all ordinary native selects through the shared bridge without duplicating their option business rules', () => {
    const nativeSelectCount = componentSources().reduce(
      (count, source) => count + (source.match(/<select\b/g) ?? []).length,
      0
    );
    expect(nativeSelectCount).toBe(28);
    expect(selectSource).toContain('target instanceof HTMLSelectElement');
    expect(selectSource).toContain('nativeSelectOptions(select)');
    expect(selectSource).toContain("select.dataset.mvNative !== 'true'");
    expect(selectSource).toContain("dispatchEvent(new Event('change', { bubbles: true }))");
  });

  it('removes the rejected Unified Add mobile account sheet and uses MVSelect directly', () => {
    expect(unified).toContain("from './MVSelect'");
    expect(unified).toContain('<MVSelect');
    expect(unified).not.toContain('mv-mobile-account-picker');
    expect(unified).not.toContain('mv-mobile-account-trigger');
    expect(unified).not.toContain('role="dialog"');
  });

  it('migrates Transfer Plan funding sources to MVSelect while preserving visible disabled reasons', () => {
    expect(funding).toContain("from './MVSelect'");
    expect(funding).toContain('<MVSelect');
    expect(funding).not.toContain('openSourcePickerId');
    expect(funding).not.toContain('focusSourceOption');
    expect(funding).toContain('Credit/liability account — not a cash funding source');
    expect(funding).toContain('No safe-to-move balance');
    expect(funding).toContain('Already selected in another source row');
    expect(funding).toContain('disabledReason: disabledReason || undefined');
  });

  it('keeps account identities unambiguous and balances subordinate', () => {
    expect(unified).toContain('label: accountIdentityLabel(account)');
    expect(unified).toContain('trailing: formatPence(account.currentBalancePence)');
    expect(funding).toContain('label: accountIdentityLabel(account)');
    expect(selectCss).toContain('.mv-select-option-trailing');
    expect(selectCss).toContain('font-variant-numeric: tabular-nums');
  });

  it('keeps same-name Marius and Vesta Lloyds accounts distinct by stable ID and owner/type identity', () => {
    const mariusLloyds: Account = {
      id: 'lloyds-current-marius-test',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 0,
      currentBalancePence: 125000,
      ownerMemberId: 'member-marius-test',
      ownerPerson: 'Marius',
      isActive: true,
    };
    const vestaLloyds: Account = {
      id: 'lloyds-current-vesta-test',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 0,
      currentBalancePence: 0,
      ownerMemberId: 'member-vesta-test',
      ownerPerson: 'Vesta',
      isActive: true,
    };

    const options = [mariusLloyds, vestaLloyds].map((account) => ({
      value: account.id,
      label: accountIdentityLabel(account),
    }));

    expect(options).toEqual([
      { value: 'lloyds-current-marius-test', label: 'Lloyds · Current · Marius' },
      { value: 'lloyds-current-vesta-test', label: 'Lloyds · Current · Vesta' },
    ]);
    expect(new Set(options.map((option) => option.value)).size).toBe(2);
    expect(new Set(options.map((option) => option.label)).size).toBe(2);
    expect(unified).toContain('value: account.id');
    expect(unified).toContain('label: accountIdentityLabel(account)');
    expect(unified).toContain('onValueChange={onChange}');
    expect(selectSource).toContain('onValueChange(option.value)');
    expect(transaction).toContain('setAccountId(nextAccountId)');
    expect(transaction).toContain('accountId,');
  });

  it('uses select-only listbox semantics rather than falsely exposing a text combobox', () => {
    expect(selectSource).toContain("aria-haspopup={hasOptions ? 'listbox' : undefined}");
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(selectSource).toContain('aria-selected={selected}');
    expect(selectSource).toContain('aria-disabled={option.disabled || undefined}');
    expect(selectSource).not.toContain('role="combobox"');
  });

  it('keeps zero-option direct selectors explicit and prevents empty listbox slivers', () => {
    expect(selectSource).toContain("emptyMessage = 'No options available'");
    expect(selectSource).toContain('const hasOptions = options.length > 0;');
    expect(selectSource).toContain('if (disabled || !hasOptions) return;');
    expect(selectSource).toContain('if (open && !hasOptions) close(false);');
    expect(selectSource).toContain('open && hasOptions && triggerRef.current');
    expect(unified).toContain('emptyMessage="No accounts available"');
  });

  it('keeps the portalled listbox named by the explicit field label or native select label', () => {
    expect(selectSource).toContain('labelledBy?: string');
    expect(selectSource).toContain("aria-label={label || (!labelledBy ? 'Options' : undefined)}");
    expect(selectSource).toContain('aria-labelledby={label ? undefined : labelledBy}');
    expect(selectSource).toContain('labelledBy={ariaLabelledBy}');
    expect(selectSource).toContain('label={snapshot.label}');
  });

  it('supports keyboard opening, navigation, selection, Escape, Tab and focus restoration', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
      expect(selectSource).toContain(`event.key === '${key}'`);
    }
    expect(selectSource).toContain("event.key === ' '");
    expect(selectSource).toContain('focusRelativeTo');
    expect(selectSource).toContain('focus({ preventScroll: true })');
  });

  it('keeps portalled listbox Tab traversal inside the owning modal and wraps at modal edges', () => {
    expect(selectSource).toContain("anchor.closest('[role=\"dialog\"][aria-modal=\"true\"]')");
    expect(selectSource).toContain('const focusScope: ParentNode = modal ?? document;');
    expect(selectSource).toContain('focusScope.querySelectorAll<HTMLElement>');
    expect(selectSource).toContain('const nextIndex = index + (reverse ? -1 : 1);');
    expect(selectSource).toContain('(modal ? candidates[reverse ? candidates.length - 1 : 0] : undefined)');
  });

  it('closes on outside pointer interaction and selects one option without nested interactive option controls', () => {
    expect(selectSource).toContain("document.addEventListener('pointerdown', handlePointerDown, true)");
    expect(selectSource).toContain('if (listboxRef.current?.contains(event.target) || anchor.contains(event.target)) return;');
    expect(selectSource).toMatch(/<div[\s\S]*?role="option"/);
    expect(selectSource).not.toMatch(/role="option"[\s\S]{0,180}<button/);
  });

  it('anchors and collision-constrains the popover to the visual viewport with internal scrolling', () => {
    expect(selectSource).toContain('anchor.getBoundingClientRect()');
    expect(selectSource).toContain('window.visualViewport');
    expect(selectSource).toContain('spaceBelow < MIN_USEFUL_HEIGHT && spaceAbove > spaceBelow');
    expect(selectSource).toContain('viewportWidth - VIEWPORT_GUTTER * 2');
    expect(selectCss).toContain('position: fixed');
    expect(selectCss).toContain('overflow-y: auto');
    expect(selectCss).toContain('overscroll-behavior: contain');
  });

  it('uses the same field surface and geometry independent of user-selected layout mode', () => {
    expect(selectCss).toContain('background-color: var(--field)');
    expect(selectCss).toContain('background: var(--field)');
    expect(selectCss).toContain('border: 1px solid var(--border)');
    expect(selectCss).not.toContain('.mv-layout-phone .mv-select');
    expect(selectCss).not.toContain('.mv-layout-pc .mv-select');
  });

  it('protects iPhone anti-focus-zoom typography and touch geometry in both layout modes', () => {
    expect(selectCss).toContain('@media (max-width: 47.999rem)');
    expect(selectCss).toContain('font-size: var(--mv-control-value-phone-size)');
    expect(selectCss).toContain('line-height: var(--mv-control-value-phone-leading)');
    expect(selectCss).toContain('min-height: 44px');
  });

  it('keeps desktop selectors dense on the 13px/20px shared value tokens', () => {
    expect(selectCss).toContain('font-size: var(--mv-control-value-size)');
    expect(selectCss).toContain('line-height: var(--mv-control-value-leading)');
    expect(selectCss).toContain('min-height: 40px');
  });

  it('keeps Date and Month semantic controls native and outside the dropdown bridge', () => {
    expect(transaction).toContain('id="transaction-date"');
    expect(transaction).toContain('type="date"');
    expect(transaction).toContain('id="unified-bill-due-date"');
    expect(monthPicker).toContain('type="month"');
    expect(selectSource).toContain('HTMLSelectElement');
    expect(selectSource).not.toContain('HTMLInputElement');
  });

  it('preserves transaction/category eligibility sources rather than reimplementing them in MVSelect', () => {
    expect(transaction).toContain('getTransactionCategoryOptions');
    expect(transaction).toContain('getBillCategoryOptions');
    expect(transaction).toContain('isTransactionCategorySelectionAllowed');
    expect(selectSource).not.toContain('categoryEligibility');
    expect(selectSource).not.toContain('safeToMovePence');
  });

  it('contains no user-agent sniffing or page scale workaround', () => {
    expect(selectSource).not.toMatch(/userAgent|navigator\.platform|iPhone|iPad/);
    expect(selectCss).not.toMatch(/zoom\s*:|transform:\s*scale/);
  });
});
