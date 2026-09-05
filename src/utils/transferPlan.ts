import {
  Account,
  PlannedPayment,
  AccountFundingRequirement,
  TransferPlanSummary,
  Transaction,
} from '../types';

/**
 * Calculates the exact funding requirement for a single account based on selected upcoming payments.
 * 
 * Strict integer-pence calculations:
 * - payments: only payments where includeInTransferPlan is true and accountId matches
 * - totalSelectedPaymentsPence: sum of all selected payments for display/audit
 * - totalUnpaidSelectedPaymentsPence: selected unpaid bills that still need funding
 * - currentBalancePence: authoritative reconciled balance of the account
 * - amountAvailablePence: non-negative available funds (Math.max(0, currentBalancePence))
 * - transferRequiredPence:
 *     Exact formula handling both positive balances and overdrawn/negative balances:
 *     transferRequired = Math.max(0, totalUnpaidSelectedPaymentsPence - currentBalancePence)
 *     
 *     Positive balance example: balance £300 (30,000p), bills £379.79 (37,979p) -> requires £79.79 (7,979p)
 *     Funded balance example: balance £2,450 (245,000p), bills £1,588.50 (158,850p) -> requires £0.00 (0p)
 *     Overdraft example: balance -£100 (-10,000p), bills £300 (30,000p) -> requires £400.00 (40,000p)
 */
export function calculateAccountFunding(
  account: Account,
  plannedPayments: PlannedPayment[],
  transactions: Transaction[] = []
): AccountFundingRequirement {
  const selectedPayments = plannedPayments.filter(
    (p) => p.accountId === account.id && p.includeInTransferPlan === true
  );

  // Transfer Plan inclusion and payment status are separate dimensions.
  // Selected paid rows stay visible for audit/reference, but only selected
  // unpaid bills can create a new funding requirement.
  const paidPayments = selectedPayments.filter((p) => p.status === 'paid');
  const unpaidPayments = selectedPayments.filter((p) => p.status !== 'paid');

  const sortedUnpaid = [...unpaidPayments].sort((a, b) => {
    const dateA = a.dueDate || '9999-99-99';
    const dateB = b.dueDate || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  const currentBalancePence = account.currentBalancePence;
  const amountAvailablePence = Math.max(0, currentBalancePence);

  // Distinguish selected bills covered by the current account balance from
  // selected bills that still need funding.
  let runningBalance = amountAvailablePence;
  const fundedPayments: PlannedPayment[] = [];
  const unfundedPayments: PlannedPayment[] = [];

  for (const p of sortedUnpaid) {
    if (runningBalance >= p.amountPence) {
      fundedPayments.push(p);
      runningBalance -= p.amountPence;
    } else {
      unfundedPayments.push(p);
    }
  }

  const totalSelectedPaymentsPence = selectedPayments.reduce(
    (sum, p) => sum + p.amountPence,
    0
  );
  const totalUnpaidSelectedPaymentsPence = unpaidPayments.reduce(
    (sum, p) => sum + p.amountPence,
    0
  );

  // Exact Transfer Required formula:
  // selected UNPAID In-Plan bills - current destination-account balance.
  // Paid bills remain visible, but their actual expense has already affected
  // the current balance and must never be funded a second time.
  const transferRequiredPence = Math.max(
    0,
    totalUnpaidSelectedPaymentsPence - currentBalancePence
  );
  const isFullyFunded = transferRequiredPence === 0;

  return {
    account,
    currentBalancePence,
    selectedPayments,
    unpaidPayments,
    paidPayments,
    fundedPayments,
    unfundedPayments,
    totalSelectedPaymentsPence,
    totalUnpaidSelectedPaymentsPence,
    amountAvailablePence,
    transferRequiredPence,
    isFullyFunded,
  };
}

/**
 * Generates the complete household Transfer Plan for a given month.
 * Separates accounts into those requiring funding vs those fully funded.
 */
export function generateTransferPlan(
  accounts: Account[],
  allPlannedPayments: PlannedPayment[],
  selectedMonth?: string,
  transactions: Transaction[] = []
): TransferPlanSummary {
  // Filter payments by month if selectedMonth is provided
  const relevantPayments = selectedMonth
    ? allPlannedPayments.filter((p) => p.month === selectedMonth)
    : allPlannedPayments;

  const accountsNeedingFunding: AccountFundingRequirement[] = [];
  const accountsFullyFunded: AccountFundingRequirement[] = [];

  let totalTransferRequiredPence = 0;
  let totalSelectedPaymentsPence = 0;
  let totalSelectedPaymentsCount = 0;
  let totalPaidSelectedPaymentsCount = 0;

  // Only consider active accounts
  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  for (const account of activeAccounts) {
    const funding = calculateAccountFunding(account, relevantPayments, transactions);

    totalPaidSelectedPaymentsCount += funding.paidPayments.length;

    // Keep every destination account with at least one selected bill visible in
    // the Account Funding section. Funding is based on In Plan selection; the
    // Paid/Unpaid count remains a separate status metric.
    if (funding.selectedPayments.length === 0) continue;

    if (funding.transferRequiredPence > 0) {
      accountsNeedingFunding.push(funding);
      totalTransferRequiredPence += funding.transferRequiredPence;
    } else {
      accountsFullyFunded.push(funding);
    }

    totalSelectedPaymentsPence += funding.totalSelectedPaymentsPence;
    totalSelectedPaymentsCount += funding.selectedPayments.length;
  }

  // Sort accounts needing funding by highest transfer required first
  accountsNeedingFunding.sort((a, b) => b.transferRequiredPence - a.transferRequiredPence);

  return {
    month: selectedMonth || 'All Active',
    accountsNeedingFunding,
    accountsFullyFunded,
    totalTransferRequiredPence,
    totalSelectedPaymentsPence,
    totalSelectedPaymentsCount,
    totalPaidSelectedPaymentsCount,
  };
}

/**
 * Formats a YYYY-MM string into a human-readable month header e.g. "2026-09" -> "September 2026"
 */
export function formatMonthLabel(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) return yearMonth;
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return yearMonth;

  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Shifts a due date into a target month with month-end edge case clamping.
 * Example: 2026-01-31 shifted to 2026-02 clamps to 2026-02-28.
 */
export function shiftDateToTargetMonth(dueDate: string | undefined, targetMonth: string): string | undefined {
  if (!dueDate) return undefined;
  const parts = dueDate.split('-');
  if (parts.length < 3) return undefined;
  const rawDay = parseInt(parts[2], 10);
  if (isNaN(rawDay)) return undefined;

  const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
  if (!targetYear || !targetMonthNum) return undefined;

  // Last day of targetMonth (day 0 of month+1)
  const daysInTargetMonth = new Date(targetYear, targetMonthNum, 0).getDate();
  const clampedDay = Math.min(rawDay, daysInTargetMonth);
  return `${targetMonth}-${String(clampedDay).padStart(2, '0')}`;
}
