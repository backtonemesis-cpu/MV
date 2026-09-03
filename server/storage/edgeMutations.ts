import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import type { UserRole } from '../../src/types';
import { bumpVersionAndLog } from '../db';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import type { HouseholdMutationResult } from './contracts';
import { HOUSEHOLD_ID, OWNER_EMAIL, normalizeEmail } from './contracts';
import {
  FirestoreCoreMutationStore,
  SqliteCoreMutationStore,
  type MutationActor,
  type PlannedIncomeMutationInput,
  type PlannedPaymentMutationInput,
  type TransactionMutationInput,
} from './coreMutations';
import { FirestoreHouseholdStore } from './firestoreStore';

export interface BulkToggleInput {
  month?: string;
  include: boolean;
  onlyUnpaid?: boolean;
  paymentIds?: string[];
}

export interface MonthImportInput {
  sourceMonth: string;
  targetMonth: string;
  paymentIds?: string[];
}

export interface IdempotentTransactionResult {
  id: string;
  duplicatePrevented?: boolean;
}

export interface EdgeMutationStore {
  createTransactionIdempotent(
    actor: MutationActor,
    input: TransactionMutationInput
  ): Promise<HouseholdMutationResult<IdempotentTransactionResult>>;
  updatePlannedPayment(
    actor: MutationActor,
    input: PlannedPaymentMutationInput
  ): Promise<HouseholdMutationResult<{ id: string }>>;
  deletePlannedPayment(
    actor: MutationActor,
    paymentId: string
  ): Promise<HouseholdMutationResult<{ id: string }>>;
  updatePlannedIncome(
    actor: MutationActor,
    input: PlannedIncomeMutationInput
  ): Promise<HouseholdMutationResult<{ id: string }>>;
  deletePlannedIncome(
    actor: MutationActor,
    incomeId: string
  ): Promise<HouseholdMutationResult<{ id: string }>>;
  bulkTogglePlannedPayments(
    actor: MutationActor,
    input: BulkToggleInput
  ): Promise<HouseholdMutationResult<{ updatedCount: number }>>;
  importMonth(
    actor: MutationActor,
    input: MonthImportInput
  ): Promise<HouseholdMutationResult<{ importedCount: number; targetMonth: string }>>;
  archiveOrDeleteAccount(
    actor: MutationActor,
    accountId: string
  ): Promise<HouseholdMutationResult<{ id: string; archived: boolean }>>;
  approveMember(
    actor: MutationActor,
    memberId: string,
    role: 'editor' | 'view_only'
  ): Promise<HouseholdMutationResult<{ id: string; role: UserRole }>>;
  changeMemberRole(
    actor: MutationActor,
    memberId: string,
    newRole: UserRole
  ): Promise<HouseholdMutationResult<{ id: string; role: UserRole }>>;
  removeMember(
    actor: MutationActor,
    memberId: string
  ): Promise<HouseholdMutationResult<{ id: string; role: 'removed' }>>;
}

function assertVersion(db: DatabaseSync, expectedVersion: number): number {
  const row = db.prepare('SELECT version FROM household_meta WHERE id = ?').get(HOUSEHOLD_ID) as any;
  const currentVersion = Number(row?.version || 1);
  if (currentVersion !== expectedVersion) {
    const error: any = new Error(
      `Concurrent modification conflict: submitted version ${expectedVersion}, but server is at version ${currentVersion}. Refresh to load latest state.`
    );
    error.status = 409;
    error.serverVersion = currentVersion;
    throw error;
  }
  return currentVersion;
}

function sqliteResult<T>(value: T, version: number): HouseholdMutationResult<T> {
  return { value, version };
}

function importedPaymentId(sourceId: string, targetMonth: string): string {
  return `bill-import-${targetMonth}-${sourceId}`;
}

export class SqliteEdgeMutationStore implements EdgeMutationStore {
  private readonly core: SqliteCoreMutationStore;

  constructor(private readonly db: DatabaseSync) {
    this.core = new SqliteCoreMutationStore(db);
  }

  async createTransactionIdempotent(actor: MutationActor, input: TransactionMutationInput) {
    const currentVersion = assertVersion(this.db, actor.expectedVersion);

    if (input.idempotencyKey) {
      const existing = this.db
        .prepare('SELECT id FROM transactions WHERE idempotency_key = ?')
        .get(input.idempotencyKey) as any;
      if (existing) {
        return sqliteResult(
          { id: String(existing.id), duplicatePrevented: true },
          currentVersion
        );
      }
    }

    return this.core.createTransaction(actor, input);
  }

