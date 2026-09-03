import type { DatabaseSync } from 'node:sqlite';
import type { Firestore, WriteBatch, DocumentReference } from 'firebase-admin/firestore';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import { HOUSEHOLD_ID } from './contracts';

export const MIGRATION_CONFIRMATION = 'MIGRATE_SQLITE_TO_FIRESTORE';

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
  accounts: Record<string, any>[];
  categories: Record<string, any>[];
  transactions: Record<string, any>[];
  splits: Record<string, any>[];
  plannedPayments: Record<string, any>[];
  plannedIncomes: Record<string, any>[];
  savingsGoals: Record<string, any>[];
  auditLogs: Record<string, any>[];
}

export interface MigrationEvidence {
  counts: {
    accounts: number;
    categories: number;
    transactions: number;
    splits: number;
    plannedPayments: number;
    plannedIncomes: number;
    savingsGoals: number;
    auditLogs: number;
  };
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
  excludedIdentityTables: readonly string[];
}

const EXCLUDED_IDENTITY_TABLES = [
  'users',
  'user_sessions',
  'user_preferences',
] as const;

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = JSON.parse(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
}

function stripUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
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

export function exportSqliteMigrationBundle(db: DatabaseSync): MigrationBundle {
  const meta = db.prepare('SELECT * FROM household_meta WHERE id = ?').get(HOUSEHOLD_ID) as any;
  if (!meta) throw new Error(`SQLite household ${HOUSEHOLD_ID} does not exist`);

  const accounts = rows(db, 'SELECT * FROM accounts ORDER BY id ASC').map((a) => stripUndefined({
    id: String(a.id),
    name: String(a.name),
    type: String(a.type),
    currency: String(a.currency || 'GBP'),
    startingBalancePence: safeInteger(a.starting_balance_pence, `accounts.${a.id}.startingBalancePence`),
    currentBalancePence: safeInteger(a.current_balance_pence, `accounts.${a.id}.currentBalancePence`),
    ownerPerson: String(a.owner_person),
    isActive: Boolean(a.is_active),
    reconciledAt: asOptionalString(a.reconciled_at),
    reconciliationDate: asOptionalString(a.reconciliation_date),
    reconciledBalancePence: a.reconciled_balance_pence == null ? undefined : safeInteger(a.reconciled_balance_pence, `accounts.${a.id}.reconciledBalancePence`),
    creditLimitPence: a.credit_limit_pence == null ? undefined : safeInteger(a.credit_limit_pence, `accounts.${a.id}.creditLimitPence`),
    balanceOwedPence: a.balance_owed_pence == null ? undefined : safeInteger(a.balance_owed_pence, `accounts.${a.id}.balanceOwedPence`),
    notes: asOptionalString(a.notes),
    createdAt: String(a.created_at),
    updatedAt: String(a.updated_at),
    schemaVersion: safeInteger(a.schema_version ?? 1, `accounts.${a.id}.schemaVersion`),
    metadata: parseJson(a.metadata_json),
  }));

  const categories = rows(db, 'SELECT * FROM categories ORDER BY id ASC').map((c) => stripUndefined({
    id: String(c.id),
    name: String(c.name),
    group: String(c.group_name),
    monthlyBudgetPence: safeInteger(c.monthly_budget_pence, `categories.${c.id}.monthlyBudgetPence`),
    icon: asOptionalString(c.icon),
    isArchived: Boolean(c.is_archived),
  }));

  const transactions = rows(db, 'SELECT * FROM transactions ORDER BY id ASC').map((t) => stripUndefined({
    id: String(t.id),
    date: String(t.date),
    description: String(t.description),
    amountPence: safeInteger(t.amount_pence, `transactions.${t.id}.amountPence`),
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
    schemaVersion: safeInteger(t.schema_version ?? 1, `transactions.${t.id}.schemaVersion`),
    metadata: parseJson(t.metadata_json),
    idempotencyKey: asOptionalString(t.idempotency_key),
    taxYear: asOptionalString(t.tax_year),
  }));

  const splits = rows(db, 'SELECT * FROM transaction_splits ORDER BY transaction_id ASC, id ASC').map((s) => stripUndefined({
    id: String(s.id),
    transactionId: String(s.transaction_id),
    categoryId: String(s.category_id),
    amountPence: safeInteger(s.amount_pence, `splits.${s.id}.amountPence`),
    payer: asOptionalString(s.payer),
    notes: asOptionalString(s.notes),
  }));

  const plannedPayments = rows(db, 'SELECT * FROM planned_payments ORDER BY id ASC').map((p) => stripUndefined({
    id: String(p.id),
    name: String(p.name),
    amountPence: safeInteger(p.amount_pence, `plannedPayments.${p.id}.amountPence`),
    actualAmountPence: p.actual_amount_pence == null ? undefined : safeInteger(p.actual_amount_pence, `plannedPayments.${p.id}.actualAmountPence`),
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
    schemaVersion: safeInteger(p.schema_version ?? 1, `plannedPayments.${p.id}.schemaVersion`),
    metadata: parseJson(p.metadata_json),
  }));

  const plannedIncomes = rows(db, 'SELECT * FROM planned_incomes ORDER BY id ASC').map((i) => stripUndefined({
    id: String(i.id),
    name: String(i.name),
    expectedAmountPence: safeInteger(i.expected_amount_pence, `plannedIncomes.${i.id}.expectedAmountPence`),
    actualAmountPence: i.actual_amount_pence == null ? undefined : safeInteger(i.actual_amount_pence, `plannedIncomes.${i.id}.actualAmountPence`),
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
    schemaVersion: safeInteger(i.schema_version ?? 1, `plannedIncomes.${i.id}.schemaVersion`),
    metadata: parseJson(i.metadata_json),
  }));

  const savingsGoals = rows(db, 'SELECT * FROM savings_goals ORDER BY id ASC').map((s) => stripUndefined({
    id: String(s.id),
    name: String(s.name),
    targetPence: safeInteger(s.target_pence, `savingsGoals.${s.id}.targetPence`),
    currentPence: safeInteger(s.current_pence, `savingsGoals.${s.id}.currentPence`),
    targetDate: asOptionalString(s.target_date),
    accountId: String(s.account_id),
    linkedAccountId: asOptionalString(s.linked_account_id),
    createdAt: String(s.created_at),
    updatedAt: String(s.updated_at),
    schemaVersion: safeInteger(s.schema_version ?? 1, `savingsGoals.${s.id}.schemaVersion`),
    metadata: parseJson(s.metadata_json),
  }));

  const auditLogs = rows(db, 'SELECT * FROM audit_logs ORDER BY timestamp ASC, id ASC').map((a) => stripUndefined({
    id: String(a.id),
    timestamp: String(a.timestamp),
    actorEmail: String(a.actor_email).trim().toLowerCase(),
    action: String(a.action),
    entityType: String(a.entity_type),
    entityId: String(a.entity_id),
    summary: String(a.summary),
    details: parseJson(a.details_json),
  }));

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

function transactionDeltaForAccount(tx: Record<string, any>, accountId: string): number {
  if (tx.accountId === accountId) {
    if (tx.type === 'income') return tx.amountPence;
    if (tx.type === 'expense' || tx.type === 'repayment') return -tx.amountPence;
    if (tx.type === 'refund' || tx.isRefund) return tx.amountPence;
    if (tx.type === 'transfer' && tx.isTransfer) return -tx.amountPence;
  }
  if (tx.targetAccountId === accountId && tx.type === 'transfer' && tx.isTransfer) {
    return tx.amountPence;
  }
  return 0;
}

function calculateAccountBalance(account: Record<string, any>, transactions: Record<string, any>[]): number {
  const anchorDate = account.reconciliationDate as string | undefined;
  const base = Number.isSafeInteger(account.reconciledBalancePence)
    ? account.reconciledBalancePence
    : account.startingBalancePence;

  return transactions.reduce((balance, tx) => {
    if (anchorDate && tx.date <= anchorDate) return balance;
    return balance + transactionDeltaForAccount(tx, account.id);
  }, base);
}

export function migrationEvidence(bundle: MigrationBundle): MigrationEvidence {
  const totals = { income: 0, expense: 0, refund: 0, transfer: 0, repayment: 0 };
  for (const tx of bundle.transactions) {
    if (tx.type in totals) totals[tx.type as keyof typeof totals] += tx.amountPence;
  }

  return {
    counts: {
      accounts: bundle.accounts.length,
      categories: bundle.categories.length,
      transactions: bundle.transactions.length,
      splits: bundle.splits.length,
      plannedPayments: bundle.plannedPayments.length,
      plannedIncomes: bundle.plannedIncomes.length,
      savingsGoals: bundle.savingsGoals.length,
      auditLogs: bundle.auditLogs.length,
    },
    transactionTotalsPence: totals,
    plannedTotalsPence: {
      payments: bundle.plannedPayments.reduce((sum, p) => sum + p.amountPence, 0),
      paymentActuals: bundle.plannedPayments.reduce((sum, p) => sum + (p.actualAmountPence || 0), 0),
      incomesExpected: bundle.plannedIncomes.reduce((sum, i) => sum + i.expectedAmountPence, 0),
      incomesActual: bundle.plannedIncomes.reduce((sum, i) => sum + (i.actualAmountPence || 0), 0),
    },
    savingsCurrentPence: bundle.savingsGoals.reduce((sum, goal) => sum + goal.currentPence, 0),
    accountBalances: bundle.accounts.map((account) => ({
      id: account.id,
      storedCurrentBalancePence: account.currentBalancePence,
      calculatedCurrentBalancePence: calculateAccountBalance(account, bundle.transactions),
      reconciliationDate: account.reconciliationDate,
      reconciledBalancePence: account.reconciledBalancePence,
    })),
    datasetVersion: bundle.household.version,
    schemaVersion: bundle.household.schemaVersion,
  };
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateMigrationBundle(bundle: MigrationBundle): MigrationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const evidence = migrationEvidence(bundle);

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

  const idempotencyKeys = bundle.transactions
    .map((item) => item.idempotencyKey)
    .filter((item): item is string => Boolean(item));
  if (!unique(idempotencyKeys)) errors.push('Duplicate transaction idempotency keys found');

  for (const tx of bundle.transactions) {
    if (!accountIds.has(tx.accountId)) errors.push(`Transaction ${tx.id} references missing account ${tx.accountId}`);
    if (tx.targetAccountId && !accountIds.has(tx.targetAccountId)) errors.push(`Transaction ${tx.id} references missing target account ${tx.targetAccountId}`);
    if (!categoryIds.has(tx.categoryId)) errors.push(`Transaction ${tx.id} references missing category ${tx.categoryId}`);
    if (tx.originalTransactionId && !transactionIds.has(tx.originalTransactionId)) warnings.push(`Refund/original link ${tx.id} -> ${tx.originalTransactionId} is unresolved`);
    if (tx.plannedPaymentId && !paymentIds.has(tx.plannedPaymentId)) errors.push(`Transaction ${tx.id} references missing planned payment ${tx.plannedPaymentId}`);
    if (tx.plannedIncomeId && !incomeIds.has(tx.plannedIncomeId)) errors.push(`Transaction ${tx.id} references missing planned income ${tx.plannedIncomeId}`);
  }

  const splitGroups = new Map<string, number>();
  for (const split of bundle.splits) {
    if (!transactionIds.has(split.transactionId)) errors.push(`Split ${split.id} references missing transaction ${split.transactionId}`);
    if (!categoryIds.has(split.categoryId)) errors.push(`Split ${split.id} references missing category ${split.categoryId}`);
    splitGroups.set(split.transactionId, (splitGroups.get(split.transactionId) || 0) + split.amountPence);
  }
  for (const [transactionId, splitTotal] of splitGroups) {
    const tx = bundle.transactions.find((item) => item.id === transactionId);
    if (tx && splitTotal !== tx.amountPence) errors.push(`Transaction ${transactionId} split total ${splitTotal} does not equal transaction amount ${tx.amountPence}`);
  }

  for (const payment of bundle.plannedPayments) {
    if (!accountIds.has(payment.accountId)) errors.push(`Planned payment ${payment.id} references missing account ${payment.accountId}`);
    if (payment.categoryId && !categoryIds.has(payment.categoryId)) errors.push(`Planned payment ${payment.id} references missing category ${payment.categoryId}`);
    if (payment.actualTransactionId && !transactionIds.has(payment.actualTransactionId)) errors.push(`Planned payment ${payment.id} references missing actual transaction ${payment.actualTransactionId}`);
  }
  for (const income of bundle.plannedIncomes) {
    if (!accountIds.has(income.accountId)) errors.push(`Planned income ${income.id} references missing account ${income.accountId}`);
    if (income.actualTransactionId && !transactionIds.has(income.actualTransactionId)) errors.push(`Planned income ${income.id} references missing actual transaction ${income.actualTransactionId}`);
  }
  for (const goal of bundle.savingsGoals) {
    if (!accountIds.has(goal.accountId)) errors.push(`Savings goal ${goal.id} references missing account ${goal.accountId}`);
    if (goal.linkedAccountId && !accountIds.has(goal.linkedAccountId)) errors.push(`Savings goal ${goal.id} references missing linked account ${goal.linkedAccountId}`);
  }

  for (const balance of evidence.accountBalances) {
    if (balance.storedCurrentBalancePence !== balance.calculatedCurrentBalancePence) {
      errors.push(`Account ${balance.id} stored balance ${balance.storedCurrentBalancePence} does not reconcile to ${balance.calculatedCurrentBalancePence}`);
    }
  }

  if (bundle.household.currency !== 'GBP') errors.push('MV migration only supports GBP household data');
  if (bundle.household.schemaVersion !== CURRENT_SCHEMA_VERSION) errors.push(`Source schema ${bundle.household.schemaVersion} does not match server schema ${CURRENT_SCHEMA_VERSION}`);

  return { valid: errors.length === 0, errors, warnings, evidence };
}

function withoutId(item: Record<string, any>) {
  const { id: _id, ...data } = item;
  return stripUndefined(data);
}

async function commitInChunks(targetDb: Firestore, writes: Array<(batch: WriteBatch) => void>): Promise<void> {
  const MAX_BATCH_WRITES = 400;
  for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
    const batch = targetDb.batch();
    for (const apply of writes.slice(offset, offset + MAX_BATCH_WRITES)) apply(batch);
    await batch.commit();
  }
}

