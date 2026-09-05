import type {
  Account,
  AuditLogEntry,
  Category,
  HouseholdData,
  PlannedIncome,
  PlannedPayment,
  SavingsGoal,
  Transaction,
} from './types';

export const SOURCE_BUDGET_IMPORT_ID = 'source-budget-2026-09-v2';
export const SOURCE_BUDGET_NAME = 'LIVE - 2026 September budget';
export const SOURCE_BUDGET_MONTH = '2026-09';

const SOURCE_CREATED_AT = '2026-08-31T15:55:00.000Z';
const SOURCE_ACTOR = 'source-budget-workbook';

const categoryIds = {
  fixed: 'src-cat-fixed',
  emma: 'src-cat-emma',
  subscriptions: 'src-cat-subscriptions',
  phones: 'src-cat-phones',
  bankFees: 'src-cat-bank-fees',
  variableHousehold: 'src-cat-variable-household',
  employment: 'src-cat-employment',
  benefits: 'src-cat-benefits',
  maintenanceIncome: 'src-cat-c-maintenance',
  childBenefit: 'src-cat-c-benefit',
} as const;

const accountIds = {
  santander: 'src-account-santander',
  lloydsMarius: 'src-account-lloyds-marius',
  lloydsVesta: 'src-account-lloyds-vesta',
  natwest: 'src-account-natwest',
  chase: 'src-account-chase',
  cash: 'src-account-cash',
  creditCard: 'src-account-credit-card',
} as const;

const SOURCE_CATEGORIES: Category[] = [
  { id: 'cat-housing', name: 'Rent / Mortgage', group: 'Housing', monthlyBudgetPence: 0 },
  { id: 'cat-council-tax', name: 'Council Tax', group: 'Housing', monthlyBudgetPence: 0 },
  { id: 'cat-groceries', name: 'Groceries & Food', group: 'Living', monthlyBudgetPence: 0 },
  { id: 'cat-utilities', name: 'Gas & Electricity', group: 'Utilities', monthlyBudgetPence: 0 },
  { id: 'cat-water', name: 'Water Rates', group: 'Utilities', monthlyBudgetPence: 0 },
  { id: 'cat-internet', name: 'Broadband & Mobile', group: 'Utilities', monthlyBudgetPence: 0 },
  { id: 'cat-transport', name: 'Transport & Fuel', group: 'Living', monthlyBudgetPence: 0 },
  { id: 'cat-childcare', name: 'Child Maintenance / Care', group: 'Family', monthlyBudgetPence: 0 },
  { id: 'cat-health', name: 'Health & Pharmacy', group: 'Personal', monthlyBudgetPence: 0 },
  { id: 'cat-dining', name: 'Dining & Takeaway', group: 'Discretionary', monthlyBudgetPence: 0 },
  { id: 'cat-entertainment', name: 'Entertainment & Subs', group: 'Discretionary', monthlyBudgetPence: 0 },
  { id: 'cat-salary', name: 'Salary & Earnings', group: 'Income', monthlyBudgetPence: 0 },
  { id: 'cat-benefits', name: 'State Benefits / Universal Credit', group: 'Income', monthlyBudgetPence: 0 },
  { id: 'cat-child-benefit', name: 'Child Benefit', group: 'Income', monthlyBudgetPence: 0 },
  { id: categoryIds.fixed, name: 'Fixed', group: 'Fixed Bills', monthlyBudgetPence: 0 },
  { id: categoryIds.emma, name: 'Emma', group: 'Fixed Bills', monthlyBudgetPence: 0 },
  { id: categoryIds.subscriptions, name: 'Subscriptions', group: 'Fixed Bills', monthlyBudgetPence: 0 },
  { id: categoryIds.phones, name: 'Phones', group: 'Fixed Bills', monthlyBudgetPence: 0 },
  { id: categoryIds.bankFees, name: 'Bank Fees', group: 'Fixed Bills', monthlyBudgetPence: 0 },
  {
    id: categoryIds.variableHousehold,
    name: 'Variable Household',
    group: 'Living',
    monthlyBudgetPence: 0,
  },
  { id: categoryIds.employment, name: 'Employment', group: 'Income', monthlyBudgetPence: 0 },
  { id: categoryIds.benefits, name: 'Benefits', group: 'Income', monthlyBudgetPence: 0 },
  {
    id: categoryIds.maintenanceIncome,
    name: 'C Maintenance',
    group: 'Income',
    monthlyBudgetPence: 0,
  },
  { id: categoryIds.childBenefit, name: 'C Benefit', group: 'Income', monthlyBudgetPence: 0 },
  {
    id: 'cat-savings',
    name: 'Savings Allocation',
    group: 'Savings',
    monthlyBudgetPence: 0,
  },
  {
    id: 'cat-transfer',
    name: 'Internal Transfer',
    group: 'Transfers',
    monthlyBudgetPence: 0,
  },
];

