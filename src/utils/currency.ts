import { Account, Transaction, PlannedPayment, PlannedIncome, SavingsGoal } from '../types';

/**
 * Formats integer pence into standard GBP representation e.g. 15000 -> "£150.00"
 * Negative values formatted as "-£100.00"
 */
export function formatPence(pence: number): string {
  if (pence === null || pence === undefined || isNaN(pence)) return '£0.00';
  const isNegative = pence < 0;
  const absPence = Math.abs(Math.round(pence));
  const pounds = Math.floor(absPence / 100);
  const remainingPence = absPence % 100;
  const formattedPence = remainingPence.toString().padStart(2, '0');
  const formattedPounds = pounds.toLocaleString('en-GB');

  return `${isNegative ? '-' : ''}£${formattedPounds}.${formattedPence}`;
}

/**
 * Formats integer pence into raw pounds string for editable form inputs e.g. 1250 -> "12.50"
 */
export function formatPenceToPoundsInput(pence: number | null | undefined): string {
  if (pence === null || pence === undefined || isNaN(pence)) return '';
  return (pence / 100).toFixed(2);
}

/**
 * Parses user currency input string (e.g. "12.34", "£12.34", "1,234.56", "-50.00")
 * explicitly into integer pence.
 * 
 * Returns NULL if input is blank or whitespace, strictly preserving the distinction
 * between blank/unspecified and confirmed zero (£0.00).
 */
export function parseHumanPoundsToPence(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (isNaN(input)) return null;
    return Math.round(input * 100);
  }
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Remove currency symbols, spaces, and commas
  const clean = trimmed.replace(/[£,\s]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  return Math.round(num * 100);
}

/**
 * Backward-compatible helper for code expecting a fallback 0
 */
export function parseToPence(input: string | number | null | undefined): number {
  return parseHumanPoundsToPence(input) ?? 0;
}

/**
 * Computes authoritative financial metrics strictly following handoff integrity rules:
 * - Internal transfers: excluded from income & spending
 * - Card repayments: excluded from spending to avoid double counting underlying merchant items
 * - Refunds/credits: restore available funds without inflating gross salary/income
 * - Savings transfers: tracked distinctly, not counted as ordinary living expenditure
 */
export function calculateFinancialSummary(transactions: Transaction[]) {
  let grossIncomePence = 0;
  let grossExpensesPence = 0;
  let refundsPence = 0;
  let internalTransfersPence = 0;
  let cardRepaymentsPence = 0;
  let savingsTransfersPence = 0;

  for (const tx of transactions) {
    if (tx.isSavings) {
      savingsTransfersPence += tx.amountPence;
      continue;
    }
    if (tx.isTransfer || tx.type === 'transfer') {
      internalTransfersPence += tx.amountPence;
      continue;
    }
    if (tx.isRepayment || tx.type === 'repayment') {
      cardRepaymentsPence += tx.amountPence;
      continue;
    }
    if (tx.isRefund || tx.type === 'refund') {
      refundsPence += tx.amountPence;
      continue;
    }

    if (tx.type === 'income') {
      grossIncomePence += tx.amountPence;
    } else if (tx.type === 'expense') {
      grossExpensesPence += tx.amountPence;
    }
  }

  // Net expenses is useful as a non-negative spending view, while household
  // cashflow must keep the full refund value and must never treat savings
  // transfers as money leaving the household.
  const netExpensesPence = Math.max(0, grossExpensesPence - refundsPence);
  const netCashflowPence = grossIncomePence + refundsPence - grossExpensesPence;

  return {
    grossIncomePence,
    grossExpensesPence,
    refundsPence,
    netExpensesPence,
    internalTransfersPence,
    cardRepaymentsPence,
    savingsTransfersPence,
    netCashflowPence,
  };
}

export function linkedActualTransactionForPayment(
  payment: PlannedPayment,
  transactions: Transaction[]
): Transaction | undefined {
  if (!payment.actualTransactionId) return undefined;

  return transactions.find(
    (tx) =>
      tx.id === payment.actualTransactionId &&
      tx.plannedPaymentId === payment.id &&
      tx.type === 'expense' &&
      !tx.isTransfer &&
      !tx.isRepayment &&
      !tx.isSavings &&
      !tx.isRefund
  );
}

export function isPlannedPaymentEffectivelyPaid(
  payment: PlannedPayment,
  transactions: Transaction[]
): boolean {
  if (linkedActualTransactionForPayment(payment, transactions)) return true;
  return payment.status === 'paid' && !payment.actualTransactionId;
}

