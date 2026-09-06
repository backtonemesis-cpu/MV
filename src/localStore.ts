import { JOINT_ACCOUNT_OWNER_ID } from './types';
import type {
  Account,
  AuditLogEntry,
  HouseholdData,
  HouseholdMember,
  Payer,
  PlannedIncome,
  PlannedPayment,
  PlannedPaymentMutationExpectation,
  SavingsGoal,
  Transaction,
  UserPreferences,
  UserRole,
} from './types';
import { normalizeUserPreferences } from './themeEngine';
import { calculateAccountFunding } from './utils/transferPlan';
import { getAccountPermanentDeleteEligibility } from './utils/accountDeletion';
import {
  findLatestTransferPlanFundingBatch,
  getLegacyIncomingFundingBatches,
  getTransferPlanFundingBatches,
  getTransferPlanFundingMonth,
} from './utils/transferPlanFunding';

const STORAGE_KEY = 'mv_local_state_v1';
const ROLLBACK_KEY = 'mv_local_state_before_restore_v1';
const SOURCE_IMPORT_BACKUP_KEY = 'mv_local_state_before_source_budget_import_v1';
const SOURCE_IMPORT_FUNDING_RECOVERY_ID = 'source-import-funding-recovery-v1';
export const LEGACY_SOURCE_SEED_MIGRATION_ID = 'source-budget-2026-09-v2';
const PREFS_KEY = 'mv_local_preferences_v1';
const LOCAL_EVENT = 'mv-local-state-updated';
const OWNER_EMAIL = 'marius@local.invalid';
const OWNER_NAME = 'Marius';
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const STANDARD_CATEGORIES = [
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
  { id: 'cat-savings', name: 'Savings Allocation', group: 'Savings', monthlyBudgetPence: 0 },
  { id: 'cat-salary', name: 'Salary & Earnings', group: 'Income', monthlyBudgetPence: 0 },
  { id: 'cat-benefits', name: 'State Benefits / Universal Credit', group: 'Income', monthlyBudgetPence: 0 },
  { id: 'cat-child-benefit', name: 'Child Benefit', group: 'Income', monthlyBudgetPence: 0 },
  { id: 'cat-transfer', name: 'Internal Transfer', group: 'Transfers', monthlyBudgetPence: 0 },
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function ownerMember(): HouseholdMember {
  return {
    id: 'local-marius',
    email: OWNER_EMAIL,
    name: OWNER_NAME,
    role: 'owner',
    joinedAt: '2026-09-04T00:00:00.000Z',
    lastActiveAt: nowIso(),
  };
}

export function createBlankLocalHousehold(version = 1): HouseholdData {
  return {
    id: 'household-mv-local',
    name: 'Marius Household',
    version,
    schemaStatus: {
      currentSchemaVersion: 1,
      minSupportedClientVersion: 1,
      latestAppliedVersion: 1,
      appliedMigrations: [],
      isUpToDate: true,
    },
    members: [ownerMember()],
    accounts: [],
    categories: STANDARD_CATEGORIES.map((category) => ({ ...category })),
    transactions: [],
    savingsGoals: [],
    plannedPayments: [],
    plannedIncomes: [],
    auditLogs: [],
  };
}

function isSafePence(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }
  return day <= new Date(year, month, 0).getDate();
}

function assertValidPaymentDate(value: string): void {
  if (!isValidDateKey(value)) {
    throw new Error('Payment date must be a valid YYYY-MM-DD calendar date.');
  }
}

function isActualPaymentEvidence(
  transaction: Transaction,
  paymentId: string
): boolean {
  return (
    transaction.plannedPaymentId === paymentId &&
    transaction.type === 'expense' &&
    !transaction.isTransfer &&
    !transaction.isRepayment &&
    !transaction.isSavings &&
    !transaction.isRefund
  );
}

function paymentEvidenceReferences(
  state: HouseholdData,
  paymentId: string
): Transaction[] {
  return state.transactions.filter(
    (transaction) => transaction.plannedPaymentId === paymentId
  );
}

function assertNoPaymentEvidenceReference(
  state: HouseholdData,
  payment: PlannedPayment
): void {
  const references = paymentEvidenceReferences(state, payment.id);
  if (payment.actualTransactionId || references.length > 0) {
    throw new Error(
      `${payment.name} already has or references actual payment evidence. Nothing was changed.`
    );
  }
}

function requireUniqueLinkedPaymentEvidence(
  state: HouseholdData,
  payment: PlannedPayment
): Transaction {
  const references = paymentEvidenceReferences(state, payment.id);
  if (!payment.actualTransactionId && references.length === 0) {
    throw new Error(
      `${payment.name} has no linked actual payment transaction to undo. Nothing was changed.`
    );
  }
  if (
    !payment.actualTransactionId ||
    references.length !== 1 ||
    references[0].id !== payment.actualTransactionId ||
    !isActualPaymentEvidence(references[0], payment.id)
  ) {
    throw new Error(
      `The linked Activity expense for ${payment.name} is missing, duplicated, or mismatched. Nothing was changed.`
    );
  }
  return references[0];
}

function assertPaymentMatchesExpectation(
  payment: PlannedPayment,
  expected: PlannedPaymentMutationExpectation
): void {
  const same =
    payment.id === expected.id &&
    payment.name === expected.name &&
    payment.amountPence === expected.amountPence &&
    payment.month === expected.month &&
    payment.responsiblePerson === expected.responsiblePerson &&
    payment.accountId === expected.accountId &&
    (payment.categoryId || '') === (expected.categoryId || '') &&
    payment.status === expected.status &&
    payment.includeInTransferPlan === expected.includeInTransferPlan &&
    (payment.actualTransactionId || '') === (expected.actualTransactionId || '');

  if (!same) {
    throw new Error(
      `${payment.name} changed after the confirmation was opened. Refresh and review the current bill before trying again. Nothing was changed.`
    );
  }
}

function assertHouseholdShape(value: unknown): asserts value is HouseholdData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved MV data is not a valid object.');
  }
  const state = value as Partial<HouseholdData>;
  for (const field of [
    'members',
    'accounts',
    'categories',
    'transactions',
    'savingsGoals',
    'plannedPayments',
    'auditLogs',
  ] as const) {
    if (!Array.isArray(state[field])) throw new Error(`Saved MV data is missing ${field}.`);
  }
  if (state.plannedIncomes !== undefined && !Array.isArray(state.plannedIncomes)) {
    throw new Error('Saved MV data has invalid planned income.');
  }
  if (!Number.isSafeInteger(state.version) || (state.version ?? 0) < 1) {
    throw new Error('Saved MV data has an invalid version.');
  }

  for (const account of state.accounts ?? []) {
    if (!isSafePence(account.startingBalancePence)) {
      throw new Error(`Account '${account.name}' has an invalid starting balance.`);
    }
    if (
      account.reconciledBalancePence !== undefined &&
      !isSafePence(account.reconciledBalancePence)
    ) {
      throw new Error(`Account '${account.name}' has an invalid reconciled balance.`);
    }
  }

  for (const tx of state.transactions ?? []) {
    if (!isSafePence(tx.amountPence) || tx.amountPence < 0) {
      throw new Error(`Transaction '${tx.description}' has an invalid amount.`);
    }
    if (tx.splits?.length) {
      const splitTotal = tx.splits.reduce((sum, split) => sum + split.amountPence, 0);
      if (splitTotal !== tx.amountPence) {
        throw new Error(`Transaction '${tx.description}' split total does not match its amount.`);
      }
    }
  }

  for (const payment of state.plannedPayments ?? []) {
    if (!isSafePence(payment.amountPence) || payment.amountPence < 0) {
      throw new Error(`Planned payment '${payment.name}' has an invalid amount.`);
    }
  }

  for (const income of state.plannedIncomes ?? []) {
    if (!isSafePence(income.expectedAmountPence) || income.expectedAmountPence < 0) {
      throw new Error(`Planned income '${income.name}' has an invalid amount.`);
    }
  }

  for (const goal of state.savingsGoals ?? []) {
    if (!isSafePence(goal.targetPence) || !isSafePence(goal.currentPence)) {
      throw new Error(`Savings goal '${goal.name}' has an invalid amount.`);
    }
  }
}

function assertUniqueIds(label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id?.trim()) throw new Error(`${label} contains a blank ID.`);
    if (seen.has(id)) throw new Error(`${label} contains duplicate ID '${id}'.`);
    seen.add(id);
  }
}

function assertBackupReferentialIntegrity(state: HouseholdData): void {
  assertUniqueIds('Accounts', state.accounts.map((item) => item.id));
  assertUniqueIds('Categories', state.categories.map((item) => item.id));
  assertUniqueIds('Transactions', state.transactions.map((item) => item.id));
  assertUniqueIds('Planned payments', state.plannedPayments.map((item) => item.id));
  assertUniqueIds('Planned incomes', (state.plannedIncomes || []).map((item) => item.id));
  assertUniqueIds('Savings goals', state.savingsGoals.map((item) => item.id));
  assertUniqueIds('Household members', state.members.map((item) => item.id));

  const accountIds = new Set(state.accounts.map((item) => item.id));
  const categoryIds = new Set(state.categories.map((item) => item.id));
  const paymentIds = new Set(state.plannedPayments.map((item) => item.id));
  const incomeIds = new Set((state.plannedIncomes || []).map((item) => item.id));
  const transactionsById = new Map(state.transactions.map((item) => [item.id, item]));

  for (const transaction of state.transactions) {
    if (!accountIds.has(transaction.accountId)) {
      throw new Error(
        `Transaction '${transaction.description}' references a missing source account.`
      );
    }
    if (transaction.targetAccountId && !accountIds.has(transaction.targetAccountId)) {
      throw new Error(
        `Transaction '${transaction.description}' references a missing destination account.`
      );
    }
    if (!categoryIds.has(transaction.categoryId)) {
      throw new Error(
        `Transaction '${transaction.description}' references a missing category.`
      );
    }
    for (const split of transaction.splits || []) {
      if (!categoryIds.has(split.categoryId)) {
        throw new Error(
          `Transaction '${transaction.description}' has a split referencing a missing category.`
        );
      }
    }
    if (transaction.plannedPaymentId && !paymentIds.has(transaction.plannedPaymentId)) {
      throw new Error(
        `Transaction '${transaction.description}' references a missing planned payment.`
      );
    }
    if (transaction.plannedIncomeId && !incomeIds.has(transaction.plannedIncomeId)) {
      throw new Error(
        `Transaction '${transaction.description}' references a missing planned income.`
      );
    }
  }

  for (const payment of state.plannedPayments) {
    if (!accountIds.has(payment.accountId)) {
      throw new Error(`Planned payment '${payment.name}' references a missing account.`);
    }
    if (payment.categoryId && !categoryIds.has(payment.categoryId)) {
      throw new Error(`Planned payment '${payment.name}' references a missing category.`);
    }

    const references = state.transactions.filter(
      (transaction) => transaction.plannedPaymentId === payment.id
    );

    if (payment.actualTransactionId) {
      const transaction = transactionsById.get(payment.actualTransactionId);
      if (
        references.length !== 1 ||
        !transaction ||
        references[0].id !== transaction.id ||
        !isActualPaymentEvidence(transaction, payment.id)
      ) {
        throw new Error(
          `Planned payment '${payment.name}' has missing, duplicated, or mismatched actual payment evidence.`
        );
      }
    } else if (references.length > 0) {
      throw new Error(
        `Planned payment '${payment.name}' has orphan actual payment evidence.`
      );
    }
  }

  for (const income of state.plannedIncomes || []) {
    if (!accountIds.has(income.accountId)) {
      throw new Error(`Planned income '${income.name}' references a missing account.`);
    }
    if (income.categoryId && !categoryIds.has(income.categoryId)) {
      throw new Error(`Planned income '${income.name}' references a missing category.`);
    }
    const linkedId = income.actualTransactionId || income.linkedTransactionId;
    if (linkedId) {
      const transaction = transactionsById.get(linkedId);
      if (
        !transaction ||
        transaction.plannedIncomeId !== income.id ||
        transaction.type !== 'income'
      ) {
        throw new Error(
          `Planned income '${income.name}' has invalid linked actual receipt evidence.`
        );
      }
    }
  }

  for (const goal of state.savingsGoals) {
    for (const accountId of [goal.accountId, goal.linkedAccountId]) {
      if (accountId && !accountIds.has(accountId)) {
        throw new Error(`Savings goal '${goal.name}' references a missing account.`);
      }
    }
  }
}

function localTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateCurrentBalancePence(account: Account, transactions: Transaction[]): number {
  const hasReconciliation =
    Boolean(account.reconciliationDate) &&
    Number.isSafeInteger(account.reconciledBalancePence);

  let balance = hasReconciliation
    ? account.reconciledBalancePence!
    : account.type === 'credit' &&
      account.startingBalancePence === 0 &&
      Number.isSafeInteger(account.balanceOwedPence) &&
      (account.balanceOwedPence ?? 0) > 0
    ? -account.balanceOwedPence!
    : account.startingBalancePence;

  const today = localTodayDateKey();
  const effective = transactions.filter((tx) => {
    // Accounts shows the balance that exists now, not future scheduled activity.
    // Future-dated income/transfers/expenses remain in the ledger but do not
    // change the current balance until their transaction date arrives.
    if (tx.date > today) return false;
    if (!hasReconciliation) return true;
    return tx.date > account.reconciliationDate!;
  });

  for (const tx of effective) {
    if (tx.accountId === account.id) {
      if (tx.type === 'income' || tx.type === 'refund' || tx.isRefund) {
        balance += tx.amountPence;
      } else if (
        tx.type === 'expense' ||
        tx.type === 'repayment' ||
        (tx.type === 'transfer' && tx.isTransfer)
      ) {
        balance -= tx.amountPence;
      }
    }

    if (tx.targetAccountId === account.id && tx.type === 'transfer' && tx.isTransfer) {
      balance += tx.amountPence;
    }

    if (
      tx.targetAccountId === account.id &&
      (tx.type === 'repayment' || tx.isRepayment)
    ) {
      balance += tx.amountPence;
    }
  }

  return balance;
}