const SOURCE_ACCOUNTS: Account[] = [
  {
    id: accountIds.chase,
    name: 'Chase',
    type: 'savings',
    currency: 'GBP',
    startingBalancePence: 1568747,
    currentBalancePence: 1568747,
    ownerPerson: 'Marius',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 1568747,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRows: [19],
      sourceBalancePence: 1568747,
      sourceBalanceKind: 'savings_snapshot',
    },
  },
  {
    id: accountIds.santander,
    name: 'Santander',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 400000,
    currentBalancePence: 400000,
    ownerPerson: 'Marius',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 400000,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRows: [20],
      sourceBalancePence: 400000,
      sourceBalanceKind: 'savings_snapshot',
    },
  },
  {
    id: accountIds.cash,
    name: 'Cash',
    type: 'cash',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    ownerPerson: 'Joint',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRows: [21],
      sourceBalancePence: 0,
      sourceBalanceKind: 'savings_snapshot',
    },
  },
  {
    id: accountIds.lloydsMarius,
    name: 'Lloyds',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    ownerPerson: 'Marius',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceBalanceProvided: false,
    },
  },
  {
    id: accountIds.lloydsVesta,
    name: 'Lloyds',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    ownerPerson: 'Vesta',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceBalanceProvided: false,
    },
  },
  {
    id: accountIds.natwest,
    name: 'NatWest',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    ownerPerson: 'Vesta',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceBalanceProvided: false,
    },
  },
  {
    id: accountIds.creditCard,
    name: 'Credit Card',
    type: 'credit',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    balanceOwedPence: 0,
    ownerPerson: 'Marius',
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceBalanceProvided: false,
    },
  },
];

type SourceExpense = {
  row: number;
  amountPence: number;
  description: string;
  categoryId: string;
  expenseType: 'Fixed' | 'Variable';
  paid: boolean;
  payer: 'Marius' | 'Vesta' | 'Joint';
  sourcePaidBy: string;
  accountId: string;
};

const SOURCE_EXPENSES: SourceExpense[] = [
  { row: 6, amountPence: 120000, description: 'Rent', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 7, amountPence: 21700, description: 'Electric', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 8, amountPence: 16700, description: 'Council tax', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloydsVesta },
  { row: 9, amountPence: 2000, description: 'Internet - Vodafone', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloydsVesta },
  { row: 17, amountPence: 20000, description: 'Child Maintenance', categoryId: categoryIds.emma, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.lloydsMarius },
  { row: 24, amountPence: 1299, description: 'Netflix', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 25, amountPence: 801, description: 'Phone', categoryId: categoryIds.phones, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 26, amountPence: 795, description: 'Phone', categoryId: categoryIds.phones, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloydsVesta },
  { row: 27, amountPence: 1899, description: 'Google One', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.creditCard },
  { row: 28, amountPence: 1999, description: 'ChatGPT', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.creditCard },
  { row: 29, amountPence: 1470, description: 'National Trust', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.lloydsMarius },
  { row: 36, amountPence: 300, description: 'Santander', categoryId: categoryIds.bankFees, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 37, amountPence: 500, description: 'Lloyds', categoryId: categoryIds.bankFees, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloydsVesta },
  { row: 44, amountPence: 100000, description: 'Food and shopping', categoryId: categoryIds.variableHousehold, expenseType: 'Variable', paid: true, payer: 'Joint', sourcePaidBy: 'Household', accountId: accountIds.creditCard },
];

type SourceIncome = {
  row: number;
  date: string;
  sourceDateLabel: string;
  amountPence: number;
  description: string;
  categoryId: string;
  incomeType: string;
  payer: 'Marius' | 'Vesta' | 'Joint';
  sourceReceivedBy: string;
  accountId: string;
};

const SOURCE_INCOMES: SourceIncome[] = [
  { row: 5, date: '2026-09-01', sourceDateLabel: '1st', amountPence: 350303, description: 'Paycheck', categoryId: categoryIds.employment, incomeType: 'Employment', payer: 'Marius', sourceReceivedBy: 'Marius', accountId: accountIds.lloydsMarius },
  { row: 6, date: '2026-09-05', sourceDateLabel: '5th', amountPence: 80000, description: 'U Credit', categoryId: categoryIds.benefits, incomeType: 'Benefits', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 7, date: '2026-09-11', sourceDateLabel: '11th', amountPence: 34979, description: 'Child M', categoryId: categoryIds.maintenanceIncome, incomeType: 'C Maintenance', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 8, date: '2026-09-22', sourceDateLabel: '22nd', amountPence: 10820, description: 'Child B', categoryId: categoryIds.childBenefit, incomeType: 'C Benefit', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 9, date: '2026-09-11', sourceDateLabel: '11th', amountPence: 100000, description: 'Paycheck', categoryId: categoryIds.employment, incomeType: 'Employment', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.lloydsVesta },
];

