import { describe, expect, it } from 'vitest';
import type { HouseholdData, PlannedIncome, PlannedPayment, Transaction } from '../types';
import {
  migrateLegacySourceCategories,
  RETIRED_LEGACY_CATEGORY_IDS,
} from './legacyCategoryMigration';

const categories = [
  ['cat-housing', 'Rent / Mortgage', 'Housing'],
  ['cat-council-tax', 'Council Tax', 'Housing'],
  ['cat-utilities', 'Gas & Electricity', 'Utilities'],
  ['cat-internet', 'Broadband & Mobile', 'Utilities'],
  ['cat-childcare', 'Child Maintenance / Care', 'Family'],
  ['cat-entertainment', 'Entertainment & Subs', 'Discretionary'],
  ['cat-salary', 'Salary & Earnings', 'Income'],
  ['cat-benefits', 'State Benefits / Universal Credit', 'Income'],
  ['cat-child-benefit', 'Child Benefit', 'Income'],
  ['src-cat-fixed', 'Fixed', 'Fixed Bills'],
  ['src-cat-emma', 'Emma', 'Fixed Bills'],
  ['src-cat-subscriptions', 'Subscriptions', 'Fixed Bills'],
  ['src-cat-phones', 'Phones', 'Fixed Bills'],
  ['src-cat-bank-fees', 'Bank Fees', 'Fixed Bills'],
  ['src-cat-variable-household', 'Variable Household', 'Living'],
  ['src-cat-employment', 'Employment', 'Income'],
  ['src-cat-benefits', 'Benefits', 'Income'],
  ['src-cat-c-maintenance', 'C Maintenance', 'Income'],
  ['src-cat-c-benefit', 'C Benefit', 'Income'],
].map(([id, name, group]) => ({ id, name, group, monthlyBudgetPence: 0 }));

function payment(
  row: number,
  name: string,
  amountPence: number,
  categoryId: string,
  accountId = 'acc-santander',
  responsiblePerson = 'Marius'
): PlannedPayment {
  return {
    id: `src-payment-row-${row}`,
    name,
    amountPence,
    actualAmountPence: amountPence,
    actualDate: '2026-09-01',
    actualTransactionId: `tx-${row}`,
    month: '2026-09',
    responsiblePerson,
    accountId,
    categoryId,
    status: 'paid',
    includeInTransferPlan: true,
    createdAt: '2026-08-31T15:55:00.000Z',
    createdBy: 'source-budget-workbook',
    metadata: { sourceRow: row, fundingBatchKey: `fund-${row}` },
  };
}

function expense(
  row: number,
  name: string,
  amountPence: number,
  categoryId: string,
  accountId = 'acc-santander',
  payer = 'Marius'
): Transaction {
  return {
    id: `tx-${row}`,
    date: '2026-09-01',
    description: name,
    amountPence,
    type: 'expense',
    categoryId,
    accountId,
    payer,
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    plannedPaymentId: `src-payment-row-${row}`,
    createdAt: '2026-08-31T15:55:00.000Z',
    createdBy: 'source-budget-workbook',
    metadata: { sourceRow: row, evidence: `evidence-${row}` },
  };
}

function plannedIncome(row: number, categoryId: string): PlannedIncome {
  return {
    id: `src-planned-income-row-${row}`,
    name: row === 6 ? 'U Credit' : row === 8 ? 'Child B' : 'Paycheck',
    expectedAmountPence: row === 6 ? 80000 : row === 8 ? 10820 : 350303,
    actualAmountPence: row === 6 ? 80000 : row === 8 ? 10820 : 350303,
    month: '2026-09',
    sourcePerson: row === 5 ? 'Marius' : 'Vesta',
    accountId: row === 5 ? 'acc-lloyds' : 'acc-natwest',
    categoryId,
    status: 'received',
    actualTransactionId: `income-${row}`,
    createdAt: '2026-08-31T15:55:00.000Z',
    createdBy: 'source-budget-workbook',
  };
}