function adjustAnchoredBalanceForNewTransfer(
  account: Account,
  deltaPence: number,
  transferDate: string
): void {
  if (
    account.reconciliationDate &&
    Number.isSafeInteger(account.reconciledBalancePence) &&
    transferDate <= account.reconciliationDate
  ) {
    account.reconciledBalancePence = account.reconciledBalancePence! + deltaPence;
  }
}

function normalizeCommitmentMonth(month: string | undefined, date: string): string {
  const resolved = month || date.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(resolved)) {
    throw new Error('Commitment month must use YYYY-MM format.');
  }
  return resolved;
}

function calculateSafeToMovePence(
  state: HouseholdData,
  account: Account,
  month: string
): { safeToMovePence: number; committedPence: number } {
  const monthPayments = state.plannedPayments.filter(
    (payment) => payment.month === month
  );
  const funding = calculateAccountFunding(account, monthPayments, state.transactions);
  const committedPence = funding.totalUnpaidSelectedPaymentsPence;
  return {
    committedPence,
    safeToMovePence: Math.max(0, account.currentBalancePence - committedPence),
  };
}

function markSourceBudgetHandled(state: HouseholdData): void {
  const current = state.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };

  if (!current.appliedMigrations.some((migration) => migration.name === LEGACY_SOURCE_SEED_MIGRATION_ID)) {
    current.appliedMigrations = [
      ...current.appliedMigrations,
      {
        version: 1,
        name: LEGACY_SOURCE_SEED_MIGRATION_ID,
        appliedAt: nowIso(),
        executionTimeMs: 0,
        checksum: 'user-explicit-state',
      },
    ];
  }

  state.schemaStatus = current;
}


function financeMemberKey(name: string): string {
  const normalized = name.trim().toLowerCase();
  const slug = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'person';

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return `${slug}-${hash.toString(36)}`;
}

function financeMemberEmail(name: string): string {
  return `finance-${financeMemberKey(name)}@local.invalid`;
}

function financeMemberId(name: string): string {
  return `local-person-${financeMemberKey(name)}`;
}

function normalizedPersonName(value?: string): string {
  return value?.trim().toLowerCase() || '';
}

function createInferredFinancialMember(name: string): HouseholdMember {
  return {
    id: financeMemberId(name),
    email: financeMemberEmail(name),
    name: name.trim(),
    role: 'editor',
    joinedAt: nowIso(),
    approvedAt: nowIso(),
    approvedBy: OWNER_EMAIL,
  };
}

function normalizeAccountOwnership(state: HouseholdData): void {
  const membersById = new Map(state.members.map((member) => [member.id, member]));

  state.accounts = state.accounts.map((account) => {
    if (
      account.ownerMemberId === JOINT_ACCOUNT_OWNER_ID ||
      normalizedPersonName(account.ownerPerson) === 'joint'
    ) {
      return {
        ...account,
        ownerMemberId: JOINT_ACCOUNT_OWNER_ID,
        ownerPerson: 'Joint',
      };
    }

    if (account.ownerMemberId) {
      const linkedMember = membersById.get(account.ownerMemberId);
      if (linkedMember) {
        return {
          ...account,
          ownerPerson: linkedMember.name,
        };
      }

      // Unknown legacy IDs are preserved rather than guessed. The edit form
      // requires the user to choose a valid current household member.
      return account;
    }

    const ownerName = normalizedPersonName(account.ownerPerson);
    if (!ownerName) return account;

    const matches = state.members.filter(
      (member) => normalizedPersonName(member.name) === ownerName
    );
    if (matches.length !== 1) return account;

    return {
      ...account,
      ownerMemberId: matches[0].id,
      ownerPerson: matches[0].name,
    };
  });
}

function resolveAccountOwnerForWrite(
  state: HouseholdData,
  ownerMemberId?: string,
  legacyOwnerPerson?: string
): { ownerMemberId: string; ownerPerson: Payer } {
  if (ownerMemberId === JOINT_ACCOUNT_OWNER_ID) {
    return { ownerMemberId: JOINT_ACCOUNT_OWNER_ID, ownerPerson: 'Joint' };
  }

  if (ownerMemberId) {
    const member = state.members.find((candidate) => candidate.id === ownerMemberId);
    if (!member || member.role === 'removed') {
      throw new Error('Account owner must be an active household member or Joint.');
    }
    return { ownerMemberId: member.id, ownerPerson: member.name };
  }

  const legacyName = legacyOwnerPerson?.trim();
  if (!legacyName) {
    throw new Error('Account owner is required. Choose a household member or Joint.');
  }

  if (legacyName.toLowerCase() === 'joint') {
    return { ownerMemberId: JOINT_ACCOUNT_OWNER_ID, ownerPerson: 'Joint' };
  }

  const activeMatches = state.members.filter(
    (member) =>
      member.role !== 'removed' &&
      normalizedPersonName(member.name) === normalizedPersonName(legacyName)
  );
  if (activeMatches.length === 1) {
    return {
      ownerMemberId: activeMatches[0].id,
      ownerPerson: activeMatches[0].name,
    };
  }

  if (activeMatches.length > 1) {
    throw new Error('Account owner is ambiguous. Choose a specific household member.');
  }

  const removedMatch = state.members.find(
    (member) =>
      member.role === 'removed' &&
      normalizedPersonName(member.name) === normalizedPersonName(legacyName)
  );
  if (removedMatch) {
    throw new Error('This household member is removed and cannot own a new account.');
  }

  // Backwards-compatible path for legacy callers that still submit ownerPerson
  // instead of ownerMemberId. The normal UI always submits the stable member ID.
  const inferredMember = createInferredFinancialMember(legacyName);
  state.members.push(inferredMember);
  return {
    ownerMemberId: inferredMember.id,
    ownerPerson: inferredMember.name,
  };
}

function referencedFinancialPeople(state: HouseholdData): string[] {
  const names = new Set<string>();

  const add = (value?: string) => {
    const name = value?.trim();
    if (!name || name.toLowerCase() === 'joint') return;
    names.add(name);
  };

  state.accounts.forEach((account) => add(account.ownerPerson));
  state.transactions.forEach((transaction) => {
    add(transaction.payer);
    transaction.splits?.forEach((split) => add(split.payer));
  });
  state.plannedPayments.forEach((payment) => add(payment.responsiblePerson));
  (state.plannedIncomes || []).forEach((income) => add(income.sourcePerson));

  return Array.from(names);
}

function renameFinancialPersonReferences(
  state: HouseholdData,
  previousName: string,
  nextName: string
): void {
  const previous = previousName.trim().toLowerCase();
  if (!previous || previous === nextName.trim().toLowerCase()) return;

  const rename = (value?: string): string | undefined =>
    value?.trim().toLowerCase() === previous ? nextName : value;

  state.accounts = state.accounts.map((account) => ({
    ...account,
    ownerPerson: rename(account.ownerPerson),
  }));

  state.transactions = state.transactions.map((transaction) => ({
    ...transaction,
    payer: rename(transaction.payer) || transaction.payer,
    splits: transaction.splits?.map((split) => ({
      ...split,
      payer: rename(split.payer),
    })),
  }));

  state.plannedPayments = state.plannedPayments.map((payment) => ({
    ...payment,
    responsiblePerson: rename(payment.responsiblePerson) || payment.responsiblePerson,
  }));

  state.plannedIncomes = (state.plannedIncomes || []).map((income) => ({
    ...income,
    sourcePerson: rename(income.sourcePerson) || income.sourcePerson,
  }));
}


function repairDuplicateAccountRouting(state: HouseholdData): number {
  const normalized = (value?: string) => value?.trim().toLowerCase() || '';

  const resolve = (
    currentAccountId: string,
    person: string
  ): string | undefined => {
    const personKey = normalized(person);
    if (!personKey || personKey === 'joint') return undefined;

    const memberMatches = state.members.filter(
      (member) => normalized(member.name) === personKey
    );
    const personMemberId = memberMatches.length === 1 ? memberMatches[0].id : undefined;

    const current = state.accounts.find((account) => account.id === currentAccountId);
    if (!current) return undefined;
    if (
      (personMemberId && current.ownerMemberId === personMemberId) ||
      normalized(current.ownerPerson) === personKey
    ) {
      return undefined;
    }

    const candidates = state.accounts.filter(
      (account) =>
        account.isActive !== false &&
        account.id !== current.id &&
        normalized(account.name) === normalized(current.name) &&
        account.type === current.type &&
        (
          (personMemberId && account.ownerMemberId === personMemberId) ||
          normalized(account.ownerPerson) === personKey
        )
    );

    return candidates.length === 1 ? candidates[0].id : undefined;
  };

  let repairs = 0;

  state.transactions = state.transactions.map((transaction) => {
    if (transaction.isTransfer || transaction.type === 'transfer') return transaction;
    const targetAccountId = resolve(
      transaction.accountId,
      transaction.payer
    );
    if (!targetAccountId) return transaction;
    repairs += 1;
    return {
      ...transaction,
      accountId: targetAccountId,
      metadata: {
        ...(transaction.metadata || {}),
        accountRoutingRepair: {
          fromAccountId: transaction.accountId,
          toAccountId: targetAccountId,
          reason: 'unique same-bank owner match',
        },
      },
    };
  });

  state.plannedPayments = state.plannedPayments.map((payment) => {
    const targetAccountId = resolve(
      payment.accountId,
      payment.responsiblePerson
    );
    if (!targetAccountId) return payment;
    repairs += 1;
    return {
      ...payment,
      accountId: targetAccountId,
      metadata: {
        ...(payment.metadata || {}),
        accountRoutingRepair: {
          fromAccountId: payment.accountId,
          toAccountId: targetAccountId,
          reason: 'unique same-bank owner match',
        },
      },
    };
  });

  state.plannedIncomes = (state.plannedIncomes || []).map((income) => {
    const targetAccountId = resolve(
      income.accountId,
      income.sourcePerson
    );
    if (!targetAccountId) return income;
    repairs += 1;
    return {
      ...income,
      accountId: targetAccountId,
      metadata: {
        ...(income.metadata || {}),
        accountRoutingRepair: {
          fromAccountId: income.accountId,
          toAccountId: targetAccountId,
          reason: 'unique same-bank owner match',
        },
      },
    };
  });

  return repairs;
}

function stripImportedNarrativeNotes(state: HouseholdData): void {
  const importedNarrativePrefixes = [
    'imported from source workbook',
    'imported from the source workbook',
    'imported from a paid fixed row in the source workbook',
    'source savings snapshot:',
    'used by source income/expense rows.',
    'used by source income rows.',
    'used by source expense rows.',
  ];

  const shouldStrip = (notes?: string): boolean => {
    const normalized = notes?.trim().toLowerCase() || '';
    return importedNarrativePrefixes.some((prefix) => normalized.startsWith(prefix));
  };

  state.accounts = (state.accounts || []).map((account) =>
    shouldStrip(account.notes) ? { ...account, notes: undefined } : account
  );

  state.transactions = (state.transactions || []).map((transaction) =>
    shouldStrip(transaction.notes) ? { ...transaction, notes: undefined } : transaction
  );

  state.plannedPayments = (state.plannedPayments || []).map((payment) =>
    shouldStrip(payment.notes) ? { ...payment, notes: undefined } : payment
  );

  state.plannedIncomes = (state.plannedIncomes || []).map((income) =>
    shouldStrip(income.notes) ? { ...income, notes: undefined } : income
  );

  state.auditLogs = (state.auditLogs || []).map((entry) =>
    entry.action === 'source_budget_imported'
      ? { ...entry, summary: 'September 2026 budget imported.' }
      : entry
  );
}


function mapRecoveredAccountId(
  backup: HouseholdData,
  current: HouseholdData,
  oldAccountId: string
): string | undefined {
  if (current.accounts.some((account) => account.id === oldAccountId)) return oldAccountId;
  const oldAccount = backup.accounts.find((account) => account.id === oldAccountId);
  if (!oldAccount) return undefined;

  const sameIdentity = current.accounts.filter(
    (account) =>
      account.isActive !== false &&
      account.name.trim().toLowerCase() === oldAccount.name.trim().toLowerCase() &&
      account.type === oldAccount.type &&
      (!oldAccount.ownerPerson ||
        account.ownerPerson?.trim().toLowerCase() ===
          oldAccount.ownerPerson.trim().toLowerCase())
  );
  return sameIdentity.length === 1 ? sameIdentity[0].id : undefined;
}

