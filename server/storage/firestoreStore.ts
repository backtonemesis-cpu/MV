import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction as FirestoreTransaction,
} from 'firebase-admin/firestore';
import type {
  Account,
  AuditLogEntry,
  Category,
  HouseholdData,
  HouseholdMember,
  PlannedIncome,
  PlannedPayment,
  SavingsGoal,
  Transaction,
  TransactionSplit,
  UserPreferences,
} from '../../src/types';
import { getAdminFirestore } from '../firebaseAdmin';
import {
  CURRENT_SCHEMA_VERSION,
  MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
} from '../migrations';
import {
  HOUSEHOLD_CURRENCY,
  HOUSEHOLD_ID,
  HOUSEHOLD_NAME,
  type HouseholdMutationRequest,
  type HouseholdMutationResult,
  type PersistentHouseholdStore,
  normalizeEmail,
} from './contracts';
import { withCalculatedAccountBalances } from './reconciliation';

const COLLECTIONS = {
  members: 'members',
  preferences: 'preferences',
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  savingsGoals: 'savingsGoals',
  plannedPayments: 'plannedPayments',
  plannedIncomes: 'plannedIncomes',
  audit: 'audit',
} as const;

export interface FirestoreMutationContext {
  transaction: FirestoreTransaction;
  householdRef: DocumentReference;
  metaRef: DocumentReference;
  collectionRef: (name: keyof typeof COLLECTIONS, id: string) => DocumentReference;
  nextVersion: number;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) ? Number(value) : fallback;
}

function mapMember(id: string, data: DocumentData): HouseholdMember {
  return {
    id,
    email: normalizeEmail(asString(data.email)),
    name: asString(data.name),
    role: data.role,
    joinedAt: asString(data.joinedAt),
    approvedAt: data.approvedAt ? asString(data.approvedAt) : undefined,
    approvedBy: data.approvedBy ? asString(data.approvedBy) : undefined,
    lastActiveAt: data.lastActiveAt ? asString(data.lastActiveAt) : undefined,
  };
}

function mapAccount(id: string, data: DocumentData): Account {
  return {
    id,
    name: asString(data.name),
    type: data.type,
    currency: 'GBP',
    startingBalancePence: asNumber(data.startingBalancePence),
    currentBalancePence: asNumber(data.currentBalancePence),
    ownerPerson: data.ownerPerson,
    isActive: data.isActive !== false,
    reconciledAt: data.reconciledAt ? asString(data.reconciledAt) : undefined,
    reconciliationDate: data.reconciliationDate ? asString(data.reconciliationDate) : undefined,
    reconciledBalancePence: Number.isSafeInteger(data.reconciledBalancePence)
      ? Number(data.reconciledBalancePence)
      : undefined,
    creditLimitPence: Number.isSafeInteger(data.creditLimitPence)
      ? Number(data.creditLimitPence)
      : undefined,
    balanceOwedPence: Number.isSafeInteger(data.balanceOwedPence)
      ? Number(data.balanceOwedPence)
      : undefined,
    notes: data.notes ? asString(data.notes) : undefined,
    schemaVersion: Number.isSafeInteger(data.schemaVersion) ? Number(data.schemaVersion) : 1,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
  };
}

function mapCategory(id: string, data: DocumentData): Category {
  return {
    id,
    name: asString(data.name),
    group: asString(data.group),
    monthlyBudgetPence: asNumber(data.monthlyBudgetPence),
    icon: data.icon ? asString(data.icon) : undefined,
    isArchived: Boolean(data.isArchived),
  };
}

function mapSplit(id: string, data: DocumentData): TransactionSplit {
  return {
    id,
    amountPence: asNumber(data.amountPence),
    categoryId: asString(data.categoryId),
    payer: data.payer,
    notes: data.notes ? asString(data.notes) : undefined,
  };
}

