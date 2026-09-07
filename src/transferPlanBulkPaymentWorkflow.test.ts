import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlankLocalHousehold,
  executeLocalTransferAllocations,
  loadLocalHousehold,
  markLocalPaymentsPaid,
  saveLocalHousehold,
  undoLocalPaymentsPaid,
} from './localStore';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

function installFixture() {
  const state = createBlankLocalHousehold();
  state.accounts = [
    {
      id: 'source-savings',
      name: 'Santander',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 1_000_00,
      currentBalancePence: 1_000_00,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
    {
      id: 'bills-marius',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 0,
      currentBalancePence: 0,
      ownerPerson: 'Marius',
      ownerMemberId: 'local-marius',
      isActive: true,
    },
    {
      id: 'bills-vesta',
      name: 'Lloyds',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 500_00,
      currentBalancePence: 500_00,
      ownerPerson: 'Vesta',
      ownerMemberId: 'finance-vesta',
      isActive: true,
    },
  ];
  state.plannedPayments = [
    {
      id: 'rent',
      name: 'Rent',
      amountPence: 600_00,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'bills-marius',
      categoryId: 'cat-rent',
      status: 'unpaid',
      includeInTransferPlan: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    },
    {
      id: 'phone',
      name: 'Phone',
      amountPence: 45_67,
      month: '2026-09',
      responsiblePerson: 'Vesta',
      accountId: 'bills-vesta',
      categoryId: 'cat-broadband',
      status: 'unpaid',
      includeInTransferPlan: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'test',
    },
  ];
  saveLocalHousehold(state);
}

function confirmedPayments(ids: string[]) {
  const state = loadLocalHousehold();
  return ids.map((id) => {
    const payment = state.plannedPayments.find((item) => item.id === id);
    if (!payment) throw new Error(`Missing test payment ${id}`);
    return payment;
  });
}

describe('Transfer Plan bulk payment workflow', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    installFixture();
  });

  it('funding remains separate from Paid status and does not create Activity expenses', () => {
    let state = loadLocalHousehold();
    executeLocalTransferAllocations(
      {
        destinationAccountId: 'bills-marius',
        expectedTotalPence: 600_00,
        allocations: [{ sourceAccountId: 'source-savings', amountPence: 600_00 }],
        description: 'Transfer Plan: fund rent',
        date: '2026-09-06',
        month: '2026-09',
      },
      state.version
    );

    state = loadLocalHousehold();
    expect(state.plannedPayments.find((p) => p.id === 'rent')?.status).toBe('unpaid');
    expect(state.plannedPayments.find((p) => p.id === 'rent')?.actualTransactionId).toBeUndefined();
    expect(state.transactions.filter((tx) => tx.plannedPaymentId === 'rent')).toHaveLength(0);
    expect(state.transactions.filter((tx) => tx.type === 'transfer')).toHaveLength(1);
  });

  it('marks multiple bills paid atomically with planned amounts, one date and each assigned account', () => {
    const before = loadLocalHousehold();
    const result = markLocalPaymentsPaid(
      confirmedPayments(['rent', 'phone']),
      '2026-09-07',
      before.version
    );

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((tx) => tx.amountPence).sort((a,b)=>a-b)).toEqual([45_67, 600_00]);
    expect(result.transactions.every((tx) => tx.date === '2026-09-07')).toBe(true);
    expect(result.transactions.map((tx) => [tx.plannedPaymentId, tx.accountId])).toEqual(
      expect.arrayContaining([
        ['rent', 'bills-marius'],
        ['phone', 'bills-vesta'],
      ])
    );

    const state = loadLocalHousehold();
    for (const payment of state.plannedPayments) {
      expect(payment.status).toBe('paid');
      expect(payment.actualAmountPence).toBe(payment.amountPence);
      expect(payment.actualDate).toBe('2026-09-07');
      const linked = state.transactions.find((tx) => tx.id === payment.actualTransactionId);
      expect(linked?.plannedPaymentId).toBe(payment.id);
      expect(linked?.accountId).toBe(payment.accountId);
    }
  });

  it('does not duplicate Activity expenses when the same already-paid bills are submitted again', () => {
    let state = loadLocalHousehold();
    markLocalPaymentsPaid(confirmedPayments(['rent', 'phone']), '2026-09-07', state.version);
    state = loadLocalHousehold();

    const firstIds = state.transactions
      .filter((tx) => tx.plannedPaymentId)
      .map((tx) => tx.id)
      .sort();

    markLocalPaymentsPaid(confirmedPayments(['rent', 'phone']), '2026-09-07', state.version);
    state = loadLocalHousehold();

    const secondIds = state.transactions
      .filter((tx) => tx.plannedPaymentId)
      .map((tx) => tx.id)
      .sort();

    expect(secondIds).toEqual(firstIds);
    expect(secondIds).toHaveLength(2);
  });

  it('undoes only the exact linked Activity expenses and leaves funding transfers intact', () => {
    let state = loadLocalHousehold();
    executeLocalTransferAllocations(
      {
        destinationAccountId: 'bills-marius',
        expectedTotalPence: 600_00,
        allocations: [{ sourceAccountId: 'source-savings', amountPence: 600_00 }],
        description: 'Transfer Plan: fund rent',
        date: '2026-09-06',
        month: '2026-09',
      },
      state.version
    );
    state = loadLocalHousehold();

    const fundingIds = state.transactions.filter((tx) => tx.type === 'transfer').map((tx) => tx.id);
    markLocalPaymentsPaid(confirmedPayments(['rent', 'phone']), '2026-09-07', state.version);
    state = loadLocalHousehold();

    const unrelatedExpense = {
      id: 'unrelated-expense',
      date: '2026-09-07',
      description: 'Unrelated',
      amountPence: 12_34,
      type: 'expense' as const,
      categoryId: 'cat-groceries',
      accountId: 'bills-vesta',
      payer: 'Vesta' as const,
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-07T12:00:00.000Z',
      createdBy: 'test',
    };
    const raw = loadLocalHousehold();
    raw.transactions.unshift(unrelatedExpense);
    saveLocalHousehold(raw);
    state = loadLocalHousehold();

    undoLocalPaymentsPaid(confirmedPayments(['rent', 'phone']), state.version);
    state = loadLocalHousehold();

    expect(state.plannedPayments.every((p) => p.status === 'unpaid')).toBe(true);
    expect(state.plannedPayments.every((p) => p.actualTransactionId === undefined)).toBe(true);
    expect(state.transactions.filter((tx) => tx.plannedPaymentId)).toHaveLength(0);
    expect(state.transactions.some((tx) => tx.id === 'unrelated-expense')).toBe(true);
    expect(state.transactions.filter((tx) => tx.type === 'transfer').map((tx) => tx.id)).toEqual(fundingIds);
  });

  it('fails safely and mutates nothing if any selected paid bill lacks a uniquely linked Activity expense', () => {
    let state = loadLocalHousehold();
    markLocalPaymentsPaid(confirmedPayments(['rent']), '2026-09-07', state.version);
    state = loadLocalHousehold();

    const broken = loadLocalHousehold();
    const rent = broken.plannedPayments.find((p) => p.id === 'rent')!;
    broken.transactions = broken.transactions.filter((tx) => tx.id !== rent.actualTransactionId);
    saveLocalHousehold(broken);

    state = loadLocalHousehold();
    const versionBefore = state.version;
    expect(() => undoLocalPaymentsPaid(confirmedPayments(['rent']), versionBefore)).toThrow(/missing, duplicated, or mismatched/);

    const after = loadLocalHousehold();
    expect(after.version).toBe(versionBefore);
    expect(after.plannedPayments.find((p) => p.id === 'rent')?.status).toBe('paid');
  });
});
