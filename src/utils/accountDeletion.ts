import type { Account, AuditLogEntry, HouseholdData } from '../types';

export interface AccountPermanentDeleteEligibility {
  accountId: string;
  canDeletePermanently: boolean;
  reasons: string[];
  removableAuditLogIds: string[];
  zeroEffectReconciliationOnly: boolean;
  isolatedSetupBalancePence: number;
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

function reconciliationMarkerPresent(account: Account): boolean {
  return (
    Boolean(account.reconciledAt) ||
    Boolean(account.reconciliationDate) ||
    account.reconciledBalancePence !== undefined
  );
}

function reconciliationIsZeroEffect(account: Account): boolean {
  if (!reconciliationMarkerPresent(account)) return false;

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

function isExplicitHarmlessAdministrativeAudit(entry: AuditLogEntry): boolean {
  if (entry.action === 'account_created' || entry.action === 'account_archived') {
    return true;
  }

  if (entry.action === 'account_updated') {
    const details = entry.details || {};
    return details.administrativeOnly === true && details.financialStateChanged === false;
  }

  return false;
}

function isLegacyHarmlessAdministrativeAudit(entry: AuditLogEntry): boolean {
  // Legacy account UI edits/reactivations were all recorded as account_updated
  // without details. The UI did not expose account balances, so these rows are
  // administrative-only unless other material state evidence exists elsewhere.
  return entry.action === 'account_updated' && !entry.details;
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

function classifyAccountAuditReferences(
  account: Account,
  references: AuditLogEntry[]
): {
  harmless: AuditLogEntry[];
  material: AuditLogEntry[];
} {
  const harmless: AuditLogEntry[] = [];
  const material: AuditLogEntry[] = [];

  for (const entry of references) {
    if (
      isExplicitHarmlessAdministrativeAudit(entry) ||
      isExplicitHarmlessReconciliationAudit(entry)
    ) {
      harmless.push(entry);
      continue;
    }

    if (isLegacyHarmlessAdministrativeAudit(entry)) {
      harmless.push(entry);
      continue;
    }

    material.push(entry);
  }

  // A generic legacy reconciliation row is indistinguishable from an old UI
  // account edit. It is only harmless because the current account state and all
  // persisted financial collections are checked independently below.
  if (
    reconciliationIsZeroEffect(account) &&
    material.length === 0
  ) {
    return { harmless, material };
  }

  return { harmless, material };
}

function isolatedSetupBalancePence(account: Account): number {
  // A non-zero balance is only treated as setup-state when it is exactly the
  // original opening value and there is no credit debt. Any later balance
  // movement makes current != starting and remains blocking.
  if (
    account.currentBalancePence === account.startingBalancePence &&
    (account.balanceOwedPence ?? 0) === 0
  ) {
    return account.startingBalancePence;
  }
  return 0;
}

/**
 * Authoritative decision used by both the Accounts UI and the final mutation.
 *
 * Safe deletion is about evidence, not merely a £0 balance:
 * - any financial/structural foreign-key reference blocks;
 * - any material reconciliation blocks;
 * - any unexplained balance movement blocks;
 * - harmless account-management history does not trap an otherwise unused
 *   mistaken account forever;
 * - a non-zero opening balance can be removed only when it is still exactly the
 *   untouched opening/current setup value and has no linked evidence anywhere.
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
      isolatedSetupBalancePence: 0,
    };
  }

  const reasons: string[] = [];

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
    account.currentBalancePence !== account.startingBalancePence ||
    (account.balanceOwedPence ?? 0) !== 0
  ) {
    reasons.push('The account balance has changed from its original setup state.');
  }

  if (
    reconciliationMarkerPresent(account) &&
    !reconciliationIsZeroEffect(account)
  ) {
    reasons.push('The account has material reconciliation history or a reconciliation discrepancy.');
  }

  const auditReferences = getAccountAuditReferences(state, accountId);
  const auditClassification = classifyAccountAuditReferences(account, auditReferences);

  if (auditClassification.material.length > 0) {
    reasons.push('The account is referenced by material retained audit history.');
  }

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
  const setupBalance = canDeletePermanently ? isolatedSetupBalancePence(account) : 0;
  const zeroEffectReconciliationOnly =
    canDeletePermanently &&
    reconciliationMarkerPresent(account) &&
    reconciliationIsZeroEffect(account) &&
    auditReferences.every((entry) => auditClassification.harmless.includes(entry));

  return {
    accountId,
    canDeletePermanently,
    reasons: Array.from(new Set(reasons)),
    removableAuditLogIds: canDeletePermanently
      ? auditClassification.harmless.map((entry) => entry.id)
      : [],
    zeroEffectReconciliationOnly,
    isolatedSetupBalancePence: setupBalance,
  };
}
