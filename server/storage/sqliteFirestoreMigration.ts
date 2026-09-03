import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  Firestore,
  WriteBatch,
  DocumentReference,
} from 'firebase-admin/firestore';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import {
  HOUSEHOLD_ID,
  OWNER_EMAIL,
  normalizeEmail,
} from './contracts';

export const MIGRATION_CONFIRMATION = 'MIGRATE_SQLITE_TO_FIRESTORE';

type Row = Record<string, any>;

export interface MigrationBundle {
  household: {
    id: string;
    name: string;
    currency: 'GBP';
    version: number;
    updatedAt: string;
    schemaVersion: number;
    isLocked: boolean;
    closedAt?: string;
  };
  members: Row[];
  preferences: Row[];
  accounts: Row[];
  categories: Row[];
  transactions: Row[];
  splits: Row[];
  plannedPayments: Row[];
  plannedIncomes: Row[];
  savingsGoals: Row[];
  auditLogs: Row[];
}

export interface MigrationEvidence {
  counts: {
    members: number;
    preferences: number;
    accounts: number;
    categories: number;
    transactions: number;
    splits: number;
    plannedPayments: number;
    plannedIncomes: number;
    savingsGoals: number;
    auditLogs: number;
  };
  memberRoles: Array<{ email: string; role: string }>;
  transactionTotalsPence: {
    income: number;
    expense: number;
    refund: number;
    transfer: number;
    repayment: number;
  };
  plannedTotalsPence: {
    payments: number;
    paymentActuals: number;
    incomesExpected: number;
    incomesActual: number;
  };
  savingsCurrentPence: number;
  accountBalances: Array<{
    id: string;
    storedCurrentBalancePence: number;
    calculatedCurrentBalancePence: number;
    reconciliationDate?: string;
    reconciledBalancePence?: number;
  }>;
  datasetVersion: number;
  schemaVersion: number;
  fingerprint: string;
}

export interface MigrationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: MigrationEvidence;
}

export interface MigrationRunOptions {
  sourceDb: DatabaseSync;
  targetDb: Firestore;
  resolveFirebaseUid: (email: string) => Promise<string>;
  dryRun?: boolean;
  allowReplace?: boolean;
  confirmation?: string;
}

export interface MigrationRunResult {
  dryRun: boolean;
  applied: boolean;
  source: MigrationValidation;
  targetBefore: MigrationEvidence | null;
  targetAfter: MigrationEvidence | null;
  equivalentAfterMigration: boolean | null;
  identityBindings: Array<{ email: string; firestoreMemberId: string; role: string }>;
  excludedLegacyFields: readonly string[];
}

const EXCLUDED_LEGACY_FIELDS = [
  'users.password_hash',
  'users.salt',
  'user_sessions.*',
] as const;

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = JSON.parse(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : undefined;
}