export function effectivePlannedPaymentAmountPence(
  payment: PlannedPayment,
  transactions: Transaction[]
): number {
  const linked = linkedActualTransactionForPayment(payment, transactions);
  if (linked) return linked.amountPence;
  if (payment.status === 'paid' && payment.actualAmountPence !== undefined) {
    return payment.actualAmountPence;
  }
  return payment.amountPence;
}

/**
 * Computes Available Surplus according to the exact MV formula:
 * Available Surplus = Actual Income Received + Refunds/Credits Returned − Fixed Bills − Gross Other Spending
 *
 * Rules:
 * - All operations use exact integer pence with zero floating-point drift.
 * - Fixed Bills and Gross Spending must not contain the same expenditure twice.
 * - Internal transfers, savings transfers, and card repayments contribute ZERO to income/spending.
 * - Outstanding obligations = remaining unpaid fixed bills for the selected month.
 */
export function calculateMonthlySurplus(
  transactions: Transaction[],
  plannedPayments: PlannedPayment[],
  month: string,
  plannedIncomes?: PlannedIncome[]
) {
  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(month));
  const monthPayments = plannedPayments.filter((p) => p.month === month);
  const monthPlannedIncomes = (plannedIncomes || []).filter((i) => i.month === month);

  // Expected Income from planned income entries (or fallback to received transactions if none planned)
  let expectedIncomePence = 0;
  for (const inc of monthPlannedIncomes) {
    expectedIncomePence += inc.expectedAmountPence;
  }

  let actualIncomeReceivedPence = 0;
  let refundsPence = 0;
  let grossOtherSpendingPence = 0;
  let internalTransfersPence = 0;
  let savingsTransfersPence = 0;
  let cardRepaymentsPence = 0;

  for (const tx of monthTransactions) {
    if (tx.isSavings) {
      savingsTransfersPence += tx.amountPence;
    } else if (tx.isTransfer || tx.type === 'transfer') {
      internalTransfersPence += tx.amountPence;
    } else if (tx.isRepayment || tx.type === 'repayment') {
      cardRepaymentsPence += tx.amountPence;
    } else if (tx.isRefund || tx.type === 'refund') {
      refundsPence += tx.amountPence;
    } else if (tx.type === 'income') {
      actualIncomeReceivedPence += tx.amountPence;
    } else if (tx.type === 'expense') {
      // Prevent double counting: if a transaction is explicitly linked to a planned payment,
      // it is covered under Fixed Bills and must not be added to Gross Other Spending twice!
      if (!tx.plannedPaymentId) {
        grossOtherSpendingPence += tx.amountPence;
      }
    }
  }

  // If no planned income entries exist yet, expected income defaults to actual received
  if (expectedIncomePence === 0 && actualIncomeReceivedPence > 0) {
    expectedIncomePence = actualIncomeReceivedPence;
  }

  // Fixed bills breakdown
  let fixedBillsTotalPence = 0;
  let fixedBillsPaidPence = 0;
  let fixedBillsUnpaidPence = 0;

  for (const p of monthPayments) {
    const effectiveAmountPence = effectivePlannedPaymentAmountPence(
      p,
      monthTransactions
    );
    const isPaid = isPlannedPaymentEffectivelyPaid(p, monthTransactions);

    fixedBillsTotalPence += effectiveAmountPence;
    if (isPaid) {
      fixedBillsPaidPence += effectiveAmountPence;
    } else {
      fixedBillsUnpaidPence += effectiveAmountPence;
    }
  }

  // Authoritative MV formula:
  // Available Surplus = Actual Income Received + Refunds/Credits Returned − Fixed Bills − Gross Other Spending
  const availableSurplusPence =
    actualIncomeReceivedPence + refundsPence - fixedBillsTotalPence - grossOtherSpendingPence;

  // Outstanding Obligations:
  // Remaining unpaid fixed bills for the selected month
  const outstandingObligationsPence = fixedBillsUnpaidPence;

  return {
    month,
    expectedIncomePence,
    actualIncomeReceivedPence,
    refundsPence,
    fixedBillsTotalPence,
    fixedBillsPaidPence,
    fixedBillsUnpaidPence,
    outstandingObligationsPence,
    grossOtherSpendingPence,
    availableSurplusPence,
    internalTransfersPence,
    savingsTransfersPence,
    cardRepaymentsPence,
    transactionCount: monthTransactions.length,
    paymentCount: monthPayments.length,
  };
}


