import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedPayment } from './types';
import {
  createBlankLocalHousehold,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  markLocalPaymentsPaid,
  saveLocalHousehold,
  undoLocalPaymentsPaid,
} from './localStore';

const transferSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransferPlanView.tsx'),
  'utf8'
);
const quickModalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/BulkPaymentStatusModal.tsx'),
  'utf8'
);
const detailsModalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MarkPaymentPaidModal.tsx'),
  'utf8'
);
const undoFundingSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UndoFundingModal.tsx'),
  'utf8'
);

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const month = '2026-09';
const paymentDate = '2026-09-06';

function bill(
  id: string,
  name: string,
  amountPence: number
): PlannedPayment {
  return {
    id,
    name,
    amountPence,
    month,
    responsiblePerson: 'Marius',
    accountId: 'santander-current-marius',
    categoryId: 'cat-housing',
    status: 'unpaid',
    includeInTransferPlan: true,
    dueDate: '2026-09-20',
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'test',
  };
}

function installSantanderFixture() {
  const state = createBlankLocalHousehold();
  state.accounts = [
    {
      id: 'funding-source',
      name: 'Santander',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 1_441_00,
      currentBalancePence: 1_441_00,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
    {
      id: 'santander-current-marius',
      name: 'Santander',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 0,
      currentBalancePence: 0,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
  ];
  state.plannedPayments = [
    bill('rent', 'Rent', 1_200_00),
    bill('electric', 'Electric', 217_00),
    bill('netflix', 'Netflix', 12_99),
    bill('phone', 'Phone', 8_01),
    bill('santander', 'Santander', 3_00),
  ];
  saveLocalHousehold(state);

  const beforeFunding = loadLocalHousehold();
  executeLocalTransferAllocations(
    {
      destinationAccountId: 'santander-current-marius',
      expectedTotalPence: 1_441_00,
      allocations: [
        { sourceAccountId: 'funding-source', amountPence: 1_441_00 },
      ],
      description: 'Transfer Plan: fund Santander card',
      date: '2026-09-05',
      month,
    },
    beforeFunding.version
  );
}

function snapshots(ids?: string[]) {
  const state = loadLocalHousehold();
  const set = ids ? new Set(ids) : null;
  return state.plannedPayments.filter((payment) => !set || set.has(payment.id));
}

describe('Santander £1,441 Transfer Plan payment UX regression', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installSantanderFixture();
  });

  it('makes whole-card and normal single-bill payment use one compact confirmation architecture', () => {
    expect(transferSource).toContain('Mark all paid');
    expect(transferSource).toContain("payments: requirement.unpaidPayments");
    expect(transferSource).toContain(
      "setBulkPaymentDialog({ mode: 'mark', payments: [payment] })"
    );
    expect(transferSource).toContain('Mark paid');
    expect(quickModalSource).toContain("payments.length === 1");
    expect(quickModalSource).toContain("?'Mark paid'".replace('?', ''));
    expect(quickModalSource).toContain('localDateInputValue()');
    expect(quickModalSource).toContain('accountIdentityLabel(account)');
    expect(quickModalSource).toContain('payment.responsiblePerson');
    expect(quickModalSource).toContain('categoriesById.get(payment.categoryId)');
  });

  it('keeps Payment details as the secondary exception form', () => {
    expect(transferSource).toContain('Payment details');
    expect(transferSource).toContain('setMarkingPayment(payment)');
    expect(detailsModalSource).toContain('Payment details');
    expect(detailsModalSource).toContain('Actual amount (£)');
    expect(detailsModalSource).toContain('Actual date');
    expect(detailsModalSource).toContain('Paid from');
    expect(detailsModalSource).toContain('data-modal-initial-focus');
  });

  it('removes visible Payment action clutter while preserving explicit accessible selection names', () => {
    expect(transferSource).not.toContain('<span>Payment action</span>');
    expect(transferSource).toContain('Select ${payment.name} for payment');
    expect(transferSource).toContain('Select ${payment.name} to undo payment');

    const selectionStart = transferSource.indexOf(
      'const togglePaymentActionSelection'
    );
    const selectionEnd = transferSource.indexOf(
      'const clearPaymentActionSelection',
      selectionStart
    );
    const selectionHandler = transferSource.slice(selectionStart, selectionEnd);
    expect(selectionHandler).toContain('setPaymentActionSelectedIds');
    expect(selectionHandler).not.toContain('onMarkPaymentsPaid');
    expect(selectionHandler).not.toContain('onUndoPaymentsPaid');
  });

  it('keeps Transfer Plan inclusion visibly separate from payment actions', () => {
    expect(transferSource).toContain('aria-label="Transfer Plan bill selection"');
    expect(transferSource).toContain('Selection only');
    expect(transferSource).toContain('Include Unpaid');
    expect(transferSource).toContain('Include Paid');
    expect(transferSource).toContain('Include All');
    expect(transferSource).toContain('Exclude All');
    expect(transferSource).toContain('Mark selected paid');
    expect(transferSource).toContain('Undo selected payments');
  });

  it('calculates the exact Santander whole-card and Rent + Netflix selected totals', () => {
    const state = loadLocalHousehold();
    const allTotal = state.plannedPayments.reduce(
      (sum, payment) => sum + payment.amountPence,
      0
    );
    const selectedTotal = state.plannedPayments
      .filter((payment) => payment.id === 'rent' || payment.id === 'netflix')
      .reduce((sum, payment) => sum + payment.amountPence, 0);

    expect(allTotal).toBe(1_441_00);
    expect(selectedTotal).toBe(1_212_99);
    expect(quickModalSource).toContain(
      'payments.reduce((sum, payment) =>'
    );
    expect(quickModalSource).toContain('formatPence(totalPence)');
  });

  it('confirming Mark all paid creates exactly five reciprocal Activity expenses and leaves funding intact', () => {
    let state = loadLocalHousehold();
    const fundingIds = state.transactions
      .filter((transaction) => transaction.type === 'transfer')
      .map((transaction) => transaction.id);

    expect(state.plannedPayments).toHaveLength(5);
    expect(state.plannedPayments.every((payment) => payment.status === 'unpaid')).toBe(true);
    expect(state.accounts.find((account) => account.id === 'santander-current-marius')?.currentBalancePence).toBe(1_441_00);

    markLocalPaymentsPaid(snapshots(), paymentDate, state.version);
    state = loadLocalHousehold();

    const activity = state.transactions.filter(
      (transaction) => Boolean(transaction.plannedPaymentId)
    );
    expect(activity).toHaveLength(5);
    expect(activity.reduce((sum, transaction) => sum + transaction.amountPence, 0)).toBe(1_441_00);
    expect(activity.every((transaction) => transaction.accountId === 'santander-current-marius')).toBe(true);
    expect(activity.every((transaction) => transaction.date === paymentDate)).toBe(true);
    expect(state.plannedPayments.every((payment) => payment.status === 'paid')).toBe(true);

    for (const payment of state.plannedPayments) {
      const linked = state.transactions.find(
        (transaction) => transaction.id === payment.actualTransactionId
      );
      expect(linked?.plannedPaymentId).toBe(payment.id);
      expect(linked?.amountPence).toBe(payment.amountPence);
    }

    expect(
      state.transactions
        .filter((transaction) => transaction.type === 'transfer')
        .map((transaction) => transaction.id)
    ).toEqual(fundingIds);
  });

  it('Undo Paid removes only the exact selected payment Activity and leaves the £1,441 funding transfer intact', () => {
    let state = loadLocalHousehold();
    const fundingIds = state.transactions
      .filter((transaction) => transaction.type === 'transfer')
      .map((transaction) => transaction.id);

    markLocalPaymentsPaid(snapshots(), paymentDate, state.version);
    state = loadLocalHousehold();

    undoLocalPaymentsPaid(snapshots(['rent', 'netflix']), state.version);
    state = loadLocalHousehold();

    expect(
      state.transactions.filter((transaction) => transaction.plannedPaymentId)
    ).toHaveLength(3);
    expect(state.plannedPayments.find((payment) => payment.id === 'rent')?.status).toBe('unpaid');
    expect(state.plannedPayments.find((payment) => payment.id === 'netflix')?.status).toBe('unpaid');
    expect(state.plannedPayments.find((payment) => payment.id === 'electric')?.status).toBe('paid');
    expect(
      state.transactions
        .filter((transaction) => transaction.type === 'transfer')
        .map((transaction) => transaction.id)
    ).toEqual(fundingIds);
  });

  it('keeps Cancel/Close/Escape non-mutating and warns clearly before Undo Funding with paid bills', () => {
    expect(quickModalSource).toContain('data-modal-initial-focus');
    expect(quickModalSource).toContain('onClick={onClose}');
    expect(quickModalSource).toContain(
      'useModalAccessibility<HTMLElement>(true, onClose)'
    );
    expect(undoFundingSource).toContain(
      'recorded with their linked Activity expenses'
    );
    expect(undoFundingSource).toContain(
      'resulting account/funding position may change'
    );
  });
});
