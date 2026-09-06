import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Stage 4 accessibility and responsive regression contract', () => {
  it('installs the global modal accessibility guard and final accessibility stylesheet before render', () => {
    const main = read('main.tsx');
    expect(main).toContain("import './globalDesignSystem.css';");
    expect(main).toContain("import './accessibility.css';");
    expect(main.indexOf("import './accessibility.css';")).toBeGreaterThan(
      main.indexOf("import './globalDesignSystem.css';")
    );
    expect(main).toContain("import { installModalAccessibility } from './utils/modalAccessibility'");
    expect(main).toContain('installModalAccessibility();');
  });

  it('enforces modal semantics, contained focus, labelled controls, selection state, alerts and focus restoration', () => {
    const modal = read('utils/modalAccessibility.ts');
    expect(modal).toContain(".mv-modal-backdrop .mv-modal-card");
    expect(modal).toContain("dialog.setAttribute('role', 'dialog')");
    expect(modal).toContain("dialog.setAttribute('aria-modal', 'true')");
    expect(modal).toContain("dialog.setAttribute('aria-labelledby', title.id)");
    expect(modal).toContain("button.setAttribute('aria-label', 'Close dialog')");
    expect(modal).toContain('label.htmlFor = control.id');
    expect(modal).toContain(".mv-transaction-type-tab, .mv-transaction-selector-pill");
    expect(modal).toContain("button.setAttribute('aria-pressed'");
    expect(modal).toContain('.mv-rollover-error');
    expect(modal).toContain('.mv-transaction-modal .bg-danger-soft.border-danger');
    expect(modal).toContain("error.setAttribute('role', 'alert')");
    expect(modal).toContain("if (event.key !== 'Tab') return");
    expect(modal).toContain('(event.shiftKey ? last : first).focus()');
    expect(modal).toContain('if (target?.isConnected) target.focus()');
    expect(modal).toContain("attributeFilter: ['class']");
  });

  it('hardens high-risk finance and recovery dialogs explicitly', () => {
    const backup = read('components/BackupRestoreModal.tsx');
    const payment = read('components/MarkPaymentPaidModal.tsx');
    const bill = read('components/PlannedPaymentModal.tsx');
    const conflict = read('components/ConflictResolutionModal.tsx');

    expect(backup).toContain('aria-labelledby="backup-restore-modal-title"');
    expect(backup).toContain('aria-label="Close backup and restore"');
    expect(backup).toContain('role="alert"');
    expect(payment).toContain('htmlFor="record-payment-amount"');
    expect(payment).toContain('htmlFor="record-payment-date"');
    expect(payment).toContain('htmlFor="record-payment-account"');
    expect(payment).toContain('role="alert"');
    expect(bill).toContain('aria-labelledby="planned-payment-modal-title"');
    expect(bill).toContain('htmlFor="planned-payment-account"');
    expect(bill).toContain('aria-label="Include in Transfer Plan"');
    expect(conflict).toContain('role="alertdialog"');
    expect(conflict).toContain('aria-describedby="conflict-modal-description"');
  });

  it('uses navigation semantics rather than an incomplete ARIA menu model', () => {
    const navigation = read('components/Navigation.tsx');
    expect(navigation).toContain('aria-label="Primary navigation"');
    expect(navigation).toContain('aria-label="Mobile navigation"');
    expect(navigation).toContain("aria-current={isActive ? 'page' : undefined}");
    expect(navigation).toContain("if (event.key !== 'Escape') return");
    expect(navigation).toContain("document.getElementById('mobile-nav-tab-more')?.focus()");
    expect(navigation).not.toContain('role="menu"');
    expect(navigation).not.toContain('role="menuitem"');
  });

  it('retains the repaired PC/Phone controls and iPhone-safe sizing', () => {
    const header = read('components/Header.tsx');
    const design = read('globalDesignSystem.css');

    expect(header).toContain('aria-label="App display mode"');
    expect(header).toContain('aria-label="Use PC layout"');
    expect(header).toContain('aria-label="Use Phone layout"');
    expect(header).toContain("aria-pressed={layoutMode === 'pc'}");
    expect(header).toContain("aria-pressed={layoutMode === 'phone'}");

    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(design).toContain('--mv-ds-control-large: 2.75rem');
    expect(design).toContain('env(safe-area-inset-bottom)');
    expect(design).toContain('.mv-layout-phone .mv-nav-mobile');
  });

  it('keeps small supporting text contrast and keyboard focus visibly accessible', () => {
    const accessibility = read('accessibility.css');

    expect(accessibility).toContain('[data-theme="light"]');
    expect(accessibility).toContain('--text-muted: #5f6f85');
    expect(accessibility).toContain('--text-subtle: #5f6f85');
    expect(accessibility).toContain('[data-theme="dark"]');
    expect(accessibility).toContain('--text-subtle: #94a3b8');
    expect(accessibility).toContain('[data-theme="slate"]');
    expect(accessibility).toContain('--text-subtle: #cbd5e1');
    expect(accessibility).toContain(':focus-visible');
    expect(accessibility).toContain('outline: 2px solid var(--mv-focus-ring) !important');
    expect(accessibility).toContain('outline-offset: 2px !important');
  });
});