/**
 * Returns whether an account is part of the household's savings position.
 *
 * Rules:
 * - Active Savings and Cash accounts are savings/liquid assets.
 * - Current, Joint and Credit accounts are excluded even if historical/source
 *   metadata described part of their balance as a savings snapshot.
 */
export function isSavingsPositionAccount(account: Account): boolean {
  if (account.isActive === false) return false;
  return account.type === 'savings' || account.type === 'cash';
}

/**
 * Household liquid funds excludes liabilities/credit accounts.
 * Current, joint, savings and cash balances are liquid assets.
 */
export function calculateLiquidFundsPence(accounts: Account[]): number {
  return accounts
    .filter(
      (account) =>
        account.isActive !== false &&
        account.type !== 'credit'
    )
    .reduce((sum, account) => sum + account.currentBalancePence, 0);
}

/**
 * Legacy diagnostic retained for old backups that still contain account-linked
 * savings allocations. Household savings goals no longer use this for progress.
 */
export function calculateSavingsGoalAllocationIntegrity(
  accounts: Account[],
  goals: SavingsGoal[]
) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const allocatedByAccount = new Map<string, number>();

  for (const goal of goals) {
    if (!goal.accountId) continue;
    allocatedByAccount.set(
      goal.accountId,
      (allocatedByAccount.get(goal.accountId) || 0) + goal.currentPence
    );
  }

  return goals.map((goal) => {
    if (!goal.accountId) {
      return {
        goalId: goal.id,
        accountId: undefined,
        accountBalancePence: 0,
        accountAllocatedPence: 0,
        overallocatedPence: 0,
        isOverallocated: false,
      };
    }

    const account = accountById.get(goal.accountId);
    const accountBalancePence =
      account && account.isActive !== false ? account.currentBalancePence : 0;
    const accountAllocatedPence = allocatedByAccount.get(goal.accountId) || 0;
    const overallocatedPence = Math.max(
      0,
      accountAllocatedPence - Math.max(0, accountBalancePence)
    );

    return {
      goalId: goal.id,
      accountId: goal.accountId,
      accountBalancePence,
      accountAllocatedPence,
      overallocatedPence,
      isOverallocated: overallocatedPence > 0,
    };
  });
}

export function calculateNetSavingsMovementPence(
  accounts: Account[],
  transactions: Transaction[],
  month: string
): number {
  const savingsAccountIds = new Set(
    accounts.filter(isSavingsPositionAccount).map((account) => account.id)
  );

  return transactions
    .filter(
      (tx) =>
        tx.date.startsWith(month) &&
        tx.isTransfer &&
        tx.type === 'transfer' &&
        Boolean(tx.targetAccountId)
    )
    .reduce((sum, tx) => {
      const sourceIsSavings = savingsAccountIds.has(tx.accountId);
      const targetIsSavings = tx.targetAccountId
        ? savingsAccountIds.has(tx.targetAccountId)
        : false;

      if (!sourceIsSavings && targetIsSavings) return sum + tx.amountPence;
      if (sourceIsSavings && !targetIsSavings) return sum - tx.amountPence;
      return sum;
    }, 0);
}

/**
 * Computes the authoritative savings position without using goal progress as money.
 *
 * Current Savings = balances of designated savings/liquid accounts.
 * Saved This Month = Income + Refunds - Fixed Bills - Gross Other Spending.
 * Projected End Savings = Current Savings + Saved This Month.
 * Savings Transfers = net movement into designated Savings/Cash accounts.
 *
 * Savings goals are deliberately excluded; they are allocation targets, not bank balances.
 */
export function calculateSavingsPosition(
  accounts: Account[],
  transactions: Transaction[],
  plannedPayments: PlannedPayment[],
  month: string,
  plannedIncomes?: PlannedIncome[]
) {
  const savingsAccounts = accounts.filter(isSavingsPositionAccount);

  const currentSavingsPence = savingsAccounts.reduce(
    (sum, account) => sum + account.currentBalancePence,
    0
  );

  const monthly = calculateMonthlySurplus(
    transactions,
    plannedPayments,
    month,
    plannedIncomes
  );

  const monthSavingsTransfersPence = calculateNetSavingsMovementPence(
    accounts,
    transactions,
    month
  );

  return {
    month,
    savingsAccounts,
    currentSavingsPence,
    savedThisMonthPence: monthly.availableSurplusPence,
    projectedEndSavingsPence: currentSavingsPence + monthly.availableSurplusPence,
    savingsTransfersPence: monthSavingsTransfersPence,
    monthly,
  };
}
