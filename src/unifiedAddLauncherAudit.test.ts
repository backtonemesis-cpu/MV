import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components/Dashboard.tsx'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(src, 'dashboard.css'), 'utf8');
const transactionModal = fs.readFileSync(path.join(src, 'components/TransactionModal.tsx'), 'utf8');
const types = fs.readFileSync(path.join(src, 'types.ts'), 'utf8');
const plannedPaymentModal = fs.readFileSync(path.join(src, 'components/PlannedPaymentModal.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const launcherStateCss = fs.readFileSync(path.resolve(process.cwd(), 'public/unified-add-launcher-fix.css'), 'utf8');
const sharedUi = fs.readFileSync(path.join(src, 'components/UnifiedAddUi.tsx'), 'utf8');

describe('unified Dashboard Add launcher', () => {
  it('has one semantic Dashboard Add definition with mode-specific placement instead of competing transaction and bill actions', () => {
    expect(dashboard).toContain('const actionControls = canEdit ? (');
    expect(dashboard.match(/<span>Add<\/span>/g)?.length).toBe(1);
    expect(dashboard).toContain('mv-dashboard-actions-pc');
    expect(dashboard).toContain('mv-dashboard-actions-phone');
    expect(dashboardCss).toContain('.mv-layout-phone .mv-dashboard-actions-pc');
    expect(dashboardCss).toContain('.mv-layout-pc .mv-dashboard-actions-phone');
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

  it('keeps Bill outside TransactionType/schema semantics while rendering it in the same launcher shell', () => {
    expect(types).toContain("export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';");
    expect(types).not.toMatch(/TransactionType[^\n]*bill/);
    expect(transactionModal).toContain("if (choice === 'bill')");
    expect(transactionModal).toContain('setIsBillEntry(true)');
    expect(transactionModal).not.toContain("type: 'bill'");
    expect(transactionModal).not.toContain('OPEN_BILL_EVENT');
  });

  it('keeps Bill selection in place and only saves PlannedPayment data on submit', () => {
    expect(dashboard).not.toContain('OPEN_BILL_EVENT');
    expect(transactionModal).toContain('const handleUnifiedChoiceChange = (choice: UnifiedAddChoice) =>');
    expect(transactionModal).toContain("if (choice === 'bill')");
    expect(transactionModal).toContain('setIsBillEntry(true)');
    expect(transactionModal).toContain('onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>');
    expect(transactionModal).toContain('await onSaveBill({');
    expect(transactionModal).not.toContain('dispatchEvent');
    expect(plannedPaymentModal).toContain('await onSave({');
  });

  it('creates nothing merely by opening, switching or cancelling the launcher', () => {
    const openLauncher = dashboard.slice(
      dashboard.indexOf('const openUnifiedAdd'),
      dashboard.indexOf('const actionControls')
    );
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
    expect(indexHtml).toContain('href="/unified-add-launcher-fix.css"');
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
