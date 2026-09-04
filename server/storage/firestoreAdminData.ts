import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import {
  HOUSEHOLD_ID,
  OWNER_EMAIL,
} from './contracts';
import { FirestoreHouseholdStore } from './firestoreStore';
import {
  migrationEvidence,
  readFirestoreMigrationBundle,
  validateMigrationBundle,
  type MigrationBundle,
} from './sqliteFirestoreMigration';

type Row = Record<string, any>;

const MAX_ATOMIC_ADMIN_WRITES = 450;
const VALID_PAYER = new Set(['Marius', 'Vesta', 'Joint']);
const VALID_TRANSACTION_TYPE = new Set([
  'expense',
  'income',
  'transfer',
  'repayment',
  'refund',
]);
const VALID_ACCOUNT_TYPE = new Set([
  'current',
  'joint',
  'savings',
  'credit',
  'cash',
]);

export interface BackupPreflightResult {
  valid: boolean;
  counts: Record<string, number>;
  checks: string[];
  warnings: string[];
  errors: string[];
  estimatedAtomicWrites: number;
  maxAtomicWrites: number;
  normalized?: MigrationBundle;
}

interface ExistingFinancialRefs {
  accounts: DocumentReference[];
  categories: DocumentReference[];
  transactions: DocumentReference[];
  splits: Array<{ key: string; ref: DocumentReference }>;
  plannedPayments: DocumentReference[];
  plannedIncomes: DocumentReference[];
  savingsGoals: DocumentReference[];
}

function clean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clean(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, clean(item)])
    ) as T;
  }
  return value;
}

function withoutKeys(row: Row, ...keys: string[]): Row {
  const omitted = new Set(keys);
  return clean(
    Object.fromEntries(
      Object.entries(row).filter(([key]) => !omitted.has(key))
    )
  );
}

function safeInteger(
  value: unknown,
  field: string,
  errors: string[],
  options: { positive?: boolean; nonNegative?: boolean } = {}
): value is number {
  if (!Number.isSafeInteger(value)) {
    errors.push(`${field} must be a safe integer in pence`);
    return false;
  }
  if (options.positive && Number(value) <= 0) {
    errors.push(`${field} must be greater than zero`);
    return false;
  }
  if (options.nonNegative && Number(value) < 0) {
    errors.push(`${field} must not be negative`);
    return false;
  }
  return true;
}

