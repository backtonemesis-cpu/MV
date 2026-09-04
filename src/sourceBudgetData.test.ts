import { describe, expect, it } from 'vitest';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateSavingsPosition,
} from './utils/currency';
import {
  createSourceBudgetHousehold,
  SOURCE_BUDGET_EXPECTED,
  SOURCE_BUDGET_IMPORT_ID,
} from './sourceBudgetData';

describe('September source budget snapshot', () => {
  it('reproduces the audited workbook totals exactly in integer pence', () => {
    const state = createSourceBudgetHousehold();
    const monthTransactions = state.transactions.filter((tx) =>
      tx.date.startsWith(SOURCE_BUDGET_EXPECTED.month)
    );

    const summary = calculateFinancialSummary(monthTransactions);
    const surplus = calculateMonthlySurplus(
      state.transactions,
      state.plannedPayments,
      SOURCE_BUDGET_EXPECTED.month,
      state.plannedIncomes || []
    );

    expect(summary.grossIncomePence).toBe(SOURCE_BUDGET_EXPECTED.incomePence);
    expect(summary.grossExpensesPence).toBe(SOURCE_BUDGET_EXPECTED.expensesPence);

    expect(surplus.actualIncomeReceivedPence).toBe(SOURCE_BUDGET_EXPECTED.incomePence);
    expect(surplus.expectedIncomePence).toBe(SOURCE_BUDGET_EXPECTED.incomePence);
    expect(surplus.fixedBillsTotalPence).toBe(SOURCE_BUDGET_EXPECTED.fixedBillsPence);
    expect(surplus.fixedBillsUnpaidPence).toBe(SOURCE_BUDGET_EXPECTED.unpaidBillsPence);
    expect(surplus.grossOtherSpendingPence).toBe(
      SOURCE_BUDGET_EXPECTED.variableSpendingPence
    );
    expect(surplus.availableSurplusPence).toBe(
      SOURCE_BUDGET_EXPECTED.savedThisMonthPence
    );

    const currentSavingsPence = state.accounts.reduce(
      (sum, account) => sum + account.currentBalancePence,
      0
    );
    expect(currentSavingsPence).toBe(SOURCE_BUDGET_EXPECTED.currentSavingsPence);
    expect(currentSavingsPence + surplus.availableSurplusPence).toBe(
      SOURCE_BUDGET_EXPECTED.projectedEndSavingsPence
    );

    const savingsPosition = calculateSavingsPosition(
      state.accounts,
      state.transactions,
      state.plannedPayments,
      SOURCE_BUDGET_EXPECTED.month,
      state.plannedIncomes || []
    );

    expect(savingsPosition.currentSavingsPence).toBe(
      SOURCE_BUDGET_EXPECTED.currentSavingsPence
    );
    expect(savingsPosition.savedThisMonthPence).toBe(
      SOURCE_BUDGET_EXPECTED.savedThisMonthPence
    );
    expect(savingsPosition.projectedEndSavingsPence).toBe(
      SOURCE_BUDGET_EXPECTED.projectedEndSavingsPence
    );
    expect(savingsPosition.savingsAccounts.map((account) => account.name)).toEqual([
      'Chase',
      'Santander',
      'Cash',
    ]);

    expect(state.transactions).toHaveLength(19);
    expect(state.plannedPayments).toHaveLength(13);
    expect(state.plannedIncomes).toHaveLength(5);
    expect(
      state.schemaStatus?.appliedMigrations.some(
        (migration) => migration.name === SOURCE_BUDGET_IMPORT_ID
      )
    ).toBe(true);
  });

  it('keeps source attribution and the Household-to-Joint compatibility mapping traceable', () => {
    const state = createSourceBudgetHousehold();

    const food = state.transactions.find((tx) => tx.description === 'Food and shopping');
    expect(food).toEqual(
      expect.objectContaining({
        amountPence: 100000,
        payer: 'Joint',
        accountId: 'src-account-credit-card',
        categoryId: 'src-cat-variable-household',
      })
    );
    expect(food?.metadata?.sourcePaidBy).toBe('Household');

    const maintenance = state.transactions.find((tx) => tx.description === 'Child M');
    expect(maintenance).toEqual(
      expect.objectContaining({
        amountPence: 34979,
        payer: 'Vesta',
        accountId: 'src-account-natwest',
        categoryId: 'src-cat-c-maintenance',
      })
    );
  });
});
