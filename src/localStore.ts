import { JOINT_ACCOUNT_OWNER_ID } from './types';
import type {
  Account,
  AuditLogEntry,
  HouseholdData,
  HouseholdMember,
  Payer,
  PlannedIncome,
  PlannedPayment,
  SavingsGoal,
  Transaction,
  UserPreferences,
  UserRole,
} from './types';
import { normalizeUserPreferences } from './themeEngine';
import { createSourceBudgetHousehold, SOURCE_BUDGET_IMPORT_ID } from './sourceBudgetData';

const STORAGE_KEY = 'mv_local_state_v1';
const ROLLBACK_KEY = 'mv_local_state_before_restore_v1';
const SOURCE_IMPORT_BACKUP_KEY = 'mv_local_state_before_source_budget_import_v1';
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

function markSourceBudgetHandled(state: HouseholdData): void {
  const current = state.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };

  if (!current.appliedMigrations.some((migration) => migration.name === SOURCE_BUDGET_IMPORT_ID)) {
    current.appliedMigrations = [
      ...current.appliedMigrations,
      {
        version: 1,
        name: SOURCE_BUDGET_IMPORT_ID,
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
    const sourceHousehold = createSourceBudgetHousehold();
    saveLocalHousehold(sourceHousehold);
    return normalizeHousehold(sourceHousehold);
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

  const hasSourceBudget =
    parsed.schemaStatus?.appliedMigrations?.some(
      (migration) => migration.name === SOURCE_BUDGET_IMPORT_ID
    ) ?? false;

  if (!hasSourceBudget) {
    // Keep a one-time local rollback copy before replacing old/test finance data.
    // App-only savings goals are preserved when their linked account name exists
    // in the source workbook (for example a goal linked to Chase).
    storage.setItem(SOURCE_IMPORT_BACKUP_KEY, raw);
    const sourceHousehold = createSourceBudgetHousehold(parsed);
    saveLocalHousehold(sourceHousehold);
    return normalizeHousehold(sourceHousehold);
  }

  return normalizeHousehold(parsed);
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
  ].slice(0, 500);
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
      const categoryId =
        data.categoryId ||
        (data.isTransfer || data.type === 'transfer' ? 'cat-transfer' : '');
      if (!categoryId) throw new Error('Category is required.');
      assertAccountExists(state, data.accountId);
      assertCategoryExists(state, categoryId);
      if (!isSafePence(data.amountPence) || (data.amountPence ?? -1) < 0) {
        throw new Error('Transaction amount must be exact integer pence.');
      }
      if (data.targetAccountId) assertAccountExists(state, data.targetAccountId);

      const tx: Transaction = {
        id: data.id || createId('tx'),
        date: data.date || new Date().toISOString().slice(0, 10),
        description: data.description || 'Transaction',
        amountPence: data.amountPence!,
        type: data.type || 'expense',
        categoryId,
        accountId: data.accountId,
        targetAccountId: data.targetAccountId,
        payer: data.payer || 'Marius',
        notes: data.notes,
        isTransfer: Boolean(data.isTransfer || data.type === 'transfer'),
        isRepayment: Boolean(data.isRepayment || data.type === 'repayment'),
        isSavings: Boolean(data.isSavings),
        isRefund: Boolean(data.isRefund || data.type === 'refund'),
        originalTransactionId: data.originalTransactionId,
        splits: data.splits,
        plannedPaymentId: data.plannedPaymentId,
        plannedIncomeId: data.plannedIncomeId,
        idempotencyKey: data.idempotencyKey,
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

      const next = { ...existing, ...data, id, updatedAt: nowIso(), updatedBy: OWNER_EMAIL };
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
      assertAccountExists(state, next.accountId);
      assertCategoryExists(state, next.categoryId);
      if (next.targetAccountId) assertAccountExists(state, next.targetAccountId);
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
        const incomeIndex = (state.plannedIncomes || []).findIndex(
          (income) => income.id === next.plannedIncomeId
        );
        if (incomeIndex >= 0) {
          const linkedIncome = state.plannedIncomes[incomeIndex];
          state.plannedIncomes[incomeIndex] = {
            ...linkedIncome,
            actualAmountPence: next.amountPence,
            actualDate: next.date,
            actualTransactionId: next.id,
            linkedTransactionId: next.id,
            receivedDate: next.date,
            accountId: next.accountId,
            categoryId: next.categoryId,
            sourcePerson: next.payer,
            status:
              next.amountPence < linkedIncome.expectedAmountPence ? 'partial' : 'received',
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }
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
        const incomeIndex = (state.plannedIncomes || []).findIndex(
          (income) => income.id === existing.plannedIncomeId
        );
        if (incomeIndex >= 0) {
          state.plannedIncomes[incomeIndex] = {
            ...state.plannedIncomes[incomeIndex],
            status: 'expected',
            actualAmountPence: undefined,
            actualDate: undefined,
            actualTransactionId: undefined,
            linkedTransactionId: undefined,
            receivedDate: undefined,
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }
      }
    }
  );
  return { version: result.state.version };
}

export function createLocalAccount(
  data: Partial<Account>,
  expectedVersion: number
): { account: Account; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_created',
      entityType: 'account',
      entityId: '',
      summary: data.name || 'Account created',
    },
    (state) => {
      if (!data.name?.trim()) throw new Error('Account name is required.');
      const starting = data.startingBalancePence ?? data.currentBalancePence ?? 0;
      if (!isSafePence(starting)) throw new Error('Starting balance must be exact integer pence.');
      const owner = resolveAccountOwnerForWrite(
        state,
        data.ownerMemberId,
        data.ownerPerson
      );
      const account: Account = {
        id: data.id || createId('account'),
        name: data.name.trim(),
        type: data.type || 'current',
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
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_updated',
      entityType: 'account',
      entityId: id,
      summary: data.name || 'Account updated',
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

export function deleteLocalAccount(id: string, expectedVersion: number): { version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'account_deleted_or_archived',
      entityType: 'account',
      entityId: id,
      summary: 'Account removed from active use',
    },
    (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index < 0) throw new Error('Account not found.');
      const referenced =
        state.transactions.some((tx) => tx.accountId === id || tx.targetAccountId === id) ||
        state.plannedPayments.some((item) => item.accountId === id) ||
        (state.plannedIncomes || []).some((item) => item.accountId === id) ||
        state.savingsGoals.some((item) => item.accountId === id || item.linkedAccountId === id);
      if (referenced) state.accounts[index] = { ...state.accounts[index], isActive: false };
      else state.accounts.splice(index, 1);
    }
  );
  return { version: result.state.version };
}