function incomeTx(row: number, categoryId: string): Transaction {
  const planned = plannedIncome(row, categoryId);
  return {
    id: `income-${row}`,
    date: row === 6 ? '2026-09-05' : row === 8 ? '2026-09-22' : '2026-09-01',
    description: planned.name,
    amountPence: planned.actualAmountPence!,
    type: 'income',
    categoryId,
    accountId: planned.accountId,
    payer: planned.sourcePerson,
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    plannedIncomeId: planned.id,
    createdAt: '2026-08-31T15:55:00.000Z',
    createdBy: 'source-budget-workbook',
  };
}

function household(): HouseholdData {
  const plannedPayments = [
    payment(6, 'Rent', 120000, 'src-cat-fixed'),
    payment(7, 'Electric', 21700, 'src-cat-fixed'),
    payment(36, 'Santander', 300, 'src-cat-bank-fees'),
  ];
  const plannedIncomes = [
    plannedIncome(5, 'src-cat-employment'),
    plannedIncome(6, 'src-cat-benefits'),
    plannedIncome(8, 'src-cat-c-benefit'),
  ];
  return {
    id: 'household',
    name: 'Household',
    version: 41,
    members: [],
    accounts: [
      { id: 'acc-santander', name: 'Santander', type: 'current', currency: 'GBP', startingBalancePence: 400000, currentBalancePence: 400000 },
      { id: 'acc-lloyds', name: 'Lloyds', type: 'current', currency: 'GBP', startingBalancePence: 0, currentBalancePence: 0 },
      { id: 'acc-natwest', name: 'NatWest', type: 'current', currency: 'GBP', startingBalancePence: 0, currentBalancePence: 0 },
    ],
    categories,
    transactions: [
      expense(6, 'Rent', 120000, 'src-cat-fixed'),
      expense(7, 'Electric', 21700, 'src-cat-fixed'),
      expense(36, 'Santander', 300, 'src-cat-bank-fees'),
      incomeTx(5, 'src-cat-employment'),
      incomeTx(6, 'src-cat-benefits'),
      incomeTx(8, 'src-cat-c-benefit'),
      {
        id: 'src-expense-row-44',
        date: '2026-09-01',
        description: 'Food and shopping',
        amountPence: 100000,
        type: 'expense',
        categoryId: 'src-cat-variable-household',
        accountId: 'acc-santander',
        payer: 'Joint',
        isTransfer: false,
        isRepayment: false,
        isSavings: false,
        isRefund: false,
        createdAt: '2026-08-31T15:55:00.000Z',
        createdBy: 'source-budget-workbook',
        metadata: { sourceRow: 44 },
      },
    ],
    plannedPayments,
    plannedIncomes,
    savingsGoals: [],
    auditLogs: [],
  };
}

function withoutCategoryRelationships(state: HouseholdData) {
  return {
    version: state.version,
    accounts: state.accounts,
    transactions: state.transactions.map(({ categoryId: _categoryId, ...tx }) => tx),
    plannedPayments: state.plannedPayments.map(({ categoryId: _categoryId, ...bill }) => bill),
    plannedIncomes: (state.plannedIncomes || []).map(({ categoryId: _categoryId, ...income }) => income),
    savingsGoals: state.savingsGoals,
    auditLogs: state.auditLogs,
  };
}

