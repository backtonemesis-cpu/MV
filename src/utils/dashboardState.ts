import type {
  HouseholdData,
  PlannedIncome,
  PlannedPayment,
  Transaction,
} from '../types';

export type DashboardAccountState =
  | 'first_setup'
  | 'liquid'
  | 'credit_only'
  | 'no_active_accounts';

export type DashboardIntegrityIssueCode =
  | 'duplicate_account_id'
  | 'missing_account_reference'
  | 'missing_payment_reference'
  | 'missing_income_reference'
  | 'invalid_payment_evidence'
  | 'invalid_income_evidence'
  | 'unsafe_money_total';

export interface DashboardIntegrityIssue {
  code: DashboardIntegrityIssueCode;
  message: string;
}

export interface DashboardIntegrityAssessment {
  isCritical: boolean;
  issues: DashboardIntegrityIssue[];
}

function hasAccountLinkedFinancialRecords(household: HouseholdData): boolean {
  if (household.transactions.length > 0) return true;
  if (household.plannedPayments.length > 0) return true;
  if ((household.plannedIncomes || []).length > 0) return true;
  if (
    household.savingsGoals.some(
      (goal) => Boolean(goal.accountId || goal.linkedAccountId)
    )
  ) {
    return true;
  }
  return (household.transferPlanFundingRecords || []).length > 0;
}

export function classifyDashboardAccountState(
  household: HouseholdData
): DashboardAccountState {
  if (
    household.accounts.length === 0 &&
    !hasAccountLinkedFinancialRecords(household)
  ) {
    return 'first_setup';
  }

  const activeAccounts = household.accounts.filter(
    (account) => account.isActive !== false
  );
  if (activeAccounts.length === 0) return 'no_active_accounts';
  if (activeAccounts.some((account) => account.type !== 'credit')) {
    return 'liquid';
  }
  return 'credit_only';
}

function pushIssue(
  issues: DashboardIntegrityIssue[],
  code: DashboardIntegrityIssueCode,
  message: string
): void {
  if (issues.some((issue) => issue.code === code && issue.message === message)) {
    return;
  }
  issues.push({ code, message });
}

function addSafe(
  current: number,
  value: number,
  issues: DashboardIntegrityIssue[]
): number {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(value)) {
    pushIssue(
      issues,
      'unsafe_money_total',
      'A Dashboard money value is outside exact safe-integer pence.'
    );
    return current;
  }
  const next = current + value;
  if (!Number.isSafeInteger(next)) {
    pushIssue(
      issues,
      'unsafe_money_total',
      'A Dashboard money total exceeds exact safe-integer pence.'
    );
    return current;
  }
  return next;
}

function subtractSafe(
  current: number,
  value: number,
  issues: DashboardIntegrityIssue[]
): number {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(value)) {
    pushIssue(
      issues,
      'unsafe_money_total',
      'A Dashboard money value is outside exact safe-integer pence.'
    );
    return current;
  }
  const next = current - value;
  if (!Number.isSafeInteger(next)) {
    pushIssue(
      issues,
      'unsafe_money_total',
      'A Dashboard money total exceeds exact safe-integer pence.'
    );
    return current;
  }
  return next;
}

function isActualPaymentEvidence(
  transaction: Transaction,
  payment: PlannedPayment
): boolean {
  return (
    transaction.id === payment.actualTransactionId &&
    transaction.plannedPaymentId === payment.id &&
    transaction.type === 'expense' &&
    !transaction.isTransfer &&
    !transaction.isRepayment &&
    !transaction.isSavings &&
    !transaction.isRefund
  );
}

function isActualIncomeEvidence(
  transaction: Transaction,
  income: PlannedIncome
): boolean {
  return (
    transaction.plannedIncomeId === income.id &&
    transaction.type === 'income' &&
    !transaction.isTransfer &&
    !transaction.isRepayment &&
    !transaction.isSavings &&
    !transaction.isRefund
  );
}