export function reconcileLocalAccount(
  id: string,
  reconciledBalancePence: number,
  reconciliationDate: string,
  expectedVersion: number
): { account: Account; version: number } {
  return updateLocalAccount(
    id,
    {
      reconciledBalancePence,
      reconciliationDate,
      reconciledAt: nowIso(),
    },
    expectedVersion
  );
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
      const payment = plannedPaymentFromPartial(data);
      assertAccountExists(state, payment.accountId);
      if (payment.categoryId) assertCategoryExists(state, payment.categoryId);
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
      const next = plannedPaymentFromPartial({ ...state.plannedPayments[index], ...data, id });
      next.updatedAt = nowIso();
      next.updatedBy = OWNER_EMAIL;
      assertAccountExists(state, next.accountId);
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
  },
  expectedVersion: number
): { transaction: Transaction; version: number } {
  if (payload.sourceAccountId === payload.destinationAccountId) {
    throw new Error('Source and destination accounts must be different.');
  }
  const state = loadLocalHousehold();
  const source = state.accounts.find((account) => account.id === payload.sourceAccountId);
  const destination = state.accounts.find(
    (account) => account.id === payload.destinationAccountId
  );
  if (!source || source.isActive === false) throw new Error('Funding source account is unavailable.');
  if (!destination || destination.isActive === false) {
    throw new Error('Destination account is unavailable.');
  }
  if (source.type === 'credit') {
    throw new Error('Credit accounts cannot be used as Transfer Plan funding sources.');
  }
  if (!isSafePence(payload.amountPence) || payload.amountPence <= 0) {
    throw new Error('Transfer amount must be exact positive integer pence.');
  }
  if (source.currentBalancePence < payload.amountPence) {
    throw new Error('Funding source does not have enough available balance for this transfer.');
  }
  const category = state.categories.find((item) => item.id === 'cat-transfer');
  if (!category) throw new Error('Internal Transfer category is missing.');

  const transferDate = payload.date || new Date().toISOString().slice(0, 10);
  const sourceNeedsAnchorAdjustment =
    source.reconciliationDate &&
    Number.isSafeInteger(source.reconciledBalancePence) &&
    transferDate <= source.reconciliationDate;
  const destinationNeedsAnchorAdjustment =
    destination.reconciliationDate &&
    Number.isSafeInteger(destination.reconciledBalancePence) &&
    transferDate <= destination.reconciliationDate;

  if (sourceNeedsAnchorAdjustment || destinationNeedsAnchorAdjustment) {
    const result = mutateLocalHousehold(
      expectedVersion,
      {
        action: 'transfer_created',
        entityType: 'transaction',
        entityId: '',
        summary: payload.description || 'Internal transfer',
      },
      (draft) => {
        const draftSource = draft.accounts.find((account) => account.id === payload.sourceAccountId)!;
        const draftDestination = draft.accounts.find(
          (account) => account.id === payload.destinationAccountId
        )!;
        adjustAnchoredBalanceForNewTransfer(draftSource, -payload.amountPence, transferDate);
        adjustAnchoredBalanceForNewTransfer(draftDestination, payload.amountPence, transferDate);

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
          isSavings: false,
          isRefund: false,
          createdAt: nowIso(),
          createdBy: OWNER_EMAIL,
        };
        draft.transactions.unshift(tx);
        return tx;
      }
    );
    return { transaction: result.value, version: result.state.version };
  }

  return createLocalTransaction(
    {
      accountId: payload.sourceAccountId,
      targetAccountId: payload.destinationAccountId,
      amountPence: payload.amountPence,
      description: payload.description || 'Internal transfer',
      date: transferDate,
      payer: payload.payer || source.ownerPerson || 'Joint',
      categoryId: category.id,
      type: 'transfer',
      isTransfer: true,
      isSavings: false,
    },
    expectedVersion
  );
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
        if (source.currentBalancePence < allocation.amountPence) {
          throw new Error(
            `${source.name} does not have enough available balance for its allocation.`
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
      const date = payload.date || new Date().toISOString().slice(0, 10);

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
  expectedVersion: number
): {
  undoneTransactions: Transaction[];
  version: number;
} {
  const current = loadLocalHousehold();
  const candidates = current.transactions
    .filter(
      (transaction) =>
        transaction.targetAccountId === destinationAccountId &&
        transaction.type === 'transfer' &&
        transaction.isTransfer
    )
    .sort((a, b) => {
      const createdCompare = (b.createdAt || '').localeCompare(a.createdAt || '');
      if (createdCompare !== 0) return createdCompare;
      return b.date.localeCompare(a.date);
    });

  const latest = candidates[0];
  if (!latest) {
    throw new Error('No incoming funding transfer is available to undo for this account.');
  }

  const latestBatchId = latest.metadata?.transferBatchId as string | undefined;
  const targetTransactions = latestBatchId
    ? current.transactions.filter(
        (transaction) =>
          transaction.metadata?.transferBatchId === latestBatchId &&
          transaction.targetAccountId === destinationAccountId &&
          transaction.type === 'transfer' &&
          transaction.isTransfer
      )
    : [latest];

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funding_undone',
      entityType: 'account',
      entityId: destinationAccountId,
      summary: `Undid Transfer Plan funding for destination account`,
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
        throw new Error('Transfer Plan funding changed before it could be undone. Refresh and try again.');
      }

      let destinationTotalPence = 0;

      for (const transaction of actualTransactions) {
        const source = state.accounts.find((account) => account.id === transaction.accountId);
        if (!source) throw new Error('A funding source account is unavailable.');

        // Reverse the reconciliation-anchor adjustment that was applied when
        // the funding transfer was created.
        adjustAnchoredBalanceForNewTransfer(source, transaction.amountPence, transaction.date);
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
      const income = plannedIncomeFromPartial(data);
      assertAccountExists(state, income.accountId);
      if (income.categoryId) assertCategoryExists(state, income.categoryId);
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
      const next = plannedIncomeFromPartial({ ...incomes[index], ...data, id });
      next.updatedAt = nowIso();
      next.updatedBy = OWNER_EMAIL;
      assertAccountExists(state, next.accountId);
      if (next.categoryId) assertCategoryExists(state, next.categoryId);

      const linkedTransactionId = next.actualTransactionId || next.linkedTransactionId;
      if (linkedTransactionId) {
        const txIndex = state.transactions.findIndex((tx) => tx.id === linkedTransactionId);
        if (txIndex >= 0) {
          const linkedTx = state.transactions[txIndex];
          const syncedAmount = next.actualAmountPence ?? linkedTx.amountPence;
          const syncedDate = next.actualDate || next.receivedDate || linkedTx.date;
          const syncedCategoryId = next.categoryId || linkedTx.categoryId;

          assertCategoryExists(state, syncedCategoryId);
          state.transactions[txIndex] = {
            ...linkedTx,
            description: next.name,
            amountPence: syncedAmount,
            date: syncedDate,
            accountId: next.accountId,
            categoryId: syncedCategoryId,
            payer: next.sourcePerson,
            plannedIncomeId: next.id,
            updatedAt: nowIso(),
            updatedBy: OWNER_EMAIL,
          };
        }
      }

      incomes[index] = next;
      state.plannedIncomes = incomes;
      return next;
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
      if (item.actualTransactionId || item.linkedTransactionId) {
        throw new Error('Cannot delete planned income already linked to an actual transaction.');
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
    amountPence: number;
    payer?: string;
    date?: string;
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
      const goalIndex = state.savingsGoals.findIndex((goal) => goal.id === payload.goalId);
      if (goalIndex < 0) throw new Error('Savings goal not found.');

      const goal = state.savingsGoals[goalIndex];
      const source = state.accounts.find((account) => account.id === payload.sourceAccountId);
      const destination = state.accounts.find((account) => account.id === goal.accountId);

      if (!source || source.isActive === false) {
        throw new Error('Savings funding source account is unavailable.');
      }
      if (!destination || destination.isActive === false) {
        throw new Error('Savings destination account is unavailable.');
      }
      if (destination.type !== 'savings' && destination.type !== 'cash') {
        throw new Error('Savings goals must be linked to an active Savings or Cash account.');
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
      if (source.currentBalancePence < payload.amountPence) {
        throw new Error('Savings funding source does not have enough available balance.');
      }

      const category = state.categories.find((item) => item.id === 'cat-transfer');
      if (!category) throw new Error('Internal Transfer category is missing.');

      const date = payload.date || localTodayDateKey();

      // Keep reconciliation anchors consistent so the transfer changes visible
      // account balances even when the transfer date is on/before the anchor date.
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
        notes: 'Savings allocation',
        isTransfer: true,
        isRepayment: false,
        isSavings: true,
        isRefund: false,
        metadata: {
          savingsGoalId: goal.id,
        },
        createdAt: nowIso(),
        createdBy: OWNER_EMAIL,
      };

      state.transactions.unshift(transaction);

      const nextGoal: SavingsGoal = {
        ...goal,
        currentPence: goal.currentPence + payload.amountPence,
      };
      state.savingsGoals[goalIndex] = nextGoal;

      return { transaction, goal: nextGoal };
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
      if (!data.accountId) throw new Error('Savings account is required.');
      const linkedAccount = assertAccountExists(state, data.accountId);
      if (
        linkedAccount.isActive === false ||
        (linkedAccount.type !== 'savings' && linkedAccount.type !== 'cash')
      ) {
        throw new Error('Savings goals must be linked to an active Savings or Cash account.');
      }
      const targetPence = data.targetPence ?? 0;
      const currentPence = data.currentPence ?? 0;
      if (!isSafePence(targetPence) || !isSafePence(currentPence)) {
        throw new Error('Savings amounts must be exact integer pence.');
      }
      const goal: SavingsGoal = {
        id: data.id || createId('goal'),
        name: data.name.trim(),
        targetPence,
        currentPence,
        targetDate: data.targetDate,
        accountId: data.accountId,
        linkedAccountId: data.linkedAccountId,
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
      const next = { ...state.savingsGoals[index], ...data, id };
      if (!isSafePence(next.targetPence) || !isSafePence(next.currentPence)) {
        throw new Error('Savings amounts must be exact integer pence.');
      }
      const linkedAccount = assertAccountExists(state, next.accountId);
      if (
        linkedAccount.isActive === false ||
        (linkedAccount.type !== 'savings' && linkedAccount.type !== 'cash')
      ) {
        throw new Error('Savings goals must be linked to an active Savings or Cash account.');
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
  const day = date.slice(8, 10);
  return `${targetMonth}-${day}`;
}

export function markLocalPaymentPaid(
  id: string,
  payload: { actualAmountPence?: number; actualDate?: string; accountId?: string },
  expectedVersion: number
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
      if (payment.actualTransactionId) throw new Error('Planned bill is already linked to an actual transaction.');

      const accountId = payload.accountId || payment.accountId;
      assertAccountExists(state, accountId);
      const categoryId = payment.categoryId || 'cat-housing';
      assertCategoryExists(state, categoryId);
      const amountPence = payload.actualAmountPence ?? payment.amountPence;
      if (!isSafePence(amountPence) || amountPence < 0) {
        throw new Error('Actual payment amount must be exact integer pence.');
      }
      const actualDate = payload.actualDate || payment.dueDate || `${payment.month}-01`;
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
      summary: 'Planned income marked received with linked actual transaction',
    },
    (state) => {
      const incomes = state.plannedIncomes || [];
      const index = incomes.findIndex((income) => income.id === id);
      if (index < 0) throw new Error('Planned income not found.');
      const income = incomes[index];
      if (income.actualTransactionId || income.linkedTransactionId) {
        throw new Error('Planned income is already linked to an actual transaction.');
      }

      const accountId = payload.accountId || income.accountId;
      assertAccountExists(state, accountId);
      const categoryId = income.categoryId || 'cat-salary';
      assertCategoryExists(state, categoryId);
      const amountPence = payload.actualAmountPence ?? income.expectedAmountPence;
      if (!isSafePence(amountPence) || amountPence < 0) {
        throw new Error('Actual income amount must be exact integer pence.');
      }
      const actualDate = payload.actualDate || income.expectedDate || `${income.month}-01`;
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
      const nextIncome: PlannedIncome = {
        ...income,
        status: amountPence < income.expectedAmountPence ? 'partial' : 'received',
        actualAmountPence: amountPence,
        actualDate,
        actualTransactionId: tx.id,
        linkedTransactionId: tx.id,
        receivedDate: actualDate,
        updatedAt: nowIso(),
        updatedBy: OWNER_EMAIL,
      };
      incomes[index] = nextIncome;
      state.plannedIncomes = incomes;
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
  // An explicit restore is authoritative. Mark the source import as handled so
  // the one-time source seeding migration does not overwrite the restored backup.
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
  // An explicit reset must stay blank rather than immediately reimporting source data.
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