function stripUndefined<T extends Row>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function safeInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${field} must be a safe integer`);
  }
  return number;
}

function rows(db: DatabaseSync, sql: string): any[] {
  return db.prepare(sql).all() as any[];
}

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function canonicalBundle(bundle: MigrationBundle) {
  const sortBy = (items: Row[], key: string) =>
    [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));

  return {
    household: bundle.household,
    members: sortBy(bundle.members, 'email'),
    preferences: sortBy(bundle.preferences, 'email'),
    accounts: sortBy(bundle.accounts, 'id'),
    categories: sortBy(bundle.categories, 'id'),
    transactions: sortBy(bundle.transactions, 'id'),
    splits: [...bundle.splits].sort((a, b) =>
      `${a.transactionId}:${a.id}`.localeCompare(`${b.transactionId}:${b.id}`)
    ),
    plannedPayments: sortBy(bundle.plannedPayments, 'id'),
    plannedIncomes: sortBy(bundle.plannedIncomes, 'id'),
    savingsGoals: sortBy(bundle.savingsGoals, 'id'),
    auditLogs: sortBy(bundle.auditLogs, 'id'),
  };
}

export function migrationFingerprint(bundle: MigrationBundle): string {
  const canonical = stableValue(canonicalBundle(bundle));
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

export function exportSqliteMigrationBundle(db: DatabaseSync): MigrationBundle {
  const meta = db
    .prepare('SELECT * FROM household_meta WHERE id = ?')
    .get(HOUSEHOLD_ID) as any;
  if (!meta) throw new Error(`SQLite household ${HOUSEHOLD_ID} does not exist`);

  const members = rows(
    db,
    'SELECT id, email, display_name, role, joined_at, approved_at, approved_by, last_active_at FROM users ORDER BY email ASC'
  ).map((u) =>
    stripUndefined({
      legacyId: String(u.id),
      email: normalizeEmail(String(u.email)),
      name: String(u.display_name),
      role: String(u.role),
      joinedAt: String(u.joined_at),
      approvedAt: asOptionalString(u.approved_at),
      approvedBy: asOptionalString(u.approved_by),
      lastActiveAt: asOptionalString(u.last_active_at),
    })
  );

  const memberEmailByLegacyId = new Map(
    members.map((member) => [member.legacyId, member.email])
  );
  const preferences = rows(
    db,
    'SELECT user_id, theme, accent_color, updated_at FROM user_preferences ORDER BY user_id ASC'
  ).map((p) => {
    const email = memberEmailByLegacyId.get(String(p.user_id));
    if (!email) {
      throw new Error(
        `Preference row references missing legacy user ${String(p.user_id)}`
      );
    }
    return {
      email,
      theme: String(p.theme),
      accent: String(p.accent_color),
      updatedAt: String(p.updated_at),
    };
  });

  const accounts = rows(db, 'SELECT * FROM accounts ORDER BY id ASC').map((a) =>
    stripUndefined({
      id: String(a.id),
      name: String(a.name),
      type: String(a.type),
      currency: String(a.currency || 'GBP'),
      startingBalancePence: safeInteger(
        a.starting_balance_pence,
        `accounts.${a.id}.startingBalancePence`
      ),
      currentBalancePence: safeInteger(
        a.current_balance_pence,
        `accounts.${a.id}.currentBalancePence`
      ),
      ownerPerson: String(a.owner_person),
      isActive: Boolean(a.is_active),
      reconciledAt: asOptionalString(a.reconciled_at),
      reconciliationDate: asOptionalString(a.reconciliation_date),
      reconciledBalancePence:
        a.reconciled_balance_pence == null
          ? undefined
          : safeInteger(
              a.reconciled_balance_pence,
              `accounts.${a.id}.reconciledBalancePence`
            ),
      creditLimitPence:
        a.credit_limit_pence == null
          ? undefined
          : safeInteger(
              a.credit_limit_pence,
              `accounts.${a.id}.creditLimitPence`
            ),
      balanceOwedPence:
        a.balance_owed_pence == null
          ? undefined
          : safeInteger(
              a.balance_owed_pence,
              `accounts.${a.id}.balanceOwedPence`
            ),
      notes: asOptionalString(a.notes),
      createdAt: String(a.created_at),
      updatedAt: String(a.updated_at),
      schemaVersion: safeInteger(
        a.schema_version ?? 1,
        `accounts.${a.id}.schemaVersion`
      ),
      metadata: parseJson(a.metadata_json),
    })
  );

  const categories = rows(
    db,
    'SELECT * FROM categories ORDER BY id ASC'
  ).map((c) =>
    stripUndefined({
      id: String(c.id),
      name: String(c.name),
      group: String(c.group_name),
      monthlyBudgetPence: safeInteger(
        c.monthly_budget_pence,
        `categories.${c.id}.monthlyBudgetPence`
      ),
      icon: asOptionalString(c.icon),
      isArchived: Boolean(c.is_archived),
    })
  );

  const transactions = rows(
    db,
    'SELECT * FROM transactions ORDER BY id ASC'
  ).map((t) =>
    stripUndefined({
      id: String(t.id),
      date: String(t.date),
      description: String(t.description),
      amountPence: safeInteger(
        t.amount_pence,
        `transactions.${t.id}.amountPence`
      ),
      type: String(t.type),
      categoryId: String(t.category_id),
      accountId: String(t.account_id),
      targetAccountId: asOptionalString(t.target_account_id),
      payer: String(t.payer),
      notes: asOptionalString(t.notes),
      isTransfer: Boolean(t.is_transfer),
      isRepayment: Boolean(t.is_repayment),
      isSavings: Boolean(t.is_savings),
      isRefund: Boolean(t.is_refund),
      originalTransactionId: asOptionalString(t.original_transaction_id),
      plannedPaymentId: asOptionalString(t.planned_payment_id),
      plannedIncomeId: asOptionalString(t.planned_income_id),
      createdAt: String(t.created_at),
      createdBy: String(t.created_by),
      updatedAt: asOptionalString(t.updated_at),
      updatedBy: asOptionalString(t.updated_by),
      schemaVersion: safeInteger(
        t.schema_version ?? 1,
        `transactions.${t.id}.schemaVersion`
      ),
      metadata: parseJson(t.metadata_json),
      idempotencyKey: asOptionalString(t.idempotency_key),
      taxYear: asOptionalString(t.tax_year),
    })
  );

  const splits = rows(
    db,
    'SELECT * FROM transaction_splits ORDER BY transaction_id ASC, id ASC'
  ).map((s) =>
    stripUndefined({
      id: String(s.id),
      transactionId: String(s.transaction_id),
      categoryId: String(s.category_id),
      amountPence: safeInteger(
        s.amount_pence,
        `splits.${s.id}.amountPence`
      ),
      payer: asOptionalString(s.payer),
      notes: asOptionalString(s.notes),
    })
  );

  const plannedPayments = rows(
    db,
    'SELECT * FROM planned_payments ORDER BY id ASC'
  ).map((p) =>
    stripUndefined({
      id: String(p.id),
      name: String(p.name),
      amountPence: safeInteger(
        p.amount_pence,
        `plannedPayments.${p.id}.amountPence`
      ),
      actualAmountPence:
        p.actual_amount_pence == null
          ? undefined
          : safeInteger(
              p.actual_amount_pence,
              `plannedPayments.${p.id}.actualAmountPence`
            ),
      actualDate: asOptionalString(p.actual_date),
      actualTransactionId: asOptionalString(p.actual_transaction_id),
      month: String(p.month),
      responsiblePerson: String(p.responsible_person),
      accountId: String(p.account_id),
      dueDate: asOptionalString(p.due_date),
      categoryId: asOptionalString(p.category_id),
      status: String(p.status),
      includeInTransferPlan: Boolean(p.include_in_transfer_plan),
      notes: asOptionalString(p.notes),
      createdAt: String(p.created_at),
      createdBy: String(p.created_by),
      updatedAt: asOptionalString(p.updated_at),
      updatedBy: asOptionalString(p.updated_by),
      schemaVersion: safeInteger(
        p.schema_version ?? 1,
        `plannedPayments.${p.id}.schemaVersion`
      ),
      metadata: parseJson(p.metadata_json),
    })
  );

  const plannedIncomes = rows(
    db,
    'SELECT * FROM planned_incomes ORDER BY id ASC'
  ).map((i) =>
    stripUndefined({
      id: String(i.id),
      name: String(i.name),
      expectedAmountPence: safeInteger(
        i.expected_amount_pence,
        `plannedIncomes.${i.id}.expectedAmountPence`
      ),
      actualAmountPence:
        i.actual_amount_pence == null
          ? undefined
          : safeInteger(
              i.actual_amount_pence,
              `plannedIncomes.${i.id}.actualAmountPence`
            ),
      month: String(i.month),
      sourcePerson: String(i.source_person),
      accountId: String(i.account_id),
      expectedDate: asOptionalString(i.expected_date),
      actualDate: asOptionalString(i.actual_date),
      status: String(i.status),
      notes: asOptionalString(i.notes),
      actualTransactionId: asOptionalString(i.actual_transaction_id),
      createdAt: String(i.created_at),
      createdBy: String(i.created_by),
      updatedAt: asOptionalString(i.updated_at),
      updatedBy: asOptionalString(i.updated_by),
      schemaVersion: safeInteger(
        i.schema_version ?? 1,
        `plannedIncomes.${i.id}.schemaVersion`
      ),
      metadata: parseJson(i.metadata_json),
    })
  );

  const savingsGoals = rows(
    db,
    'SELECT * FROM savings_goals ORDER BY id ASC'
  ).map((s) =>
    stripUndefined({
      id: String(s.id),
      name: String(s.name),
      targetPence: safeInteger(
        s.target_pence,
        `savingsGoals.${s.id}.targetPence`
      ),
      currentPence: safeInteger(
        s.current_pence,
        `savingsGoals.${s.id}.currentPence`
      ),
      targetDate: asOptionalString(s.target_date),
      accountId: String(s.account_id),
      linkedAccountId: asOptionalString(s.linked_account_id),
      createdAt: String(s.created_at),
      updatedAt: String(s.updated_at),
      schemaVersion: safeInteger(
        s.schema_version ?? 1,
        `savingsGoals.${s.id}.schemaVersion`
      ),
      metadata: parseJson(s.metadata_json),
    })
  );

  const auditLogs = rows(
    db,
    'SELECT * FROM audit_logs ORDER BY timestamp ASC, id ASC'
  ).map((a) =>
    stripUndefined({
      id: String(a.id),
      timestamp: String(a.timestamp),
      actorEmail: normalizeEmail(String(a.actor_email)),
      action: String(a.action),
      entityType: String(a.entity_type),
      entityId: String(a.entity_id),
      summary: String(a.summary),
      details: parseJson(a.details_json),
    })
  );

  return {
    household: {
      id: HOUSEHOLD_ID,
      name: String(meta.name),
      currency: 'GBP',
      version: safeInteger(meta.version, 'household.version'),
      updatedAt: String(meta.updated_at),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      isLocked: Boolean(meta.is_locked),
      closedAt: asOptionalString(meta.closed_at),
    },
    members,
    preferences,
    accounts,
    categories,
    transactions,
    splits,
    plannedPayments,
    plannedIncomes,
    savingsGoals,
    auditLogs,
  };
}

function transactionDeltaForAccount(tx: Row, accountId: string): number {
  if (tx.accountId === accountId) {
    if (tx.type === 'income') return tx.amountPence;
    if (tx.type === 'expense' || tx.type === 'repayment') return -tx.amountPence;
    if (tx.type === 'refund' || tx.isRefund) return tx.amountPence;
    if (tx.type === 'transfer' && tx.isTransfer) return -tx.amountPence;
  }
  if (
    tx.targetAccountId === accountId &&
    tx.type === 'transfer' &&
    tx.isTransfer
  ) {
    return tx.amountPence;
  }
  return 0;
}

function calculateAccountBalance(
  account: Row,
  transactions: Row[]
): number {
  const anchorDate =
    account.reconciliationDate &&
    Number.isSafeInteger(account.reconciledBalancePence)
      ? String(account.reconciliationDate)
      : undefined;
  const base = anchorDate
    ? account.reconciledBalancePence
    : account.startingBalancePence;

  return transactions.reduce((balance, tx) => {
    if (anchorDate && tx.date <= anchorDate) return balance;
    return balance + transactionDeltaForAccount(tx, account.id);
  }, base);
}

export function migrationEvidence(bundle: MigrationBundle): MigrationEvidence {
  const totals = {
    income: 0,
    expense: 0,
    refund: 0,
    transfer: 0,
    repayment: 0,
  };
  for (const tx of bundle.transactions) {
    if (tx.type in totals) {
      totals[tx.type as keyof typeof totals] += tx.amountPence;
    }
  }

  return {
    counts: {
      members: bundle.members.length,
      preferences: bundle.preferences.length,
      accounts: bundle.accounts.length,
      categories: bundle.categories.length,
      transactions: bundle.transactions.length,
      splits: bundle.splits.length,
      plannedPayments: bundle.plannedPayments.length,
      plannedIncomes: bundle.plannedIncomes.length,
      savingsGoals: bundle.savingsGoals.length,
      auditLogs: bundle.auditLogs.length,
    },
    memberRoles: bundle.members
      .map((member) => ({ email: member.email, role: member.role }))
      .sort((a, b) => a.email.localeCompare(b.email)),
    transactionTotalsPence: totals,
    plannedTotalsPence: {
      payments: bundle.plannedPayments.reduce(
        (sum, p) => sum + p.amountPence,
        0
      ),
      paymentActuals: bundle.plannedPayments.reduce(
        (sum, p) => sum + (p.actualAmountPence || 0),
        0
      ),
      incomesExpected: bundle.plannedIncomes.reduce(
        (sum, i) => sum + i.expectedAmountPence,
        0
      ),
      incomesActual: bundle.plannedIncomes.reduce(
        (sum, i) => sum + (i.actualAmountPence || 0),
        0
      ),
    },
    savingsCurrentPence: bundle.savingsGoals.reduce(
      (sum, goal) => sum + goal.currentPence,
      0
    ),
    accountBalances: bundle.accounts
      .map((account) => ({
        id: account.id,
        storedCurrentBalancePence: account.currentBalancePence,
        calculatedCurrentBalancePence: calculateAccountBalance(
          account,
          bundle.transactions
        ),
        reconciliationDate: account.reconciliationDate,
        reconciledBalancePence: account.reconciledBalancePence,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    datasetVersion: bundle.household.version,
    schemaVersion: bundle.household.schemaVersion,
    fingerprint: migrationFingerprint(bundle),
  };
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateMigrationBundle(
  bundle: MigrationBundle
): MigrationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const evidence = migrationEvidence(bundle);

  const memberEmails = bundle.members.map((item) => item.email);
  if (!unique(memberEmails)) errors.push('Duplicate household member emails found');

  const owners = bundle.members.filter((member) => member.role === 'owner');
  if (owners.length !== 1) {
    errors.push(`Expected exactly one household owner, found ${owners.length}`);
  } else if (owners[0].email !== OWNER_EMAIL) {
    errors.push(
      `Household owner must be ${OWNER_EMAIL}, found ${owners[0].email}`
    );
  }

  const accountIds = new Set(bundle.accounts.map((item) => item.id));
  const categoryIds = new Set(bundle.categories.map((item) => item.id));
  const transactionIds = new Set(bundle.transactions.map((item) => item.id));
  const paymentIds = new Set(bundle.plannedPayments.map((item) => item.id));
  const incomeIds = new Set(bundle.plannedIncomes.map((item) => item.id));

  const entitySets: Array<[string, string[]]> = [
    ['account', bundle.accounts.map((item) => item.id)],
    ['category', bundle.categories.map((item) => item.id)],
    ['transaction', bundle.transactions.map((item) => item.id)],
    ['split', bundle.splits.map((item) => item.id)],
    ['planned payment', bundle.plannedPayments.map((item) => item.id)],
    ['planned income', bundle.plannedIncomes.map((item) => item.id)],
    ['savings goal', bundle.savingsGoals.map((item) => item.id)],
    ['audit log', bundle.auditLogs.map((item) => item.id)],
  ];
  for (const [name, ids] of entitySets) {
    if (!unique(ids)) errors.push(`Duplicate ${name} IDs found`);
  }

  for (const preference of bundle.preferences) {
    if (!memberEmails.includes(preference.email)) {
      errors.push(
        `Preference row references missing household member ${preference.email}`
      );
    }
  }
  if (!unique(bundle.preferences.map((item) => item.email))) {
    errors.push('Duplicate preference rows found for a household member');
  }

  const idempotencyKeys = bundle.transactions
    .map((item) => item.idempotencyKey)
    .filter((item): item is string => Boolean(item));
  if (!unique(idempotencyKeys)) {
    errors.push('Duplicate transaction idempotency keys found');
  }

  for (const tx of bundle.transactions) {
    if (!accountIds.has(tx.accountId)) {
      errors.push(
        `Transaction ${tx.id} references missing account ${tx.accountId}`
      );
    }
    if (tx.targetAccountId && !accountIds.has(tx.targetAccountId)) {
      errors.push(
        `Transaction ${tx.id} references missing target account ${tx.targetAccountId}`
      );
    }
    if (!categoryIds.has(tx.categoryId)) {
      errors.push(
        `Transaction ${tx.id} references missing category ${tx.categoryId}`
      );
    }
    if (
      tx.originalTransactionId &&
      !transactionIds.has(tx.originalTransactionId)
    ) {
      warnings.push(
        `Refund/original link ${tx.id} -> ${tx.originalTransactionId} is unresolved`
      );
    }
    if (tx.plannedPaymentId && !paymentIds.has(tx.plannedPaymentId)) {
      errors.push(
        `Transaction ${tx.id} references missing planned payment ${tx.plannedPaymentId}`
      );
    }
    if (tx.plannedIncomeId && !incomeIds.has(tx.plannedIncomeId)) {
      errors.push(
        `Transaction ${tx.id} references missing planned income ${tx.plannedIncomeId}`
      );
    }
  }

  const splitGroups = new Map<string, number>();
  for (const split of bundle.splits) {
    if (!transactionIds.has(split.transactionId)) {
      errors.push(
        `Split ${split.id} references missing transaction ${split.transactionId}`
      );
    }
    if (!categoryIds.has(split.categoryId)) {
      errors.push(
        `Split ${split.id} references missing category ${split.categoryId}`
      );
    }
    splitGroups.set(
      split.transactionId,
      (splitGroups.get(split.transactionId) || 0) + split.amountPence
    );
  }
  for (const [transactionId, splitTotal] of splitGroups) {
    const tx = bundle.transactions.find((item) => item.id === transactionId);
    if (tx && splitTotal !== tx.amountPence) {
      errors.push(
        `Transaction ${transactionId} split total ${splitTotal} does not equal transaction amount ${tx.amountPence}`
      );
    }
  }

  for (const payment of bundle.plannedPayments) {
    if (!accountIds.has(payment.accountId)) {
      errors.push(
        `Planned payment ${payment.id} references missing account ${payment.accountId}`
      );
    }
    if (payment.categoryId && !categoryIds.has(payment.categoryId)) {
      errors.push(
        `Planned payment ${payment.id} references missing category ${payment.categoryId}`
      );
    }
    if (
      payment.actualTransactionId &&
      !transactionIds.has(payment.actualTransactionId)
    ) {
      errors.push(
        `Planned payment ${payment.id} references missing actual transaction ${payment.actualTransactionId}`
      );
    }
    if (payment.actualTransactionId) {
      const actual = bundle.transactions.find(
        (tx) => tx.id === payment.actualTransactionId
      );
      if (actual && actual.plannedPaymentId !== payment.id) {
        errors.push(
          `Planned payment ${payment.id} actual transaction ${actual.id} does not link back to it`
        );
      }
    }
  }

  for (const income of bundle.plannedIncomes) {
    if (!accountIds.has(income.accountId)) {
      errors.push(
        `Planned income ${income.id} references missing account ${income.accountId}`
      );
    }
    if (
      income.actualTransactionId &&
      !transactionIds.has(income.actualTransactionId)
    ) {
      errors.push(
        `Planned income ${income.id} references missing actual transaction ${income.actualTransactionId}`
      );
    }
    if (income.actualTransactionId) {
      const actual = bundle.transactions.find(
        (tx) => tx.id === income.actualTransactionId
      );
      if (actual && actual.plannedIncomeId !== income.id) {
        errors.push(
          `Planned income ${income.id} actual transaction ${actual.id} does not link back to it`
        );
      }
    }
  }

  for (const goal of bundle.savingsGoals) {
    if (!accountIds.has(goal.accountId)) {
      errors.push(
        `Savings goal ${goal.id} references missing account ${goal.accountId}`
      );
    }
    if (goal.linkedAccountId && !accountIds.has(goal.linkedAccountId)) {
      errors.push(
        `Savings goal ${goal.id} references missing linked account ${goal.linkedAccountId}`
      );
    }
  }

  for (const balance of evidence.accountBalances) {
    if (
      balance.storedCurrentBalancePence !==
      balance.calculatedCurrentBalancePence
    ) {
      errors.push(
        `Account ${balance.id} stored balance ${balance.storedCurrentBalancePence} does not reconcile to ${balance.calculatedCurrentBalancePence}`
      );
    }
  }

  if (bundle.household.currency !== 'GBP') {
    errors.push('MV migration only supports GBP household data');
  }
  if (bundle.household.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(
      `Source schema ${bundle.household.schemaVersion} does not match server schema ${CURRENT_SCHEMA_VERSION}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    evidence,
  };
}