export function assessDashboardIntegrity(
  household: HouseholdData,
  selectedMonth: string
): DashboardIntegrityAssessment {
  const issues: DashboardIntegrityIssue[] = [];
  const accountIds = new Set<string>();

  for (const account of household.accounts) {
    if (!account.id || accountIds.has(account.id)) {
      pushIssue(
        issues,
        'duplicate_account_id',
        'Account identity is missing or duplicated.'
      );
    }
    accountIds.add(account.id);

    if (!Number.isSafeInteger(account.currentBalancePence)) {
      pushIssue(
        issues,
        'unsafe_money_total',
        'A current account balance is outside exact safe-integer pence.'
      );
    }
  }

  const paymentsById = new Map(
    household.plannedPayments.map((payment) => [payment.id, payment])
  );
  const incomesById = new Map(
    (household.plannedIncomes || []).map((income) => [income.id, income])
  );
  const transactionsById = new Map(
    household.transactions.map((transaction) => [transaction.id, transaction])
  );

  for (const transaction of household.transactions) {
    if (!accountIds.has(transaction.accountId)) {
      pushIssue(
        issues,
        'missing_account_reference',
        'A transaction references a missing source account.'
      );
    }
    if (
      transaction.targetAccountId &&
      !accountIds.has(transaction.targetAccountId)
    ) {
      pushIssue(
        issues,
        'missing_account_reference',
        'A transaction references a missing destination account.'
      );
    }
    if (
      transaction.plannedPaymentId &&
      !paymentsById.has(transaction.plannedPaymentId)
    ) {
      pushIssue(
        issues,
        'missing_payment_reference',
        'A transaction references a missing planned bill.'
      );
    }
    if (
      transaction.plannedIncomeId &&
      !incomesById.has(transaction.plannedIncomeId)
    ) {
      pushIssue(
        issues,
        'missing_income_reference',
        'A transaction references a missing planned income item.'
      );
    }
    if (!Number.isSafeInteger(transaction.amountPence)) {
      pushIssue(
        issues,
        'unsafe_money_total',
        'A transaction amount is outside exact safe-integer pence.'
      );
    }
  }

  for (const payment of household.plannedPayments) {
    if (!accountIds.has(payment.accountId)) {
      pushIssue(
        issues,
        'missing_account_reference',
        'A planned bill references a missing account.'
      );
    }
    if (!Number.isSafeInteger(payment.amountPence)) {
      pushIssue(
        issues,
        'unsafe_money_total',
        'A planned bill amount is outside exact safe-integer pence.'
      );
    }
    if (payment.actualTransactionId) {
      const transaction = transactionsById.get(payment.actualTransactionId);
      if (!transaction || !isActualPaymentEvidence(transaction, payment)) {
        pushIssue(
          issues,
          'invalid_payment_evidence',
          'A planned bill has missing or mismatched actual payment evidence.'
        );
      }
    }
  }

  for (const income of household.plannedIncomes || []) {
    if (!accountIds.has(income.accountId)) {
      pushIssue(
        issues,
        'missing_account_reference',
        'A planned income item references a missing account.'
      );
    }
    if (
      !Number.isSafeInteger(income.expectedAmountPence) ||
      (income.actualAmountPence !== undefined &&
        !Number.isSafeInteger(income.actualAmountPence))
    ) {
      pushIssue(
        issues,
        'unsafe_money_total',
        'A planned income amount is outside exact safe-integer pence.'
      );
    }
    const linkedId = income.actualTransactionId || income.linkedTransactionId;
    if (linkedId) {
      const transaction = transactionsById.get(linkedId);
      if (!transaction || !isActualIncomeEvidence(transaction, income)) {
        pushIssue(
          issues,
          'invalid_income_evidence',
          'A planned income item has missing or mismatched actual receipt evidence.'
        );
      }
    }
  }

  // Validate the exact aggregate boundaries that feed Dashboard headlines.
  // Displayed values still come from the existing authoritative finance helpers.
  let liquidTotal = 0;
  let savingsCashTotal = 0;
  for (const account of household.accounts) {
    if (account.isActive === false) continue;
    if (account.type !== 'credit') {
      liquidTotal = addSafe(liquidTotal, account.currentBalancePence, issues);
    }
    if (account.type === 'savings' || account.type === 'cash') {
      savingsCashTotal = addSafe(
        savingsCashTotal,
        account.currentBalancePence,
        issues
      );
    }
  }
  void liquidTotal;
  void savingsCashTotal;

  let actualIncome = 0;
  let refunds = 0;
  let otherSpending = 0;
  let expectedIncome = 0;
  let fixedBills = 0;

  for (const transaction of household.transactions) {
    if (!transaction.date.startsWith(selectedMonth)) continue;
    if (transaction.isSavings) continue;
    if (transaction.isTransfer || transaction.type === 'transfer') continue;
    if (transaction.isRepayment || transaction.type === 'repayment') continue;
    if (transaction.isRefund || transaction.type === 'refund') {
      refunds = addSafe(refunds, transaction.amountPence, issues);
    } else if (transaction.type === 'income') {
      actualIncome = addSafe(actualIncome, transaction.amountPence, issues);
    } else if (transaction.type === 'expense' && !transaction.plannedPaymentId) {
      otherSpending = addSafe(otherSpending, transaction.amountPence, issues);
    }
  }

  for (const income of household.plannedIncomes || []) {
    if (income.month !== selectedMonth) continue;
    expectedIncome = addSafe(
      expectedIncome,
      income.expectedAmountPence,
      issues
    );
  }
  void expectedIncome;

  for (const payment of household.plannedPayments) {
    if (payment.month !== selectedMonth) continue;
    let effectiveAmount = payment.amountPence;
    if (payment.actualTransactionId) {
      const linked = transactionsById.get(payment.actualTransactionId);
      if (linked && isActualPaymentEvidence(linked, payment)) {
        effectiveAmount = linked.amountPence;
      }
    } else if (
      payment.status === 'paid' &&
      payment.actualAmountPence !== undefined
    ) {
      effectiveAmount = payment.actualAmountPence;
    }
    fixedBills = addSafe(fixedBills, effectiveAmount, issues);
  }

  let availableSurplus = addSafe(0, actualIncome, issues);
  availableSurplus = addSafe(availableSurplus, refunds, issues);
  availableSurplus = subtractSafe(availableSurplus, fixedBills, issues);
  availableSurplus = subtractSafe(availableSurplus, otherSpending, issues);
  void availableSurplus;

  // Transfer Plan uses account balances minus selected unpaid bill totals.
  for (const account of household.accounts) {
    if (account.isActive === false || account.type === 'credit') continue;
    let selectedUnpaid = 0;
    for (const payment of household.plannedPayments) {
      if (
        payment.month !== selectedMonth ||
        payment.accountId !== account.id ||
        !payment.includeInTransferPlan
      ) {
        continue;
      }
      const paidByLegacyState =
        payment.status === 'paid' && !payment.actualTransactionId;
      const linked = payment.actualTransactionId
        ? transactionsById.get(payment.actualTransactionId)
        : undefined;
      const paidByEvidence =
        Boolean(linked) && isActualPaymentEvidence(linked!, payment);
      if (paidByLegacyState || paidByEvidence) continue;
      selectedUnpaid = addSafe(selectedUnpaid, payment.amountPence, issues);
    }
    subtractSafe(account.currentBalancePence, selectedUnpaid, issues);
  }

  return {
    isCritical: issues.length > 0,
    issues,
  };
}