function recoverTransferPlanFundingFromSourceBackup(
  input: HouseholdData,
  storage: Storage
): HouseholdData {
  const alreadyRecovered =
    input.schemaStatus?.appliedMigrations?.some(
      (migration) => migration.name === SOURCE_IMPORT_FUNDING_RECOVERY_ID
    ) ?? false;
  if (alreadyRecovered) return input;

  const rawBackup = storage.getItem(SOURCE_IMPORT_BACKUP_KEY);
  if (!rawBackup) return input;

  const next = clone(input);
  let recoveredTransactions = 0;
  let recoveredBatches = 0;
  let skippedAmbiguousBatches = 0;

  {
    try {
      const parsedBackup = JSON.parse(rawBackup) as unknown;
      assertHouseholdShape(parsedBackup);
      const backup = parsedBackup as HouseholdData;
      const historicalBatches = [
        ...getTransferPlanFundingBatches(backup.transactions),
        ...getLegacyIncomingFundingBatches(backup.transactions),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const batch of historicalBatches) {
        const mappedDestinationId = mapRecoveredAccountId(
          backup,
          next,
          batch.destinationAccountId
        );
        const mappedSources = batch.allocations.map((allocation) =>
          mapRecoveredAccountId(backup, next, allocation.sourceAccountId)
        );
        if (!mappedDestinationId || mappedSources.some((id) => !id)) {
          skippedAmbiguousBatches += 1;
          continue;
        }

        const batchMonth = getTransferPlanFundingMonth(batch.transactions[0]);
        if (
          findLatestTransferPlanFundingBatch(
            next.transactions,
            mappedDestinationId,
            batchMonth,
            true
          )
        ) {
          continue;
        }

        const destination = next.accounts.find(
          (account) => account.id === mappedDestinationId
        );
        if (!destination) {
          skippedAmbiguousBatches += 1;
          continue;
        }

        const recovered = batch.transactions.map((transaction, index) => ({
          ...transaction,
          accountId: mappedSources[index]!,
          targetAccountId: mappedDestinationId,
          metadata: {
            ...(transaction.metadata || {}),
            recoveredFromSourceImportBackup: true,
            recoveryId: SOURCE_IMPORT_FUNDING_RECOVERY_ID,
          },
        }));

        for (const transaction of recovered) {
          const source = next.accounts.find(
            (account) => account.id === transaction.accountId
          );
          if (!source) continue;
          adjustAnchoredBalanceForNewTransfer(
            source,
            -transaction.amountPence,
            transaction.date
          );
          adjustAnchoredBalanceForNewTransfer(
            destination,
            transaction.amountPence,
            transaction.date
          );
        }

        next.transactions.unshift(...recovered);
        recoveredTransactions += recovered.length;
        recoveredBatches += 1;
      }
    } catch {
      // Historical rollback data is recovery-only and must not block valid state.
    }
  }

  const schemaStatus = next.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };
  schemaStatus.appliedMigrations = [
    ...(schemaStatus.appliedMigrations || []),
    {
      version: schemaStatus.latestAppliedVersion || 1,
      name: SOURCE_IMPORT_FUNDING_RECOVERY_ID,
      appliedAt: nowIso(),
      executionTimeMs: 0,
      checksum: `recovered-${recoveredBatches}-batches-${recoveredTransactions}-transactions`,
    },
  ];
  next.schemaStatus = schemaStatus;
  next.version = input.version + 1;

  if (recoveredTransactions > 0 || skippedAmbiguousBatches > 0) {
    next.auditLogs = [
      {
        id: createId('audit'),
        timestamp: nowIso(),
        actorEmail: OWNER_EMAIL,
        action: 'transfer_plan_funding_recovered',
        entityType: 'transfer_plan' as const,
        entityId: 'source-import-recovery',
        summary:
          recoveredTransactions > 0
            ? `Recovered ${recoveredBatches} Transfer Plan funding batch${recoveredBatches === 1 ? '' : 'es'} from the pre-import rollback copy.`
            : 'No unambiguous Transfer Plan funding batch could be recovered from the pre-import rollback copy.',
        details: {
          recoveredBatches,
          recoveredTransactions,
          skippedAmbiguousBatches,
        },
      },
      ...(next.auditLogs || []),
    ];
  }

  return normalizeHousehold(next);
}

function normalizeHousehold(input: HouseholdData): HouseholdData {
  const state = clone(input);
  state.id = 'household-mv-local';
  state.name = state.name || 'Marius Household';

  const existingMembers = Array.isArray(state.members) ? state.members : [];
  const existingOwner = existingMembers.find(
    (member) =>
      member.id === 'local-marius' ||
      member.email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase()
  );
  const owner = {
    ...ownerMember(),
    ...(existingOwner || {}),
    id: 'local-marius',
    email: OWNER_EMAIL,
    name: existingOwner?.name || OWNER_NAME,
    role: 'owner' as const,
  };
  const otherMembers = existingMembers.filter(
    (member) =>
      member.id !== 'local-marius' &&
      member.email.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()
  );

  // Household members are the people whose finances are tracked. Infer any
  // referenced people from existing finance records exactly once unless that
  // person already has an active or removed household record.
  const knownNames = new Set(
    [owner, ...otherMembers].map((member) => member.name.trim().toLowerCase())
  );
  knownNames.add(OWNER_NAME.toLowerCase());

  const inferredMembers: HouseholdMember[] = referencedFinancialPeople(state)
    .filter((name) => !knownNames.has(name.trim().toLowerCase()))
    .map((name) => ({
      id: financeMemberId(name),
      email: financeMemberEmail(name),
      name,
      role: 'editor' as const,
      joinedAt: '2026-09-04T00:00:00.000Z',
      approvedAt: '2026-09-04T00:00:00.000Z',
      approvedBy: OWNER_EMAIL,
    }));

  state.members = [owner, ...otherMembers, ...inferredMembers];

  state.plannedIncomes = state.plannedIncomes || [];
  stripImportedNarrativeNotes(state);
  normalizeAccountOwnership(state);

  // Same-named bank accounts are distinguished by stable account ID and owner.
  // If a record is attached to the wrong owner's duplicate account, repair only
  // the deterministic case: same bank name + same account type + one unique
  // active account whose owner matches the financial person. This is a dev/test
  // dataset, so the repair applies to both imported and manually-created rows.
  repairDuplicateAccountRouting(state);

  state.accounts = state.accounts.map((account) => ({
    ...account,
    currency: 'GBP',
    currentBalancePence: calculateCurrentBalancePence(account, state.transactions),
  }));
  return state;
}

export function loadLocalHousehold(): HouseholdData {
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable. MV cannot safely save local data.');

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    // Production must never reconstruct household finances from source-code
    // fixtures. A new browser starts blank and the user can restore an explicit
    // MV backup when moving to another device.
    const blank = createBlankLocalHousehold();
    markSourceBudgetHandled(blank);
    saveLocalHousehold(blank);
    return normalizeHousehold(blank);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'Saved MV data could not be read. Import a valid backup or clear the damaged local copy.'
    );
  }

  assertHouseholdShape(parsed);

  // Historical clients used an embedded September seed. Preserve the user's
  // existing browser state exactly rather than reimporting or replacing it.
  // Recording the legacy migration marker only prevents older seed logic from
  // ever being reintroduced on this state.
  const normalized = normalizeHousehold(parsed);
  markSourceBudgetHandled(normalized);

  const recovered = recoverTransferPlanFundingFromSourceBackup(
    normalized,
    storage
  );

  storage.setItem(STORAGE_KEY, JSON.stringify(recovered));
  return recovered;
}

export function saveLocalHousehold(state: HouseholdData): void {
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable. MV could not save your changes.');
  const normalized = normalizeHousehold(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  globalThis.dispatchEvent?.(new CustomEvent(LOCAL_EVENT, { detail: normalized.version }));
}

function conflict(currentVersion: number): Error {
  const error: any = new Error(
    `Concurrent modification conflict: submitted version is stale. Current local version is ${currentVersion}.`
  );
  error.status = 409;
  error.serverVersion = currentVersion;
  return error;
}

function appendAudit(
  state: HouseholdData,
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'actorEmail'>
): void {
  state.auditLogs = [
    {
      id: createId('audit'),
      timestamp: nowIso(),
      actorEmail: OWNER_EMAIL,
      ...entry,
    },
    ...(state.auditLogs || []),
  ];
}

export function mutateLocalHousehold<T>(
  expectedVersion: number,
  audit: Omit<AuditLogEntry, 'id' | 'timestamp' | 'actorEmail'>,
  change: (state: HouseholdData) => T
): { value: T; state: HouseholdData } {
  const state = loadLocalHousehold();
  if (state.version !== expectedVersion) throw conflict(state.version);

  const draft = clone(state);
  const value = change(draft);
  draft.version = state.version + 1;
  appendAudit(draft, audit);
  const normalized = normalizeHousehold(draft);
  saveLocalHousehold(normalized);
  return { value, state: normalized };
}

function assertAccountExists(state: HouseholdData, accountId: string): Account {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) throw new Error('Account not found.');
  return account;
}

function assertActiveAccount(state: HouseholdData, accountId: string): Account {
  const account = assertAccountExists(state, accountId);
  if (account.isActive === false) {
    throw new Error('Archived accounts cannot receive new financial activity.');
  }
  return account;
}

function isActualIncomeEvidence(transaction: Transaction, incomeId: string): boolean {
  return (
    transaction.plannedIncomeId === incomeId &&
    transaction.type === 'income' &&
    !transaction.isTransfer &&
    !transaction.isRepayment &&
    !transaction.isSavings &&
    !transaction.isRefund
  );
}

function synchronizePlannedIncomeEvidence(
  state: HouseholdData,
  incomeId: string
): PlannedIncome | undefined {
  const incomes = state.plannedIncomes || [];
  const index = incomes.findIndex((income) => income.id === incomeId);
  if (index < 0) return undefined;

  const income = incomes[index];
  const receipts = state.transactions
    .filter((transaction) => isActualIncomeEvidence(transaction, incomeId))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.createdAt || '').localeCompare(b.createdAt || '') ||
        a.id.localeCompare(b.id)
    );

  if (receipts.length === 0) {
    const metadata = { ...(income.metadata || {}) };
    delete metadata.actualTransactionIds;
    delete metadata.actualReceiptCount;
    const reset: PlannedIncome = {
      ...income,
      status: 'expected',
      actualAmountPence: undefined,
      actualDate: undefined,
      actualTransactionId: undefined,
      linkedTransactionId: undefined,
      receivedDate: undefined,
      metadata,
      updatedAt: nowIso(),
      updatedBy: OWNER_EMAIL,
    };
    incomes[index] = reset;
    state.plannedIncomes = incomes;
    return reset;
  }

  const actualAmountPence = receipts.reduce(
    (sum, transaction) => sum + transaction.amountPence,
    0
  );
  const latest = receipts[receipts.length - 1];
  const next: PlannedIncome = {
    ...income,
    status:
      actualAmountPence < income.expectedAmountPence ? 'partial' : 'received',
    actualAmountPence,
    actualDate: latest.date,
    actualTransactionId: latest.id,
    linkedTransactionId: latest.id,
    receivedDate: latest.date,
    metadata: {
      ...(income.metadata || {}),
      actualTransactionIds: receipts.map((transaction) => transaction.id),
      actualReceiptCount: receipts.length,
    },
    updatedAt: nowIso(),
    updatedBy: OWNER_EMAIL,
  };
  incomes[index] = next;
  state.plannedIncomes = incomes;
  return next;
}

function assertCategoryExists(state: HouseholdData, categoryId: string): void {
  if (!state.categories.some((item) => item.id === categoryId)) {
    throw new Error('Category not found.');
  }
}

export function createLocalTransaction(
  data: Partial<Transaction>,
  expectedVersion: number
): { transaction: Transaction; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transaction_created',
      entityType: 'transaction',
      entityId: '',
      summary: data.description || 'Transaction created',
    },
    (state) => {
      if (!data.accountId) throw new Error('Account is required.');
      if (!data.type) throw new Error('Transaction type is required.');
      const isInternalTransfer = Boolean(
        data.isTransfer || data.type === 'transfer'
      );
      if (isInternalTransfer) {
        throw new Error(
          'Internal transfers must be recorded through the transfer workflow so both account balances stay traceable.'
        );
      }
      const isRepayment = Boolean(data.isRepayment || data.type === 'repayment');
      if (data.targetAccountId && !isRepayment) {
        throw new Error(
          'A destination account is only valid for an internal transfer or card repayment.'
        );
      }
      if (isRepayment) {
        if (!data.targetAccountId) {
          throw new Error('Card repayments require the credit account being repaid.');
        }
        if (data.targetAccountId === data.accountId) {
          throw new Error('Card repayment source and credit account must be different.');
        }
        const repaymentSource = assertActiveAccount(state, data.accountId);
        const repaymentTarget = assertActiveAccount(state, data.targetAccountId);
        if (repaymentSource.type === 'credit') {
          throw new Error('Card repayments must be funded from a cash-capable account.');
        }
        if (repaymentTarget.type !== 'credit') {
          throw new Error('Card repayment destination must be a credit account.');
        }
      }
      if (!data.payer) {
        throw new Error('Transaction person is required.');
      }
      if (data.plannedPaymentId || data.plannedIncomeId) {
        throw new Error(
          'Linked actual evidence must be recorded through the planned payment or planned income workflow.'
        );
      }
      if (data.isSavings) {
        throw new Error(
          'Savings classification is reserved for internal transfers and cannot hide ordinary income or spending.'
        );
      }
      const categoryId =
        data.categoryId ||
        (data.isTransfer || data.type === 'transfer' ? 'cat-transfer' : '');
      if (!categoryId) throw new Error('Category is required.');
      assertActiveAccount(state, data.accountId);
      assertCategoryExists(state, categoryId);
      if (!isSafePence(data.amountPence) || (data.amountPence ?? -1) < 0) {
        throw new Error('Transaction amount must be exact integer pence.');
      }
      if (data.targetAccountId) assertActiveAccount(state, data.targetAccountId);

      if (data.id && state.transactions.some((transaction) => transaction.id === data.id)) {
        throw new Error('A transaction with this ID already exists.');
      }
      const idempotencyKey = data.idempotencyKey?.trim();
      if (
        idempotencyKey &&
        state.transactions.some(
          (transaction) => transaction.idempotencyKey?.trim() === idempotencyKey
        )
      ) {
        throw new Error('Duplicate transaction request rejected.');
      }

      const tx: Transaction = {
        id: data.id || createId('tx'),
        date: data.date || localTodayDateKey(),
        description: data.description || 'Transaction',
        amountPence: data.amountPence!,
        type: isRepayment ? 'repayment' : data.type,
        categoryId,
        accountId: data.accountId,
        targetAccountId: data.targetAccountId,
        payer: data.payer,
        notes: data.notes,
        isTransfer: Boolean(data.isTransfer || data.type === 'transfer'),
        isRepayment,
        isSavings: Boolean(data.isSavings),
        isRefund: Boolean(data.isRefund || data.type === 'refund'),
        originalTransactionId: data.originalTransactionId,
        splits: data.splits,
        plannedPaymentId: data.plannedPaymentId,
        plannedIncomeId: data.plannedIncomeId,
        idempotencyKey,
        taxYear: data.taxYear,
        schemaVersion: data.schemaVersion,
        metadata: data.metadata,
        createdAt: data.createdAt || nowIso(),
        createdBy: OWNER_EMAIL,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };

      if (tx.splits?.length) {
        const total = tx.splits.reduce((sum, split) => sum + split.amountPence, 0);
        if (total !== tx.amountPence) throw new Error('Transaction split total must equal transaction amount.');
      }

      state.transactions.unshift(tx);
      return tx;
    }
  );
  return { transaction: result.value, version: result.state.version };
}