function withoutId(item: Row, ...keys: string[]) {
  const omitted = new Set(['id', ...keys]);
  return stripUndefined(
    Object.fromEntries(
      Object.entries(item).filter(([key]) => !omitted.has(key))
    )
  );
}

async function commitInChunks(
  targetDb: Firestore,
  writes: Array<(batch: WriteBatch) => void>
): Promise<void> {
  const MAX_BATCH_WRITES = 400;
  for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
    const batch = targetDb.batch();
    for (const apply of writes.slice(offset, offset + MAX_BATCH_WRITES)) {
      apply(batch);
    }
    await batch.commit();
  }
}

function setWrite(
  ref: DocumentReference,
  data: Row
): (batch: WriteBatch) => void {
  return (batch) => batch.set(ref, stripUndefined(data));
}

async function resolveIdentityBindings(
  bundle: MigrationBundle,
  resolver: (email: string) => Promise<string>
) {
  const bindings: Array<{
    email: string;
    firestoreMemberId: string;
    role: string;
  }> = [];

  for (const member of bundle.members) {
    let firestoreMemberId: string;
    if (member.role === 'removed') {
      firestoreMemberId = `removed-${crypto
        .createHash('sha256')
        .update(member.email)
        .digest('hex')
        .slice(0, 32)}`;
    } else {
      firestoreMemberId = String(await resolver(member.email)).trim();
      if (!firestoreMemberId) {
        throw new Error(
          `Firebase UID resolver returned an empty UID for active member ${member.email}`
        );
      }
    }
    bindings.push({
      email: member.email,
      firestoreMemberId,
      role: member.role,
    });
  }

  if (
    new Set(bindings.map((item) => item.firestoreMemberId)).size !==
    bindings.length
  ) {
    throw new Error('Firebase UID bindings are not unique');
  }

  return bindings;
}

