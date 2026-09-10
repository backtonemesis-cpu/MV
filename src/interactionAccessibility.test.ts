import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const COMPONENT_DIR = path.join(SRC_DIR, 'components');
const read = (file: string) => fs.readFileSync(file, 'utf8');
const component = (name: string) => read(path.join(COMPONENT_DIR, name));

describe('Global interaction accessibility contract', () => {
  it('uses one native month-picker indicator instead of competing calendar icons', () => {
    const monthPicker = component('MonthPicker.tsx');
    expect(monthPicker).toContain('type="month"');
    expect(monthPicker).toContain('showPicker');
    expect(monthPicker).not.toContain('CalendarDays');
    expect(monthPicker).not.toContain('mv-month-picker-icon');
  });

  it('keeps mobile More navigation as a disclosure instead of an incomplete ARIA menu', () => {
    const nav = component('Navigation.tsx');
    expect(nav).toContain('aria-expanded={isMoreOpen}');
    expect(nav).toContain('aria-controls="mobile-more-navigation"');
    expect(nav).toContain("event.key !== 'Escape'");
    expect(nav).not.toContain('role="menu"');
    expect(nav).not.toContain('role="menuitem"');
    expect(nav).not.toContain('aria-haspopup="menu"');
  });

  it('gives core dialogs modal semantics and shared focus containment', () => {
    for (const name of [
      'TransactionModal.tsx',
      'BackupRestoreModal.tsx',
      'MonthImportModal.tsx',
      'ConflictResolutionModal.tsx',
      'AcceptanceTestsModal.tsx',
      'PlannedPaymentModal.tsx',
      'MarkPaymentPaidModal.tsx',
      'AccountsView.tsx',
      'IncomeView.tsx',
      'SavingsView.tsx',
      'ExecuteTransferModal.tsx',
    ]) {
      const source = component(name);
      expect(source, name).toContain('aria-modal="true"');
      expect(source, name).toContain('useModalAccessibility');
    }

    const helper = read(path.join(SRC_DIR, 'utils', 'modalAccessibility.ts'));
    expect(helper).toContain("event.key !== 'Tab'");
    expect(helper).toContain("event.key === 'Escape'");
    expect(helper).toContain('returnTarget.focus');
    expect(helper).toContain("document.body.style.overflow = 'hidden'");
  });

  it('supports keyboard operation and discoverable disabled reasons in the funding listbox', () => {
    const funding = component('ExecuteTransferModal.tsx');
    const select = component('MVSelect.tsx');
    expect(funding).toContain('<MVSelect');
    expect(funding).toContain('ariaLabelledBy={sourceLabelId}');
    expect(funding).toContain('disabled: Boolean(disabledReason)');
    expect(funding).toContain('disabledReason: disabledReason || undefined');
    expect(funding).toContain('Credit/liability account — not a cash funding source');
    expect(funding).toContain('No safe-to-move balance');
    expect(select).toContain('aria-haspopup="listbox"');
    expect(select).toContain('role="listbox"');
    expect(select).toContain('role="option"');
    expect(select).toContain('aria-disabled={option.disabled || undefined}');
    expect(select).toContain("event.key === 'ArrowDown'");
    expect(select).toContain("event.key === 'ArrowUp'");
    expect(select).toContain("event.key === 'Home'");
    expect(select).toContain("event.key === 'End'");
    expect(select).toContain("event.key === 'Escape'");
  });
});