function setWrite(ref: DocumentReference, data: Record<string, any>): (batch: WriteBatch) => void {
  return (batch) => batch.set(ref, stripUndefined(data));
}

export async function readFirestoreMigrationBundle(targetDb: Firestore): Promise<MigrationBundle | null> {
  const householdRef = targetDb.collection('households').doc(HOUSEHOLD_ID);
  const householdSnapshot = await householdRef.get();
  if (!householdSnapshot.exists) return null;

  const [meta, accounts, categories, transactions, plannedPayments, plannedIncomes, savingsGoals, auditLogs] = await Promise.all([
    householdRef.collection('meta').doc('state').get(),
    householdRef.collection('accounts').get(),
    householdRef.collection('categories').get(),
    householdRef.collection('transactions').get(),
    householdRef.collection('plannedPayments').get(),
    householdRef.collection('plannedIncomes').get(),
    householdRef.collection('savingsGoals').get(),
    householdRef.collection('audit').get(),
  ]);

  const splitSnapshots = await Promise.all(transactions.docs.map((doc) => doc.ref.collection('splits').get()));
  const splits = splitSnapshots.flatMap((snapshot, transactionIndex) =>
    snapshot.docs.map((doc) => ({ id: doc.id, transactionId: transactions.docs[transactionIndex].id, ...doc.data() }))
  );

  const householdData = householdSnapshot.data() || {};
  const metaData = meta.data() || {};
  return {
    household: {
      id: HOUSEHOLD_ID,
      name: String(householdData.name || 'Marius & Vesta Household'),
      currency: 'GBP',
      version: safeInteger(metaData.version ?? 1, 'firestore.version'),
      updatedAt: String(metaData.updatedAt || ''),
      schemaVersion: safeInteger(metaData.schemaVersion ?? CURRENT_SCHEMA_VERSION, 'firestore.schemaVersion'),
      isLocked: Boolean(metaData.isLocked),
      closedAt: asOptionalString(metaData.closedAt),
    },
    accounts: accounts.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    categories: categories.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    transactions: transactions.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    splits: splits.sort((a, b) => `${a.transactionId}:${a.id}`.localeCompare(`${b.transactionId}:${b.id}`)),
    plannedPayments: plannedPayments.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    plannedIncomes: plannedIncomes.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    savingsGoals: savingsGoals.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
    auditLogs: auditLogs.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function evidenceEqual(a: MigrationEvidence, b: MigrationEvidence): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function migrateSqliteToFirestore(options: MigrationRunOptions): Promise<MigrationRunResult> {
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
      excludedIdentityTables: EXCLUDED_IDENTITY_TABLES,
    };
  }

  const targetBeforeBundle = await readFirestoreMigrationBundle(options.targetDb);
  const targetBefore = targetBeforeBundle ? migrationEvidence(targetBeforeBundle) : null;
  const dryRun = options.dryRun !== false;
  if (dryRun) {
    return {
      dryRun: true,
      applied: false,
      source,
      targetBefore,
      targetAfter: null,
      equivalentAfterMigration: null,
      excludedIdentityTables: EXCLUDED_IDENTITY_TABLES,
    };
  }

  if (options.confirmation !== MIGRATION_CONFIRMATION) {
    throw new Error(`Live migration requires confirmation token ${MIGRATION_CONFIRMATION}`);
  }
  if (targetBeforeBundle && !options.allowReplace) {
    throw new Error('Refusing to overwrite a non-empty Firestore household without allowReplace=true');
  }

  const householdRef = options.targetDb.collection('households').doc(HOUSEHOLD_ID);
  if (targetBeforeBundle && options.allowReplace) {
    await options.targetDb.recursiveDelete(householdRef);
  }

  await householdRef.set({
    id: HOUSEHOLD_ID,
    name: bundle.household.name,
    currency: bundle.household.currency,
    migrationState: 'loading',
    migratedAt: new Date().toISOString(),
  });
  await householdRef.collection('meta').doc('state').set(stripUndefined({
    version: bundle.household.version,
    schemaVersion: bundle.household.schemaVersion,
    updatedAt: bundle.household.updatedAt,
    isLocked: bundle.household.isLocked,
    closedAt: bundle.household.closedAt,
    migrationState: 'loading',
  }));

  const writes: Array<(batch: WriteBatch) => void> = [];
  for (const item of bundle.accounts) writes.push(setWrite(householdRef.collection('accounts').doc(item.id), withoutId(item)));
  for (const item of bundle.categories) writes.push(setWrite(householdRef.collection('categories').doc(item.id), withoutId(item)));
  for (const item of bundle.transactions) writes.push(setWrite(householdRef.collection('transactions').doc(item.id), withoutId(item)));
  for (const item of bundle.splits) writes.push(setWrite(householdRef.collection('transactions').doc(item.transactionId).collection('splits').doc(item.id), withoutId(stripUndefined({ ...item, transactionId: undefined }))));
  for (const item of bundle.plannedPayments) writes.push(setWrite(householdRef.collection('plannedPayments').doc(item.id), withoutId(item)));
  for (const item of bundle.plannedIncomes) writes.push(setWrite(householdRef.collection('plannedIncomes').doc(item.id), withoutId(item)));
  for (const item of bundle.savingsGoals) writes.push(setWrite(householdRef.collection('savingsGoals').doc(item.id), withoutId(item)));
  for (const item of bundle.auditLogs) writes.push(setWrite(householdRef.collection('audit').doc(item.id), withoutId(item)));
  await commitInChunks(options.targetDb, writes);

  await householdRef.set({ migrationState: 'complete' }, { merge: true });
  await householdRef.collection('meta').doc('state').set({ migrationState: 'complete' }, { merge: true });

  const targetAfterBundle = await readFirestoreMigrationBundle(options.targetDb);
  if (!targetAfterBundle) throw new Error('Firestore household disappeared after migration');
  const targetAfterValidation = validateMigrationBundle(targetAfterBundle);
  if (!targetAfterValidation.valid) {
    throw new Error(`Post-migration Firestore validation failed: ${targetAfterValidation.errors.join('; ')}`);
  }

  const targetAfter = targetAfterValidation.evidence;
  const equivalentAfterMigration = evidenceEqual(source.evidence, targetAfter);
  if (!equivalentAfterMigration) {
    throw new Error('Post-migration evidence does not exactly match SQLite source evidence');
  }

  return {
    dryRun: false,
    applied: true,
    source,
    targetBefore,
    targetAfter,
    equivalentAfterMigration,
    excludedIdentityTables: EXCLUDED_IDENTITY_TABLES,
  };
}