describe('deterministic legacy source category migration', () => {
  it('moves Rent and Electric to the canonical exact IDs', () => {
    const result = migrateLegacySourceCategories(household());
    expect(result.state.plannedPayments.find((item) => item.id === 'src-payment-row-6')?.categoryId).toBe('cat-housing');
    expect(result.state.transactions.find((item) => item.id === 'tx-6')?.categoryId).toBe('cat-housing');
    expect(result.state.plannedPayments.find((item) => item.id === 'src-payment-row-7')?.categoryId).toBe('cat-utilities');
    expect(result.state.transactions.find((item) => item.id === 'tx-7')?.categoryId).toBe('cat-utilities');
  });

  it('preserves all non-category financial facts and reciprocal payment linkage', () => {
    const before = household();
    const after = migrateLegacySourceCategories(before).state;
    expect(withoutCategoryRelationships(after)).toEqual(withoutCategoryRelationships(before));
    expect(after.transactions.find((item) => item.id === 'tx-6')?.plannedPaymentId).toBe('src-payment-row-6');
    expect(after.plannedPayments.find((item) => item.id === 'src-payment-row-6')?.actualTransactionId).toBe('tx-6');
    expect(after.plannedPayments.find((item) => item.id === 'src-payment-row-6')?.status).toBe('paid');
    expect(after.plannedPayments.find((item) => item.id === 'src-payment-row-6')?.metadata?.fundingBatchKey).toBe('fund-6');
  });

  it('migrates deterministic legacy income lineages without changing amounts, dates, accounts or people', () => {
    const before = household();
    const result = migrateLegacySourceCategories(before);
    expect(result.state.transactions.find((item) => item.id === 'income-5')?.categoryId).toBe('cat-salary');
    expect(result.state.transactions.find((item) => item.id === 'income-6')?.categoryId).toBe('cat-benefits');
    expect(result.state.transactions.find((item) => item.id === 'income-8')?.categoryId).toBe('cat-child-benefit');
    expect(withoutCategoryRelationships(result.state)).toEqual(withoutCategoryRelationships(before));
  });

  it('does not silently guess ambiguous Variable Household data or specific Bank Fees data', () => {
    const result = migrateLegacySourceCategories(household());
    expect(result.state.transactions.find((item) => item.id === 'src-expense-row-44')?.categoryId).toBe('src-cat-variable-household');
    expect(result.state.transactions.find((item) => item.id === 'tx-36')?.categoryId).toBe('src-cat-bank-fees');
    expect(result.report.rows.find((row) => row.transactionId === 'src-expense-row-44')?.confidence).toBe('AMBIGUOUS');
  });

  it('is idempotent and does not duplicate transactions', () => {
    const first = migrateLegacySourceCategories(household());
    const second = migrateLegacySourceCategories(first.state);
    expect(first.state.transactions).toHaveLength(household().transactions.length);
    expect(second.state.transactions).toHaveLength(first.state.transactions.length);
    expect(second.changed).toBe(false);
    expect(second.state).toEqual(first.state);
  });

  it('preserves an already-correct category and a deliberate non-legacy override', () => {
    const state = household();
    state.plannedPayments[0].categoryId = 'cat-housing';
    state.transactions[0].categoryId = 'cat-housing';
    state.plannedPayments[1].categoryId = 'cat-entertainment';
    state.transactions[1].categoryId = 'cat-entertainment';
    const result = migrateLegacySourceCategories(state);
    expect(result.state.transactions[0].categoryId).toBe('cat-housing');
    expect(result.state.transactions[1].categoryId).toBe('cat-entertainment');
  });

  it('recognizes copied planned-bill lineage so rollover cannot preserve the retired category', () => {
    const state = household();
    state.plannedPayments.push({
      ...payment(999, 'Rent', 120000, 'src-cat-fixed'),
      id: 'payment-october-rent',
      month: '2026-10',
      status: 'unpaid',
      actualAmountPence: undefined,
      actualDate: undefined,
      actualTransactionId: undefined,
      metadata: { copiedFromId: 'src-payment-row-6' },
    });
    const result = migrateLegacySourceCategories(state);
    expect(result.state.plannedPayments.find((item) => item.id === 'payment-october-rent')?.categoryId).toBe('cat-housing');
  });

  it('retires only legacy IDs that have deterministic canonical replacements', () => {
    expect(RETIRED_LEGACY_CATEGORY_IDS.has('src-cat-fixed')).toBe(true);
    expect(RETIRED_LEGACY_CATEGORY_IDS.has('src-cat-subscriptions')).toBe(true);
    expect(RETIRED_LEGACY_CATEGORY_IDS.has('src-cat-bank-fees')).toBe(false);
    expect(RETIRED_LEGACY_CATEGORY_IDS.has('src-cat-variable-household')).toBe(false);
    expect(RETIRED_LEGACY_CATEGORY_IDS.has('src-cat-c-maintenance')).toBe(false);
  });
});