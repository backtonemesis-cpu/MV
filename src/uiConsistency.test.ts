import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Account } from './types';
import {
  accountIdentityLabel,
  accountOptionLabel,
} from './utils/accountDisplay';
import { localDateInputValue } from './utils/dateInput';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const COMPONENT_DIR = path.join(SRC_DIR, 'components');

const read = (file: string) => fs.readFileSync(file, 'utf8');
const component = (name: string) => read(path.join(COMPONENT_DIR, name));

describe('Global finance UI consistency contract', () => {
  it('uses one explicit account identity format', () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Santander',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 3785_30,
      currentBalancePence: 3785_30,
      ownerPerson: 'Marius',
    };

    expect(accountIdentityLabel(account)).toBe('Santander · Savings · Marius');
    expect(accountOptionLabel(account)).toBe(
      'Santander · Savings · Marius · £3,785.30'
    );
  });

  it('formats financial input dates in local calendar time', () => {
    const local = new Date(2026, 8, 5, 23, 30, 0);
    expect(localDateInputValue(local)).toBe('2026-09-05');
  });

  it('keeps bill editing outside Transfer Plan and makes paid status safely reversible', () => {
    const billModal = component('PlannedPaymentModal.tsx');
    const transactionModal = component('TransactionModal.tsx');
    const plan = component('TransferPlanView.tsx');

    expect(billModal).toContain('mv-money-input-with-prefix');
    expect(billModal).toContain('mv-money-prefix');
    expect(transactionModal.match(/mv-money-input-with-prefix/g)?.length).toBe(2);
    expect(transactionModal.match(/mv-money-prefix/g)?.length).toBe(2);

    expect(plan).toContain("'Undo payment'");
    expect(plan).toContain("'Record paid'");
    expect(plan).toContain("'Undo recorded payment'");
    expect(plan).toContain("'Record payment'");
    expect(plan).toContain('onUndoPaymentPaid');
    expect(plan).toContain('remove the linked Activity expense');
    expect(plan).toContain('Funding records are not changed.');
    expect(plan).toContain('Paid / Complete');

    expect(plan).toContain('Selection only');
    expect(plan).toContain('Bill details are read-only here');
    expect(plan).not.toContain('<PlannedPaymentModal');
    expect(plan).not.toContain('onCreatePlannedPayment');
    expect(plan).not.toContain('onDeletePlannedPayment');
    expect(plan).not.toContain('editingPayment');
    expect(plan).not.toContain('isAddingPayment');
  });

  it('keeps Transfer Plan cards as the primary working surface', () => {
    const plan = component('TransferPlanView.tsx');

    expect(plan).toContain('Bills in this card');
    expect(plan).toContain('Show bills (');
    expect(plan).toContain('Hide bills');
    expect(plan).toContain('renderCardPaymentAction');
    expect(plan).toContain("'Undo payment'");
    expect(plan).toContain("'Record paid'");
    expect(plan).toContain('Undo all funding for this card');
    expect(plan).toContain('onUndoFunding(requirement.account.id, selectedMonth)');
    expect(plan).toContain('Funding recorded');
    expect(plan).toContain('buildTransferPlanAccountModels');
    expect(plan).toContain('Bills · {formatMonthLabel(selectedMonth)}');
  });

  it('keeps Transfer Plan funding choices explicit and removes By', () => {
    const modal = component('ExecuteTransferModal.tsx');

    expect(modal).toContain('Funding sources');
    expect(modal).toContain('Money from');
    expect(modal).toContain('Add source');
    expect(modal).toContain('Record transfer');
    expect(modal).toContain('Choose account');
    expect(modal).toContain('accountOptionLabel(account');
    expect(modal).toContain('Safe to move');
    expect(modal).toContain('reservedPlanPenceByAccountId');
    expect(modal).toContain("sourceAccountId: ''");
    expect(modal).toContain('mv-money-input-with-prefix');
    expect(modal).not.toContain('>By</label>');
    expect(modal).not.toContain('rememberedSource');
    expect(modal).not.toContain('Fully allocated');
  });

  it('does not preselect new savings, account, income, bill, or transaction facts', () => {
    const savings = component('SavingsView.tsx');
    const accounts = component('AccountsView.tsx');
    const income = component('IncomeView.tsx');
    const bill = component('PlannedPaymentModal.tsx');
    const transaction = component('TransactionModal.tsx');
    const paid = component('MarkPaymentPaidModal.tsx');

    expect(savings).toContain("const [sourceAccountId, setSourceAccountId] = useState('')");
    expect(savings).toContain("const [destinationAccountId, setDestinationAccountId] = useState('')");
    expect(savings).not.toContain('transferPayer');
    expect(savings).not.toContain('>By</label>');

    expect(accounts).toContain("useState<AccountType | ''>('')");
    expect(accounts).toContain('Select account type');
    expect(accounts).toContain('<option value="cash">Cash</option>');

    expect(income).toContain("setSourcePerson('')");
    expect(income).toContain("setAccountId('')");
    expect(income).toContain("setCategoryId('')");
    expect(income).toContain("setExpectedDate('')");
    expect(income).toContain('Select account');
    expect(income).toContain('Category (optional)');
    expect(income).not.toContain('Select receiving account');

    expect(bill).toContain("payment?.accountId || ''");
    expect(bill).toContain("payment?.responsiblePerson || ''");
    expect(bill).toContain("payment?.categoryId || ''");
    expect(bill).toContain('payment?.includeInTransferPlan === true');

    expect(transaction).toContain("useState<TransactionType | ''>('')");
    expect(transaction).toContain("useState<Payer | ''>('')");
    expect(transaction).toContain("setCategoryId('')");
    expect(transaction).toContain("setAccountId('')");
    expect(transaction).toContain("setTargetAccountId('')");

    expect(paid).toContain("const [date, setDate] = useState(payment.actualDate || '')");
    expect(paid).toContain("const [accountId, setAccountId] = useState('')");
    expect(paid).toContain('Select payment account');
  });

  it('keeps household role choices inside the approved permission model', () => {
    const members = component('MembersView.tsx');

    expect(members).toContain('<option value="editor">Editor</option>');
    expect(members).toContain('<option value="view_only">View Only</option>');
    expect(members).not.toContain('<option value="owner">Co-Owner</option>');
  });

  it('keeps financial date fallbacks local and protects currency-prefix spacing', () => {
    const store = read(path.join(SRC_DIR, 'localStore.ts'));
    const app = read(path.join(SRC_DIR, 'App.tsx'));
    const css = read(path.join(SRC_DIR, 'index.css'));

    expect(store).not.toContain("new Date().toISOString().slice(0, 10)");
    expect(store).toContain('localTodayDateKey()');
    expect(app).not.toContain("new Date().toISOString().substring(0, 10)");
    expect(app).not.toContain("new Date().toISOString().slice(0, 10)");
    expect(app).toContain('localDateInputValue()');

    expect(css).toContain('.mv-modal-form input.mv-money-input-with-prefix');
    expect(css).toContain('padding-left: 32px !important');
    expect(css).toContain('.mv-money-prefix');
  });

  it('keeps Dashboard on the same Transfer Plan and savings rules', () => {
    const dashboard = component('Dashboard.tsx');

    expect(dashboard).toContain('generateTransferPlan(');
    expect(dashboard).not.toContain('isPlannedPaymentEffectivelyPaid');
    expect(dashboard).toContain("label: 'Transferred From Savings'");
    expect(dashboard).toContain('calculateTransferredFromSavingsPence');
  });

  it('keeps financial amount colors semantic rather than decorative', () => {
    const budget = component('BudgetView.tsx');
    const activity = component('AccountsView.tsx');
    const savings = component('SavingsView.tsx');

    expect(budget).toContain('text-2xl font-black text-success');
    expect(budget).toContain('text-2xl font-black text-danger');
    expect(budget).toContain('text-xs font-extrabold text-main');
    expect(activity).toContain('const isIncomingTransfer =');
    expect(activity).toContain("? '← '");
    expect(activity).toContain(": '→ '");
    expect(activity).toContain("'text-danger'");
    expect(savings).toContain('Transferred From Savings');
  });

  it('uses arrows for movement and neutral account identity in transfer displays', () => {
    const activity = component('TransactionList.tsx');
    const savings = component('SavingsView.tsx');
    const plan = component('TransferPlanView.tsx');

    expect(activity).toContain('accountIdentityLabel(account)');
    expect(activity).toContain(' → ');
    expect(savings).toContain('accountIdentityLabel(sourceAccount)');
    expect(savings).toContain('→');
    expect(plan).toContain('accountIdentityLabel(account)');
  });
});
