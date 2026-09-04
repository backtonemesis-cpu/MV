import { describe, expect, it } from 'vitest';
import {
  calculateFinancialSummary,
  calculateMonthlySurplus,
  calculateSavingsPosition,
} from './utils/currency';
import {
  createSourceBudgetHousehold,
  preserveCompatibleSavingsGoals,
  resolveCompatibleAccount,
  SOURCE_BUDGET_EXPECTED,
  SOURCE_BUDGET_IMPORT_ID,
} from './sourceBudgetData';
import type { Account, HouseholdData, SavingsGoal } from './types';

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
      SOURCE_BUDGET_EXPECTED.savingsAccountBalancesPence
    );
    expect(savingsPosition.savedThisMonthPence).toBe(
      SOURCE_BUDGET_EXPECTED.savedThisMonthPence
    );
    expect(savingsPosition.projectedEndSavingsPence).toBe(
      SOURCE_BUDGET_EXPECTED.savingsAccountProjectedPence
    );
    expect(savingsPosition.savingsAccounts.map((account) => account.name)).toEqual([
      'Chase',
      'Cash',
    ]);
    expect(
      savingsPosition.savingsAccounts.every(
        (account) => account.type === 'savings' || account.type === 'cash'
      )
    ).toBe(true);

    expect(state.transactions).toHaveLength(19);
    expect(state.plannedPayments).toHaveLength(13);
    expect(state.plannedPayments.every((payment) => payment.isRecurring === true)).toBe(true);
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

  describe('preserveCompatibleSavingsGoals & resolveCompatibleAccount matching hierarchy', () => {
    const makeGoal = (id: string, accountId: string): SavingsGoal => ({
      id,
      name: `Goal ${id}`,
      targetPence: 1000_00,
      currentPence: 500_00,
      targetDate: '2026-12-31',
      accountId,
    });

    const syntheticLloydsCandidates: Pick<Account, 'id' | 'name' | 'type' | 'ownerPerson'>[] = [
      {
        id: 'candidate-lloyds-marius',
        name: 'Lloyds',
        type: 'current',
        ownerPerson: 'Marius',
      },
      {
        id: 'candidate-lloyds-vesta',
        name: 'Lloyds',
        type: 'current',
        ownerPerson: 'Vesta',
      },
      {
        id: 'candidate-chase-savings',
        name: 'Chase',
        type: 'savings',
      },
    ];

    it('1. Existing Marius Lloyds maps only to Marius Lloyds', () => {
      const oldAccount = {
        id: 'legacy-marius-lloyds-id',
        name: 'Lloyds',
        type: 'current' as const,
        ownerPerson: 'Marius',
      };
      const resolved = resolveCompatibleAccount(oldAccount, syntheticLloydsCandidates);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe('candidate-lloyds-marius');
      expect(resolved?.ownerPerson).toBe('Marius');
    });

    it('2. Existing Vesta Lloyds maps only to Vesta Lloyds', () => {
      const oldAccount = {
        id: 'legacy-vesta-lloyds-id',
        name: 'Lloyds',
        type: 'current' as const,
        ownerPerson: 'Vesta',
      };
      const resolved = resolveCompatibleAccount(oldAccount, syntheticLloydsCandidates);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe('candidate-lloyds-vesta');
      expect(resolved?.ownerPerson).toBe('Vesta');
    });

    it('3. Missing owner with two matching candidates returns no mapping', () => {
      const oldAccountWithoutOwner = {
        id: 'legacy-unknown-owner-lloyds',
        name: 'Lloyds',
        type: 'current' as const,
      };
      const resolved = resolveCompatibleAccount(oldAccountWithoutOwner, syntheticLloydsCandidates);
      expect(resolved).toBeUndefined();
    });

    it('4. Two matching candidates with the same owner must remain ambiguous and return no mapping', () => {
      const ambiguousCandidates: Pick<Account, 'id' | 'name' | 'type' | 'ownerPerson'>[] = [
        {
          id: 'candidate-lloyds-marius-1',
          name: 'Lloyds',
          type: 'current',
          ownerPerson: 'Marius',
        },
        {
          id: 'candidate-lloyds-marius-2',
          name: 'Lloyds',
          type: 'current',
          ownerPerson: 'Marius',
        },
      ];
      const oldAccount = {
        id: 'legacy-marius-id',
        name: 'Lloyds',
        type: 'current' as const,
        ownerPerson: 'Marius',
      };
      const resolved = resolveCompatibleAccount(oldAccount, ambiguousCandidates);
      expect(resolved).toBeUndefined();
    });

    it('5. A unique name+type candidate still maps when source owner metadata is missing', () => {
      const oldAccount = {
        id: 'legacy-chase-id',
        name: 'Chase',
        type: 'savings' as const,
        ownerPerson: 'Marius',
      };
      const resolved = resolveCompatibleAccount(oldAccount, syntheticLloydsCandidates);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe('candidate-chase-savings');
    });

    it('6. Exact-ID preservation still works', () => {
      const oldAccount = {
        id: 'candidate-lloyds-vesta',
        name: 'Different Name',
        type: 'savings' as const,
      };
      const resolved = resolveCompatibleAccount(oldAccount, syntheticLloydsCandidates);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe('candidate-lloyds-vesta');
    });

    it('7. preserveCompatibleSavingsGoals integration: maps unambiguous goals and preserves exact IDs against SOURCE_ACCOUNTS', () => {
      const existing: Partial<HouseholdData> = {
        accounts: [
          {
            id: 'legacy-chase-goal-account',
            name: 'Chase',
            type: 'savings',
            currency: 'GBP',
            startingBalancePence: 5000_00,
            currentBalancePence: 5000_00,
            ownerPerson: 'Marius',
          },
        ],
        savingsGoals: [
          makeGoal('goal-exact', 'src-account-chase'),
          makeGoal('goal-legacy-chase', 'legacy-chase-goal-account'),
        ],
      };
      const result = preserveCompatibleSavingsGoals(existing as HouseholdData);
      expect(result).toHaveLength(2);
      expect(result[0].accountId).toBe('src-account-chase');
      expect(result[1].accountId).toBe('src-account-chase');
    });
  });
});