export function updateLocalTransaction(
  id: string,
  data: Partial<Transaction>,
  expectedVersion: number
): { transaction: Transaction; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transaction_updated',
      entityType: 'transaction',
      entityId: id,
      summary: data.description || 'Transaction updated',
    },
    (state) => {
      const index = state.transactions.findIndex((tx) => tx.id === id);
      if (index < 0) throw new Error('Transaction not found.');
      const existing = state.transactions[index];
      if (existing.metadata?.savingsGoalId) {
        throw new Error('Savings goal contributions must be managed from the Savings view.');
      }
      if (existing.isTransfer || existing.type === 'transfer') {
        throw new Error(
          'Internal transfers cannot be edited in place. Undo the exact transfer and record a corrected transfer instead.'
        );
      }

      if (
        data.plannedPaymentId !== undefined &&
        data.plannedPaymentId !== existing.plannedPaymentId
      ) {
        throw new Error('Linked planned-payment identity cannot be changed from Activity.');
      }
      if (
        data.plannedIncomeId !== undefined &&
        data.plannedIncomeId !== existing.plannedIncomeId
      ) {
        throw new Error('Linked planned-income identity cannot be changed from Activity.');
      }

      const next = { ...existing, ...data, id, updatedAt: nowIso(), updatedBy: OWNER_EMAIL };
      if (next.isTransfer || next.type === 'transfer') {
        throw new Error(
          'A normal Activity transaction cannot be converted into an internal transfer. Use the transfer workflow.'
        );
      }
      const nextIsRepayment = Boolean(next.isRepayment || next.type === 'repayment');
      if (next.targetAccountId && !nextIsRepayment) {
        throw new Error(
          'A destination account is only valid for an internal transfer or card repayment.'
        );
      }
      if (nextIsRepayment) {
        if (!next.targetAccountId) {
          throw new Error('Card repayments require the credit account being repaid.');
        }
        if (next.targetAccountId === next.accountId) {
          throw new Error('Card repayment source and credit account must be different.');
        }
        const repaymentSource =
          next.accountId === existing.accountId
            ? assertAccountExists(state, next.accountId)
            : assertActiveAccount(state, next.accountId);
        const repaymentTarget =
          next.targetAccountId === existing.targetAccountId
            ? assertAccountExists(state, next.targetAccountId)
            : assertActiveAccount(state, next.targetAccountId);
        if (repaymentSource.type === 'credit') {
          throw new Error('Card repayments must be funded from a cash-capable account.');
        }
        if (repaymentTarget.type !== 'credit') {
          throw new Error('Card repayment destination must be a credit account.');
        }
        next.type = 'repayment';
        next.isRepayment = true;
      }
      if (!isSafePence(next.amountPence) || next.amountPence < 0) {
        throw new Error('Transaction amount must be exact integer pence.');
      }

      if (
        existing.plannedPaymentId &&
        (next.type !== 'expense' || next.isTransfer || next.isRepayment || next.isSavings || next.isRefund)
      ) {
        throw new Error('A transaction linked to a paid bill must remain an expense.');
      }
      if (
        existing.plannedIncomeId &&
        (next.type !== 'income' || next.isTransfer || next.isRepayment || next.isSavings || next.isRefund)
      ) {
        throw new Error('A transaction linked to received income must remain income.');
      }
      if (next.accountId === existing.accountId) {
        assertAccountExists(state, next.accountId);
      } else {
        assertActiveAccount(state, next.accountId);
      }
      assertCategoryExists(state, next.categoryId);
      if (next.targetAccountId) {
        if (next.targetAccountId === existing.targetAccountId) {
          assertAccountExists(state, next.targetAccountId);
        } else {
          assertActiveAccount(state, next.targetAccountId);
        }
      }
      if (next.splits?.length) {
        const total = next.splits.reduce((sum, split) => sum + split.amountPence, 0);
        if (total !== next.amountPence) throw new Error('Transaction split total must equal transaction amount.');
      }
      state.transactions[index] = next;

      if (next.plannedPaymentId) {
        const paymentIndex = state.plannedPayments.findIndex(
          (payment) => payment.id === next.plannedPaymentId
        );
        if (paymentIndex >= 0) {
          state.plannedPayments[paymentIndex] = {
            ...state.plannedPayments[paymentIndex],
            actualAmountPence: next.amountPence,
            actualDate: next.date,
            actualTransactionId: next.id,
            accountId: next.accountId,
            categoryId: next.categoryId,
            responsiblePerson: next.payer,
            status: 'paid',
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }
      }

      if (next.plannedIncomeId) {
        synchronizePlannedIncomeEvidence(state, next.plannedIncomeId);
      }

      return next;
    }
  );
  return { transaction: result.value, version: result.state.version };
}

export function deleteLocalTransaction(id: string, expectedVersion: number): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transaction_deleted',
      entityType: 'transaction',
      entityId: id,
      summary: 'Transaction deleted',
    },
    (state) => {
      const existing = state.transactions.find((tx) => tx.id === id);
      if (!existing) throw new Error('Transaction not found.');
      if (existing.metadata?.savingsGoalId) {
        throw new Error('Savings goal contributions must be managed from the Savings view.');
      }
      if (existing.isTransfer || existing.type === 'transfer') {
        throw new Error(
          'Internal transfers cannot be deleted directly. Use the exact transfer undo workflow.'
        );
      }

      state.transactions = state.transactions.filter((tx) => tx.id !== id);

      if (existing.plannedPaymentId) {
        const paymentIndex = state.plannedPayments.findIndex(
          (payment) => payment.id === existing.plannedPaymentId
        );
        if (paymentIndex >= 0) {
          state.plannedPayments[paymentIndex] = {
            ...state.plannedPayments[paymentIndex],
            status: 'unpaid',
            actualAmountPence: undefined,
            actualDate: undefined,
            actualTransactionId: undefined,
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }
      }

      if (existing.plannedIncomeId) {
        synchronizePlannedIncomeEvidence(state, existing.plannedIncomeId);
      }
    }
  );
  return { version: result.state.version };
}

export function createLocalAccount(
  data: Partial<Account>,
  expectedVersion: number
): { account: Account; version: number } {
  const accountId = data.id || createId('account');
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_created',
      entityType: 'account',
      entityId: accountId,
      summary: data.name || 'Account created',
      details: {
        administrativeOnly: true,
        financialStateChanged: false,
      },
    },
    (state) => {
      if (!data.name?.trim()) throw new Error('Account name is required.');
      if (!data.type) throw new Error('Account type is required.');
      const starting = data.startingBalancePence ?? data.currentBalancePence ?? 0;
      if (!isSafePence(starting)) throw new Error('Starting balance must be exact integer pence.');
      const owner = resolveAccountOwnerForWrite(
        state,
        data.ownerMemberId,
        data.ownerPerson
      );
      if (state.accounts.some((account) => account.id === accountId)) {
        throw new Error('An account with this ID already exists.');
      }
      const account: Account = {
        id: accountId,
        name: data.name.trim(),
        type: data.type,
        currency: 'GBP',
        startingBalancePence: starting,
        currentBalancePence: starting,
        ownerMemberId: owner.ownerMemberId,
        ownerPerson: owner.ownerPerson,
        isActive: data.isActive !== false,
        reconciledAt: data.reconciledAt,
        reconciliationDate: data.reconciliationDate,
        reconciledBalancePence: data.reconciledBalancePence,
        creditLimitPence: data.creditLimitPence,
        balanceOwedPence: data.balanceOwedPence,
        notes: data.notes,
        schemaVersion: data.schemaVersion,
        metadata: data.metadata,
      };
      state.accounts.push(account);
      return account;
    }
  );
  return { account: result.value, version: result.state.version };
}

export function updateLocalAccount(
  id: string,
  data: Partial<Account>,
  expectedVersion: number
): { account: Account; version: number } {
  if (Object.prototype.hasOwnProperty.call(data, 'isActive')) {
    throw new Error('Use the dedicated archive or reactivate account action to change account status.');
  }
  const administrativeFields = new Set([
    'name',
    'type',
    'ownerMemberId',
    'ownerPerson',
    'notes',
  ]);
  const changedFields = Object.keys(data).filter((key) => key !== 'id' && key !== 'currency');
  const administrativeOnly = changedFields.every((key) => administrativeFields.has(key));
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_updated',
      entityType: 'account',
      entityId: id,
      summary: data.name || 'Account updated',
      details: {
        changedFields,
        administrativeOnly,
        financialStateChanged: !administrativeOnly,
      },
    },
    (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index < 0) throw new Error('Account not found.');

      const existingAccount = state.accounts[index];
      let ownerFields: Pick<Account, 'ownerMemberId' | 'ownerPerson'> = {
        ownerMemberId: existingAccount.ownerMemberId,
        ownerPerson: existingAccount.ownerPerson,
      };
      if (data.ownerMemberId !== undefined || data.ownerPerson !== undefined) {
        const isKeepingExistingStableOwner =
          Boolean(existingAccount.ownerMemberId) &&
          data.ownerMemberId === existingAccount.ownerMemberId &&
          data.ownerPerson === undefined;

        ownerFields = isKeepingExistingStableOwner
          ? {
              ownerMemberId: existingAccount.ownerMemberId,
              ownerPerson: existingAccount.ownerPerson,
            }
          : resolveAccountOwnerForWrite(
              state,
              data.ownerMemberId,
              data.ownerPerson
            );
      }

      const next = {
        ...state.accounts[index],
        ...data,
        ...ownerFields,
        id,
        currency: 'GBP' as const,
      };
      if (!isSafePence(next.startingBalancePence)) throw new Error('Starting balance must be exact integer pence.');
      if (next.reconciledBalancePence !== undefined && !isSafePence(next.reconciledBalancePence)) {
        throw new Error('Reconciled balance must be exact integer pence.');
      }
      state.accounts[index] = next;
      return next;
    }
  );
  return { account: result.value, version: result.state.version };
}

export function archiveLocalAccount(
  id: string,
  expectedVersion: number
): { account: Account; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_archived',
      entityType: 'account',
      entityId: id,
      summary: 'Account archived; financial history preserved',
      details: {
        administrativeOnly: true,
        financialStateChanged: false,
      },
    },
    (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index < 0) throw new Error('Account not found.');
      const next = { ...state.accounts[index], isActive: false };
      state.accounts[index] = next;
      return next;
    }
  );
  return { account: result.value, version: result.state.version };
}

export function reactivateLocalAccount(
  id: string,
  expectedVersion: number
): { account: Account; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_reactivated',
      entityType: 'account',
      entityId: id,
      summary: 'Account reactivated',
      details: {
        administrativeOnly: true,
        financialStateChanged: false,
      },
    },
    (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index < 0) throw new Error('Account not found.');
      const next = { ...state.accounts[index], isActive: true };
      state.accounts[index] = next;
      return next;
    }
  );
  return { account: result.value, version: result.state.version };
}

export function permanentlyDeleteLocalAccount(
  id: string,
  expectedVersion: number
): { version: number } {
  const current = loadLocalHousehold();
  const target = current.accounts.find((account) => account.id === id);
  if (!target) throw new Error('Account not found.');

  const initialEligibility = getAccountPermanentDeleteEligibility(current, id);
  const auditSummary = `Permanently deleted unused account: ${target.name} · ${target.type} · ${target.ownerPerson || 'Unassigned'}`;

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_permanently_deleted',
      entityType: 'system',
      entityId: current.id,
      summary: auditSummary,
      details: {
        removedIsolatedSetupBalancePence: initialEligibility.isolatedSetupBalancePence,
      },
    },
    (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index < 0) throw new Error('Account not found.');

      const eligibility = getAccountPermanentDeleteEligibility(state, id);
      if (!eligibility.canDeletePermanently) {
        throw new Error(
          `This account cannot be permanently deleted. ${eligibility.reasons.join(' ')} Archive it instead.`
        );
      }

      if (eligibility.removableAuditLogIds.length > 0) {
        const harmlessAuditIds = new Set(eligibility.removableAuditLogIds);
        state.auditLogs = state.auditLogs.filter(
          (entry) => !harmlessAuditIds.has(entry.id)
        );
      }

      state.accounts.splice(index, 1);
    }
  );
  return { version: result.state.version };
}

/** @deprecated Use archiveLocalAccount or permanentlyDeleteLocalAccount explicitly. */
export function deleteLocalAccount(id: string, expectedVersion: number): { version: number } {
  return permanentlyDeleteLocalAccount(id, expectedVersion);
}

export function reconcileLocalAccount(
  id: string,
  reconciledBalancePence: number,
  reconciliationDate: string,
  expectedVersion: number
): { account: Account; version: number } {
  if (!isSafePence(reconciledBalancePence)) {
    throw new Error('Reconciled balance must be exact integer pence.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reconciliationDate)) {
    throw new Error('Reconciliation date must use YYYY-MM-DD format.');
  }

  const current = loadLocalHousehold();
  const account = current.accounts.find((candidate) => candidate.id === id);
  if (!account) throw new Error('Account not found.');

  const discrepancyPence =
    reconciledBalancePence - account.currentBalancePence;
  const zeroEffect =
    account.startingBalancePence === 0 &&
    account.currentBalancePence === 0 &&
    (account.balanceOwedPence ?? 0) === 0 &&
    reconciledBalancePence === 0 &&
    discrepancyPence === 0;

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_reconciled',
      entityType: 'account',
      entityId: id,
      summary: zeroEffect
        ? 'Account reconciled with no financial effect'
        : 'Account reconciliation recorded',
      details: {
        currentBalancePence: account.currentBalancePence,
        reconciledBalancePence,
        discrepancyPence,
        zeroEffect,
        createdFinancialTransaction: false,
      },
    },
    (state) => {
      const index = state.accounts.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw new Error('Account not found.');

      const next = {
        ...state.accounts[index],
        reconciledBalancePence,
        reconciliationDate,
        reconciledAt: nowIso(),
      };
      state.accounts[index] = next;
      return next;
    }
  );

  return { account: result.value, version: result.state.version };
}

