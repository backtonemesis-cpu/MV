import type {
  Account,
  AuditLogEntry,
  HouseholdData,
  HouseholdMember,
  PlannedIncome,
  PlannedPayment,
  SavingsGoal,
  Transaction,
  UserPreferences,
} from './types';

const STORAGE_KEY = 'mv_local_state_v1';
const ROLLBACK_KEY = 'mv_local_state_before_restore_v1';
const PREFS_KEY = 'mv_local_preferences_v1';
const LOCAL_EVENT = 'mv-local-state-updated';
const OWNER_EMAIL = 'backtonemesis@gmail.com';
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

function calculateCurrentBalancePence(account: Account, transactions: Transaction[]): number {
  const hasReconciliation =
    Boolean(account.reconciliationDate) &&
    Number.isSafeInteger(account.reconciledBalancePence);

  let balance = hasReconciliation
    ? account.reconciledBalancePence!
    : account.startingBalancePence;

  const effective = transactions.filter((tx) => {
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

function normalizeHousehold(input: HouseholdData): HouseholdData {
  const state = clone(input);
  state.id = 'household-mv-local';
  state.name = state.name || 'Marius Household';
  state.members = [ownerMember()];
  state.plannedIncomes = state.plannedIncomes || [];
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
    const blank = createBlankLocalHousehold();
    saveLocalHousehold(blank);
    return blank;
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
      const next = { ...state.transactions[index], ...data, id, updatedAt: nowIso(), updatedBy: OWNER_EMAIL };
      if (!isSafePence(next.amountPence) || next.amountPence < 0) {
        throw new Error('Transaction amount must be exact integer pence.');
      }
      assertAccountExists(state, next.accountId);
      assertCategoryExists(state, next.categoryId);
      if (next.targetAccountId) assertAccountExists(state, next.targetAccountId);
      if (next.splits?.length) {
        const total = next.splits.reduce((sum, split) => sum + split.amountPence, 0);
        if (total !== next.amountPence) throw new Error('Transaction split total must equal transaction amount.');
      }
      state.transactions[index] = next;
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
      const before = state.transactions.length;
      state.transactions = state.transactions.filter((tx) => tx.id !== id);
      if (state.transactions.length === before) throw new Error('Transaction not found.');
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
      const account: Account = {
        id: data.id || createId('account'),
        name: data.name.trim(),
        type: data.type || 'current',
        currency: 'GBP',
        startingBalancePence: starting,
        currentBalancePence: starting,
        ownerPerson: data.ownerPerson || 'Marius',
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
      const next = { ...state.accounts[index], ...data, id, currency: 'GBP' as const };
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
  params: { month?: string; include: boolean; onlyUnpaid?: boolean; paymentIds?: string[] },
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
        if (params.onlyUnpaid && payment.status === 'paid') return payment;
        return { ...payment, includeInTransferPlan: params.include, updatedAt: nowIso(), updatedBy: OWNER_EMAIL };
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
  const category = state.categories.find((item) => item.id === 'cat-transfer');
  if (!category) throw new Error('Internal Transfer category is missing.');
  return createLocalTransaction(
    {
      accountId: payload.sourceAccountId,
      targetAccountId: payload.destinationAccountId,
      amountPence: payload.amountPence,
      description: payload.description || 'Internal transfer',
      date: payload.date || new Date().toISOString().slice(0, 10),
      payer: (payload.payer as any) || 'Marius',
      categoryId: category.id,
      type: 'transfer',
      isTransfer: true,
      isSavings: false,
    },
    expectedVersion
  );
}

function plannedIncomeFromPartial(data: Partial<PlannedIncome>): PlannedIncome {
  if (!data.name?.trim()) throw new Error('Income name is required.');
  if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) throw new Error('Valid month is required.');
  if (!data.accountId) throw new Error('Income account is required.');
  if (!isSafePence(data.expectedAmountPence) || (data.expectedAmountPence ?? -1) < 0) {
    throw new Error('Expected income must be exact integer pence.');
  }
  return {
    id: data.id || createId('income'),
    name: data.name.trim(),
    expectedAmountPence: data.expectedAmountPence!,
    actualAmountPence: data.actualAmountPence,
    month: data.month,
    sourcePerson: data.sourcePerson || 'Marius',
    accountId: data.accountId,
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
      assertAccountExists(state, data.accountId);
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
      assertAccountExists(state, next.accountId);
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
      assertCategoryExists(state, 'cat-salary');
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
        categoryId: 'cat-salary',
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
  params: { sourceMonth: string; targetMonth: string; paymentIds?: string[] },
  expectedVersion: number
): { imported: number; version: number } {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'month_imported',
      entityType: 'planned_payment',
      entityId: params.targetMonth,
      summary: `Month copied from ${params.sourceMonth} to ${params.targetMonth}`,
    },
    (state) => {
      const selectedIds = params.paymentIds ? new Set(params.paymentIds) : null;
      const source = state.plannedPayments.filter(
        (payment) =>
          payment.month === params.sourceMonth &&
          (!selectedIds || selectedIds.has(payment.id))
      );
      let imported = 0;
      for (const payment of source) {
        const copiedFromId = String(payment.metadata?.copiedFromId || payment.id);
        const exists = state.plannedPayments.some(
          (candidate) =>
            candidate.month === params.targetMonth &&
            String(candidate.metadata?.copiedFromId || '') === copiedFromId
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
        imported += 1;
      }
      return imported;
    }
  );
  return { imported: result.value, version: result.state.version };
}

export function getLocalPreferences(): UserPreferences {
  const storage = getStorage();
  if (!storage) return { theme: 'system', accent: 'default' };
  try {
    const parsed = JSON.parse(storage.getItem(PREFS_KEY) || '{}');
    return {
      theme: parsed.theme || 'system',
      accent: parsed.accent || 'default',
    };
  } catch {
    return { theme: 'system', accent: 'default' };
  }
}

export function saveLocalPreferences(preferences: UserPreferences): UserPreferences {
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable.');
  storage.setItem(PREFS_KEY, JSON.stringify(preferences));
  return preferences;
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