  async updatePlannedPayment(actor: MutationActor, input: PlannedPaymentMutationInput) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT id FROM planned_payments WHERE id = ?').get(input.id);
      if (!existing) throw new Error('Planned payment not found');

      this.db.prepare(`
        UPDATE planned_payments SET
          name = ?, amount_pence = ?, month = ?, responsible_person = ?, account_id = ?,
          due_date = ?, category_id = ?, status = ?, include_in_transfer_plan = ?, notes = ?,
          updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        input.name,
        input.amountPence,
        input.month,
        input.responsiblePerson,
        input.accountId,
        input.dueDate || null,
        input.categoryId || null,
        input.status || 'unpaid',
        input.includeInTransferPlan !== false ? 1 : 0,
        input.notes || null,
        actor.now,
        actor.actorEmail,
        input.id
      );

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_payment_updated',
        'planned_payment',
        input.id,
        `Updated planned payment: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deletePlannedPayment(actor: MutationActor, paymentId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT * FROM planned_payments WHERE id = ?').get(paymentId) as any;
      if (!existing) throw new Error('Planned payment not found');

      this.db.prepare('DELETE FROM planned_payments WHERE id = ?').run(paymentId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_payment_deleted',
        'planned_payment',
        paymentId,
        `Deleted planned payment: ${existing.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: paymentId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async updatePlannedIncome(actor: MutationActor, input: PlannedIncomeMutationInput) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT id FROM planned_incomes WHERE id = ?').get(input.id);
      if (!existing) throw new Error('Planned income not found');

      this.db.prepare(`
        UPDATE planned_incomes SET
          name = ?, expected_amount_pence = ?, month = ?, source_person = ?, account_id = ?,
          expected_date = ?, status = ?, notes = ?, updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        input.name,
        input.expectedAmountPence,
        input.month,
        input.sourcePerson,
        input.accountId,
        input.expectedDate || null,
        input.status || 'expected',
        input.notes || null,
        actor.now,
        actor.actorEmail,
        input.id
      );

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_income_updated',
        'planned_income',
        input.id,
        `Updated planned income: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deletePlannedIncome(actor: MutationActor, incomeId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT * FROM planned_incomes WHERE id = ?').get(incomeId) as any;
      if (!existing) throw new Error('Planned income not found');

      this.db.prepare('DELETE FROM planned_incomes WHERE id = ?').run(incomeId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_income_deleted',
        'planned_income',
        incomeId,
        `Deleted planned income: ${existing.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: incomeId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async bulkTogglePlannedPayments(actor: MutationActor, input: BulkToggleInput) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);

      let query = 'UPDATE planned_payments SET include_in_transfer_plan = ? WHERE 1=1';
      const params: any[] = [input.include ? 1 : 0];

      if (input.month) {
        query += ' AND month = ?';
        params.push(input.month);
      }
      if (input.onlyUnpaid) {
        query += " AND status = 'unpaid'";
      }
      if (Array.isArray(input.paymentIds) && input.paymentIds.length > 0) {
        query += ` AND id IN (${input.paymentIds.map(() => '?').join(',')})`;
        params.push(...input.paymentIds);
      }

      const result = this.db.prepare(query).run(...params) as any;
      const updatedCount = Number(result.changes || 0);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_payments_bulk_toggled',
        'planned_payment',
        input.month || 'all',
        `Bulk toggled transfer plan inclusion: ${input.include ? 'included' : 'excluded'}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ updatedCount }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async importMonth(actor: MutationActor, input: MonthImportInput) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);

      let query = 'SELECT * FROM planned_payments WHERE month = ?';
      const params: any[] = [input.sourceMonth];
      if (Array.isArray(input.paymentIds) && input.paymentIds.length > 0) {
        query += ` AND id IN (${input.paymentIds.map(() => '?').join(',')})`;
        params.push(...input.paymentIds);
      }

      const sourceBills = this.db.prepare(query).all(...params) as any[];
      const targetBills = this.db
        .prepare('SELECT name, amount_pence, account_id FROM planned_payments WHERE month = ?')
        .all(input.targetMonth) as any[];

      const insert = this.db.prepare(`
        INSERT INTO planned_payments (
          id, name, amount_pence, month, responsible_person, account_id,
          due_date, category_id, status, include_in_transfer_plan, notes,
          schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?)
      `);

      let importedCount = 0;
      for (const bill of sourceBills) {
        const duplicate = targetBills.some(
          (target) =>
            target.name === bill.name &&
            target.amount_pence === bill.amount_pence &&
            target.account_id === bill.account_id
        );
        if (duplicate) continue;

        const dueDate = bill.due_date
          ? `${input.targetMonth}-${String(bill.due_date).split('-')[2] || '01'}`
          : null;

        insert.run(
          importedPaymentId(String(bill.id), input.targetMonth),
          bill.name,
          bill.amount_pence,
          input.targetMonth,
          bill.responsible_person,
          bill.account_id,
          dueDate,
          bill.category_id,
          bill.include_in_transfer_plan,
          bill.notes,
          CURRENT_SCHEMA_VERSION,
          actor.now,
          actor.actorEmail
        );
        importedCount += 1;
      }

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'month_imported',
        'planned_payment',
        input.targetMonth,
        `Imported ${importedCount} planned payments from ${input.sourceMonth} into ${input.targetMonth}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ importedCount, targetMonth: input.targetMonth }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async archiveOrDeleteAccount(actor: MutationActor, accountId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
      if (!existing) throw new Error('Account not found');

      const txCount = Number(
        (this.db
          .prepare('SELECT count(*) as count FROM transactions WHERE account_id = ? OR target_account_id = ?')
          .get(accountId, accountId) as any).count
      );
      const planCount = Number(
        (this.db
          .prepare('SELECT count(*) as count FROM planned_payments WHERE account_id = ?')
          .get(accountId) as any).count
      );
      const archived = txCount > 0 || planCount > 0;

      if (archived) {
        this.db
          .prepare('UPDATE accounts SET is_active = 0, updated_at = ? WHERE id = ?')
          .run(actor.now, accountId);
      } else {
        this.db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
      }

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'account_archived',
        'account',
        accountId,
        `Archived account: ${existing.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: accountId, archived }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async approveMember(actor: MutationActor, memberId: string, role: 'editor' | 'view_only') {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const target = this.db.prepare('SELECT * FROM users WHERE id = ?').get(memberId) as any;
      if (!target) throw new Error('Member not found');

      this.db
        .prepare('UPDATE users SET role = ?, approved_at = ?, approved_by = ? WHERE id = ?')
        .run(role, actor.now, actor.actorEmail, memberId);
      this.db.prepare('UPDATE user_sessions SET role = ? WHERE user_id = ?').run(role, memberId);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'member_approved',
        'member',
        memberId,
        `Approved ${target.email} as ${role}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: memberId, role }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async changeMemberRole(actor: MutationActor, memberId: string, newRole: UserRole) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const target = this.db.prepare('SELECT * FROM users WHERE id = ?').get(memberId) as any;
      if (!target) throw new Error('Member not found');

      const targetEmail = normalizeEmail(String(target.email));
      if (targetEmail === OWNER_EMAIL && newRole !== 'owner') {
        throw new Error('Cannot demote the sole household owner');
      }
      if (targetEmail !== OWNER_EMAIL && newRole === 'owner') {
        throw new Error('Only Marius may hold the Household Owner role');
      }

      this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, memberId);
      this.db.prepare('UPDATE user_sessions SET role = ? WHERE user_id = ?').run(newRole, memberId);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'member_role_changed',
        'member',
        memberId,
        `Changed ${target.email} role to ${newRole}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: memberId, role: newRole }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async removeMember(actor: MutationActor, memberId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const target = this.db.prepare('SELECT * FROM users WHERE id = ?').get(memberId) as any;
      if (!target) throw new Error('Member not found');
      if (normalizeEmail(String(target.email)) === OWNER_EMAIL || target.role === 'owner') {
        throw new Error('Cannot remove household owner');
      }

      this.db.prepare("UPDATE users SET role = 'removed' WHERE id = ?").run(memberId);
      this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(memberId);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'member_removed',
        'member',
        memberId,
        `Removed member ${target.email} from household`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: memberId, role: 'removed' as const }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }
}

export class FirestoreEdgeMutationStore implements EdgeMutationStore {
  private readonly core: FirestoreCoreMutationStore;
  private readonly store: FirestoreHouseholdStore;

  constructor(private readonly db: Firestore, store?: FirestoreHouseholdStore) {
    this.store = store || new FirestoreHouseholdStore(db);
    this.core = new FirestoreCoreMutationStore(db, this.store);
  }

  private householdRef() {
    return this.db.collection('households').doc(HOUSEHOLD_ID);
  }

  private metaRef() {
    return this.householdRef().collection('meta').doc('state');
  }

  private async currentVersion(expectedVersion: number): Promise<number> {
    const snapshot = await this.metaRef().get();
    const currentVersion = Number(snapshot.data()?.version || 1);
    if (currentVersion !== expectedVersion) {
      const error: any = new Error(
        `Concurrent modification conflict: submitted version ${expectedVersion}, but server is at version ${currentVersion}. Refresh to load latest state.`
      );
      error.status = 409;
      error.serverVersion = currentVersion;
      throw error;
    }
    return currentVersion;
  }

  async createTransactionIdempotent(actor: MutationActor, input: TransactionMutationInput) {
    const currentVersion = await this.currentVersion(actor.expectedVersion);

    if (input.idempotencyKey) {
      const existing = await this.householdRef()
        .collection('transactions')
        .where('idempotencyKey', '==', input.idempotencyKey)
        .limit(1)
        .get();
      const doc = existing.docs[0];
      if (doc) {
        return {
          value: { id: doc.id, duplicatePrevented: true },
          version: currentVersion,
        };
      }
    }

    return this.core.createTransaction(actor, input);
  }

  async updatePlannedPayment(actor: MutationActor, input: PlannedPaymentMutationInput) {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_payment_updated',
          entityType: 'planned_payment',
          entityId: input.id,
          summary: `Updated planned payment: ${input.name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('plannedPayments', input.id);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Planned payment not found');
        transaction.update(ref, {
          name: input.name,
          amountPence: input.amountPence,
          month: input.month,
          responsiblePerson: input.responsiblePerson,
          accountId: input.accountId,
          dueDate: input.dueDate || null,
          categoryId: input.categoryId || null,
          status: input.status || 'unpaid',
          includeInTransferPlan: input.includeInTransferPlan !== false,
          notes: input.notes || null,
          updatedAt: actor.now,
          updatedBy: actor.actorEmail,
        });
        return { id: input.id };
      }
    );
  }

  async deletePlannedPayment(actor: MutationActor, paymentId: string) {
    const ref = this.householdRef().collection('plannedPayments').doc(paymentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Planned payment not found');
    const name = String(snapshot.data()?.name || '');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_payment_deleted',
          entityType: 'planned_payment',
          entityId: paymentId,
          summary: `Deleted planned payment: ${name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const currentRef = collectionRef('plannedPayments', paymentId);
        const current = await transaction.get(currentRef);
        if (!current.exists) throw new Error('Planned payment not found');
        transaction.delete(currentRef);
        return { id: paymentId };
      }
    );
  }

  async updatePlannedIncome(actor: MutationActor, input: PlannedIncomeMutationInput) {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_income_updated',
          entityType: 'planned_income',
          entityId: input.id,
          summary: `Updated planned income: ${input.name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('plannedIncomes', input.id);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Planned income not found');
        transaction.update(ref, {
          name: input.name,
          expectedAmountPence: input.expectedAmountPence,
          month: input.month,
          sourcePerson: input.sourcePerson,
          accountId: input.accountId,
          expectedDate: input.expectedDate || null,
          status: input.status || 'expected',
          notes: input.notes || null,
          updatedAt: actor.now,
          updatedBy: actor.actorEmail,
        });
        return { id: input.id };
      }
    );
  }

  async deletePlannedIncome(actor: MutationActor, incomeId: string) {
    const ref = this.householdRef().collection('plannedIncomes').doc(incomeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Planned income not found');
    const name = String(snapshot.data()?.name || '');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_income_deleted',
          entityType: 'planned_income',
          entityId: incomeId,
          summary: `Deleted planned income: ${name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const currentRef = collectionRef('plannedIncomes', incomeId);
        const current = await transaction.get(currentRef);
        if (!current.exists) throw new Error('Planned income not found');
        transaction.delete(currentRef);
        return { id: incomeId };
      }
    );
  }

  async bulkTogglePlannedPayments(actor: MutationActor, input: BulkToggleInput) {
    const snapshot = await this.householdRef().collection('plannedPayments').get();
    const matching = snapshot.docs.filter((doc) => {
      const data = doc.data();
      if (input.month && data.month !== input.month) return false;
      if (input.onlyUnpaid && data.status !== 'unpaid') return false;
      if (input.paymentIds?.length && !input.paymentIds.includes(doc.id)) return false;
      return true;
    });

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_payments_bulk_toggled',
          entityType: 'planned_payment',
          entityId: input.month || 'all',
          summary: `Bulk toggled transfer plan inclusion: ${input.include ? 'included' : 'excluded'}`,
        },
      },
      ({ transaction }) => {
        for (const doc of matching) {
          transaction.update(doc.ref, { includeInTransferPlan: input.include });
        }
        return { updatedCount: matching.length };
      }
    );
  }

  async importMonth(actor: MutationActor, input: MonthImportInput) {
    const payments = await this.householdRef().collection('plannedPayments').get();
    const sourceBills = payments.docs.filter((doc) => {
      const data = doc.data();
      if (data.month !== input.sourceMonth) return false;
      if (input.paymentIds?.length && !input.paymentIds.includes(doc.id)) return false;
      return true;
    });
    const targetBills = payments.docs.filter((doc) => doc.data().month === input.targetMonth);

    const imports = sourceBills.filter((source) => {
      const data = source.data();
      return !targetBills.some((target) => {
        const targetData = target.data();
        return (
          targetData.name === data.name &&
          targetData.amountPence === data.amountPence &&
          targetData.accountId === data.accountId
        );
      });
    });

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'month_imported',
          entityType: 'planned_payment',
          entityId: input.targetMonth,
          summary: `Imported ${imports.length} planned payments from ${input.sourceMonth} into ${input.targetMonth}`,
        },
      },
      ({ transaction, collectionRef }) => {
        for (const source of imports) {
          const data = source.data();
          const dueDate = data.dueDate
            ? `${input.targetMonth}-${String(data.dueDate).split('-')[2] || '01'}`
            : null;
          transaction.create(
            collectionRef('plannedPayments', importedPaymentId(source.id, input.targetMonth)),
            {
              name: data.name,
              amountPence: data.amountPence,
              month: input.targetMonth,
              responsiblePerson: data.responsiblePerson,
              accountId: data.accountId,
              dueDate,
              categoryId: data.categoryId || null,
              status: 'unpaid',
              includeInTransferPlan: data.includeInTransferPlan !== false,
              notes: data.notes || null,
              schemaVersion: CURRENT_SCHEMA_VERSION,
              createdAt: actor.now,
              createdBy: actor.actorEmail,
            }
          );
        }
        return { importedCount: imports.length, targetMonth: input.targetMonth };
      }
    );
  }

  async archiveOrDeleteAccount(actor: MutationActor, accountId: string) {
    const household = this.householdRef();
    const [transactions, plannedPayments] = await Promise.all([
      household.collection('transactions').get(),
      household.collection('plannedPayments').get(),
    ]);
    const referenced =
      transactions.docs.some((doc) => {
        const data = doc.data();
        return data.accountId === accountId || data.targetAccountId === accountId;
      }) ||
      plannedPayments.docs.some((doc) => doc.data().accountId === accountId);

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'account_archived',
          entityType: 'account',
          entityId: accountId,
          summary: `Archived account: ${accountId}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('accounts', accountId);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Account not found');

        if (referenced) {
          transaction.update(ref, { isActive: false, updatedAt: actor.now });
        } else {
          transaction.delete(ref);
        }
        return { id: accountId, archived: referenced };
      }
    );
  }

  async approveMember(actor: MutationActor, memberId: string, role: 'editor' | 'view_only') {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'member_approved',
          entityType: 'member',
          entityId: memberId,
          summary: `Approved member as ${role}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('members', memberId);
        const target = await transaction.get(ref);
        if (!target.exists) throw new Error('Member not found');
        transaction.update(ref, {
          role,
          approvedAt: actor.now,
          approvedBy: actor.actorEmail,
        });
        return { id: memberId, role };
      }
    );
  }

  async changeMemberRole(actor: MutationActor, memberId: string, newRole: UserRole) {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'member_role_changed',
          entityType: 'member',
          entityId: memberId,
          summary: `Changed member role to ${newRole}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('members', memberId);
        const target = await transaction.get(ref);
        if (!target.exists) throw new Error('Member not found');
        const targetEmail = normalizeEmail(String(target.data()?.email || ''));
        if (targetEmail === OWNER_EMAIL && newRole !== 'owner') {
          throw new Error('Cannot demote the sole household owner');
        }
        if (targetEmail !== OWNER_EMAIL && newRole === 'owner') {
          throw new Error('Only Marius may hold the Household Owner role');
        }
        transaction.update(ref, { role: newRole });
        return { id: memberId, role: newRole };
      }
    );
  }

  async removeMember(actor: MutationActor, memberId: string) {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'member_removed',
          entityType: 'member',
          entityId: memberId,
          summary: 'Removed member from household',
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('members', memberId);
        const target = await transaction.get(ref);
        if (!target.exists) throw new Error('Member not found');
        const targetEmail = normalizeEmail(String(target.data()?.email || ''));
        if (targetEmail === OWNER_EMAIL || target.data()?.role === 'owner') {
          throw new Error('Cannot remove household owner');
        }
        transaction.update(ref, { role: 'removed' });
        return { id: memberId, role: 'removed' as const };
      }
    );
  }
}