function plannedPaymentFromPartial(data: Partial<PlannedPayment>): PlannedPayment {
  if (!data.name?.trim()) throw new Error('Bill name is required.');
  if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) throw new Error('Valid month is required.');
  if (!data.accountId) throw new Error('Payment account is required.');
  if (!isSafePence(data.amountPence) || (data.amountPence ?? -1) < 0) {
    throw new Error('Bill amount must be exact integer pence.');
  }
  return {
    id: data.id || createId('bill'),
    name: data.name.trim(),
    amountPence: data.amountPence!,
    actualAmountPence: data.actualAmountPence,
    actualDate: data.actualDate,
    actualTransactionId: data.actualTransactionId,
    month: data.month,
    responsiblePerson: data.responsiblePerson || 'Marius',
    accountId: data.accountId,
    dueDate: data.dueDate,
    categoryId: data.categoryId,
    status: data.status || 'unpaid',
    includeInTransferPlan: data.includeInTransferPlan !== false,
    isRecurring: data.isRecurring === true,
    notes: data.notes,
    schemaVersion: data.schemaVersion,
    metadata: data.metadata,
    createdAt: data.createdAt || nowIso(),
    createdBy: data.createdBy || OWNER_EMAIL,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  };
}

export function createLocalPlannedPayment(
  data: Partial<PlannedPayment>,
  expectedVersion: number
): { payment: PlannedPayment; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payment_created',
      entityType: 'planned_payment',
      entityId: '',
      summary: data.name || 'Planned bill created',
    },
    (state) => {
      if (!data.responsiblePerson?.trim()) {
        throw new Error('Responsible person is required.');
      }
      if (
        data.status === 'paid' ||
        data.actualTransactionId !== undefined ||
        data.actualAmountPence !== undefined ||
        data.actualDate !== undefined
      ) {
        throw new Error(
          'New bills must start unpaid. Record the actual payment through the Mark Paid workflow.'
        );
      }

      const payment = plannedPaymentFromPartial({
        ...data,
        status: 'unpaid',
        includeInTransferPlan: data.includeInTransferPlan === true,
      });
      assertActiveAccount(state, payment.accountId);
      if (payment.categoryId) assertCategoryExists(state, payment.categoryId);
      if (state.plannedPayments.some((item) => item.id === payment.id)) {
        throw new Error('A planned payment with this ID already exists.');
      }
      state.plannedPayments.push(payment);
      return payment;
    }
  );
  return { payment: result.value, version: result.state.version };
}

export function updateLocalPlannedPayment(
  id: string,
  data: Partial<PlannedPayment>,
  expectedVersion: number
): { payment: PlannedPayment; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payment_updated',
      entityType: 'planned_payment',
      entityId: id,
      summary: data.name || 'Planned bill updated',
    },
    (state) => {
      const index = state.plannedPayments.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Planned bill not found.');

      const existing = state.plannedPayments[index];
      const linkedActual = existing.actualTransactionId
        ? state.transactions.find(
            (tx) =>
              tx.id === existing.actualTransactionId &&
              tx.plannedPaymentId === existing.id &&
              tx.type === 'expense' &&
              !tx.isTransfer &&
              !tx.isRepayment &&
              !tx.isSavings &&
              !tx.isRefund
          )
        : undefined;

      if (existing.actualTransactionId && !linkedActual) {
        throw new Error(
          'This bill references a missing actual payment transaction. Resolve the linked transaction before editing the bill.'
        );
      }

      if (
        data.actualTransactionId !== undefined ||
        data.actualAmountPence !== undefined ||
        data.actualDate !== undefined
      ) {
        throw new Error(
          'Actual payment evidence cannot be edited from the bill form. Edit the linked Activity transaction instead.'
        );
      }

      if (data.status === 'paid' && !linkedActual) {
        throw new Error(
          'A bill can only be marked paid by recording its actual payment.'
        );
      }

      if (data.status === 'unpaid' && linkedActual) {
        throw new Error(
          'A bill with a linked actual expense transaction cannot be marked unpaid.'
        );
      }

      const next = plannedPaymentFromPartial({ ...existing, ...data, id });

      if (linkedActual) {
        next.status = 'paid';
        next.actualAmountPence = linkedActual.amountPence;
        next.actualDate = linkedActual.date;
        next.actualTransactionId = linkedActual.id;
      } else {
        next.status = 'unpaid';
        next.actualAmountPence = undefined;
        next.actualDate = undefined;
        next.actualTransactionId = undefined;
      }

      next.updatedAt = nowIso();
      next.updatedBy = OWNER_EMAIL;
      if (next.accountId === existing.accountId) {
        assertAccountExists(state, next.accountId);
      } else {
        assertActiveAccount(state, next.accountId);
      }
      if (next.categoryId) assertCategoryExists(state, next.categoryId);
      state.plannedPayments[index] = next;
      return next;
    }
  );
  return { payment: result.value, version: result.state.version };
}

export function deleteLocalPlannedPayment(id: string, expectedVersion: number): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payment_deleted',
      entityType: 'planned_payment',
      entityId: id,
      summary: 'Planned bill deleted',
    },
    (state) => {
      const item = state.plannedPayments.find((payment) => payment.id === id);
      if (!item) throw new Error('Planned bill not found.');
      if (item.actualTransactionId) {
        throw new Error('Cannot delete a bill already linked to an actual transaction.');
      }
      state.plannedPayments = state.plannedPayments.filter((payment) => payment.id !== id);
    }
  );
  return { version: result.state.version };
}

export function bulkToggleLocalPlannedPayments(
  params: {
    month?: string;
    include: boolean;
    onlyUnpaid?: boolean;
    status?: 'paid' | 'unpaid';
    paymentIds?: string[];
  },
  expectedVersion: number
): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_bulk_updated',
      entityType: 'transfer_plan',
      entityId: params.month || 'selection',
      summary: 'Transfer Plan inclusion updated',
    },
    (state) => {
      const ids = params.paymentIds ? new Set(params.paymentIds) : null;
      state.plannedPayments = state.plannedPayments.map((payment) => {
        if (params.month && payment.month !== params.month) return payment;
        if (ids && !ids.has(payment.id)) return payment;
        // Transfer Plan bulk selection follows explicit Plan status only.
        // Linked Activity evidence must not silently change Plan inclusion.
        const isPaid = payment.status === 'paid';
        if (params.onlyUnpaid && isPaid) return payment;

        if (params.status) {
          const matchesStatus =
            params.status === 'paid' ? isPaid : !isPaid;
          return {
            ...payment,
            // "Select Paid" / "Select Unpaid" are exclusive selections:
            // matching rows are selected and the opposite status is cleared.
            includeInTransferPlan: params.include ? matchesStatus : matchesStatus ? false : payment.includeInTransferPlan,
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }

        return {
          ...payment,
          includeInTransferPlan: params.include,
          updatedAt: nowIso(),
          updatedBy: OWNER_EMAIL,
        };
      });
    }
  );
  return { version: result.state.version };
}

export function executeLocalTransfer(
  payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description?: string;
    date?: string;
    payer?: string;
    idempotencyKey?: string;
    commitmentMonth?: string;
  },
  expectedVersion: number
): { transaction: Transaction; version: number } {
  if (payload.sourceAccountId === payload.destinationAccountId) {
    throw new Error('Source and destination accounts must be different.');
  }
  if (!isSafePence(payload.amountPence) || payload.amountPence <= 0) {
    throw new Error('Transfer amount must be exact positive integer pence.');
  }

  const transferDate = payload.date || localTodayDateKey();
  const commitmentMonth = normalizeCommitmentMonth(
    payload.commitmentMonth,
    transferDate
  );
  const idempotencyKey = payload.idempotencyKey?.trim();

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_created',
      entityType: 'transaction',
      entityId: '',
      summary: payload.description || 'Internal transfer',
    },
    (state) => {
      const source = assertAccountExists(state, payload.sourceAccountId);
      const destination = assertAccountExists(state, payload.destinationAccountId);

      if (source.isActive === false) throw new Error('Funding source account is unavailable.');
      if (destination.isActive === false) throw new Error('Destination account is unavailable.');
      if (source.type === 'credit') {
        throw new Error('Credit accounts cannot be used as transfer funding sources.');
      }
      const { safeToMovePence, committedPence } = calculateSafeToMovePence(
        state,
        source,
        commitmentMonth
      );
      if (safeToMovePence < payload.amountPence) {
        throw new Error(
          `Transfer exceeds safe-to-move balance after ${commitmentMonth} selected bill commitments (${committedPence} pence committed; ${safeToMovePence} pence safe to move).`
        );
      }

      const category = state.categories.find((item) => item.id === 'cat-transfer');
      if (!category) throw new Error('Internal Transfer category is missing.');

      if (
        idempotencyKey &&
        state.transactions.some(
          (transaction) => transaction.idempotencyKey?.trim() === idempotencyKey
        )
      ) {
        throw new Error('Duplicate transfer request rejected.');
      }

      adjustAnchoredBalanceForNewTransfer(source, -payload.amountPence, transferDate);
      adjustAnchoredBalanceForNewTransfer(destination, payload.amountPence, transferDate);

      const tx: Transaction = {
        id: createId('tx'),
        accountId: payload.sourceAccountId,
        targetAccountId: payload.destinationAccountId,
        amountPence: payload.amountPence,
        description: payload.description || 'Internal transfer',
        date: transferDate,
        payer: payload.payer || source.ownerPerson || 'Joint',
        categoryId: category.id,
        type: 'transfer',
        isTransfer: true,
        isRepayment: false,
        isSavings:
          source.type === 'savings' ||
          source.type === 'cash' ||
          destination.type === 'savings' ||
          destination.type === 'cash',
        isRefund: false,
        idempotencyKey,
        metadata: {
          commitmentMonth,
        },
        createdAt: nowIso(),
        createdBy: OWNER_EMAIL,
      };

      state.transactions.unshift(tx);
      return tx;
    }
  );

  return { transaction: result.value, version: result.state.version };
}


export function undoLocalTransferTransaction(
  id: string,
  expectedVersion: number
): { transaction: Transaction; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_undone',
      entityType: 'transaction',
      entityId: id,
      summary: 'Internal transfer undone exactly',
    },
    (state) => {
      const transaction = state.transactions.find((candidate) => candidate.id === id);
      if (!transaction) throw new Error('Transfer transaction not found.');
      if (
        !transaction.isTransfer ||
        transaction.type !== 'transfer' ||
        !transaction.targetAccountId
      ) {
        throw new Error('Only a complete internal transfer can be undone with this workflow.');
      }
      if (transaction.metadata?.savingsGoalId) {
        throw new Error('Savings transfers must be managed from the Savings view.');
      }
      if (
        transaction.metadata?.transferBatchId ||
        transaction.metadata?.transferPlanMonth
      ) {
        throw new Error('Transfer Plan funding must be undone from the Transfer Plan.');
      }
      if (!isSafePence(transaction.amountPence) || transaction.amountPence <= 0) {
        throw new Error('Transfer amount is invalid; nothing was changed.');
      }

      const source = assertAccountExists(state, transaction.accountId);
      const destination = assertAccountExists(state, transaction.targetAccountId);

      // Generic transfers at/before a reconciliation anchor were folded into
      // that anchor when created. Undo must reverse those exact anchor deltas.
      adjustAnchoredBalanceForNewTransfer(
        source,
        transaction.amountPence,
        transaction.date
      );
      adjustAnchoredBalanceForNewTransfer(
        destination,
        -transaction.amountPence,
        transaction.date
      );

      state.transactions = state.transactions.filter(
        (candidate) => candidate.id !== transaction.id
      );

      return transaction;
    }
  );

  return { transaction: result.value, version: result.state.version };
}