function expenseTransactionId(row: number): string {
  return `src-expense-row-${row}`;
}

function plannedPaymentId(row: number): string {
  return `src-payment-row-${row}`;
}

function incomeTransactionId(row: number): string {
  return `src-income-row-${row}`;
}

function plannedIncomeId(row: number): string {
  return `src-planned-income-row-${row}`;
}

function sourceTransactions(): Transaction[] {
  const expenseTransactions: Transaction[] = SOURCE_EXPENSES.map((expense) => {
    const isFixed = expense.expenseType === 'Fixed';
    return {
      id: expenseTransactionId(expense.row),
      date: '2026-09-01',
      description: expense.description,
      amountPence: expense.amountPence,
      type: 'expense',
      categoryId: expense.categoryId,
      accountId: expense.accountId,
      payer: expense.payer,
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      plannedPaymentId: isFixed ? plannedPaymentId(expense.row) : undefined,
      createdAt: SOURCE_CREATED_AT,
      createdBy: SOURCE_ACTOR,
      metadata: {
        source: SOURCE_BUDGET_NAME,
        sourceSheet: 'Transactions',
        sourceRow: expense.row,
        sourceDateMissing: true,
        sourcePaid: expense.paid,
        sourcePaidBy: expense.sourcePaidBy,
        sourceExpenseType: expense.expenseType,
        sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      },
    };
  });

  const incomeTransactions: Transaction[] = SOURCE_INCOMES.map((income) => ({
    id: incomeTransactionId(income.row),
    date: income.date,
    description: income.description,
    amountPence: income.amountPence,
    type: 'income',
    categoryId: income.categoryId,
    accountId: income.accountId,
    payer: income.payer,
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    plannedIncomeId: plannedIncomeId(income.row),
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRow: income.row,
      sourceDateLabel: income.sourceDateLabel,
      sourceReceivedBy: income.sourceReceivedBy,
      sourceIncomeType: income.incomeType,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
    },
  }));

  return [...incomeTransactions, ...expenseTransactions];
}

function sourcePlannedPayments(): PlannedPayment[] {
  return SOURCE_EXPENSES.filter((expense) => expense.expenseType === 'Fixed').map((expense) => ({
    id: plannedPaymentId(expense.row),
    name: expense.description,
    amountPence: expense.amountPence,
    actualAmountPence: expense.amountPence,
    actualDate: '2026-09-01',
    actualTransactionId: expenseTransactionId(expense.row),
    month: SOURCE_BUDGET_MONTH,
    responsiblePerson: expense.payer,
    accountId: expense.accountId,
    categoryId: expense.categoryId,
    status: 'paid',
    includeInTransferPlan: true,
    isRecurring: true,
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRow: expense.row,
      sourceDateMissing: true,
      sourcePaidBy: expense.sourcePaidBy,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
    },
  }));
}

function sourcePlannedIncomes(): PlannedIncome[] {
  return SOURCE_INCOMES.map((income) => ({
    id: plannedIncomeId(income.row),
    name: income.description,
    expectedAmountPence: income.amountPence,
    actualAmountPence: income.amountPence,
    month: SOURCE_BUDGET_MONTH,
    sourcePerson: income.payer,
    accountId: income.accountId,
    categoryId: income.categoryId,
    expectedDate: income.date,
    actualDate: income.date,
    actualTransactionId: incomeTransactionId(income.row),
    status: 'received',
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
      sourceSheet: 'Transactions',
      sourceRow: income.row,
      sourceDateLabel: income.sourceDateLabel,
      sourceReceivedBy: income.sourceReceivedBy,
      sourceIncomeType: income.incomeType,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
    },
  }));
}

