import type { Account, AuditLogEntry, HouseholdData } from '../types';

export interface AccountPermanentDeleteEligibility {
  accountId: string;
  canDeletePermanently: boolean;
  reasons: string[];
  removableAuditLogIds: string[];
  zeroEffectReconciliationOnly: boolean;
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

function hasNonReconciliationFinancialState(account: Account): string[] {
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

  return reasons;
}

function reconciliationIsZeroEffect(account: Account): boolean {
  const hasMarker =
    Boolean(account.reconciledAt) ||
    Boolean(account.reconciliationDate) ||
    account.reconciledBalancePence !== undefined;

  if (!hasMarker) return false;

  return (
    account.startingBalancePence === 0 &&
    account.currentBalancePence === 0 &&
    (account.balanceOwedPence ?? 0) === 0 &&
    account.reconciledBalancePence === 0
  );
}

function isExplicitHarmlessReconciliationAudit(entry: AuditLogEntry): boolean {
  if (entry.action !== 'account_reconciled') return false;
  const details = entry.details || {};
  return (
    details.zeroEffect === true &&
    details.currentBalancePence === 0 &&
    details.reconciledBalancePence === 0 &&
    details.discrepancyPence === 0 &&
    details.createdFinancialTransaction === false
  );
}

function getAccountAuditReferences(
  state: HouseholdData,
  accountId: string
): AuditLogEntry[] {
  return state.auditLogs.filter(
    (entry) =>
      entry.entityId === accountId || containsExactId(entry.details, accountId)
  );
}

function classifyReconciliationAuditReferences(
  account: Account,
  references: AuditLogEntry[]
): {
  harmless: AuditLogEntry[];
  material: AuditLogEntry[];
} {
  const harmless: AuditLogEntry[] = [];
  const material: AuditLogEntry[] = [];

  for (const entry of references) {
    if (isExplicitHarmlessReconciliationAudit(entry)) {
      harmless.push(entry);
      continue;
    }

    material.push(entry);
  }

  // Compatibility for reconciliation records created before account_reconciled
  // became explicit. The old workflow wrote one generic account_updated audit
  // row and no details. Treat that row as the harmless reconciliation marker
  // only when it is the sole account-specific audit reference and the account
  // itself proves a zero-effect £0.00 reconciliation. Any additional update,
  // archive, financial or structural audit evidence remains blocking.
  if (
    material.length === 1 &&
    harmless.length === 0 &&
    reconciliationIsZeroEffect(account) &&
    material[0].action === 'account_updated' &&
    material[0].summary === 'Account updated' &&
    !material[0].details
  ) {
    harmless.push(material[0]);
    material.length = 0;
  }

  return { harmless, material };
}

/**
 * One authoritative decision for both UI presentation and the final mutation guard.
 *
 * Permanent deletion is deliberately stricter than archiving. The only
 * reconciliation exception is a provably zero-effect marker on an otherwise
 * unused £0.00 account. Material reconciliation discrepancy/history remains
 * blocking.
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
      removableAuditLogIds: [],
      zeroEffectReconciliationOnly: false,
    };
  }

  const reasons = hasNonReconciliationFinancialState(account);

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

  const reconciliationMarkerPresent =
    Boolean(account.reconciledAt) ||
    Boolean(account.reconciliationDate) ||
    account.reconciledBalancePence !== undefined;

  if (reconciliationMarkerPresent && !reconciliationIsZeroEffect(account)) {
    reasons.push('The account has material reconciliation history or a reconciliation discrepancy.');
  }

  const auditReferences = getAccountAuditReferences(state, accountId);
  const auditClassification = classifyReconciliationAuditReferences(
    account,
    auditReferences
  );

  if (auditClassification.material.length > 0) {
    reasons.push('The account is referenced by retained audit history.');
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

  const canDeletePermanently = reasons.length === 0;
  const zeroEffectReconciliationOnly =
    canDeletePermanently &&
    reconciliationMarkerPresent &&
    reconciliationIsZeroEffect(account) &&
    auditReferences.length > 0 &&
    auditReferences.length === auditClassification.harmless.length;

  return {
    accountId,
    canDeletePermanently,
    reasons: Array.from(new Set(reasons)),
    removableAuditLogIds: canDeletePermanently
      ? auditClassification.harmless.map((entry) => entry.id)
      : [],
    zeroEffectReconciliationOnly,
  };
}