export function executeLocalTransferAllocations(
  payload: {
    destinationAccountId: string;
    expectedTotalPence: number;
    allocations: Array<{
      sourceAccountId: string;
      amountPence: number;
    }>;
    description?: string;
    date?: string;
    month?: string;
  },
  expectedVersion: number
): { transactions: Transaction[]; version: number } {
  if (!Array.isArray(payload.allocations) || payload.allocations.length === 0) {
    throw new Error('At least one funding allocation is required.');
  }
  if (!isSafePence(payload.expectedTotalPence) || payload.expectedTotalPence <= 0) {
    throw new Error('Required transfer total must be exact positive integer pence.');
  }

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funded',
      entityType: 'account',
      entityId: payload.destinationAccountId,
      summary: `Transfer Plan funding allocated across ${payload.allocations.length} source account${
        payload.allocations.length === 1 ? '' : 's'
      }`,
    },
    (state) => {
      const destination = state.accounts.find(
        (account) => account.id === payload.destinationAccountId
      );
      if (!destination || destination.isActive === false) {
        throw new Error('Destination account is unavailable.');
      }
      let planMonthPayments: PlannedPayment[] | undefined;
      if (payload.month !== undefined) {
        if (!/^\d{4}-\d{2}$/.test(payload.month)) {
          throw new Error('Transfer Plan month must use YYYY-MM format.');
        }

        planMonthPayments = state.plannedPayments.filter(
          (payment) => payment.month === payload.month
        );
        const currentRequirement = calculateAccountFunding(
          destination,
          planMonthPayments,
          state.transactions
        );

        if (currentRequirement.transferRequiredPence !== payload.expectedTotalPence) {
          throw new Error(
            `Transfer Plan funding changed before submission. Current requirement is ${currentRequirement.transferRequiredPence} pence; refresh the plan before funding.`
          );
        }
      }

      const category = state.categories.find((item) => item.id === 'cat-transfer');
      if (!category) throw new Error('Internal Transfer category is missing.');

      const seenSources = new Set<string>();
      let allocatedTotalPence = 0;
      const validated = payload.allocations.map((allocation) => {
        if (seenSources.has(allocation.sourceAccountId)) {
          throw new Error('Each funding account can only appear once in an allocation.');
        }
        seenSources.add(allocation.sourceAccountId);

        if (allocation.sourceAccountId === payload.destinationAccountId) {
          throw new Error('A funding source cannot be the same as the destination account.');
        }
        if (!isSafePence(allocation.amountPence) || allocation.amountPence <= 0) {
          throw new Error('Every funding allocation must be exact positive integer pence.');
        }

        const source = state.accounts.find(
          (account) => account.id === allocation.sourceAccountId
        );
        if (!source || source.isActive === false) {
          throw new Error('One of the funding source accounts is unavailable.');
        }
        if (source.type === 'credit') {
          throw new Error('Credit accounts cannot be used as Transfer Plan funding sources.');
        }
        const reservedPlanPence = planMonthPayments
          ? calculateAccountFunding(source, planMonthPayments, state.transactions)
              .totalUnpaidSelectedPaymentsPence
          : 0;
        const safeToMovePence = Math.max(
          0,
          source.currentBalancePence - reservedPlanPence
        );
        if (safeToMovePence < allocation.amountPence) {
          throw new Error(
            `${source.name} has only ${safeToMovePence} pence safe to move after its own selected unpaid bills.`
          );
        }

        allocatedTotalPence += allocation.amountPence;
        return { source, amountPence: allocation.amountPence };
      });

      if (allocatedTotalPence !== payload.expectedTotalPence) {
        throw new Error(
          `Funding allocations must total exactly ${payload.expectedTotalPence} pence.`
        );
      }

      const batchId = createId('transfer-batch');
      const createdAt = nowIso();
      const date = payload.date || localTodayDateKey();

      for (const { source, amountPence } of validated) {
        const draftSource = state.accounts.find((account) => account.id === source.id)!;
        adjustAnchoredBalanceForNewTransfer(draftSource, -amountPence, date);
      }
      adjustAnchoredBalanceForNewTransfer(destination, allocatedTotalPence, date);

      const transactions = validated.map(({ source, amountPence }, index) => {
        const tx: Transaction = {
          id: createId('tx'),
          date,
          description:
            payload.description ||
            `Transfer Plan: Fund ${destination.name}`,
          amountPence,
          type: 'transfer',
          categoryId: category.id,
          accountId: source.id,
          targetAccountId: destination.id,
          payer: source.ownerPerson || 'Joint',
          isTransfer: true,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          metadata: {
            transferBatchId: batchId,
            transferPlanMonth: payload.month || date.slice(0, 7),
            allocationIndex: index,
            allocationCount: validated.length,
          },
          createdAt,
          createdBy: OWNER_EMAIL,
        };
        return tx;
      });

      state.transactions.unshift(...transactions);
      return transactions;
    }
  );

  return { transactions: result.value, version: result.state.version };
}

export function undoLatestLocalTransferPlanFunding(
  destinationAccountId: string,
  expectedVersion: number,
  month?: string
): {
  undoneTransactions: Transaction[];
  version: number;
} {
  const current = loadLocalHousehold();
  const fundingBatch = findLatestTransferPlanFundingBatch(
    current.transactions,
    destinationAccountId,
    month,
    true
  );

  if (!fundingBatch) {
    throw new Error(
      month
        ? `No Transfer Plan funding is available to undo for this account in ${month}.`
        : 'No Transfer Plan funding is available to undo for this account.'
    );
  }

  const targetTransactions = fundingBatch.transactions;

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funding_undone',
      entityType: 'account',
      entityId: destinationAccountId,
      summary: month
        ? `Undid Transfer Plan funding for destination account in ${month}`
        : 'Undid Transfer Plan funding for destination account',
    },
    (state) => {
      const destination = state.accounts.find(
        (account) => account.id === destinationAccountId
      );
      if (!destination) throw new Error('Destination account is unavailable.');

      const targetIds = new Set(targetTransactions.map((transaction) => transaction.id));
      const actualTransactions = state.transactions.filter((transaction) =>
        targetIds.has(transaction.id)
      );

      if (actualTransactions.length !== targetTransactions.length) {
        throw new Error(
          'Transfer Plan funding changed before it could be undone. Refresh and try again.'
        );
      }

      let destinationTotalPence = 0;

      for (const transaction of actualTransactions) {
        const source = state.accounts.find((account) => account.id === transaction.accountId);
        if (!source) throw new Error('A funding source account is unavailable.');

        adjustAnchoredBalanceForNewTransfer(
          source,
          transaction.amountPence,
          transaction.date
        );
        destinationTotalPence += transaction.amountPence;
      }

      if (destinationTotalPence > 0) {
        adjustAnchoredBalanceForNewTransfer(
          destination,
          -destinationTotalPence,
          actualTransactions[0].date
        );
      }

      state.transactions = state.transactions.filter(
        (transaction) => !targetIds.has(transaction.id)
      );

      return actualTransactions;
    }
  );

  return { undoneTransactions: result.value, version: result.state.version };
}

function plannedIncomeFromPartial(data: Partial<PlannedIncome>): PlannedIncome {
  if (!data.name?.trim()) throw new Error('Income name is required.');
  if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) throw new Error('Valid month is required.');
  if (!data.accountId) throw new Error('Income account is required.');
  if (!isSafePence(data.expectedAmountPence) || (data.expectedAmountPence ?? -1) < 0) {
    throw new Error('Expected income must be exact integer pence.');
  }
  if (
    data.actualAmountPence !== undefined &&
    (!isSafePence(data.actualAmountPence) || data.actualAmountPence < 0)
  ) {
    throw new Error('Actual income must be exact integer pence.');
  }
  return {
    id: data.id || createId('income'),
    name: data.name.trim(),
    expectedAmountPence: data.expectedAmountPence!,
    actualAmountPence: data.actualAmountPence,
    month: data.month,
    sourcePerson: data.sourcePerson || 'Marius',
    accountId: data.accountId,
    categoryId: data.categoryId,
    expectedDate: data.expectedDate,
    actualDate: data.actualDate,
    actualTransactionId: data.actualTransactionId,
    receivedDate: data.receivedDate,
    linkedTransactionId: data.linkedTransactionId,
    status: data.status || 'expected',
    notes: data.notes,
    schemaVersion: data.schemaVersion,
    metadata: data.metadata,
    createdAt: data.createdAt || nowIso(),
    createdBy: data.createdBy || OWNER_EMAIL,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  };
}

export function createLocalPlannedIncome(
  data: Partial<PlannedIncome>,
  expectedVersion: number
): { income: PlannedIncome; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_income_created',
      entityType: 'planned_income',
      entityId: '',
      summary: data.name || 'Planned income created',
    },
    (state) => {
      if (!data.sourcePerson?.trim()) {
        throw new Error('Income person is required.');
      }
      const income = plannedIncomeFromPartial(data);
      assertActiveAccount(state, income.accountId);
      if (income.categoryId) assertCategoryExists(state, income.categoryId);
      if ((state.plannedIncomes || []).some((item) => item.id === income.id)) {
        throw new Error('A planned income with this ID already exists.');
      }
      state.plannedIncomes = [...(state.plannedIncomes || []), income];
      return income;
    }
  );
  return { income: result.value, version: result.state.version };
}

export function updateLocalPlannedIncome(
  id: string,
  data: Partial<PlannedIncome>,
  expectedVersion: number
): { income: PlannedIncome; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_income_updated',
      entityType: 'planned_income',
      entityId: id,
      summary: data.name || 'Planned income updated',
    },
    (state) => {
      const incomes = state.plannedIncomes || [];
      const index = incomes.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Planned income not found.');
      const existing = incomes[index];

      for (const field of [
        'actualAmountPence',
        'actualDate',
        'actualTransactionId',
        'linkedTransactionId',
        'receivedDate',
        'status',
      ] as const) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          throw new Error(
            'Actual income evidence cannot be edited from the planned-income form. Edit the linked Activity receipt instead.'
          );
        }
      }

      const next = plannedIncomeFromPartial({ ...existing, ...data, id });
      next.updatedAt = nowIso();
      next.updatedBy = OWNER_EMAIL;

      if (next.accountId === existing.accountId) {
        assertAccountExists(state, next.accountId);
      } else {
        assertActiveAccount(state, next.accountId);
      }
      if (next.categoryId) assertCategoryExists(state, next.categoryId);

      incomes[index] = next;
      state.plannedIncomes = incomes;
      const reconciled = synchronizePlannedIncomeEvidence(state, id) || next;
      return reconciled;
    }
  );
  return { income: result.value, version: result.state.version };
}

export function deleteLocalPlannedIncome(id: string, expectedVersion: number): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_income_deleted',
      entityType: 'planned_income',
      entityId: id,
      summary: 'Planned income deleted',
    },
    (state) => {
      const item = (state.plannedIncomes || []).find((income) => income.id === id);
      if (!item) throw new Error('Planned income not found.');
      if (state.transactions.some((transaction) => isActualIncomeEvidence(transaction, id))) {
        throw new Error('Cannot delete planned income with actual receipt evidence.');
      }
      state.plannedIncomes = (state.plannedIncomes || []).filter((income) => income.id !== id);
    }
  );
  return { version: result.state.version };
}

export function contributeLocalSavingsGoal(
  payload: {
    goalId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    payer?: string;
    date?: string;
    commitmentMonth?: string;
  },
  expectedVersion: number
): { transaction: Transaction; goal: SavingsGoal; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'savings_goal_contribution',
      entityType: 'savings',
      entityId: payload.goalId,
      summary: 'Savings goal contribution recorded',
    },
    (state) => {
      const goal = state.savingsGoals.find((item) => item.id === payload.goalId);
      if (!goal) throw new Error('Savings goal not found.');

      const source = state.accounts.find((account) => account.id === payload.sourceAccountId);
      const destination = state.accounts.find(
        (account) => account.id === payload.destinationAccountId
      );

      if (!source || source.isActive === false) {
        throw new Error('Savings funding source account is unavailable.');
      }
      if (!destination || destination.isActive === false) {
        throw new Error('Savings destination account is unavailable.');
      }
      if (destination.type !== 'savings' && destination.type !== 'cash') {
        throw new Error('Savings contributions must go to an active Savings or Cash account.');
      }
      if (source.type === 'credit') {
        throw new Error('Credit accounts cannot be used to fund savings.');
      }
      if (source.id === destination.id) {
        throw new Error('Source account must be different from the savings destination.');
      }
      if (!isSafePence(payload.amountPence) || payload.amountPence <= 0) {
        throw new Error('Savings contribution must be exact positive integer pence.');
      }
      const date = payload.date || localTodayDateKey();
      const commitmentMonth = normalizeCommitmentMonth(
        payload.commitmentMonth,
        date
      );
      const { safeToMovePence, committedPence } = calculateSafeToMovePence(
        state,
        source,
        commitmentMonth
      );
      if (safeToMovePence < payload.amountPence) {
        throw new Error(
          `Savings transfer exceeds safe-to-move balance after ${commitmentMonth} selected bill commitments (${committedPence} pence committed; ${safeToMovePence} pence safe to move).`
        );
      }

      const category = state.categories.find((item) => item.id === 'cat-transfer');
      if (!category) throw new Error('Internal Transfer category is missing.');

      adjustAnchoredBalanceForNewTransfer(source, -payload.amountPence, date);
      adjustAnchoredBalanceForNewTransfer(destination, payload.amountPence, date);

      const transaction: Transaction = {
        id: createId('tx'),
        date,
        description: `Savings Contribution: ${goal.name}`,
        amountPence: payload.amountPence,
        type: 'transfer',
        categoryId: category.id,
        accountId: source.id,
        targetAccountId: destination.id,
        payer: payload.payer || source.ownerPerson || 'Joint',
        notes: 'Household savings contribution',
        isTransfer: true,
        isRepayment: false,
        isSavings: true,
        isRefund: false,
        metadata: {
          savingsGoalId: goal.id,
          commitmentMonth,
        },
        createdAt: nowIso(),
        createdBy: OWNER_EMAIL,
      };

      state.transactions.unshift(transaction);

      // Household goal progress is derived from all Savings + Cash balances.
      // The goal itself is intentionally unchanged by a transfer.
      return { transaction, goal };
    }
  );

  return {
    ...result.value,
    version: result.state.version,
  };
}

export function createLocalSavingsGoal(
  data: Partial<SavingsGoal>,
  expectedVersion: number
): { goal: SavingsGoal; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'savings_goal_created',
      entityType: 'savings',
      entityId: '',
      summary: data.name || 'Savings goal created',
    },
    (state) => {
      if (!data.name?.trim()) throw new Error('Savings goal name is required.');

      const targetPence = data.targetPence ?? 0;
      const monthlyPlanPence = data.monthlyPlanPence;

      if (!isSafePence(targetPence) || targetPence <= 0) {
        throw new Error('Savings goal target must be exact positive integer pence.');
      }
      if (
        monthlyPlanPence !== undefined &&
        (!isSafePence(monthlyPlanPence) || monthlyPlanPence < 0)
      ) {
        throw new Error('Monthly saving plan must be non-negative exact integer pence.');
      }

      const goalId = data.id || createId('goal');
      if (state.savingsGoals.some((goal) => goal.id === goalId)) {
        throw new Error('A savings goal with this ID already exists.');
      }
      const goal: SavingsGoal = {
        id: goalId,
        name: data.name.trim(),
        targetPence,
        currentPence: 0,
        targetDate: data.targetDate,
        monthlyPlanPence,
      };

      state.savingsGoals.push(goal);
      return goal;
    }
  );

  return { goal: result.value, version: result.state.version };
}