function mapTransaction(
  id: string,
  data: DocumentData,
  splits?: TransactionSplit[]
): Transaction {
  return {
    id,
    date: asString(data.date),
    description: asString(data.description),
    amountPence: asNumber(data.amountPence),
    type: data.type,
    categoryId: asString(data.categoryId),
    accountId: asString(data.accountId),
    targetAccountId: data.targetAccountId ? asString(data.targetAccountId) : undefined,
    payer: data.payer,
    notes: data.notes ? asString(data.notes) : undefined,
    isTransfer: Boolean(data.isTransfer),
    isRepayment: Boolean(data.isRepayment),
    isSavings: Boolean(data.isSavings),
    isRefund: Boolean(data.isRefund),
    originalTransactionId: data.originalTransactionId ? asString(data.originalTransactionId) : undefined,
    splits: splits && splits.length > 0 ? splits : undefined,
    plannedPaymentId: data.plannedPaymentId ? asString(data.plannedPaymentId) : undefined,
    plannedIncomeId: data.plannedIncomeId ? asString(data.plannedIncomeId) : undefined,
    idempotencyKey: data.idempotencyKey ? asString(data.idempotencyKey) : undefined,
    taxYear: data.taxYear ? asString(data.taxYear) : undefined,
    schemaVersion: Number.isSafeInteger(data.schemaVersion) ? Number(data.schemaVersion) : 1,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    createdAt: asString(data.createdAt),
    createdBy: asString(data.createdBy),
    updatedAt: data.updatedAt ? asString(data.updatedAt) : undefined,
    updatedBy: data.updatedBy ? asString(data.updatedBy) : undefined,
  };
}

function mapPlannedPayment(id: string, data: DocumentData): PlannedPayment {
  return {
    id,
    name: asString(data.name),
    amountPence: asNumber(data.amountPence),
    actualAmountPence: Number.isSafeInteger(data.actualAmountPence)
      ? Number(data.actualAmountPence)
      : undefined,
    actualDate: data.actualDate ? asString(data.actualDate) : undefined,
    actualTransactionId: data.actualTransactionId ? asString(data.actualTransactionId) : undefined,
    month: asString(data.month),
    responsiblePerson: data.responsiblePerson,
    accountId: asString(data.accountId),
    dueDate: data.dueDate ? asString(data.dueDate) : undefined,
    categoryId: data.categoryId ? asString(data.categoryId) : undefined,
    status: data.status,
    includeInTransferPlan: Boolean(data.includeInTransferPlan),
    notes: data.notes ? asString(data.notes) : undefined,
    schemaVersion: Number.isSafeInteger(data.schemaVersion) ? Number(data.schemaVersion) : 1,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    createdAt: asString(data.createdAt),
    createdBy: asString(data.createdBy),
    updatedAt: data.updatedAt ? asString(data.updatedAt) : undefined,
    updatedBy: data.updatedBy ? asString(data.updatedBy) : undefined,
  };
}

function mapPlannedIncome(id: string, data: DocumentData): PlannedIncome {
  const actualDate = data.actualDate || data.receivedDate;
  const actualTransactionId = data.actualTransactionId || data.linkedTransactionId;

  return {
    id,
    name: asString(data.name),
    expectedAmountPence: asNumber(data.expectedAmountPence),
    actualAmountPence: Number.isSafeInteger(data.actualAmountPence)
      ? Number(data.actualAmountPence)
      : undefined,
    month: asString(data.month),
    sourcePerson: data.sourcePerson,
    accountId: asString(data.accountId),
    expectedDate: data.expectedDate ? asString(data.expectedDate) : undefined,
    actualDate: actualDate ? asString(actualDate) : undefined,
    actualTransactionId: actualTransactionId ? asString(actualTransactionId) : undefined,
    status: data.status,
    notes: data.notes ? asString(data.notes) : undefined,
    schemaVersion: Number.isSafeInteger(data.schemaVersion) ? Number(data.schemaVersion) : 1,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    createdAt: asString(data.createdAt),
    createdBy: asString(data.createdBy),
    updatedAt: data.updatedAt ? asString(data.updatedAt) : undefined,
    updatedBy: data.updatedBy ? asString(data.updatedBy) : undefined,
  };
}

function mapSavingsGoal(id: string, data: DocumentData): SavingsGoal {
  return {
    id,
    name: asString(data.name),
    targetPence: asNumber(data.targetPence),
    currentPence: asNumber(data.currentPence),
    targetDate: data.targetDate ? asString(data.targetDate) : undefined,
    accountId: asString(data.accountId),
    linkedAccountId: data.linkedAccountId ? asString(data.linkedAccountId) : undefined,
  };
}

