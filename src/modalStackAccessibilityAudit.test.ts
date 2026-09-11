import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const COMPONENT_DIR = path.join(SRC_DIR, 'components');
const read = (file: string) => fs.readFileSync(file, 'utf8');
const component = (name: string) => read(path.join(COMPONENT_DIR, name));
const helper = read(path.join(SRC_DIR, 'utils', 'modalAccessibility.ts'));

describe('Shared modal stack and background isolation contract', () => {
  it('maintains one ordered modal stack and identifies only the top modal', () => {
    expect(helper).toContain('const modalStack: ModalEntry[] = []');
    expect(helper).toContain('function getTopModal()');
    expect(helper).toContain('function isTopModal(id: symbol)');
    expect(helper).toContain('modalStack.push(entry)');
    expect(helper).toContain('modalStack.splice(index, 1)');
  });

  it('makes background siblings inert and aria-hidden while preserving prior state', () => {
    expect(helper).toContain('inert: sibling.inert');
    expect(helper).toContain("ariaHidden: sibling.getAttribute('aria-hidden')");
    expect(helper).toContain('sibling.inert = true');
    expect(helper).toContain("sibling.setAttribute('aria-hidden', 'true')");
    expect(helper).toContain('state.element.inert = state.inert');
    expect(helper).toContain("state.element.removeAttribute('aria-hidden')");
    expect(helper).toContain("state.element.setAttribute('aria-hidden', state.ariaHidden)");
  });

  it('keeps body scrolling locked until the final modal leaves the stack', () => {
    expect(helper).toContain('let previousBodyOverflow: string | null = null');
    expect(helper).toContain("document.body.style.overflow = 'hidden'");
    expect(helper).toContain('if (!topModal)');
    expect(helper).toContain('document.body.style.overflow = previousBodyOverflow');
  });

  it('allows only the topmost modal to own Escape and Tab handling', () => {
    expect(helper).toContain('if (!isTopModal(modalId)) return');
    expect(helper).toContain("event.key === 'Escape'");
    expect(helper).toContain("event.key !== 'Tab'");
    expect(helper).toContain("document.addEventListener('keydown', handleKeyDown, true)");
  });

  it('restores focus only when the remaining top modal contains the return target', () => {
    expect(helper).toContain('const remainingTop = getTopModal()');
    expect(helper).toContain('remainingTop && !remainingTop.dialog.contains(returnTarget)');
    expect(helper).toContain('returnTarget.focus({ preventScroll: true })');
  });

  it('blocks the global command shortcut behind another modal but lets the palette close itself', () => {
    expect(helper).toContain("event.key.toLowerCase() === 'k'");
    expect(helper).toContain("data-modal-allows-command-shortcut");
    expect(component('CommandPalette.tsx')).toContain('data-modal-allows-command-shortcut');
  });

  it('covers current high-risk and recently-added dialogs through the shared helper', () => {
    for (const name of [
      'TransactionModal.tsx',
      'PlannedPaymentModal.tsx',
      'BackupRestoreModal.tsx',
      'MonthImportModal.tsx',
      'ConflictResolutionModal.tsx',
      'CommandPalette.tsx',
      'ConfirmActionDialog.tsx',
      'MarkPaymentPaidModal.tsx',
      'BulkPaymentStatusModal.tsx',
      'ExecuteTransferModal.tsx',
      'UndoFundingModal.tsx',
      'TransactionList.tsx',
      'AccountsView.tsx',
      'IncomeView.tsx',
      'SavingsView.tsx',
    ]) {
      expect(component(name), name).toContain('useModalAccessibility');
    }
  });

  it('does not change financial mutation or storage modules as part of modal infrastructure', () => {
    expect(helper).not.toContain('localStorage');
    expect(helper).not.toContain('amountPence');
    expect(helper).not.toContain('accountId');
    expect(helper).not.toContain('transaction');
  });
});