export function updateLocalSavingsGoal(
  id: string,
  data: Partial<SavingsGoal>,
  expectedVersion: number
): { goal: SavingsGoal; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'savings_goal_updated',
      entityType: 'savings',
      entityId: id,
      summary: data.name || 'Savings goal updated',
    },
    (state) => {
      const index = state.savingsGoals.findIndex((goal) => goal.id === id);
      if (index < 0) throw new Error('Savings goal not found.');

      const existing = state.savingsGoals[index];
      const next: SavingsGoal = {
        ...existing,
        id,
        name: data.name?.trim() || existing.name,
        targetPence: data.targetPence ?? existing.targetPence,
        targetDate:
          Object.prototype.hasOwnProperty.call(data, 'targetDate')
            ? data.targetDate
            : existing.targetDate,
        monthlyPlanPence:
          Object.prototype.hasOwnProperty.call(data, 'monthlyPlanPence')
            ? data.monthlyPlanPence
            : existing.monthlyPlanPence,
      };

      if (!isSafePence(next.targetPence) || next.targetPence <= 0) {
        throw new Error('Savings goal target must be exact positive integer pence.');
      }
      if (
        next.monthlyPlanPence !== undefined &&
        (!isSafePence(next.monthlyPlanPence) || next.monthlyPlanPence < 0)
      ) {
        throw new Error('Monthly saving plan must be non-negative exact integer pence.');
      }

      state.savingsGoals[index] = next;
      return next;
    }
  );

  return { goal: result.value, version: result.state.version };
}

export function deleteLocalSavingsGoal(id: string, expectedVersion: number): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'savings_goal_deleted',
      entityType: 'savings',
      entityId: id,
      summary: 'Savings goal deleted',
    },
    (state) => {
      const before = state.savingsGoals.length;
      state.savingsGoals = state.savingsGoals.filter((goal) => goal.id !== id);
      if (before === state.savingsGoals.length) throw new Error('Savings goal not found.');
    }
  );
  return { version: result.state.version };
}

function shiftDateToMonth(date: string | undefined, targetMonth: string): string | undefined {
  if (!date || date.length < 10) return date;
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error('Target month must use YYYY-MM format.');
  }

  const [yearText, monthText] = targetMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const sourceDay = Number(date.slice(8, 10));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(sourceDay) ||
    sourceDay < 1
  ) {
    throw new Error('Cannot shift an invalid calendar date.');
  }

  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(sourceDay, lastDay);
  return `${targetMonth}-${String(day).padStart(2, '0')}`;
}

export function markLocalPaymentPaid(
  id: string,
  payload: { actualAmountPence?: number; actualDate?: string; accountId?: string },
  expectedVersion: number,
  expectedPayment?: PlannedPaymentMutationExpectation
): { transaction: Transaction; payment: PlannedPayment; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payment_paid',
      entityType: 'planned_payment',
      entityId: id,
      summary: 'Planned bill marked paid with linked actual transaction',
    },
    (state) => {
      const index = state.plannedPayments.findIndex((payment) => payment.id === id);
      if (index < 0) throw new Error('Planned bill not found.');
      const payment = state.plannedPayments[index];
      if (expectedPayment) {
        assertPaymentMatchesExpectation(payment, expectedPayment);
      }
      if (payment.status === 'paid' && !payment.actualTransactionId) {
        throw new Error(
          'This legacy Paid bill has no exact linked Activity evidence. Nothing was changed.'
        );
      }
      assertNoPaymentEvidenceReference(state, payment);

      const accountId = payload.accountId || payment.accountId;
      assertActiveAccount(state, accountId);
      const categoryId = payment.categoryId || 'cat-housing';
      assertCategoryExists(state, categoryId);
      const amountPence = payload.actualAmountPence ?? payment.amountPence;
      if (!isSafePence(amountPence) || amountPence < 0) {
        throw new Error('Actual payment amount must be exact integer pence.');
      }
      const actualDate = payload.actualDate || payment.dueDate || `${payment.month}-01`;
      assertValidPaymentDate(actualDate);
      const tx: Transaction = {
        id: createId('tx'),
        date: actualDate,
        description: payment.name,
        amountPence,
        type: 'expense',
        categoryId,
        accountId,
        payer: payment.responsiblePerson,
        isTransfer: false,
        isRepayment: false,
        isSavings: false,
        isRefund: false,
        plannedPaymentId: payment.id,
        createdAt: nowIso(),
        createdBy: OWNER_EMAIL,
      };
      state.transactions.unshift(tx);
      const nextPayment: PlannedPayment = {
        ...payment,
        status: 'paid',
        actualAmountPence: amountPence,
        actualDate,
        actualTransactionId: tx.id,
        updatedAt: nowIso(),
        updatedBy: OWNER_EMAIL,
      };
      state.plannedPayments[index] = nextPayment;
      return { transaction: tx, payment: nextPayment };
    }
  );
  return { ...result.value, version: result.state.version };
}

export function undoLocalPaymentPaid(
  id: string,
  expectedVersion: number
): { transaction: Transaction; payment: PlannedPayment; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payment_paid_undone',
      entityType: 'planned_payment',
      entityId: id,
      summary: 'Recorded bill payment undone and linked actual transaction removed',
    },
    (state) => {
      const paymentIndex = state.plannedPayments.findIndex(
        (payment) => payment.id === id
      );
      if (paymentIndex < 0) throw new Error('Planned bill not found.');

      const payment = state.plannedPayments[paymentIndex];
      const linkedTransaction = requireUniqueLinkedPaymentEvidence(state, payment);

      state.transactions = state.transactions.filter(
        (transaction) => transaction.id !== linkedTransaction.id
      );

      const nextPayment: PlannedPayment = {
        ...payment,
        status: 'unpaid',
        actualAmountPence: undefined,
        actualDate: undefined,
        actualTransactionId: undefined,
        updatedAt: nowIso(),
        updatedBy: OWNER_EMAIL,
      };
      state.plannedPayments[paymentIndex] = nextPayment;

      return {
        transaction: linkedTransaction,
        payment: nextPayment,
      };
    }
  );

  return { ...result.value, version: result.state.version };
}

export function markLocalPaymentsPaid(
  expectations: PlannedPaymentMutationExpectation[],
  actualDate: string,
  expectedVersion: number
): { transactions: Transaction[]; payments: PlannedPayment[]; version: number } {
  if (!Array.isArray(expectations) || expectations.length === 0) {
    throw new Error('Select at least one unpaid bill.');
  }
  assertValidPaymentDate(actualDate);

  const uniqueById = new Map<string, PlannedPaymentMutationExpectation>();
  for (const expectation of expectations) {
    const existing = uniqueById.get(expectation.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(expectation)) {
      throw new Error(
        `Conflicting confirmation snapshots were supplied for ${expectation.name}. Nothing was changed.`
      );
    }
    uniqueById.set(expectation.id, expectation);
  }
  const uniqueExpectations = Array.from(uniqueById.values());

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payments_paid',
      entityType: 'planned_payment',
      entityId: uniqueExpectations.map((item) => item.id).join(','),
      summary: `${uniqueExpectations.length} planned bill payment${uniqueExpectations.length === 1 ? '' : 's'} recorded`,
      details: {
        paymentIds: uniqueExpectations.map((item) => item.id),
        actualDate,
      },
    },
    (state) => {
      const prepared = uniqueExpectations.map((expected) => {
        const index = state.plannedPayments.findIndex(
          (payment) => payment.id === expected.id
        );
        if (index < 0) throw new Error(`Planned bill not found: ${expected.id}`);

        const payment = state.plannedPayments[index];
        assertPaymentMatchesExpectation(payment, expected);

        if (payment.status === 'paid') {
          const linked = requireUniqueLinkedPaymentEvidence(state, payment);
          return { kind: 'existing' as const, index, payment, existing: linked };
        }

        assertNoPaymentEvidenceReference(state, payment);
        assertActiveAccount(state, payment.accountId);
        const categoryId = payment.categoryId || 'cat-housing';
        assertCategoryExists(state, categoryId);
        if (!isSafePence(payment.amountPence) || payment.amountPence < 0) {
          throw new Error(`${payment.name} does not have a valid exact-pence amount.`);
        }
        return { kind: 'new' as const, index, payment, categoryId };
      });

      const transactions: Transaction[] = [];
      const payments: PlannedPayment[] = [];

      for (const item of prepared) {
        if (item.kind === 'existing') {
          transactions.push(item.existing);
          payments.push(item.payment);
          continue;
        }

        const tx: Transaction = {
          id: createId('tx'),
          date: actualDate,
          description: item.payment.name,
          amountPence: item.payment.amountPence,
          type: 'expense',
          categoryId: item.categoryId,
          accountId: item.payment.accountId,
          payer: item.payment.responsiblePerson,
          isTransfer: false,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          plannedPaymentId: item.payment.id,
          createdAt: nowIso(),
          createdBy: OWNER_EMAIL,
        };

        const nextPayment: PlannedPayment = {
          ...item.payment,
          status: 'paid',
          actualAmountPence: item.payment.amountPence,
          actualDate,
          actualTransactionId: tx.id,
          updatedAt: nowIso(),
          updatedBy: OWNER_EMAIL,
        };

        state.transactions.unshift(tx);
        state.plannedPayments[item.index] = nextPayment;
        transactions.push(tx);
        payments.push(nextPayment);
      }

      return { transactions, payments };
    }
  );

  return { ...result.value, version: result.state.version };
}

export function undoLocalPaymentsPaid(
  expectations: PlannedPaymentMutationExpectation[],
  expectedVersion: number
): { transactions: Transaction[]; payments: PlannedPayment[]; version: number } {
  if (!Array.isArray(expectations) || expectations.length === 0) {
    throw new Error('Select at least one paid bill.');
  }

  const uniqueById = new Map<string, PlannedPaymentMutationExpectation>();
  for (const expectation of expectations) {
    const existing = uniqueById.get(expectation.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(expectation)) {
      throw new Error(
        `Conflicting confirmation snapshots were supplied for ${expectation.name}. Nothing was changed.`
      );
    }
    uniqueById.set(expectation.id, expectation);
  }
  const uniqueExpectations = Array.from(uniqueById.values());

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_payments_paid_undone',
      entityType: 'planned_payment',
      entityId: uniqueExpectations.map((item) => item.id).join(','),
      summary: `${uniqueExpectations.length} recorded bill payment${uniqueExpectations.length === 1 ? '' : 's'} undone`,
      details: { paymentIds: uniqueExpectations.map((item) => item.id) },
    },
    (state) => {
      const prepared = uniqueExpectations.map((expected) => {
        const paymentIndex = state.plannedPayments.findIndex(
          (payment) => payment.id === expected.id
        );
        if (paymentIndex < 0) throw new Error(`Planned bill not found: ${expected.id}`);

        const payment = state.plannedPayments[paymentIndex];
        assertPaymentMatchesExpectation(payment, expected);
        if (payment.status !== 'paid') {
          throw new Error(
            `${payment.name} is no longer Paid. Nothing was changed.`
          );
        }

        const linkedTransaction = requireUniqueLinkedPaymentEvidence(state, payment);
        return { paymentIndex, payment, linkedTransaction };
      });

      const transactionIds = new Set(
        prepared.map((item) => item.linkedTransaction.id)
      );
      state.transactions = state.transactions.filter(
        (transaction) => !transactionIds.has(transaction.id)
      );

      const payments: PlannedPayment[] = [];
      for (const item of prepared) {
        const nextPayment: PlannedPayment = {
          ...item.payment,
          status: 'unpaid',
          actualAmountPence: undefined,
          actualDate: undefined,
          actualTransactionId: undefined,
          updatedAt: nowIso(),
          updatedBy: OWNER_EMAIL,
        };
        state.plannedPayments[item.paymentIndex] = nextPayment;
        payments.push(nextPayment);
      }

      return {
        transactions: prepared.map((item) => item.linkedTransaction),
        payments,
      };
    }
  );

  return { ...result.value, version: result.state.version };
}

export function markLocalIncomeReceived(
  id: string,
  payload: { actualAmountPence?: number; actualDate?: string; accountId?: string },
  expectedVersion: number
): { transaction: Transaction; income: PlannedIncome; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'planned_income_received',
      entityType: 'planned_income',
      entityId: id,
      summary: 'Actual income receipt recorded and linked to planned income',
    },
    (state) => {
      const incomes = state.plannedIncomes || [];
      const index = incomes.findIndex((income) => income.id === id);
      if (index < 0) throw new Error('Planned income not found.');
      const income = incomes[index];

      const existingReceipts = state.transactions.filter((transaction) =>
        isActualIncomeEvidence(transaction, income.id)
      );
      const receivedSoFarPence = existingReceipts.reduce(
        (sum, transaction) => sum + transaction.amountPence,
        0
      );
      if (
        existingReceipts.length > 0 &&
        receivedSoFarPence >= income.expectedAmountPence
      ) {
        throw new Error('Planned income is already fully received.');
      }

      const accountId = payload.accountId || income.accountId;
      assertActiveAccount(state, accountId);
      const categoryId = income.categoryId || 'cat-salary';
      assertCategoryExists(state, categoryId);
      const amountPence =
        payload.actualAmountPence ??
        Math.max(0, income.expectedAmountPence - receivedSoFarPence);
      if (!isSafePence(amountPence) || amountPence <= 0) {
        throw new Error('Actual income receipt must be exact positive integer pence.');
      }
      const actualDate =
        payload.actualDate || income.expectedDate || `${income.month}-01`;

      const tx: Transaction = {
        id: createId('tx'),
        date: actualDate,
        description: income.name,
        amountPence,
        type: 'income',
        categoryId,
        accountId,
        payer: income.sourcePerson,
        isTransfer: false,
        isRepayment: false,
        isSavings: false,
        isRefund: false,
        plannedIncomeId: income.id,
        createdAt: nowIso(),
        createdBy: OWNER_EMAIL,
      };
      state.transactions.unshift(tx);
      const nextIncome = synchronizePlannedIncomeEvidence(state, income.id);
      if (!nextIncome) throw new Error('Planned income could not be reconciled.');

      return { transaction: tx, income: nextIncome };
    }
  );
  return { ...result.value, version: result.state.version };
}