export function resolveCompatibleAccount(
  oldAccount: Pick<Account, 'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'>,
  candidateAccounts: Pick<Account, 'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'>[]
): Account | undefined {
  // 1. Exact account ID exists in candidate accounts -> preserve it
  const exactMatch = candidateAccounts.find((candidate) => candidate.id === oldAccount.id);
  if (exactMatch) {
    return exactMatch as Account;
  }

  const normalized = (v?: string) => v?.trim().toLowerCase() || '';

  // 2. Find candidates with the same normalized name + account type
  const nameTypeCandidates = candidateAccounts.filter(
    (candidate) =>
      normalized(candidate.name) === normalized(oldAccount.name) &&
      candidate.type === oldAccount.type
  );

  // 3. If exactly one candidate exists, use that candidate even when owner metadata is absent
  if (nameTypeCandidates.length === 1) {
    return nameTypeCandidates[0] as Account;
  }

  // 4. If multiple candidates exist, prefer the stable household-member ID.
  if (nameTypeCandidates.length > 1) {
    const oldOwnerMemberId = oldAccount.ownerMemberId?.trim();
    if (oldOwnerMemberId) {
      const memberIdMatches = nameTypeCandidates.filter(
        (candidate) => candidate.ownerMemberId === oldOwnerMemberId
      );
      if (memberIdMatches.length === 1) {
        return memberIdMatches[0] as Account;
      }
      if (memberIdMatches.length > 1) {
        return undefined;
      }
    }

    // Legacy fallback for imported accounts that pre-date stable owner IDs.
    const oldOwner = normalized(oldAccount.ownerPerson);
    if (!oldOwner) {
      return undefined;
    }
    const ownerMatches = nameTypeCandidates.filter(
      (candidate) => normalized(candidate.ownerPerson) === oldOwner
    );
    if (ownerMatches.length === 1) {
      return ownerMatches[0] as Account;
    }

    // 5. Never map arbitrarily between multiple same-name accounts
    return undefined;
  }

  return undefined;
}

export function preserveCompatibleSavingsGoals(existing?: HouseholdData): SavingsGoal[] {
  if (!existing?.savingsGoals?.length) return [];

  const sourceAccountIds = new Set(SOURCE_ACCOUNTS.map((account) => account.id));

  return existing.savingsGoals.flatMap((goal) => {
    // Household goals no longer require an account link. Preserve unlinked goals as-is.
    if (!goal.accountId) return [goal];

    // Legacy linked goals keep a compatible account reference for backwards-compatible
    // backups/audit history, but the link no longer drives goal progress.
    if (sourceAccountIds.has(goal.accountId)) {
      return [goal];
    }
    const oldAccount = existing.accounts.find((account) => account.id === goal.accountId);
    if (!oldAccount) return [goal];

    const resolved = resolveCompatibleAccount(oldAccount, SOURCE_ACCOUNTS);
    if (!resolved) return [goal];

    return [{ ...goal, accountId: resolved.id }];
  });
}

function sourceAuditEntry(existingAuditCount: number): AuditLogEntry {
  return {
    id: `source-budget-import-${existingAuditCount + 1}`,
    timestamp: SOURCE_CREATED_AT,
    actorEmail: SOURCE_ACTOR,
    action: 'source_budget_imported',
    entityType: 'system',
    entityId: SOURCE_BUDGET_IMPORT_ID,
    summary: 'September 2026 budget imported.',
  };
}

export function createSourceBudgetHousehold(existing?: HouseholdData): HouseholdData {
  const existingAuditLogs = existing?.auditLogs || [];
  const version = existing ? existing.version + 1 : 1;
  const preservedSavingsGoals = preserveCompatibleSavingsGoals(existing);

  return {
    id: existing?.id || 'household-mv-local',
    name: existing?.name || 'Marius Household',
    version,
    schemaStatus: {
      currentSchemaVersion: existing?.schemaStatus?.currentSchemaVersion || 1,
      minSupportedClientVersion: existing?.schemaStatus?.minSupportedClientVersion || 1,
      latestAppliedVersion: Math.max(existing?.schemaStatus?.latestAppliedVersion || 1, 1),
      appliedMigrations: [
        ...(existing?.schemaStatus?.appliedMigrations || []).filter(
          (migration) => migration.name !== SOURCE_BUDGET_IMPORT_ID
        ),
        {
          version: 1,
          name: SOURCE_BUDGET_IMPORT_ID,
          appliedAt: SOURCE_CREATED_AT,
          executionTimeMs: 0,
          checksum: 'live-2026-september-budget-routing-v2',
        },
      ],
      isUpToDate: true,
    },
    members: existing?.members || [],
    accounts: SOURCE_ACCOUNTS.map((account) => ({ ...account, metadata: { ...account.metadata } })),
    categories: SOURCE_CATEGORIES.map((category) => ({ ...category })),
    transactions: sourceTransactions(),
    savingsGoals: preservedSavingsGoals,
    plannedPayments: sourcePlannedPayments(),
    plannedIncomes: sourcePlannedIncomes(),
    auditLogs: [...existingAuditLogs, sourceAuditEntry(existingAuditLogs.length)],
  };
}

export const SOURCE_BUDGET_EXPECTED = {
  month: SOURCE_BUDGET_MONTH,
  incomePence: 576102,
  expensesPence: 289463,
  fixedBillsPence: 189463,
  variableSpendingPence: 100000,
  savedThisMonthPence: 286639,
  currentSavingsPence: 1968747,
  projectedEndSavingsPence: 2255386,
  savingsAccountBalancesPence: 1568747,
  savingsAccountProjectedPence: 1855386,
  unpaidBillsPence: 0,
  workbookAuditPassCount: 24,
  workbookAuditFailCount: 0,
} as const;