function mapAuditLog(id: string, data: DocumentData): AuditLogEntry {
  return {
    id,
    timestamp: asString(data.timestamp),
    actorEmail: normalizeEmail(asString(data.actorEmail)),
    action: asString(data.action),
    entityType: data.entityType,
    entityId: asString(data.entityId),
    summary: asString(data.summary),
    details: data.details && typeof data.details === 'object' ? data.details : undefined,
  };
}

export class FirestoreHouseholdStore implements PersistentHouseholdStore {
  readonly backend = 'firestore' as const;

  constructor(private readonly db: Firestore = getAdminFirestore()) {}

  private householdRef() {
    return this.db.collection('households').doc(HOUSEHOLD_ID);
  }

  private metaRef() {
    return this.householdRef().collection('meta').doc('state');
  }

  private collection(name: keyof typeof COLLECTIONS) {
    return this.householdRef().collection(COLLECTIONS[name]);
  }

  async ensureHousehold(): Promise<void> {
    const householdRef = this.householdRef();
    const metaRef = this.metaRef();

    await this.db.runTransaction(async (transaction) => {
      const householdSnapshot = await transaction.get(householdRef);
      const metaSnapshot = await transaction.get(metaRef);

      if (!householdSnapshot.exists) {
        transaction.create(householdRef, {
          id: HOUSEHOLD_ID,
          name: HOUSEHOLD_NAME,
          currency: HOUSEHOLD_CURRENCY,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (!metaSnapshot.exists) {
        transaction.create(metaRef, {
          version: 1,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }

  async getHouseholdData(): Promise<HouseholdData> {
    await this.ensureHousehold();

    const [
      householdSnapshot,
      metaSnapshot,
      membersSnapshot,
      accountsSnapshot,
      categoriesSnapshot,
      transactionsSnapshot,
      savingsSnapshot,
      paymentsSnapshot,
      incomesSnapshot,
      auditSnapshot,
    ] = await Promise.all([
      this.householdRef().get(),
      this.metaRef().get(),
      this.collection('members').get(),
      this.collection('accounts').get(),
      this.collection('categories').get(),
      this.collection('transactions').get(),
      this.collection('savingsGoals').get(),
      this.collection('plannedPayments').get(),
      this.collection('plannedIncomes').get(),
      this.collection('audit').orderBy('timestamp', 'desc').limit(200).get(),
    ]);

    const household = householdSnapshot.data() || {};
    const meta = metaSnapshot.data() || {};
    const members = membersSnapshot.docs
      .map((doc) => mapMember(doc.id, doc.data()))
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    const rawAccounts = accountsSnapshot.docs
      .map((doc) => mapAccount(doc.id, doc.data()))
      .filter((account) => account.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
    const categories = categoriesSnapshot.docs
      .map((doc) => mapCategory(doc.id, doc.data()))
      .filter((category) => !category.isArchived)
      .sort((a, b) => `${a.group}:${a.name}`.localeCompare(`${b.group}:${b.name}`));

    const splitEntries = await Promise.all(
      transactionsSnapshot.docs.map(async (doc) => {
        const splitsSnapshot = await doc.ref.collection('splits').get();
        return [
          doc.id,
          splitsSnapshot.docs\n            .map((splitDoc) => mapSplit(splitDoc.id, splitDoc.data()))\n            .sort((a, b) => a.id.localeCompare(b.id)),
        ] as const;
      })
    );
    const splitsByTransaction = new Map<string, TransactionSplit[]>(splitEntries);

    const transactions = transactionsSnapshot.docs
      .map((doc) => mapTransaction(doc.id, doc.data(), splitsByTransaction.get(doc.id)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const accounts = withCalculatedAccountBalances(rawAccounts, transactions);
    const savingsGoals = savingsSnapshot.docs
      .map((doc) => mapSavingsGoal(doc.id, doc.data()))
      .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));
    const plannedPayments = paymentsSnapshot.docs
      .map((doc) => mapPlannedPayment(doc.id, doc.data()))
      .sort((a, b) => b.month.localeCompare(a.month) || (a.dueDate || '').localeCompare(b.dueDate || ''));
    const plannedIncomes = incomesSnapshot.docs
      .map((doc) => mapPlannedIncome(doc.id, doc.data()))
      .sort((a, b) => b.month.localeCompare(a.month) || (a.expectedDate || '').localeCompare(b.expectedDate || ''));
    const auditLogs = auditSnapshot.docs.map((doc) => mapAuditLog(doc.id, doc.data()));

    const latestSchemaVersion = asNumber(meta.schemaVersion, CURRENT_SCHEMA_VERSION);

    return {
      id: HOUSEHOLD_ID,
      name: asString(household.name, HOUSEHOLD_NAME),
      version: asNumber(meta.version, 1),
      schemaStatus: {
        currentSchemaVersion: CURRENT_SCHEMA_VERSION,
        minSupportedClientVersion: MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
        latestAppliedVersion: latestSchemaVersion,
        appliedMigrations: [],
        isUpToDate: latestSchemaVersion >= CURRENT_SCHEMA_VERSION,
      },
      members,
      accounts,
      categories,
      transactions,
      savingsGoals,
      plannedPayments,
      plannedIncomes,
      auditLogs,
    };
  }

  async getMemberByEmail(email: string): Promise<HouseholdMember | null> {
    const normalized = normalizeEmail(email);
    const snapshot = await this.collection('members')
      .where('email', '==', normalized)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    return doc ? mapMember(doc.id, doc.data()) : null;
  }

  async getMemberById(memberId: string): Promise<HouseholdMember | null> {
    const snapshot = await this.collection('members').doc(memberId).get();
    return snapshot.exists ? mapMember(snapshot.id, snapshot.data() || {}) : null;
  }

  async getPreferences(memberId: string): Promise<UserPreferences> {
    const snapshot = await this.collection('preferences').doc(memberId).get();
    const data = snapshot.data();
    return {
      theme: data?.theme || 'system',
      accent: data?.accent || 'default',
    };
  }

  async savePreferences(memberId: string, preferences: UserPreferences): Promise<void> {
    await this.collection('preferences').doc(memberId).set(
      {
        theme: preferences.theme,
        accent: preferences.accent,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  /**
   * Atomic Firestore mutation primitive for subsequent route migration.
   * The caller's business write, meta/state version bump and append-only audit
   * entry all commit together. A stale expectedVersion fails before any write.
   */
  async runMutation<T>(
    request: HouseholdMutationRequest,
    apply: (context: FirestoreMutationContext) => Promise<T> | T
  ): Promise<HouseholdMutationResult<T>> {
    const householdRef = this.householdRef();
    const metaRef = this.metaRef();

    return this.db.runTransaction(async (transaction) => {
      const metaSnapshot = await transaction.get(metaRef);
      if (!metaSnapshot.exists) {
        throw new Error('Authoritative Firestore household meta/state has not been initialized.');
      }

      const currentVersion = asNumber(metaSnapshot.data()?.version, 1);
      if (request.expectedVersion !== currentVersion) {
        const error: any = new Error(
          `Concurrent modification conflict: submitted version ${request.expectedVersion}, but server is at version ${currentVersion}. Refresh to load latest state.`
        );
        error.status = 409;
        error.serverVersion = currentVersion;
        throw error;
      }

      const nextVersion = currentVersion + 1;
      const collectionRef = (name: keyof typeof COLLECTIONS, id: string) =>
        householdRef.collection(COLLECTIONS[name]).doc(id);

      const value = await apply({
        transaction,
        householdRef,
        metaRef,
        collectionRef,
        nextVersion,
      });

      const now = new Date().toISOString();
      transaction.update(metaRef, {
        version: nextVersion,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: now,
      });

      const auditRef = collectionRef(
        'audit',
        `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );
      transaction.create(auditRef, {
        timestamp: now,
        actorEmail: normalizeEmail(request.actorEmail),
        action: request.audit.action,
        entityType: request.audit.entityType,
        entityId: request.audit.entityId,
        summary: request.audit.summary,
        details: request.audit.details || null,
      });

      return { value, version: nextVersion };
    });
  }
}