async function targetHasAnyData(targetDb: Firestore): Promise<boolean> {
  const household = targetDb.collection('households').doc(HOUSEHOLD_ID);
  const [
    root,
    meta,
    members,
    preferences,
    accounts,
    categories,
    transactions,
    savings,
    payments,
    incomes,
    audit,
  ] = await Promise.all([
    household.get(),
    household.collection('meta').limit(1).get(),
    household.collection('members').limit(1).get(),
    household.collection('preferences').limit(1).get(),
    household.collection('accounts').limit(1).get(),
    household.collection('categories').limit(1).get(),
    household.collection('transactions').limit(1).get(),
    household.collection('savingsGoals').limit(1).get(),
    household.collection('plannedPayments').limit(1).get(),
    household.collection('plannedIncomes').limit(1).get(),
    household.collection('audit').limit(1).get(),
  ]);

  return (
    root.exists ||
    !meta.empty ||
    !members.empty ||
    !preferences.empty ||
    !accounts.empty ||
    !categories.empty ||
    !transactions.empty ||
    !savings.empty ||
    !payments.empty ||
    !incomes.empty ||
    !audit.empty
  );
}

export async function readFirestoreMigrationBundle(
  targetDb: Firestore
): Promise<MigrationBundle | null> {
  const householdRef = targetDb.collection('households').doc(HOUSEHOLD_ID);
  const householdSnapshot = await householdRef.get();
  if (!householdSnapshot.exists) return null;

  const [
    meta,
    members,
    preferences,
    accounts,
    categories,
    transactions,
    plannedPayments,
    plannedIncomes,
    savingsGoals,
    auditLogs,
  ] = await Promise.all([
    householdRef.collection('meta').doc('state').get(),
    householdRef.collection('members').get(),
    householdRef.collection('preferences').get(),
    householdRef.collection('accounts').get(),
    householdRef.collection('categories').get(),
    householdRef.collection('transactions').get(),
    householdRef.collection('plannedPayments').get(),
    householdRef.collection('plannedIncomes').get(),
    householdRef.collection('savingsGoals').get(),
    householdRef.collection('audit').get(),
  ]);

  if (!meta.exists) {
    throw new Error('Firestore household exists without authoritative meta/state');
  }

  const splitSnapshots = await Promise.all(
    transactions.docs.map((doc) => doc.ref.collection('splits').get())
  );
  const splits = splitSnapshots.flatMap((snapshot, transactionIndex) =>
    snapshot.docs.map((doc) => ({
      id: doc.id,
      transactionId: transactions.docs[transactionIndex].id,
      ...doc.data(),
    }))
  );

  const memberRows = members.docs
    .map((doc) => ({
      documentId: doc.id,
      legacyId: doc.data().legacyId,
      email: normalizeEmail(String(doc.data().email || '')),
      name: String(doc.data().name || ''),
      role: String(doc.data().role || ''),
      joinedAt: String(doc.data().joinedAt || ''),
      approvedAt: asOptionalString(doc.data().approvedAt),
      approvedBy: asOptionalString(doc.data().approvedBy),
      lastActiveAt: asOptionalString(doc.data().lastActiveAt),
    }))
    .map((item) => withoutId(item, 'documentId'));

  const memberEmailByDocumentId = new Map(
    members.docs.map((doc) => [
      doc.id,
      normalizeEmail(String(doc.data().email || '')),
    ])
  );
  const preferenceRows = preferences.docs.map((doc) => ({
    email: memberEmailByDocumentId.get(doc.id) || '',
    theme: String(doc.data().theme || ''),
    accent: String(doc.data().accent || ''),
    updatedAt: String(doc.data().updatedAt || ''),
  }));

  const householdData = householdSnapshot.data() || {};
  const metaData = meta.data() || {};

  return {
    household: {
      id: HOUSEHOLD_ID,
      name: String(householdData.name || 'Marius & Vesta Household'),
      currency: 'GBP',
      version: safeInteger(metaData.version, 'firestore.version'),
      updatedAt: String(metaData.updatedAt || ''),
      schemaVersion: safeInteger(
        metaData.schemaVersion,
        'firestore.schemaVersion'
      ),
      isLocked: Boolean(metaData.isLocked),
      closedAt: asOptionalString(metaData.closedAt),
    },
    members: memberRows.sort((a, b) => a.email.localeCompare(b.email)),
    preferences: preferenceRows.sort((a, b) => a.email.localeCompare(b.email)),
    accounts: accounts.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    categories: categories.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    transactions: transactions.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    splits: splits.sort((a, b) =>
      `${a.transactionId}:${a.id}`.localeCompare(
        `${b.transactionId}:${b.id}`
      )
    ),
    plannedPayments: plannedPayments.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    plannedIncomes: plannedIncomes.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    savingsGoals: savingsGoals.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    auditLogs: auditLogs.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function evidenceEqual(a: MigrationEvidence, b: MigrationEvidence): boolean {
  return a.fingerprint === b.fingerprint;
}

export async function migrateSqliteToFirestore(
  options: MigrationRunOptions
): Promise<MigrationRunResult> {
  const bundle = exportSqliteMigrationBundle(options.sourceDb);
  const source = validateMigrationBundle(bundle);
  if (!source.valid) {
    return {
      dryRun: options.dryRun !== false,
      applied: false,
      source,
      targetBefore: null,
      targetAfter: null,
      equivalentAfterMigration: null,
      identityBindings: [],
      excludedLegacyFields: EXCLUDED_LEGACY_FIELDS,
    };
  }

  const identityBindings = await resolveIdentityBindings(
    bundle,
    options.resolveFirebaseUid
  );

  const hasTargetData = await targetHasAnyData(options.targetDb);
  let targetBefore: MigrationEvidence | null = null;
  if (hasTargetData) {
    try {
      const targetBeforeBundle = await readFirestoreMigrationBundle(
        options.targetDb
      );
      targetBefore = targetBeforeBundle
        ? migrationEvidence(targetBeforeBundle)
        : null;
    } catch {
      targetBefore = null;
    }
  }

  const dryRun = options.dryRun !== false;
  if (dryRun) {
    return {
      dryRun: true,
      applied: false,
      source,
      targetBefore,
      targetAfter: null,
      equivalentAfterMigration: null,
      identityBindings,
      excludedLegacyFields: EXCLUDED_LEGACY_FIELDS,
    };
  }

  if (options.confirmation !== MIGRATION_CONFIRMATION) {
    throw new Error(
      `Live migration requires confirmation token ${MIGRATION_CONFIRMATION}`
    );
  }
  if (hasTargetData && !options.allowReplace) {
    throw new Error(
      'Refusing to overwrite a non-empty Firestore household without allowReplace=true'
    );
  }

  const householdRef = options.targetDb
    .collection('households')
    .doc(HOUSEHOLD_ID);

  if (hasTargetData && options.allowReplace) {
    await options.targetDb.recursiveDelete(householdRef);
  }

  const startedAt = new Date().toISOString();
  await householdRef.set({
    id: HOUSEHOLD_ID,
    name: bundle.household.name,
    currency: bundle.household.currency,
    migrationState: 'loading',
  });
  await householdRef.collection('meta').doc('migration').set({
    state: 'loading',
    sourceFingerprint: source.evidence.fingerprint,
    sourceVersion: bundle.household.version,
    schemaVersion: bundle.household.schemaVersion,
    startedAt,
  });

  const bindingByEmail = new Map(
    identityBindings.map((binding) => [
      binding.email,
      binding.firestoreMemberId,
    ])
  );
  const writes: Array<(batch: WriteBatch) => void> = [];

  for (const member of bundle.members) {
    const memberId = bindingByEmail.get(member.email);
    if (!memberId) {
      throw new Error(`No Firestore member binding for ${member.email}`);
    }
    writes.push(
      setWrite(householdRef.collection('members').doc(memberId), {
        ...withoutId(member, 'legacyId'),
        legacyId: member.legacyId,
      })
    );
  }

  for (const preference of bundle.preferences) {
    const memberId = bindingByEmail.get(preference.email);
    if (!memberId) {
      throw new Error(
        `No Firestore preference binding for ${preference.email}`
      );
    }
    writes.push(
      setWrite(
        householdRef.collection('preferences').doc(memberId),
        withoutId(preference, 'email')
      )
    );
  }

  for (const item of bundle.accounts) {
    writes.push(
      setWrite(
        householdRef.collection('accounts').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.categories) {
    writes.push(
      setWrite(
        householdRef.collection('categories').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.transactions) {
    writes.push(
      setWrite(
        householdRef.collection('transactions').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.splits) {
    writes.push(
      setWrite(
        householdRef
          .collection('transactions')
          .doc(item.transactionId)
          .collection('splits')
          .doc(item.id),
        withoutId(item, 'transactionId')
      )
    );
  }
  for (const item of bundle.plannedPayments) {
    writes.push(
      setWrite(
        householdRef.collection('plannedPayments').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.plannedIncomes) {
    writes.push(
      setWrite(
        householdRef.collection('plannedIncomes').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.savingsGoals) {
    writes.push(
      setWrite(
        householdRef.collection('savingsGoals').doc(item.id),
        withoutId(item)
      )
    );
  }
  for (const item of bundle.auditLogs) {
    writes.push(
      setWrite(
        householdRef.collection('audit').doc(item.id),
        withoutId(item)
      )
    );
  }

  await commitInChunks(options.targetDb, writes);

  // Create state only after every business/history record is loaded. A cutover
  // readiness check must still reject "verifying" until the final marker commits.
  await householdRef.collection('meta').doc('state').set(
    stripUndefined({
      version: bundle.household.version,
      schemaVersion: bundle.household.schemaVersion,
      updatedAt: bundle.household.updatedAt,
      isLocked: bundle.household.isLocked,
      closedAt: bundle.household.closedAt,
      migrationState: 'verifying',
    })
  );

  const targetAfterBundle = await readFirestoreMigrationBundle(options.targetDb);
  if (!targetAfterBundle) {
    throw new Error('Firestore household disappeared after migration');
  }
  const targetAfterValidation = validateMigrationBundle(targetAfterBundle);
  if (!targetAfterValidation.valid) {
    throw new Error(
      `Post-migration Firestore validation failed: ${targetAfterValidation.errors.join(
        '; '
      )}`
    );
  }

  const targetAfter = targetAfterValidation.evidence;
  const equivalentAfterMigration = evidenceEqual(source.evidence, targetAfter);
  if (!equivalentAfterMigration) {
    throw new Error(
      `Post-migration fingerprint mismatch: source ${source.evidence.fingerprint}, target ${targetAfter.fingerprint}`
    );
  }

  const completedAt = new Date().toISOString();
  const finalize = options.targetDb.batch();
  finalize.set(
    householdRef,
    {
      migrationState: 'complete',
      migratedAt: completedAt,
      sourceFingerprint: source.evidence.fingerprint,
    },
    { merge: true }
  );
  finalize.set(
    householdRef.collection('meta').doc('state'),
    { migrationState: 'complete' },
    { merge: true }
  );
  finalize.set(
    householdRef.collection('meta').doc('migration'),
    {
      state: 'complete',
      sourceFingerprint: source.evidence.fingerprint,
      targetFingerprint: targetAfter.fingerprint,
      sourceVersion: bundle.household.version,
      schemaVersion: bundle.household.schemaVersion,
      startedAt,
      completedAt,
      counts: source.evidence.counts,
    },
    { merge: true }
  );
  await finalize.commit();

  const [finalState, finalMigration] = await Promise.all([
    householdRef.collection('meta').doc('state').get(),
    householdRef.collection('meta').doc('migration').get(),
  ]);
  if (
    finalState.data()?.migrationState !== 'complete' ||
    finalMigration.data()?.state !== 'complete' ||
    finalMigration.data()?.sourceFingerprint !== source.evidence.fingerprint
  ) {
    throw new Error('Final Firestore migration readiness marker is incomplete');
  }

  return {
    dryRun: false,
    applied: true,
    source,
    targetBefore,
    targetAfter,
    equivalentAfterMigration,
    identityBindings,
    excludedLegacyFields: EXCLUDED_LEGACY_FIELDS,
  };
}
