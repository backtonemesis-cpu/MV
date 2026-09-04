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

export const SOURCE_BUDGET_IMPORT_ID = 'source-budget-2026-09-v1';
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
  lloyds: 'src-account-lloyds',
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
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 1568747,
    notes:
      'Source savings snapshot: £15,687.47. Technical snapshot anchor prevents September budget rows from changing this source-reported balance.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 400000,
    notes:
      'Source savings snapshot: £4,000.00. The workbook also routes September bills through Santander; it does not provide a separate full bank-ledger balance.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    notes: 'Source savings snapshot: £0.00.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceSheet: 'Transactions',
      sourceRows: [21],
      sourceBalancePence: 0,
      sourceBalanceKind: 'savings_snapshot',
    },
  },
  {
    id: accountIds.lloyds,
    name: 'Lloyds',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    notes:
      'Used by source income/expense rows. No Lloyds balance is supplied in the source workbook; £0.00 is a routing placeholder pending confirmation.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    notes:
      'Used by source income rows. No NatWest balance is supplied in the source workbook; £0.00 is a routing placeholder pending confirmation.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    isActive: true,
    reconciliationDate: '2026-09-30',
    reconciledBalancePence: 0,
    notes:
      'Used by source expense rows. No credit-card balance is supplied in the source workbook; £0.00 is a routing placeholder pending confirmation.',
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
  { row: 8, amountPence: 16700, description: 'Council tax', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloyds },
  { row: 9, amountPence: 2000, description: 'Internet - Vodafone', categoryId: categoryIds.fixed, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloyds },
  { row: 17, amountPence: 20000, description: 'Child Maintenance', categoryId: categoryIds.emma, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.lloyds },
  { row: 24, amountPence: 1299, description: 'Netflix', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 25, amountPence: 801, description: 'Phone', categoryId: categoryIds.phones, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 26, amountPence: 795, description: 'Phone', categoryId: categoryIds.phones, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloyds },
  { row: 27, amountPence: 1899, description: 'Google One', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.creditCard },
  { row: 28, amountPence: 1999, description: 'ChatGPT', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.creditCard },
  { row: 29, amountPence: 1470, description: 'National Trust', categoryId: categoryIds.subscriptions, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.lloyds },
  { row: 36, amountPence: 300, description: 'Santander', categoryId: categoryIds.bankFees, expenseType: 'Fixed', paid: true, payer: 'Marius', sourcePaidBy: 'Marius', accountId: accountIds.santander },
  { row: 37, amountPence: 500, description: 'Lloyds', categoryId: categoryIds.bankFees, expenseType: 'Fixed', paid: true, payer: 'Vesta', sourcePaidBy: 'Vesta', accountId: accountIds.lloyds },
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
  { row: 5, date: '2026-09-01', sourceDateLabel: '1st', amountPence: 350303, description: 'Paycheck', categoryId: categoryIds.employment, incomeType: 'Employment', payer: 'Marius', sourceReceivedBy: 'Marius', accountId: accountIds.lloyds },
  { row: 6, date: '2026-09-05', sourceDateLabel: '5th', amountPence: 80000, description: 'U Credit', categoryId: categoryIds.benefits, incomeType: 'Benefits', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 7, date: '2026-09-11', sourceDateLabel: '11th', amountPence: 34979, description: 'Child M', categoryId: categoryIds.maintenanceIncome, incomeType: 'C Maintenance', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 8, date: '2026-09-22', sourceDateLabel: '22nd', amountPence: 10820, description: 'Child B', categoryId: categoryIds.childBenefit, incomeType: 'C Benefit', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.natwest },
  { row: 9, date: '2026-09-11', sourceDateLabel: '11th', amountPence: 100000, description: 'Paycheck', categoryId: categoryIds.employment, incomeType: 'Employment', payer: 'Vesta', sourceReceivedBy: 'Vesta', accountId: accountIds.lloyds },
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
      notes:
        'Imported from the source workbook. Expense date is blank in the workbook, so 2026-09-01 is used only as the app-compatible month date.',
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
    notes: `Imported from source workbook income row; source date label: ${income.sourceDateLabel}.`,
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    plannedIncomeId: plannedIncomeId(income.row),
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    notes:
      'Imported from a paid Fixed row in the source workbook. The source expense date is blank; the app-compatible actual date is 2026-09-01.',
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
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
    expectedDate: income.date,
    actualDate: income.date,
    actualTransactionId: incomeTransactionId(income.row),
    status: 'received',
    notes: `Imported from source workbook. Income type: ${income.incomeType}; source date label: ${income.sourceDateLabel}.`,
    createdAt: SOURCE_CREATED_AT,
    createdBy: SOURCE_ACTOR,
    metadata: {
      source: SOURCE_BUDGET_NAME,
      sourceSheet: 'Transactions',
      sourceRow: income.row,
      sourceDateLabel: income.sourceDateLabel,
      sourceReceivedBy: income.sourceReceivedBy,
      sourceIncomeType: income.incomeType,
      sourceImportId: SOURCE_BUDGET_IMPORT_ID,
    },
  }));
}

function preserveCompatibleSavingsGoals(existing?: HouseholdData): SavingsGoal[] {
  if (!existing?.savingsGoals?.length) return [];

  const oldAccountNames = new Map(existing.accounts.map((account) => [account.id, account.name.trim().toLowerCase()]));
  const newAccountIds = new Map(SOURCE_ACCOUNTS.map((account) => [account.name.trim().toLowerCase(), account.id]));

  return existing.savingsGoals.flatMap((goal) => {
    const oldAccountName = oldAccountNames.get(goal.accountId);
    const mappedAccountId = oldAccountName ? newAccountIds.get(oldAccountName) : undefined;
    if (!mappedAccountId) return [];
    return [{ ...goal, accountId: mappedAccountId }];
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
    summary:
      'Imported LIVE - 2026 September budget: 24/24 workbook checks PASS; income £5,761.02; expenses £2,894.63; current savings £19,687.47.',
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
          checksum: 'live-2026-september-budget-24-pass',
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
  unpaidBillsPence: 0,
  workbookAuditPassCount: 24,
  workbookAuditFailCount: 0,
} as const;
