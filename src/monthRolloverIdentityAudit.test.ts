import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedIncome, PlannedPayment } from './types';
import {
  createBlankLocalHousehold,
  importLocalMonth,
  loadLocalHousehold,
  saveLocalHousehold,
} from './localStore';
import {
  isRolloverIncomeDuplicate,
  isRolloverPaymentDuplicate,
  shiftRolloverDateToMonth,
} from './utils/monthRolloverIdentity';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function payment(overrides: Partial<PlannedPayment> = {}): PlannedPayment {
  return {
    id: 'bill-source',
    name: 'Childcare',
    amountPence: 50_00,
    month: '2026-09',
    responsiblePerson: 'Marius',
    accountId: 'account-current',
    dueDate: '2026-09-05',
    categoryId: 'cat-rent',
    status: 'unpaid',
    includeInTransferPlan: true,
    isRecurring: true,
    notes: 'Morning club',
    createdAt: '2026-09-01T09:00:00.000Z',
    createdBy: 'test',
    ...overrides,
  };
}

function income(overrides: Partial<PlannedIncome> = {}): PlannedIncome {
  return {
    id: 'income-source',
    name: 'Allowance',
    expectedAmountPence: 100_00,
    month: '2026-09',
    sourcePerson: 'Marius',
    accountId: 'account-current',
    categoryId: 'cat-salary-wages',
    expectedDate: '2026-09-10',
    status: 'expected',
    notes: 'Monthly allowance',
    createdAt: '2026-09-01T09:00:00.000Z',
    createdBy: 'test',
    ...overrides,
  };
}

describe('Prepare Next Month canonical identity', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('keeps copiedFromId lineage authoritative for repeated rollover', () => {
    const source = payment();
    const target = payment({
      id: 'bill-target',
      month: '2026-10',
      categoryId: 'cat-groceries',
      dueDate: '2026-10-20',
      metadata: { copiedFromId: source.id },
    });

    expect(isRolloverPaymentDuplicate(source, target, '2026-10')).toBe(true);
  });

  it('does not collapse same-core bills when category, due date, notes, or rollover flags differ', () => {
    const source = payment();
    const exactTarget = payment({
      id: 'bill-target',
      month: '2026-10',
      dueDate: '2026-10-05',
    });

    expect(isRolloverPaymentDuplicate(source, exactTarget, '2026-10')).toBe(true);
    expect(
      isRolloverPaymentDuplicate(
        source,
        { ...exactTarget, categoryId: 'cat-groceries' },
        '2026-10'
      )
    ).toBe(false);
    expect(
      isRolloverPaymentDuplicate(
        source,
        { ...exactTarget, dueDate: '2026-10-20' },
        '2026-10'
      )
    ).toBe(false);
    expect(
      isRolloverPaymentDuplicate(
        source,
        { ...exactTarget, notes: 'Afternoon club' },
        '2026-10'
      )
    ).toBe(false);
    expect(
      isRolloverPaymentDuplicate(
        source,
        { ...exactTarget, includeInTransferPlan: false },
        '2026-10'
      )
    ).toBe(false);
  });

  it('does not collapse same-core income when category, expected date, or notes differ', () => {
    const source = income();
    const exactTarget = income({
      id: 'income-target',
      month: '2026-10',
      expectedDate: '2026-10-10',
    });

    expect(isRolloverIncomeDuplicate(source, exactTarget, '2026-10')).toBe(true);
    expect(
      isRolloverIncomeDuplicate(
        source,
        { ...exactTarget, categoryId: 'cat-child-benefit' },
        '2026-10'
      )
    ).toBe(false);
    expect(
      isRolloverIncomeDuplicate(
        source,
        { ...exactTarget, expectedDate: '2026-10-20' },
        '2026-10'
      )
    ).toBe(false);
    expect(
      isRolloverIncomeDuplicate(
        source,
        { ...exactTarget, notes: 'Second allowance' },
        '2026-10'
      )
    ).toBe(false);
  });

  it('uses the same month-end clamping rule for duplicate identity and copied dates', () => {
    expect(shiftRolloverDateToMonth('2027-01-31', '2027-02')).toBe('2027-02-28');
    expect(shiftRolloverDateToMonth('2028-01-31', '2028-02')).toBe('2028-02-29');

    const source = payment({ dueDate: '2027-01-31' });
    const target = payment({
      id: 'bill-february',
      month: '2027-02',
      dueDate: '2027-02-28',
    });
    expect(isRolloverPaymentDuplicate(source, target, '2027-02')).toBe(true);
  });

  it('imports distinct same-core scheduled records and keeps a repeated lineage import idempotent', () => {
    const state = createBlankLocalHousehold();
    state.accounts = [
      {
        id: 'account-current',
        name: 'Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 0,
        currentBalancePence: 0,
        ownerMemberId: 'local-marius',
        ownerPerson: 'Marius',
        isActive: true,
      },
    ];
    state.plannedPayments = [
      payment({ id: 'bill-one', dueDate: '2026-09-05', notes: 'Morning club' }),
      payment({ id: 'bill-two', dueDate: '2026-09-20', notes: 'Afternoon club' }),
    ];
    state.plannedIncomes = [
      income({ id: 'income-one', expectedDate: '2026-09-10', notes: 'First allowance' }),
      income({ id: 'income-two', expectedDate: '2026-09-25', notes: 'Second allowance' }),
    ];
    saveLocalHousehold(state);

    const first = importLocalMonth(
      {
        sourceMonth: '2026-09',
        targetMonth: '2026-10',
        paymentIds: ['bill-one', 'bill-two'],
        incomeIds: ['income-one', 'income-two'],
      },
      state.version
    );

    expect(first.importedPayments).toBe(2);
    expect(first.importedIncomes).toBe(2);

    const current = loadLocalHousehold();
    expect(
      current.plannedPayments
        .filter((item) => item.month === '2026-10')
        .map((item) => item.dueDate)
        .sort()
    ).toEqual(['2026-10-05', '2026-10-20']);
    expect(
      (current.plannedIncomes || [])
        .filter((item) => item.month === '2026-10')
        .map((item) => item.expectedDate)
        .sort()
    ).toEqual(['2026-10-10', '2026-10-25']);

    const second = importLocalMonth(
      {
        sourceMonth: '2026-09',
        targetMonth: '2026-10',
        paymentIds: ['bill-one', 'bill-two'],
        incomeIds: ['income-one', 'income-two'],
      },
      current.version
    );

    expect(second.imported).toBe(0);
  });

  it('keeps UI preflight and the production storage mutation on the same canonical rollover helper', () => {
    const modalSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MonthImportModal.tsx'),
      'utf8'
    );
    const apiSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/utils/api.ts'),
      'utf8'
    );
    const storeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/localStore.ts'),
      'utf8'
    );

    expect(modalSource).toContain('isRolloverPaymentDuplicate');
    expect(modalSource).toContain('isRolloverIncomeDuplicate');
    expect(apiSource).toContain('importLocalMonth,');
    expect(apiSource).toContain('return importLocalMonth(request, expectedVersion);');
    expect(apiSource).not.toContain('monthRolloverStore');
    expect(storeSource).toContain('isRolloverPaymentDuplicate');
    expect(storeSource).toContain('isRolloverIncomeDuplicate');
    expect(storeSource).toContain('shiftRolloverDateToMonth');
  });
});