function requireArray(payload: Row, key: string, errors: string[]): Row[] {
  if (!Array.isArray(payload[key])) {
    errors.push(`${key} must be an array`);
    return [];
  }
  return payload[key].filter((item: unknown, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${key}[${index}] must be an object`);
      return false;
    }
    return true;
  }) as Row[];
}

function uniqueIds(rows: Row[], label: string, errors: string[]) {
  const ids: string[] = [];
  rows.forEach((row, index) => {
    if (!row.id || typeof row.id !== 'string') {
      errors.push(`${label}[${index}].id is required`);
      return;
    }
    ids.push(row.id);
  });
  if (new Set(ids).size !== ids.length) {
    errors.push(`Duplicate ${label} IDs found`);
  }
}

function normalizeLegacySplits(transactions: Row[], payload: Row): Row[] {
  if (Array.isArray(payload.splits)) {
    return payload.splits.map((split: Row) => ({ ...split }));
  }
  return transactions.flatMap((tx) =>
    Array.isArray(tx.splits)
      ? tx.splits.map((split: Row) => ({
          ...split,
          transactionId: tx.id,
        }))
      : []
  );
}

function validateBasicFinancialShape(bundle: MigrationBundle): string[] {
  const errors: string[] = [];

  uniqueIds(bundle.accounts, 'accounts', errors);
  uniqueIds(bundle.categories, 'categories', errors);
  uniqueIds(bundle.transactions, 'transactions', errors);
  uniqueIds(bundle.splits, 'splits', errors);
  uniqueIds(bundle.plannedPayments, 'plannedPayments', errors);
  uniqueIds(bundle.plannedIncomes, 'plannedIncomes', errors);
  uniqueIds(bundle.savingsGoals, 'savingsGoals', errors);

  for (const account of bundle.accounts) {
    if (!account.name || typeof account.name !== 'string') {
      errors.push(`Account ${account.id} requires a name`);
    }
    if (!VALID_ACCOUNT_TYPE.has(account.type)) {
      errors.push(`Account ${account.id} has invalid type`);
    }
    if (!VALID_PAYER.has(account.ownerPerson)) {
      errors.push(`Account ${account.id} has invalid ownerPerson`);
    }
    safeInteger(
      account.startingBalancePence,
      `Account ${account.id} startingBalancePence`,
      errors
    );
    safeInteger(
      account.currentBalancePence,
      `Account ${account.id} currentBalancePence`,
      errors
    );
    if (account.reconciledBalancePence !== undefined) {
      safeInteger(
        account.reconciledBalancePence,
        `Account ${account.id} reconciledBalancePence`,
        errors
      );
    }
    if (account.creditLimitPence !== undefined) {
      safeInteger(
        account.creditLimitPence,
        `Account ${account.id} creditLimitPence`,
        errors,
        { nonNegative: true }
      );
    }
    if (account.balanceOwedPence !== undefined) {
      safeInteger(
        account.balanceOwedPence,
        `Account ${account.id} balanceOwedPence`,
        errors,
        { nonNegative: true }
      );
    }
  }

  for (const category of bundle.categories) {
    if (!category.name || typeof category.name !== 'string') {
      errors.push(`Category ${category.id} requires a name`);
    }
    if (!category.group || typeof category.group !== 'string') {
      errors.push(`Category ${category.id} requires a group`);
    }
    safeInteger(
      category.monthlyBudgetPence,
      `Category ${category.id} monthlyBudgetPence`,
      errors,
      { nonNegative: true }
    );
  }

  for (const tx of bundle.transactions) {
    if (!VALID_TRANSACTION_TYPE.has(tx.type)) {
      errors.push(`Transaction ${tx.id} has invalid type`);
    }
    if (!VALID_PAYER.has(tx.payer)) {
      errors.push(`Transaction ${tx.id} has invalid payer`);
    }
    if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(tx.date))) {
      errors.push(`Transaction ${tx.id} has invalid date`);
    }
    safeInteger(
      tx.amountPence,
      `Transaction ${tx.id} amountPence`,
      errors,
      { positive: true }
    );
    if (
      tx.type === 'transfer' &&
      tx.isTransfer &&
      tx.targetAccountId === tx.accountId
    ) {
      errors.push(`Transaction ${tx.id} transfers to the same account`);
    }
  }

  for (const split of bundle.splits) {
    safeInteger(
      split.amountPence,
      `Split ${split.id} amountPence`,
      errors,
      { positive: true }
    );
  }

  for (const payment of bundle.plannedPayments) {
    safeInteger(
      payment.amountPence,
      `Planned payment ${payment.id} amountPence`,
      errors,
      { positive: true }
    );
    if (payment.actualAmountPence !== undefined) {
      safeInteger(
        payment.actualAmountPence,
        `Planned payment ${payment.id} actualAmountPence`,
        errors,
        { positive: true }
      );
    }
    if (!/^\d{4}-\d{2}$/.test(String(payment.month || ''))) {
      errors.push(`Planned payment ${payment.id} has invalid month`);
    }
    if (!VALID_PAYER.has(payment.responsiblePerson)) {
      errors.push(`Planned payment ${payment.id} has invalid responsiblePerson`);
    }
    if (!['unpaid', 'paid'].includes(payment.status)) {
      errors.push(`Planned payment ${payment.id} has invalid status`);
    }
  }

  for (const income of bundle.plannedIncomes) {
    safeInteger(
      income.expectedAmountPence,
      `Planned income ${income.id} expectedAmountPence`,
      errors,
      { positive: true }
    );
    if (income.actualAmountPence !== undefined) {
      safeInteger(
        income.actualAmountPence,
        `Planned income ${income.id} actualAmountPence`,
        errors,
        { positive: true }
      );
    }
    if (!/^\d{4}-\d{2}$/.test(String(income.month || ''))) {
      errors.push(`Planned income ${income.id} has invalid month`);
    }
    if (!VALID_PAYER.has(income.sourcePerson)) {
      errors.push(`Planned income ${income.id} has invalid sourcePerson`);
    }
    if (!['expected', 'received', 'partial'].includes(income.status)) {
      errors.push(`Planned income ${income.id} has invalid status`);
    }
  }

  for (const goal of bundle.savingsGoals) {
    safeInteger(
      goal.targetPence,
      `Savings goal ${goal.id} targetPence`,
      errors,
      { positive: true }
    );
    safeInteger(
      goal.currentPence,
      `Savings goal ${goal.id} currentPence`,
      errors,
      { nonNegative: true }
    );
  }

  return errors;
}

function mapById(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function splitKey(split: Row) {
  return `${String(split.transactionId)}:${String(split.id)}`;
}

function calculateRestoreWrites(
  existing: ExistingFinancialRefs,
  bundle: MigrationBundle
): number {
  const newAccountIds = new Set(bundle.accounts.map((row) => row.id));
  const newCategoryIds = new Set(bundle.categories.map((row) => row.id));
  const newTransactionIds = new Set(bundle.transactions.map((row) => row.id));
  const newPaymentIds = new Set(bundle.plannedPayments.map((row) => row.id));
  const newIncomeIds = new Set(bundle.plannedIncomes.map((row) => row.id));
  const newSavingsIds = new Set(bundle.savingsGoals.map((row) => row.id));
  const newSplitKeys = new Set(bundle.splits.map(splitKey));

  const deletions =
    existing.accounts.filter((ref) => !newAccountIds.has(ref.id)).length +
    existing.categories.filter((ref) => !newCategoryIds.has(ref.id)).length +
    existing.transactions.filter((ref) => !newTransactionIds.has(ref.id)).length +
    existing.plannedPayments.filter((ref) => !newPaymentIds.has(ref.id)).length +
    existing.plannedIncomes.filter((ref) => !newIncomeIds.has(ref.id)).length +
    existing.savingsGoals.filter((ref) => !newSavingsIds.has(ref.id)).length +
    existing.splits.filter((item) => !newSplitKeys.has(item.key)).length;

  const sets =
    bundle.accounts.length +
    bundle.categories.length +
    bundle.transactions.length +
    bundle.splits.length +
    bundle.plannedPayments.length +
    bundle.plannedIncomes.length +
    bundle.savingsGoals.length;

  // FirestoreHouseholdStore.runMutation adds authoritative meta/state and one
  // append-only audit event.
  return deletions + sets + 2;
}

function accountDoc(row: Row): Row {
  return clean({
    name: row.name,
    type: row.type,
    currency: 'GBP',
    startingBalancePence: row.startingBalancePence,
    currentBalancePence: row.currentBalancePence,
    ownerPerson: row.ownerPerson,
    isActive: row.isActive !== false,
    reconciledAt: row.reconciledAt ?? null,
    reconciliationDate: row.reconciliationDate ?? null,
    reconciledBalancePence: row.reconciledBalancePence ?? null,
    creditLimitPence: row.creditLimitPence ?? null,
    balanceOwedPence: row.balanceOwedPence ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    schemaVersion: row.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    metadata: row.metadata ?? null,
  });
}

function categoryDoc(row: Row): Row {
  return clean({
    name: row.name,
    group: row.group,
    monthlyBudgetPence: row.monthlyBudgetPence,
    icon: row.icon ?? null,
    isArchived: Boolean(row.isArchived),
  });
}

function transactionDoc(row: Row): Row {
  return clean({
    date: row.date,
    description: row.description,
    amountPence: row.amountPence,
    type: row.type,
    categoryId: row.categoryId,
    accountId: row.accountId,
    targetAccountId: row.targetAccountId ?? null,
    payer: row.payer,
    notes: row.notes ?? null,
    isTransfer: Boolean(row.isTransfer),
    isRepayment: Boolean(row.isRepayment),
    isSavings: Boolean(row.isSavings),
    isRefund: Boolean(row.isRefund),
    originalTransactionId: row.originalTransactionId ?? null,
    plannedPaymentId: row.plannedPaymentId ?? null,
    plannedIncomeId: row.plannedIncomeId ?? null,
    createdAt: row.createdAt ?? null,
    createdBy: row.createdBy ?? null,
    updatedAt: row.updatedAt ?? null,
    updatedBy: row.updatedBy ?? null,
    schemaVersion: row.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    metadata: row.metadata ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
    taxYear: row.taxYear ?? null,
  });
}

function splitDoc(row: Row): Row {
  return clean({
    categoryId: row.categoryId,
    amountPence: row.amountPence,
    payer: row.payer ?? null,
    notes: row.notes ?? null,
  });
}

function plannedPaymentDoc(row: Row): Row {
  return clean({
    name: row.name,
    amountPence: row.amountPence,
    actualAmountPence: row.actualAmountPence ?? null,
    actualDate: row.actualDate ?? null,
    actualTransactionId: row.actualTransactionId ?? null,
    month: row.month,
    responsiblePerson: row.responsiblePerson,
    accountId: row.accountId,
    dueDate: row.dueDate ?? null,
    categoryId: row.categoryId ?? null,
    status: row.status,
    includeInTransferPlan: row.includeInTransferPlan !== false,
    notes: row.notes ?? null,
    createdAt: row.createdAt ?? null,
    createdBy: row.createdBy ?? null,
    updatedAt: row.updatedAt ?? null,
    updatedBy: row.updatedBy ?? null,
    schemaVersion: row.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    metadata: row.metadata ?? null,
  });
}

function plannedIncomeDoc(row: Row): Row {
  return clean({
    name: row.name,
    expectedAmountPence: row.expectedAmountPence,
    actualAmountPence: row.actualAmountPence ?? null,
    month: row.month,
    sourcePerson: row.sourcePerson,
    accountId: row.accountId,
    expectedDate: row.expectedDate ?? null,
    actualDate: row.actualDate ?? null,
    status: row.status,
    notes: row.notes ?? null,
    actualTransactionId: row.actualTransactionId ?? null,
    createdAt: row.createdAt ?? null,
    createdBy: row.createdBy ?? null,
    updatedAt: row.updatedAt ?? null,
    updatedBy: row.updatedBy ?? null,
    schemaVersion: row.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    metadata: row.metadata ?? null,
  });
}

function savingsGoalDoc(row: Row): Row {
  return clean({
    name: row.name,
    targetPence: row.targetPence,
    currentPence: row.currentPence,
    targetDate: row.targetDate ?? null,
    accountId: row.accountId,
    linkedAccountId: row.linkedAccountId ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    schemaVersion: row.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    metadata: row.metadata ?? null,
  });
}

export class FirestoreAdminDataService {
  constructor(
    private readonly db: Firestore,
    private readonly store: FirestoreHouseholdStore
  ) {}

  private householdRef() {
    return this.db.collection('households').doc(HOUSEHOLD_ID);
  }

  private async currentBundle(): Promise<MigrationBundle> {
    await this.store.ensureHousehold();
    const bundle = await readFirestoreMigrationBundle(this.db);
    if (!bundle) {
      throw new Error('Authoritative Firestore household could not be read');
    }
    return bundle;
  }

  private async existingFinancialRefs(): Promise<ExistingFinancialRefs> {
    await this.store.ensureHousehold();
    const household = this.householdRef();
    const [
      accounts,
      categories,
      transactions,
      plannedPayments,
      plannedIncomes,
      savingsGoals,
    ] = await Promise.all([
      household.collection('accounts').get(),
      household.collection('categories').get(),
      household.collection('transactions').get(),
      household.collection('plannedPayments').get(),
      household.collection('plannedIncomes').get(),
      household.collection('savingsGoals').get(),
    ]);
    const splitSnapshots = await Promise.all(
      transactions.docs.map((doc) => doc.ref.collection('splits').get())
    );

    return {
      accounts: accounts.docs.map((doc) => doc.ref),
      categories: categories.docs.map((doc) => doc.ref),
      transactions: transactions.docs.map((doc) => doc.ref),
      splits: splitSnapshots.flatMap((snapshot, transactionIndex) =>
        snapshot.docs.map((doc) => ({
          key: `${transactions.docs[transactionIndex].id}:${doc.id}`,
          ref: doc.ref,
        }))
      ),
      plannedPayments: plannedPayments.docs.map((doc) => doc.ref),
      plannedIncomes: plannedIncomes.docs.map((doc) => doc.ref),
      savingsGoals: savingsGoals.docs.map((doc) => doc.ref),
    };
  }

  async exportBackup(actorEmail: string) {
    const current = await this.currentBundle();
    const evidence = migrationEvidence(current);
    const balanceByAccount = new Map(
      evidence.accountBalances.map((item) => [
        item.id,
        item.calculatedCurrentBalancePence,
      ])
    );
    const normalized: MigrationBundle = {
      ...current,
      accounts: current.accounts.map((account) => ({
        ...account,
        currentBalancePence:
          balanceByAccount.get(account.id) ?? account.currentBalancePence,
      })),
    };
    const validation = validateMigrationBundle(normalized);
    if (!validation.valid) {
      throw new Error(
        `Refusing to export an internally inconsistent backup: ${validation.errors.join('; ')}`
      );
    }

    return {
      exportVersion: '3.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: actorEmail,
      householdId: HOUSEHOLD_ID,
      name: normalized.household.name,
      version: normalized.household.version,
      accounts: normalized.accounts,
      categories: normalized.categories,
      transactions: normalized.transactions,
      splits: normalized.splits,
      plannedPayments: normalized.plannedPayments,
      plannedIncomes: normalized.plannedIncomes,
      savingsGoals: normalized.savingsGoals,
      auditLogs: normalized.auditLogs,
      counts: validation.evidence.counts,
    };
  }

  private async normalizeBackup(payload: unknown): Promise<{
    bundle: MigrationBundle;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid backup payload: JSON object expected');
    }
    const row = payload as Row;

    if (!['2.0', '3.0'].includes(String(row.exportVersion || ''))) {
      errors.push('Unsupported or missing backup exportVersion; expected 2.0 or 3.0');
    }
    if (row.householdId && row.householdId !== HOUSEHOLD_ID) {
      errors.push(
        `Backup belongs to household ${String(row.householdId)}, not ${HOUSEHOLD_ID}`
      );
    }
    if (
      row.schemaVersion !== undefined &&
      row.schemaVersion !== CURRENT_SCHEMA_VERSION
    ) {
      errors.push(
        `Backup schema version ${String(row.schemaVersion)} does not match server schema ${CURRENT_SCHEMA_VERSION}`
      );
    }

    const accounts = requireArray(row, 'accounts', errors);
    const categories = requireArray(row, 'categories', errors);
    const rawTransactions = requireArray(row, 'transactions', errors);
    const transactions = rawTransactions.map((tx) => withoutKeys(tx, 'splits'));
    const splits = normalizeLegacySplits(rawTransactions, row);
    const plannedPayments = requireArray(row, 'plannedPayments', errors);
    const plannedIncomes = requireArray(row, 'plannedIncomes', errors);
    const savingsGoals = requireArray(row, 'savingsGoals', errors);

    if (row.members || row.users || row.preferences) {
      warnings.push(
        'Backup member/user/preference fields are ignored; authenticated household identity and permissions are never restored from backup.'
      );
    }
    if (Array.isArray(row.auditLogs) && row.auditLogs.length > 0) {
      warnings.push(
        'Backup audit logs are evidence-only during restore; the current append-only audit history is preserved and a new restore event is appended.'
      );
    }

    const current = await this.currentBundle();
    const bundle: MigrationBundle = {
      household: {
        ...current.household,
        name:
          typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : current.household.name,
        version: current.household.version,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      },
      members: current.members,
      preferences: current.preferences,
      accounts,
      categories,
      transactions,
      splits,
      plannedPayments,
      plannedIncomes,
      savingsGoals,
      // Current history is authoritative and must not be replaced by an uploaded
      // file. It is included here only so the common validator can validate the
      // preserved household state as a whole.
      auditLogs: current.auditLogs,
    };

    errors.push(...validateBasicFinancialShape(bundle));
    if (errors.length === 0) {
      const validation = validateMigrationBundle(bundle);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    return { bundle, errors, warnings };
  }

  async preflightRestore(payload: unknown): Promise<BackupPreflightResult> {
    const { bundle, errors, warnings } = await this.normalizeBackup(payload);
    const existing = await this.existingFinancialRefs();
    const estimatedAtomicWrites = calculateRestoreWrites(existing, bundle);
    if (estimatedAtomicWrites > MAX_ATOMIC_ADMIN_WRITES) {
      errors.push(
        `Restore requires ${estimatedAtomicWrites} atomic Firestore writes, above the verified safety limit of ${MAX_ATOMIC_ADMIN_WRITES}. Use migration/admin tooling instead of the in-app restore path.`
      );
    }

    const counts = {
      accounts: bundle.accounts.length,
      categories: bundle.categories.length,
      transactions: bundle.transactions.length,
      splits: bundle.splits.length,
      plannedPayments: bundle.plannedPayments.length,
      plannedIncomes: bundle.plannedIncomes.length,
      savingsGoals: bundle.savingsGoals.length,
      auditEvidence: Array.isArray((payload as Row)?.auditLogs)
        ? (payload as Row).auditLogs.length
        : 0,
    };

    const checks = [
      `Validated ${counts.accounts} accounts, ${counts.categories} categories and ${counts.transactions} transactions`,
      `Validated ${counts.splits} transaction splits, ${counts.plannedPayments} planned payments and ${counts.plannedIncomes} planned incomes`,
      `Validated ${counts.savingsGoals} savings goals and all account/category/planned-actual relationships`,
      `Verified exact integer-pence values and reconciled account balances`,
      `Verified sole Household Owner remains ${OWNER_EMAIL}; backup identity fields cannot replace authenticated users`,
      'Current append-only audit history will be preserved and one restore event will be added',
    ];

    return {
      valid: errors.length === 0,
      counts,
      checks,
      warnings,
      errors,
      estimatedAtomicWrites,
      maxAtomicWrites: MAX_ATOMIC_ADMIN_WRITES,
      normalized: errors.length === 0 ? bundle : undefined,
    };
  }

  async restore(
    payload: unknown,
    expectedVersion: number,
    actorEmail: string
  ) {
    const preflight = await this.preflightRestore(payload);
    if (!preflight.valid || !preflight.normalized) {
      const error: any = new Error(
        preflight.errors.join('; ') || 'Backup restore preflight failed'
      );
      error.status = 400;
      error.preflight = preflight;
      throw error;
    }

    const bundle = preflight.normalized;
    const existing = await this.existingFinancialRefs();
    const newAccountIds = new Set(bundle.accounts.map((row) => row.id));
    const newCategoryIds = new Set(bundle.categories.map((row) => row.id));
    const newTransactionIds = new Set(bundle.transactions.map((row) => row.id));
    const newPaymentIds = new Set(bundle.plannedPayments.map((row) => row.id));
    const newIncomeIds = new Set(bundle.plannedIncomes.map((row) => row.id));
    const newSavingsIds = new Set(bundle.savingsGoals.map((row) => row.id));
    const newSplitKeys = new Set(bundle.splits.map(splitKey));

    const beforeBundle = await this.currentBundle();
    const result = await this.store.runMutation(
      {
        expectedVersion,
        actorEmail,
        audit: {
          action: 'database_restored',
          entityType: 'backup',
          entityId: HOUSEHOLD_ID,
          summary: 'Restored household financial/configuration dataset from validated backup',
          details: {
            counts: preflight.counts,
            estimatedAtomicWrites: preflight.estimatedAtomicWrites,
          },
        },
      },
      ({ transaction, collectionRef }) => {
        for (const ref of existing.accounts) {
          if (!newAccountIds.has(ref.id)) transaction.delete(ref);
        }
        for (const ref of existing.categories) {
          if (!newCategoryIds.has(ref.id)) transaction.delete(ref);
        }
        for (const ref of existing.transactions) {
          if (!newTransactionIds.has(ref.id)) transaction.delete(ref);
        }
        for (const ref of existing.plannedPayments) {
          if (!newPaymentIds.has(ref.id)) transaction.delete(ref);
        }
        for (const ref of existing.plannedIncomes) {
          if (!newIncomeIds.has(ref.id)) transaction.delete(ref);
        }
        for (const ref of existing.savingsGoals) {
          if (!newSavingsIds.has(ref.id)) transaction.delete(ref);
        }
        for (const item of existing.splits) {
          if (!newSplitKeys.has(item.key)) transaction.delete(item.ref);
        }

        for (const row of bundle.accounts) {
          transaction.set(collectionRef('accounts', row.id), accountDoc(row));
        }
        for (const row of bundle.categories) {
          transaction.set(collectionRef('categories', row.id), categoryDoc(row));
        }
        for (const row of bundle.transactions) {
          transaction.set(
            collectionRef('transactions', row.id),
            transactionDoc(row)
          );
        }
        for (const row of bundle.splits) {
          transaction.set(
            collectionRef('transactions', row.transactionId)
              .collection('splits')
              .doc(row.id),
            splitDoc(row)
          );
        }
        for (const row of bundle.plannedPayments) {
          transaction.set(
            collectionRef('plannedPayments', row.id),
            plannedPaymentDoc(row)
          );
        }
        for (const row of bundle.plannedIncomes) {
          transaction.set(
            collectionRef('plannedIncomes', row.id),
            plannedIncomeDoc(row)
          );
        }
        for (const row of bundle.savingsGoals) {
          transaction.set(
            collectionRef('savingsGoals', row.id),
            savingsGoalDoc(row)
          );
        }

        return {
          restoredCounts: preflight.counts,
        };
      }
    );

    const after = await this.currentBundle();
    const afterEvidence = migrationEvidence(after);
    const postBalancePence = afterEvidence.accountBalances.reduce(
      (sum, account) => sum + account.calculatedCurrentBalancePence,
      0
    );

    return {
      success: true,
      message: 'Database successfully restored and reconciled',
      version: result.version,
      restoredCounts: result.value.restoredCounts,
      reconciliation: {
        preTransactions: beforeBundle.transactions.length,
        postTransactions: after.transactions.length,
        postBalancePence,
      },
      preflight: {
        checks: preflight.checks,
        warnings: preflight.warnings,
      },
    };
  }

  async reset(expectedVersion: number, actorEmail: string) {
    const existing = await this.existingFinancialRefs();
    const refs = [
      ...existing.splits.map((item) => item.ref),
      ...existing.transactions,
      ...existing.plannedPayments,
      ...existing.plannedIncomes,
      ...existing.savingsGoals,
      ...existing.accounts,
    ];
    const estimatedAtomicWrites = refs.length + 2;
    if (estimatedAtomicWrites > MAX_ATOMIC_ADMIN_WRITES) {
      const error: any = new Error(
        `Reset requires ${estimatedAtomicWrites} atomic Firestore writes, above the verified safety limit of ${MAX_ATOMIC_ADMIN_WRITES}. Use administrator migration tooling instead.`
      );
      error.status = 400;
      throw error;
    }

    const result = await this.store.runMutation(
      {
        expectedVersion,
        actorEmail,
        audit: {
          action: 'household_reset',
          entityType: 'household',
          entityId: HOUSEHOLD_ID,
          summary: 'Reset all household financial data to empty zero state',
          details: {
            deletedRecords: refs.length,
          },
        },
      },
      ({ transaction }) => {
        for (const ref of refs) transaction.delete(ref);
        return { deletedRecords: refs.length };
      }
    );

    return {
      success: true,
      message: 'Household financial data successfully reset to zero.',
      version: result.version,
      deletedRecords: result.value.deletedRecords,
    };
  }
}