export function importLocalMonth(
  params: {
    sourceMonth: string;
    targetMonth: string;
    paymentIds?: string[];
    incomeIds?: string[];
  },
  expectedVersion: number
): {
  imported: number;
  importedPayments: number;
  importedIncomes: number;
  version: number;
} {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'month_imported',
      entityType: 'system',
      entityId: params.targetMonth,
      summary: `Prepared ${params.targetMonth} from ${params.sourceMonth}`,
    },
    (state) => {
      const selectedPaymentIds = params.paymentIds ? new Set(params.paymentIds) : null;
      const selectedIncomeIds = params.incomeIds ? new Set(params.incomeIds) : new Set<string>();

      const sourcePayments = state.plannedPayments.filter(
        (payment) =>
          payment.month === params.sourceMonth &&
          (!selectedPaymentIds || selectedPaymentIds.has(payment.id))
      );

      const sourceIncomes = (state.plannedIncomes || []).filter(
        (income) =>
          income.month === params.sourceMonth &&
          selectedIncomeIds.has(income.id)
      );

      let importedPayments = 0;
      let importedIncomes = 0;

      for (const payment of sourcePayments) {
        const copiedFromId = String(payment.metadata?.copiedFromId || payment.id);
        const normalizedName = payment.name.trim().toLowerCase();
        const exists = state.plannedPayments.some(
          (candidate) =>
            candidate.month === params.targetMonth &&
            (
              String(candidate.metadata?.copiedFromId || '') === copiedFromId ||
              (
                candidate.name.trim().toLowerCase() === normalizedName &&
                candidate.accountId === payment.accountId &&
                candidate.amountPence === payment.amountPence &&
                candidate.responsiblePerson === payment.responsiblePerson
              )
            )
        );
        if (exists) continue;

        state.plannedPayments.push({
          ...payment,
          id: createId('bill'),
          month: params.targetMonth,
          dueDate: shiftDateToMonth(payment.dueDate, params.targetMonth),
          status: 'unpaid',
          actualAmountPence: undefined,
          actualDate: undefined,
          actualTransactionId: undefined,
          createdAt: nowIso(),
          createdBy: OWNER_EMAIL,
          updatedAt: undefined,
          updatedBy: undefined,
          metadata: { ...(payment.metadata || {}), copiedFromId },
        });
        importedPayments += 1;
      }

      const incomes = state.plannedIncomes || [];
      for (const income of sourceIncomes) {
        const copiedFromId = String(income.metadata?.copiedFromId || income.id);
        const normalizedName = income.name.trim().toLowerCase();
        const exists = incomes.some(
          (candidate) =>
            candidate.month === params.targetMonth &&
            (
              String(candidate.metadata?.copiedFromId || '') === copiedFromId ||
              (
                candidate.name.trim().toLowerCase() === normalizedName &&
                candidate.accountId === income.accountId &&
                candidate.expectedAmountPence === income.expectedAmountPence &&
                candidate.sourcePerson === income.sourcePerson
              )
            )
        );
        if (exists) continue;

        incomes.push({
          ...income,
          id: createId('income'),
          month: params.targetMonth,
          expectedDate: shiftDateToMonth(income.expectedDate, params.targetMonth),
          status: 'expected',
          actualAmountPence: undefined,
          actualDate: undefined,
          actualTransactionId: undefined,
          linkedTransactionId: undefined,
          receivedDate: undefined,
          createdAt: nowIso(),
          createdBy: OWNER_EMAIL,
          updatedAt: undefined,
          updatedBy: undefined,
          metadata: { ...(income.metadata || {}), copiedFromId },
        });
        importedIncomes += 1;
      }

      state.plannedIncomes = incomes;

      return {
        importedPayments,
        importedIncomes,
        imported: importedPayments + importedIncomes,
      };
    }
  );

  return {
    ...result.value,
    version: result.state.version,
  };
}

export function createLocalHouseholdMember(
  data: Pick<HouseholdMember, 'name'> & {
    email?: string;
    role?: 'editor' | 'view_only' | 'pending';
  },
  expectedVersion: number
): { member: HouseholdMember; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'member_created',
      entityType: 'member',
      entityId: '',
      summary: data.name || data.email || 'Household member added',
    },
    (state) => {
      const name = data.name?.trim();
      if (!name) throw new Error('Household member name is required.');

      const normalizedName = name.toLowerCase();
      if (
        state.members.some(
          (member) => member.name.trim().toLowerCase() === normalizedName && member.role !== 'removed'
        )
      ) {
        throw new Error('A household member with this name already exists.');
      }

      const providedEmail = data.email?.trim().toLowerCase();
      if (providedEmail && !providedEmail.includes('@')) {
        throw new Error('Household member email is invalid.');
      }
      const email = providedEmail || financeMemberEmail(name);

      const existingRemoved = state.members.find(
        (member) =>
          member.name.trim().toLowerCase() === normalizedName && member.role === 'removed'
      );
      const member: HouseholdMember = existingRemoved
        ? {
            ...existingRemoved,
            name,
            email: providedEmail || existingRemoved.email || email,
            role: data.role || 'editor',
            approvedAt: nowIso(),
            approvedBy: OWNER_EMAIL,
            lastActiveAt: undefined,
          }
        : {
            id: financeMemberId(name),
            email,
            name,
            role: data.role || 'editor',
            joinedAt: nowIso(),
            approvedAt: data.role === 'pending' ? undefined : nowIso(),
            approvedBy: data.role === 'pending' ? undefined : OWNER_EMAIL,
          };

      state.members = existingRemoved
        ? state.members.map((item) => (item.id === existingRemoved.id ? member : item))
        : [...state.members, member];
      return member;
    }
  );
  return { member: result.value, version: result.state.version };
}

export function updateLocalHouseholdMember(
  memberId: string,
  data: { name?: string; email?: string },
  expectedVersion: number
): { member: HouseholdMember; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'member_updated',
      entityType: 'member',
      entityId: memberId,
      summary: 'Household member details updated',
    },
    (state) => {
      const index = state.members.findIndex((member) => member.id === memberId);
      if (index < 0) throw new Error('Household member not found.');
      if (state.members[index].role === 'owner') {
        throw new Error('The household owner identity cannot be edited here.');
      }

      const previousName = state.members[index].name;
      const name = data.name?.trim() || previousName;
      const email = (data.email?.trim().toLowerCase() || state.members[index].email).trim();
      if (!name) throw new Error('Household member name is required.');
      if (!email || !email.includes('@')) throw new Error('Household member email is invalid.');

      const normalizedName = name.toLowerCase();
      const duplicate = state.members.some(
        (member, candidateIndex) =>
          candidateIndex !== index &&
          member.role !== 'removed' &&
          member.name.trim().toLowerCase() === normalizedName
      );
      if (duplicate) throw new Error('Another household member already uses this name.');

      const next: HouseholdMember = { ...state.members[index], name, email };
      state.members[index] = next;
      renameFinancialPersonReferences(state, previousName, name);
      return next;
    }
  );
  return { member: result.value, version: result.state.version };
}

export function approveLocalHouseholdMember(
  memberId: string,
  role: 'editor' | 'view_only',
  expectedVersion: number
): { member: HouseholdMember; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'member_approved',
      entityType: 'member',
      entityId: memberId,
      summary: `Household member approved as ${role}`,
    },
    (state) => {
      const index = state.members.findIndex((member) => member.id === memberId);
      if (index < 0) throw new Error('Household member not found.');
      if (state.members[index].role === 'owner') throw new Error('The household owner role cannot be changed.');
      const next: HouseholdMember = {
        ...state.members[index],
        role,
        approvedAt: nowIso(),
        approvedBy: OWNER_EMAIL,
      };
      state.members[index] = next;
      return next;
    }
  );
  return { member: result.value, version: result.state.version };
}

export function changeLocalHouseholdMemberRole(
  memberId: string,
  newRole: UserRole,
  expectedVersion: number
): { member: HouseholdMember; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'member_role_changed',
      entityType: 'member',
      entityId: memberId,
      summary: `Household member role changed to ${newRole}`,
    },
    (state) => {
      const index = state.members.findIndex((member) => member.id === memberId);
      if (index < 0) throw new Error('Household member not found.');
      if (state.members[index].role === 'owner') throw new Error('The household owner role cannot be changed.');
      if (newRole === 'owner') throw new Error('MV supports one household owner in local mode.');
      const next: HouseholdMember = {
        ...state.members[index],
        role: newRole,
        approvedAt:
          newRole === 'editor' || newRole === 'view_only'
            ? state.members[index].approvedAt || nowIso()
            : state.members[index].approvedAt,
        approvedBy:
          newRole === 'editor' || newRole === 'view_only'
            ? state.members[index].approvedBy || OWNER_EMAIL
            : state.members[index].approvedBy,
      };
      state.members[index] = next;
      return next;
    }
  );
  return { member: result.value, version: result.state.version };
}

export function removeLocalHouseholdMember(
  memberId: string,
  expectedVersion: number
): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'member_removed',
      entityType: 'member',
      entityId: memberId,
      summary: 'Household member removed',
    },
    (state) => {
      const index = state.members.findIndex((member) => member.id === memberId);
      if (index < 0) throw new Error('Household member not found.');
      if (state.members[index].role === 'owner') throw new Error('The household owner cannot be removed.');
      state.members[index] = { ...state.members[index], role: 'removed' };
    }
  );
  return { version: result.state.version };
}

export function getLocalPreferences(): UserPreferences {
  const storage = getStorage();
  if (!storage) {
    return {
      theme: 'light',
      accent: 'emerald',
      cardDensity: 'compact',
      cardRadius: 'subtle',
      cardBorder: 'subtle',
    };
  }
  try {
    const parsed = JSON.parse(storage.getItem(PREFS_KEY) || '{}');
    const normalized = normalizeUserPreferences(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      storage.setItem(PREFS_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return {
      theme: 'light',
      accent: 'emerald',
      cardDensity: 'compact',
      cardRadius: 'subtle',
      cardBorder: 'subtle',
    };
  }
}

export function saveLocalPreferences(preferences: UserPreferences): UserPreferences {
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable.');
  const normalized = normalizeUserPreferences(preferences);
  storage.setItem(PREFS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createLocalBackupPackage(): any {
  return {
    app: 'MV',
    storage: 'local-browser',
    formatVersion: 1,
    exportedAt: nowIso(),
    state: loadLocalHousehold(),
  };
}

function extractBackupState(payload: any): HouseholdData {
  const candidate = payload?.state ?? payload;
  const text = JSON.stringify(payload);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    throw new Error('Backup is larger than 5 MB.');
  }
  if (payload?.app && payload.app !== 'MV') throw new Error('This backup belongs to a different app.');
  assertHouseholdShape(candidate);
  assertBackupReferentialIntegrity(candidate);
  return normalizeHousehold(candidate);
}

export function preflightLocalRestore(payload: any): {
  valid: boolean;
  counts: Record<string, number>;
  checks: string[];
  summary: string;
} {
  const state = extractBackupState(payload);
  return {
    valid: true,
    counts: {
      accounts: state.accounts.length,
      categories: state.categories.length,
      transactions: state.transactions.length,
      savingsGoals: state.savingsGoals.length,
      plannedPayments: state.plannedPayments.length,
      plannedIncomes: (state.plannedIncomes || []).length,
      auditLogs: state.auditLogs.length,
    },
    checks: [
      'Recognised MV backup',
      'Exact integer-pence fields validated',
      'Transaction split totals validated',
      'Marius-only local owner identity enforced',
    ],
    summary: 'Backup is structurally valid for local MV restore.',
  };
}

export function restoreLocalBackup(payload: any, expectedVersion: number): { version: number } {
  const current = loadLocalHousehold();
  if (current.version !== expectedVersion) throw conflict(current.version);
  const restored = extractBackupState(payload);
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable.');
  storage.setItem(ROLLBACK_KEY, JSON.stringify(current));
  restored.version = current.version + 1;
  // An explicit restore is authoritative. Mark the retired legacy source seed
  // as handled so no future compatibility path can overwrite the restored backup.
  markSourceBudgetHandled(restored);
  appendAudit(restored, {
    action: 'database_restored',
    entityType: 'system',
    entityId: 'household-mv-local',
    summary: 'Local MV backup restored',
  });
  saveLocalHousehold(restored);
  return { version: restored.version };
}

export function resetLocalHousehold(expectedVersion: number): { version: number } {
  const current = loadLocalHousehold();
  if (current.version !== expectedVersion) throw conflict(current.version);
  const reset = createBlankLocalHousehold(current.version + 1);
  reset.auditLogs = current.auditLogs;
  // An explicit reset must stay blank. Production no longer embeds household source data.
  markSourceBudgetHandled(reset);
  appendAudit(reset, {
    action: 'household_reset',
    entityType: 'system',
    entityId: 'household-mv-local',
    summary: 'Local financial data reset to blank state',
  });
  saveLocalHousehold(reset);
  return { version: reset.version };
}

export function subscribeToLocalChanges(
  callback: (version: number, actorEmail: string) => void
): () => void {
  const localHandler = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail;
    callback(detail || loadLocalHousehold().version, OWNER_EMAIL);
  };
  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback(loadLocalHousehold().version, OWNER_EMAIL);
  };

  globalThis.addEventListener?.(LOCAL_EVENT, localHandler);
  globalThis.addEventListener?.('storage', storageHandler as EventListener);

  return () => {
    globalThis.removeEventListener?.(LOCAL_EVENT, localHandler);
    globalThis.removeEventListener?.('storage', storageHandler as EventListener);
  };
}

export const LOCAL_OWNER = {
  email: OWNER_EMAIL,
  name: OWNER_NAME,
  role: 'owner' as const,
  householdId: 'household-mv-local',
};

export const LOCAL_STORAGE_KEY = STORAGE_KEY;
export const SOURCE_IMPORT_BACKUP_STORAGE_KEY = SOURCE_IMPORT_BACKUP_KEY;
