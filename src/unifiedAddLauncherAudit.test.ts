import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components/Dashboard.tsx'), 'utf8');
const transactionModal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');
const plannedPaymentModal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const launcherStateCss = fs.readFileSync(path.resolve(process.cwd(), 'public/unified-add-launcher-fix.css'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('unified Dashboard Add launcher', () => {
  it('has one primary Dashboard Add action instead of competing transaction and bill actions', () => {
    expect(dashboard).toContain('id="dashboard-add-btn"');
    expect(dashboard).toContain('aria-label="Add"');
    expect(dashboard).not.toContain('id="dashboard-add-tx-btn"');
    expect(dashboard).not.toContain('>Add Transaction</button>');
  });

  it('uses the existing transaction type control as a six-choice launcher on Home', () => {
    expect(transactionModal).toContain('<UnifiedAddTypeTabs');
    for (const label of ['expense', 'income', 'transfer', 'refund', 'repayment', 'bill']) {
      expect(sharedUi).toContain(`'${label}'`);
    }
    expect(sharedUi).toContain('aria-pressed={activeType === type}');
    expect(sharedUi).toContain('aria-label={`Add ${type}`}');
    expect(sharedUi).toContain('mv-transaction-type-tab');
    expect(sharedUi).toContain('role="group"');
  });

  it('keeps Bill navigation-only and outside TransactionType/schema semantics', () => {
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
    expect(transactionModal).toContain("const OPEN_BILL_EVENT = 'mv:open-planned-payment';");
    expect(transactionModal).toContain('window.dispatchEvent(new CustomEvent(OPEN_BILL_EVENT))');
    expect(transactionModal).not.toContain("handleTypeChange('bill'");
    expect(transactionModal).not.toContain("type: 'bill'");
  });

  it('routes Bill to the existing PlannedPayment workflow without saving on selection', () => {
    expect(dashboard).toContain('window.addEventListener(OPEN_BILL_EVENT, openBill)');
    expect(dashboard).toContain('const openBill = () => onOpenPlannedPaymentModal()');
    expect(transactionModal).toContain("if (choice === 'bill')");
    expect(transactionModal).toContain('if (isUnifiedAddLauncher) openBillWorkflow()');
    const billStart = transactionModal.indexOf('const openBillWorkflow');
    const billEnd = transactionModal.indexOf('\n  };', billStart) + 5;
    const billRoute = transactionModal.slice(billStart, billEnd);
    expect(billRoute).toContain('onClose()');
    expect(billRoute).toContain('dispatchEvent');
    expect(billRoute).not.toContain('onSave');
    expect(plannedPaymentModal).toContain('await onSave({');
  });

  it('creates nothing merely by opening, switching or cancelling the launcher', () => {
    const openLauncher = dashboard.slice(dashboard.indexOf('const openUnifiedAdd'), dashboard.indexOf('const { mariusSpendPence'));
    expect(openLauncher).toContain('onOpenAddTransaction()');
    expect(openLauncher).not.toContain('createTransaction');
    expect(openLauncher).not.toContain('createPlannedPayment');
    expect(transactionModal).toContain('onClick={closeModal}');
    expect(transactionModal).toContain('clearUnifiedAddState();');
  });

  it('preserves an initially unselected ordinary Transaction type', () => {
    expect(transactionModal).toContain("useState<TransactionType | ''>('')");
    expect(transactionModal).toContain("setType('')");
    expect(transactionModal).toContain("if (!type) {");
  });

  it('shows only the six-choice launcher and cancel/close affordances before a type is selected', () => {
    expect(indexHtml).toContain('./unified-add-launcher-fix.css');
    expect(launcherStateCss).toContain('button[aria-label="Add bill"]');
    expect(launcherStateCss).toContain(':not(:has(.mv-transaction-type-tab.is-active))');
    expect(launcherStateCss).toContain('.mv-transaction-body > *:not(:has(.mv-transaction-type-tabs))');
    expect(launcherStateCss).toContain('.mv-modal-fixed-actions button[type="submit"]');
    expect(launcherStateCss).toMatch(/button\[type="submit"\][\s\S]*display:\s*none/);
    expect(launcherStateCss).not.toContain('visibility: hidden');
  });

  it('does not introduce width hacks or horizontal launcher overflow', () => {
    const selectorStart = sharedUi.indexOf('className="mv-transaction-type-tabs"');
    const selectorBlock = sharedUi.slice(selectorStart, selectorStart + 2200);
    expect(selectorBlock).not.toContain('calc(100% +');
    expect(selectorBlock).not.toContain('margin-right: -');
    expect(selectorBlock).not.toContain('min-w-[');
    expect(launcherStateCss).not.toContain('width:');
    expect(launcherStateCss).not.toContain('overflow-x');
  });
});
