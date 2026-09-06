import type { Account, HouseholdData } from '../types';

export interface AccountPermanentDeleteEligibility {
  accountId: string;
  canDeletePermanently: boolean;
  reasons: string[];
}

function containsExactId(value: unknown, id: string, seen = new Set<unknown>()): boolean {
  if (value === id) return true;
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsExactId(item, id, seen));
  }

  return Object.values(value as Record<string, unknown>).some((item) =>
    containsExactId(item, id, seen)
  );
}

function hasOwnFinancialHistory(account: Account): string[] {
  const reasons: string[] = [];

  if (account.startingBalancePence !== 0) {
    reasons.push('The account has a non-zero opening balance.');
  }
  if (account.currentBalancePence !== 0) {
    reasons.push('The account has a non-zero current balance.');
  }
  if ((account.balanceOwedPence ?? 0) !== 0) {
    reasons.push('The credit account has a recorded amount owed.');
  }
  if (
    account.reconciledAt ||
    account.reconciliationDate ||
    account.reconciledBalancePence !== undefined
  ) {
    reasons.push('The account has reconciliation history.');
  }

  return reasons;
}

const FINANCIAL_AUDIT_ACTION_PATTERN =
  /(transfer|fund|payment|income|saving|transaction|reconcil|repayment|refund)/i;

/**
 * One authoritative decision for both UI presentation and the final mutation guard.
 *
 * Permanent deletion is deliberately stricter than archiving. The target account
 * must have no opening/current financial value, no reconciliation history, and no
 * exact ID reference in any persisted financial collection or nested metadata.
 */
export function getAccountPermanentDeleteEligibility(
  state: HouseholdData,
  accountId: string
): AccountPermanentDeleteEligibility {
  const account = state.accounts.find((candidate) => candidate.id === accountId);
  if (!account) {
    return {
      accountId,
      canDeletePermanently: false,
      reasons: ['Account not found.'],
    };
  }

  const reasons = hasOwnFinancialHistory(account);

  if (state.transactions.some((item) => containsExactId(item, accountId))) {
    reasons.push('The account is referenced by Activity / ledger history.');
  }

  if (state.plannedPayments.some((item) => containsExactId(item, accountId))) {
    reasons.push('The account is referenced by a planned bill or payment record.');
  }

  if ((state.plannedIncomes || []).some((item) => containsExactId(item, accountId))) {
    reasons.push('The account is referenced by an income record.');
  }

  if (state.savingsGoals.some((item) => containsExactId(item, accountId))) {
    reasons.push('The account is referenced by savings data.');
  }

  if (
    state.auditLogs.some(
      (entry) =>
        FINANCIAL_AUDIT_ACTION_PATTERN.test(entry.action) &&
        (entry.entityId === accountId || containsExactId(entry.details, accountId))
    )
  ) {
    reasons.push('The account is referenced by retained financial audit history.');
  }

  // Future-proof the current schema: if new top-level persisted financial
  // collections are added, an exact target-account ID must not silently escape
  // the eligibility guard. Core identity/config collections are intentionally
  // excluded because they cannot contain account foreign keys today.
  const futurePersistedState = Object.fromEntries(
    Object.entries(state).filter(
      ([key]) =>
        ![
          'accounts',
          'transactions',
          'plannedPayments',
          'plannedIncomes',
          'savingsGoals',
          'auditLogs',
          'members',
          'categories',
          'schemaStatus',
          'id',
          'name',
          'version',
        ].includes(key)
    )
  );
  if (containsExactId(futurePersistedState, accountId)) {
    reasons.push('The account is referenced elsewhere in persisted household data.');
  }

  return {
    accountId,
    canDeletePermanently: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
}
