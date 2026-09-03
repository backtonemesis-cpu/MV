import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AccountType,
  Payer,
  TransactionType,
  TransactionSplit,
} from '../../src/types';
import {
  bumpVersionAndLog,
  recalculateAccountBalance,
} from '../db';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import {
  assertSafeIntegerPence,
  type HouseholdMutationResult,
} from './contracts';
import { FirestoreHouseholdStore } from './firestoreStore';

export interface MutationActor {
  expectedVersion: number;
  actorEmail: string;
  now: string;
}

export interface TransactionMutationInput {
  id: string;
  date: string;
  description: string;
  amountPence: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  targetAccountId?: string;
  payer: Payer;
  notes?: string;
  isTransfer?: boolean;
  isRepayment?: boolean;
  isSavings?: boolean;
  isRefund?: boolean;
  originalTransactionId?: string;
  plannedPaymentId?: string;
  plannedIncomeId?: string;
  splits?: TransactionSplit[];
  idempotencyKey?: string;
  taxYear?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountMutationInput {
  id: string;
  name: string;
  type: AccountType;
  startingBalancePence: number;
  ownerPerson: Payer;
  creditLimitPence?: number;
  notes?: string;
}

export interface PlannedPaymentMutationInput {
  id: string;
  name: string;
  amountPence: number;
  month: string;
  responsiblePerson: Payer;
  accountId: string;
  dueDate?: string;
  categoryId?: string;
  status?: 'unpaid' | 'paid';
  includeInTransferPlan?: boolean;
  notes?: string;
}

export interface PlannedIncomeMutationInput {
  id: string;
  name: string;
  expectedAmountPence: number;
  month: string;
  sourcePerson: Payer;
  accountId: string;
  expectedDate?: string;
  status?: 'expected' | 'received' | 'partial';
  notes?: string;
}

export interface SavingsGoalMutationInput {
  id: string;
  name: string;
  targetPence: number;
  currentPence: number;
  targetDate?: string;
  accountId: string;
  linkedAccountId?: string;
}

export interface PaymentActualInput {
  actualTransactionId: string;
  actualAmountPence: number;
  actualDate: string;
  accountId?: string;
}

export interface TransferMutationInput {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountPence: number;
  description: string;
  date: string;
  payer: Payer;
}

export interface CoreMutationStore {
  createTransaction(actor: MutationActor, input: TransactionMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  updateTransaction(actor: MutationActor, input: TransactionMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  deleteTransaction(actor: MutationActor, transactionId: string): Promise<HouseholdMutationResult<{ id: string }>>;
  createAccount(actor: MutationActor, input: AccountMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  updateAccount(actor: MutationActor, input: AccountMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  reconcileAccount(
    actor: MutationActor,
    accountId: string,
    reconciledBalancePence: number,
    reconciliationDate: string
  ): Promise<HouseholdMutationResult<{ id: string }>>;
  createPlannedPayment(actor: MutationActor, input: PlannedPaymentMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  payPlannedPayment(
    actor: MutationActor,
    paymentId: string,
    actual: PaymentActualInput
  ): Promise<HouseholdMutationResult<{ id: string; actualTransactionId: string }>>;
  createPlannedIncome(actor: MutationActor, input: PlannedIncomeMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  receivePlannedIncome(
    actor: MutationActor,
    incomeId: string,
    actual: PaymentActualInput
  ): Promise<HouseholdMutationResult<{ id: string; actualTransactionId: string }>>;
  executeTransfer(actor: MutationActor, input: TransferMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  createSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  updateSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput): Promise<HouseholdMutationResult<{ id: string }>>;
  deleteSavingsGoal(actor: MutationActor, savingsGoalId: string): Promise<HouseholdMutationResult<{ id: string }>>;
}

function assertVersion(db: DatabaseSync, expectedVersion: number): void {
  const row = db.prepare('SELECT version FROM household_meta WHERE id = ?').get('household-mv') as any;
  const currentVersion = Number(row?.version || 1);
  if (currentVersion !== expectedVersion) {
    const error: any = new Error(
      `Concurrent modification conflict: submitted version ${expectedVersion}, but server is at version ${currentVersion}. Refresh to load latest state.`
    );
    error.status = 409;
    error.serverVersion = currentVersion;
    throw error;
  }
}

function sqliteResult<T>(value: T, version: number): HouseholdMutationResult<T> {
  return { value, version };
}

function boolInt(value: boolean | undefined): number {
  return value ? 1 : 0;
}

function safeJson(value: Record<string, unknown> | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

export class SqliteCoreMutationStore implements CoreMutationStore {
  constructor(private readonly db: DatabaseSync) {}

  async createTransaction(actor: MutationActor, input: TransactionMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');
    for (const split of input.splits || []) assertSafeIntegerPence(split.amountPence, 'split.amountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        INSERT INTO transactions (
          id, date, description, amount_pence, type, category_id, account_id,
          target_account_id, payer, notes, is_transfer, is_repayment, is_savings,
          is_refund, original_transaction_id, planned_payment_id, planned_income_id,
          schema_version, idempotency_key, tax_year, metadata_json, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.date,
        input.description,
        input.amountPence,
        input.type,
        input.categoryId,
        input.accountId,
        input.targetAccountId || null,
        input.payer,
        input.notes || null,
        boolInt(input.isTransfer),
        boolInt(input.isRepayment),
        boolInt(input.isSavings),
        boolInt(input.isRefund),
        input.originalTransactionId || null,
        input.plannedPaymentId || null,
        input.plannedIncomeId || null,
        CURRENT_SCHEMA_VERSION,
        input.idempotencyKey || null,
        input.taxYear || null,
        safeJson(input.metadata),
        actor.now,
        actor.actorEmail
      );

      const insertSplit = this.db.prepare(`
        INSERT INTO transaction_splits (id, transaction_id, category_id, amount_pence, payer, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const split of input.splits || []) {
        insertSplit.run(split.id, input.id, split.categoryId, split.amountPence, split.payer || null, split.notes || null);
      }

      recalculateAccountBalance(this.db, input.accountId);
      if (input.targetAccountId) recalculateAccountBalance(this.db, input.targetAccountId);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'transaction_created',
        'transaction',
        input.id,
        `Recorded ${input.type}: ${input.description} (${(input.amountPence / 100).toFixed(2)})`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async updateTransaction(actor: MutationActor, input: TransactionMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');
    for (const split of input.splits || []) assertSafeIntegerPence(split.amountPence, 'split.amountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(input.id) as any;
      if (!existing) throw new Error('Transaction not found');

      this.db.prepare(`
        UPDATE transactions SET
          date = ?, description = ?, amount_pence = ?, type = ?, category_id = ?,
          account_id = ?, target_account_id = ?, payer = ?, notes = ?,
          is_transfer = ?, is_repayment = ?, is_savings = ?, is_refund = ?,
          updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        input.date,
        input.description,
        input.amountPence,
        input.type,
        input.categoryId,
        input.accountId,
        input.targetAccountId || null,
        input.payer,
        input.notes || null,
        boolInt(input.isTransfer),
        boolInt(input.isRepayment),
        boolInt(input.isSavings),
        boolInt(input.isRefund),
        actor.now,
        actor.actorEmail,
        input.id
      );

      this.db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(input.id);
      const insertSplit = this.db.prepare(`
        INSERT INTO transaction_splits (id, transaction_id, category_id, amount_pence, payer, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const split of input.splits || []) {
        insertSplit.run(split.id, input.id, split.categoryId, split.amountPence, split.payer || null, split.notes || null);
      }

      recalculateAccountBalance(this.db, existing.account_id);
      recalculateAccountBalance(this.db, input.accountId);
      if (existing.target_account_id) recalculateAccountBalance(this.db, existing.target_account_id);
      if (input.targetAccountId) recalculateAccountBalance(this.db, input.targetAccountId);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'transaction_updated',
        'transaction',
        input.id,
        `Updated transaction: ${input.description}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deleteTransaction(actor: MutationActor, transactionId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any;
      if (!existing) throw new Error('Transaction not found');

      this.db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(transactionId);
      this.db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);

      if (existing.planned_payment_id) {
        this.db.prepare(`
          UPDATE planned_payments SET
            status = 'unpaid', actual_amount_pence = NULL, actual_date = NULL, actual_transaction_id = NULL
          WHERE id = ?
        `).run(existing.planned_payment_id);
      }
      if (existing.planned_income_id) {
        this.db.prepare(`
          UPDATE planned_incomes SET
            status = 'expected', actual_amount_pence = NULL, actual_date = NULL, actual_transaction_id = NULL
          WHERE id = ?
        `).run(existing.planned_income_id);
      }

      recalculateAccountBalance(this.db, existing.account_id);
      if (existing.target_account_id) recalculateAccountBalance(this.db, existing.target_account_id);

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'transaction_deleted',
        'transaction',
        transactionId,
        `Deleted transaction: ${existing.description}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: transactionId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async createAccount(actor: MutationActor, input: AccountMutationInput) {
    assertSafeIntegerPence(input.startingBalancePence, 'startingBalancePence');
    if (input.creditLimitPence !== undefined) assertSafeIntegerPence(input.creditLimitPence, 'creditLimitPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        INSERT INTO accounts (
          id, name, type, currency, starting_balance_pence, current_balance_pence,
          owner_person, is_active, credit_limit_pence, notes, schema_version, created_at, updated_at
        ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.name,
        input.type,
        input.startingBalancePence,
        input.startingBalancePence,
        input.ownerPerson,
        input.creditLimitPence ?? null,
        input.notes || null,
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.now
      );
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'account_created',
        'account',
        input.id,
        `Created account: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async updateAccount(actor: MutationActor, input: AccountMutationInput) {
    assertSafeIntegerPence(input.startingBalancePence, 'startingBalancePence');
    if (input.creditLimitPence !== undefined) assertSafeIntegerPence(input.creditLimitPence, 'creditLimitPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const existing = this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.id);
      if (!existing) throw new Error('Account not found');

      this.db.prepare(`
        UPDATE accounts SET
          name = ?, type = ?, owner_person = ?, starting_balance_pence = ?,
          credit_limit_pence = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.name,
        input.type,
        input.ownerPerson,
        input.startingBalancePence,
        input.creditLimitPence ?? null,
        input.notes || null,
        actor.now,
        input.id
      );

      recalculateAccountBalance(this.db, input.id);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'account_updated',
        'account',
        input.id,
        `Updated account: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async reconcileAccount(
    actor: MutationActor,
    accountId: string,
    reconciledBalancePence: number,
    reconciliationDate: string
  ) {
    assertSafeIntegerPence(reconciledBalancePence, 'reconciledBalancePence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
      if (!account) throw new Error('Account not found');

      this.db.prepare(`
        UPDATE accounts SET
          reconciled_balance_pence = ?, reconciliation_date = ?, reconciled_at = ?, updated_at = ?
        WHERE id = ?
      `).run(reconciledBalancePence, reconciliationDate, actor.now, actor.now, accountId);

      const calculatedBalance = recalculateAccountBalance(this.db, accountId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'account_reconciled',
        'account',
        accountId,
        `Reconciled ${account.name} to ${(reconciledBalancePence / 100).toFixed(2)} as at ${reconciliationDate}. Post-reconcile balance: ${(calculatedBalance / 100).toFixed(2)}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: accountId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async createPlannedPayment(actor: MutationActor, input: PlannedPaymentMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        INSERT INTO planned_payments (
          id, name, amount_pence, month, responsible_person, account_id,
          due_date, category_id, status, include_in_transfer_plan, notes,
          schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
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
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.actorEmail
      );

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_payment_created',
        'planned_payment',
        input.id,
        `Added planned payment: ${input.name} (${(input.amountPence / 100).toFixed(2)}) for ${input.month}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async payPlannedPayment(actor: MutationActor, paymentId: string, actual: PaymentActualInput) {
    assertSafeIntegerPence(actual.actualAmountPence, 'actualAmountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const payment = this.db.prepare('SELECT * FROM planned_payments WHERE id = ?').get(paymentId) as any;
      if (!payment) throw new Error('Planned payment not found');

      const accountId = actual.accountId || payment.account_id;
      const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
      if (!account) throw new Error('Payment account does not exist');

      this.db.prepare(`
        INSERT INTO transactions (
          id, date, description, amount_pence, type, category_id, account_id,
          payer, planned_payment_id, schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        actual.actualTransactionId,
        actual.actualDate,
        `Payment: ${payment.name}`,
        actual.actualAmountPence,
        payment.category_id || 'cat-housing',
        accountId,
        payment.responsible_person,
        paymentId,
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.actorEmail
      );

      this.db.prepare(`
        UPDATE planned_payments SET
          status = 'paid', actual_amount_pence = ?, actual_date = ?, actual_transaction_id = ?,
          updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        actual.actualAmountPence,
        actual.actualDate,
        actual.actualTransactionId,
        actor.now,
        actor.actorEmail,
        paymentId
      );

      recalculateAccountBalance(this.db, accountId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_payment_paid',
        'planned_payment',
        paymentId,
        `Marked ${payment.name} paid: £${(actual.actualAmountPence / 100).toFixed(2)} from ${account.name} on ${actual.actualDate}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: paymentId, actualTransactionId: actual.actualTransactionId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async createPlannedIncome(actor: MutationActor, input: PlannedIncomeMutationInput) {
    assertSafeIntegerPence(input.expectedAmountPence, 'expectedAmountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        INSERT INTO planned_incomes (
          id, name, expected_amount_pence, month, source_person, account_id,
          expected_date, status, notes, schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.name,
        input.expectedAmountPence,
        input.month,
        input.sourcePerson,
        input.accountId,
        input.expectedDate || null,
        input.status || 'expected',
        input.notes || null,
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.actorEmail
      );

      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_income_created',
        'planned_income',
        input.id,
        `Expected income: ${input.name} (£${(input.expectedAmountPence / 100).toFixed(2)}) for ${input.month}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async receivePlannedIncome(actor: MutationActor, incomeId: string, actual: PaymentActualInput) {
    assertSafeIntegerPence(actual.actualAmountPence, 'actualAmountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const income = this.db.prepare('SELECT * FROM planned_incomes WHERE id = ?').get(incomeId) as any;
      if (!income) throw new Error('Planned income not found');

      const accountId = actual.accountId || income.account_id;
      const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
      if (!account) throw new Error('Receiving account does not exist');

      this.db.prepare(`
        INSERT INTO transactions (
          id, date, description, amount_pence, type, category_id, account_id,
          payer, planned_income_id, schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, 'income', 'cat-salary', ?, ?, ?, ?, ?, ?)
      `).run(
        actual.actualTransactionId,
        actual.actualDate,
        `Income: ${income.name}`,
        actual.actualAmountPence,
        accountId,
        income.source_person,
        incomeId,
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.actorEmail
      );

      this.db.prepare(`
        UPDATE planned_incomes SET
          status = 'received', actual_amount_pence = ?, actual_date = ?, actual_transaction_id = ?,
          updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        actual.actualAmountPence,
        actual.actualDate,
        actual.actualTransactionId,
        actor.now,
        actor.actorEmail,
        incomeId
      );

      recalculateAccountBalance(this.db, accountId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'planned_income_received',
        'planned_income',
        incomeId,
        `Received ${income.name}: £${(actual.actualAmountPence / 100).toFixed(2)} into ${account.name} on ${actual.actualDate}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: incomeId, actualTransactionId: actual.actualTransactionId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async executeTransfer(actor: MutationActor, input: TransferMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      const source = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(input.sourceAccountId) as any;
      const destination = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(input.destinationAccountId) as any;
      if (!source || !destination) throw new Error('Source or destination account not found');

      this.db.prepare(`
        INSERT INTO transactions (
          id, date, description, amount_pence, type, category_id, account_id,
          target_account_id, payer, is_transfer, schema_version, created_at, created_by
        ) VALUES (?, ?, ?, ?, 'transfer', 'cat-transfer', ?, ?, ?, 1, ?, ?, ?)
      `).run(
        input.id,
        input.date,
        input.description,
        input.amountPence,
        input.sourceAccountId,
        input.destinationAccountId,
        input.payer,
        CURRENT_SCHEMA_VERSION,
        actor.now,
        actor.actorEmail
      );

      recalculateAccountBalance(this.db, input.sourceAccountId);
      recalculateAccountBalance(this.db, input.destinationAccountId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'transfer_plan_executed',
        'transaction',
        input.id,
        `Executed transfer plan funding: £${(input.amountPence / 100).toFixed(2)} from ${source.name} to ${destination.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async createSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput) {
    assertSafeIntegerPence(input.targetPence, 'targetPence');
    assertSafeIntegerPence(input.currentPence, 'currentPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        INSERT INTO savings_goals (
          id, name, target_pence, current_pence, target_date, account_id,
          linked_account_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.name,
        input.targetPence,
        input.currentPence,
        input.targetDate || null,
        input.accountId,
        input.linkedAccountId || null,
        actor.now,
        actor.now
      );
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'savings_created',
        'savings',
        input.id,
        `Created savings goal: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async updateSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput) {
    assertSafeIntegerPence(input.targetPence, 'targetPence');
    assertSafeIntegerPence(input.currentPence, 'currentPence');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare(`
        UPDATE savings_goals SET
          name = ?, target_pence = ?, current_pence = ?, target_date = ?,
          account_id = ?, linked_account_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.name,
        input.targetPence,
        input.currentPence,
        input.targetDate || null,
        input.accountId,
        input.linkedAccountId || null,
        actor.now,
        input.id
      );
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'savings_updated',
        'savings',
        input.id,
        `Updated savings goal: ${input.name}`
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: input.id }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deleteSavingsGoal(actor: MutationActor, savingsGoalId: string) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      assertVersion(this.db, actor.expectedVersion);
      this.db.prepare('DELETE FROM savings_goals WHERE id = ?').run(savingsGoalId);
      const version = bumpVersionAndLog(
        this.db,
        actor.actorEmail,
        'savings_deleted',
        'savings',
        savingsGoalId,
        'Deleted savings goal'
      );
      this.db.exec('COMMIT;');
      return sqliteResult({ id: savingsGoalId }, version);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }
}

function firestoreDocData(input: TransactionMutationInput, actor: MutationActor) {
  return {
    date: input.date,
    description: input.description,
    amountPence: input.amountPence,
    type: input.type,
    categoryId: input.categoryId,
    accountId: input.accountId,
    targetAccountId: input.targetAccountId || null,
    payer: input.payer,
    notes: input.notes || null,
    isTransfer: Boolean(input.isTransfer),
    isRepayment: Boolean(input.isRepayment),
    isSavings: Boolean(input.isSavings),
    isRefund: Boolean(input.isRefund),
    originalTransactionId: input.originalTransactionId || null,
    plannedPaymentId: input.plannedPaymentId || null,
    plannedIncomeId: input.plannedIncomeId || null,
    idempotencyKey: input.idempotencyKey || null,
    taxYear: input.taxYear || null,
    metadata: input.metadata || null,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: actor.now,
    createdBy: actor.actorEmail,
  };
}

export class FirestoreCoreMutationStore implements CoreMutationStore {
  private readonly store: FirestoreHouseholdStore;

  constructor(private readonly db: Firestore, store?: FirestoreHouseholdStore) {
    this.store = store || new FirestoreHouseholdStore(db);
  }

  private householdRef() {
    return this.db.collection('households').doc('household-mv');
  }

  async createTransaction(actor: MutationActor, input: TransactionMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');
    for (const split of input.splits || []) assertSafeIntegerPence(split.amountPence, 'split.amountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'transaction_created',
          entityType: 'transaction',
          entityId: input.id,
          summary: `Recorded ${input.type}: ${input.description} (${(input.amountPence / 100).toFixed(2)})`,
        },
      },
      ({ transaction, collectionRef }) => {
        const txRef = collectionRef('transactions', input.id);
        transaction.create(txRef, firestoreDocData(input, actor));
        for (const split of input.splits || []) {
          transaction.create(txRef.collection('splits').doc(split.id), {
            categoryId: split.categoryId,
            amountPence: split.amountPence,
            payer: split.payer || null,
            notes: split.notes || null,
          });
        }
        return { id: input.id };
      }
    );
  }

  async updateTransaction(actor: MutationActor, input: TransactionMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');
    for (const split of input.splits || []) assertSafeIntegerPence(split.amountPence, 'split.amountPence');

    const txRef = this.householdRef().collection('transactions').doc(input.id);
    const existingSplits = await txRef.collection('splits').get();

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'transaction_updated',
          entityType: 'transaction',
          entityId: input.id,
          summary: `Updated transaction: ${input.description}`,
        },
      },
      async ({ transaction }) => {
        const existing = await transaction.get(txRef);
        if (!existing.exists) throw new Error('Transaction not found');

        transaction.update(txRef, {
          date: input.date,
          description: input.description,
          amountPence: input.amountPence,
          type: input.type,
          categoryId: input.categoryId,
          accountId: input.accountId,
          targetAccountId: input.targetAccountId || null,
          payer: input.payer,
          notes: input.notes || null,
          isTransfer: Boolean(input.isTransfer),
          isRepayment: Boolean(input.isRepayment),
          isSavings: Boolean(input.isSavings),
          isRefund: Boolean(input.isRefund),
          updatedAt: actor.now,
          updatedBy: actor.actorEmail,
        });

        for (const doc of existingSplits.docs) transaction.delete(doc.ref);
        for (const split of input.splits || []) {
          transaction.create(txRef.collection('splits').doc(split.id), {
            categoryId: split.categoryId,
            amountPence: split.amountPence,
            payer: split.payer || null,
            notes: split.notes || null,
          });
        }
        return { id: input.id };
      }
    );
  }

  async deleteTransaction(actor: MutationActor, transactionId: string) {
    const txRef = this.householdRef().collection('transactions').doc(transactionId);
    const existingSplits = await txRef.collection('splits').get();

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'transaction_deleted',
          entityType: 'transaction',
          entityId: transactionId,
          summary: `Deleted transaction: ${transactionId}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const existing = await transaction.get(txRef);
        if (!existing.exists) throw new Error('Transaction not found');
        const data = existing.data() || {};

        for (const doc of existingSplits.docs) transaction.delete(doc.ref);
        transaction.delete(txRef);

        if (data.plannedPaymentId) {
          transaction.update(collectionRef('plannedPayments', String(data.plannedPaymentId)), {
            status: 'unpaid',
            actualAmountPence: null,
            actualDate: null,
            actualTransactionId: null,
          });
        }
        if (data.plannedIncomeId) {
          transaction.update(collectionRef('plannedIncomes', String(data.plannedIncomeId)), {
            status: 'expected',
            actualAmountPence: null,
            actualDate: null,
            actualTransactionId: null,
          });
        }

        return { id: transactionId };
      }
    );
  }

  async createAccount(actor: MutationActor, input: AccountMutationInput) {
    assertSafeIntegerPence(input.startingBalancePence, 'startingBalancePence');
    if (input.creditLimitPence !== undefined) assertSafeIntegerPence(input.creditLimitPence, 'creditLimitPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'account_created',
          entityType: 'account',
          entityId: input.id,
          summary: `Created account: ${input.name}`,
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('accounts', input.id), {
          name: input.name,
          type: input.type,
          currency: 'GBP',
          startingBalancePence: input.startingBalancePence,
          currentBalancePence: input.startingBalancePence,
          ownerPerson: input.ownerPerson,
          isActive: true,
          creditLimitPence: input.creditLimitPence ?? null,
          notes: input.notes || null,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          updatedAt: actor.now,
        });
        return { id: input.id };
      }
    );
  }

  async updateAccount(actor: MutationActor, input: AccountMutationInput) {
    assertSafeIntegerPence(input.startingBalancePence, 'startingBalancePence');
    if (input.creditLimitPence !== undefined) assertSafeIntegerPence(input.creditLimitPence, 'creditLimitPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'account_updated',
          entityType: 'account',
          entityId: input.id,
          summary: `Updated account: ${input.name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('accounts', input.id);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Account not found');

        transaction.update(ref, {
          name: input.name,
          type: input.type,
          ownerPerson: input.ownerPerson,
          startingBalancePence: input.startingBalancePence,
          creditLimitPence: input.creditLimitPence ?? null,
          notes: input.notes || null,
          updatedAt: actor.now,
        });
        return { id: input.id };
      }
    );
  }

  async reconcileAccount(
    actor: MutationActor,
    accountId: string,
    reconciledBalancePence: number,
    reconciliationDate: string
  ) {
    assertSafeIntegerPence(reconciledBalancePence, 'reconciledBalancePence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'account_reconciled',
          entityType: 'account',
          entityId: accountId,
          summary: `Reconciled account to ${(reconciledBalancePence / 100).toFixed(2)} as at ${reconciliationDate}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('accounts', accountId);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Account not found');

        transaction.update(ref, {
          reconciledBalancePence,
          reconciliationDate,
          reconciledAt: actor.now,
          updatedAt: actor.now,
        });
        return { id: accountId };
      }
    );
  }

  async createPlannedPayment(actor: MutationActor, input: PlannedPaymentMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_payment_created',
          entityType: 'planned_payment',
          entityId: input.id,
          summary: `Added planned payment: ${input.name} (${(input.amountPence / 100).toFixed(2)}) for ${input.month}`,
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('plannedPayments', input.id), {
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
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          createdBy: actor.actorEmail,
        });
        return { id: input.id };
      }
    );
  }

  async payPlannedPayment(actor: MutationActor, paymentId: string, actual: PaymentActualInput) {
    assertSafeIntegerPence(actual.actualAmountPence, 'actualAmountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_payment_paid',
          entityType: 'planned_payment',
          entityId: paymentId,
          summary: `Marked planned payment paid: £${(actual.actualAmountPence / 100).toFixed(2)} on ${actual.actualDate}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const paymentRef = collectionRef('plannedPayments', paymentId);
        const paymentSnapshot = await transaction.get(paymentRef);
        if (!paymentSnapshot.exists) throw new Error('Planned payment not found');
        const payment = paymentSnapshot.data() || {};
        const accountId = actual.accountId || String(payment.accountId || '');
        const accountRef = collectionRef('accounts', accountId);
        const accountSnapshot = await transaction.get(accountRef);
        if (!accountSnapshot.exists) throw new Error('Payment account does not exist');

        const txRef = collectionRef('transactions', actual.actualTransactionId);
        transaction.create(txRef, {
          date: actual.actualDate,
          description: `Payment: ${String(payment.name || '')}`,
          amountPence: actual.actualAmountPence,
          type: 'expense',
          categoryId: payment.categoryId || 'cat-housing',
          accountId,
          payer: payment.responsiblePerson,
          isTransfer: false,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          plannedPaymentId: paymentId,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          createdBy: actor.actorEmail,
        });
        transaction.update(paymentRef, {
          status: 'paid',
          actualAmountPence: actual.actualAmountPence,
          actualDate: actual.actualDate,
          actualTransactionId: actual.actualTransactionId,
          updatedAt: actor.now,
          updatedBy: actor.actorEmail,
        });
        return { id: paymentId, actualTransactionId: actual.actualTransactionId };
      }
    );
  }

  async createPlannedIncome(actor: MutationActor, input: PlannedIncomeMutationInput) {
    assertSafeIntegerPence(input.expectedAmountPence, 'expectedAmountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_income_created',
          entityType: 'planned_income',
          entityId: input.id,
          summary: `Expected income: ${input.name} (£${(input.expectedAmountPence / 100).toFixed(2)}) for ${input.month}`,
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('plannedIncomes', input.id), {
          name: input.name,
          expectedAmountPence: input.expectedAmountPence,
          month: input.month,
          sourcePerson: input.sourcePerson,
          accountId: input.accountId,
          expectedDate: input.expectedDate || null,
          status: input.status || 'expected',
          notes: input.notes || null,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          createdBy: actor.actorEmail,
        });
        return { id: input.id };
      }
    );
  }

  async receivePlannedIncome(actor: MutationActor, incomeId: string, actual: PaymentActualInput) {
    assertSafeIntegerPence(actual.actualAmountPence, 'actualAmountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'planned_income_received',
          entityType: 'planned_income',
          entityId: incomeId,
          summary: `Received planned income: £${(actual.actualAmountPence / 100).toFixed(2)} on ${actual.actualDate}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const incomeRef = collectionRef('plannedIncomes', incomeId);
        const incomeSnapshot = await transaction.get(incomeRef);
        if (!incomeSnapshot.exists) throw new Error('Planned income not found');
        const income = incomeSnapshot.data() || {};
        const accountId = actual.accountId || String(income.accountId || '');
        const accountRef = collectionRef('accounts', accountId);
        const accountSnapshot = await transaction.get(accountRef);
        if (!accountSnapshot.exists) throw new Error('Receiving account does not exist');

        transaction.create(collectionRef('transactions', actual.actualTransactionId), {
          date: actual.actualDate,
          description: `Income: ${String(income.name || '')}`,
          amountPence: actual.actualAmountPence,
          type: 'income',
          categoryId: 'cat-salary',
          accountId,
          payer: income.sourcePerson,
          isTransfer: false,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          plannedIncomeId: incomeId,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          createdBy: actor.actorEmail,
        });
        transaction.update(incomeRef, {
          status: 'received',
          actualAmountPence: actual.actualAmountPence,
          actualDate: actual.actualDate,
          actualTransactionId: actual.actualTransactionId,
          updatedAt: actor.now,
          updatedBy: actor.actorEmail,
        });
        return { id: incomeId, actualTransactionId: actual.actualTransactionId };
      }
    );
  }

  async executeTransfer(actor: MutationActor, input: TransferMutationInput) {
    assertSafeIntegerPence(input.amountPence, 'amountPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'transfer_plan_executed',
          entityType: 'transaction',
          entityId: input.id,
          summary: `Executed transfer plan funding: £${(input.amountPence / 100).toFixed(2)}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const sourceRef = collectionRef('accounts', input.sourceAccountId);
        const destinationRef = collectionRef('accounts', input.destinationAccountId);
        const [source, destination] = await Promise.all([
          transaction.get(sourceRef),
          transaction.get(destinationRef),
        ]);
        if (!source.exists || !destination.exists) throw new Error('Source or destination account not found');

        transaction.create(collectionRef('transactions', input.id), {
          date: input.date,
          description: input.description,
          amountPence: input.amountPence,
          type: 'transfer',
          categoryId: 'cat-transfer',
          accountId: input.sourceAccountId,
          targetAccountId: input.destinationAccountId,
          payer: input.payer,
          isTransfer: true,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: actor.now,
          createdBy: actor.actorEmail,
        });
        return { id: input.id };
      }
    );
  }

  async createSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput) {
    assertSafeIntegerPence(input.targetPence, 'targetPence');
    assertSafeIntegerPence(input.currentPence, 'currentPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'savings_created',
          entityType: 'savings',
          entityId: input.id,
          summary: `Created savings goal: ${input.name}`,
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('savingsGoals', input.id), {
          name: input.name,
          targetPence: input.targetPence,
          currentPence: input.currentPence,
          targetDate: input.targetDate || null,
          accountId: input.accountId,
          linkedAccountId: input.linkedAccountId || null,
        });
        return { id: input.id };
      }
    );
  }

  async updateSavingsGoal(actor: MutationActor, input: SavingsGoalMutationInput) {
    assertSafeIntegerPence(input.targetPence, 'targetPence');
    assertSafeIntegerPence(input.currentPence, 'currentPence');

    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'savings_updated',
          entityType: 'savings',
          entityId: input.id,
          summary: `Updated savings goal: ${input.name}`,
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('savingsGoals', input.id);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Savings goal not found');
        transaction.update(ref, {
          name: input.name,
          targetPence: input.targetPence,
          currentPence: input.currentPence,
          targetDate: input.targetDate || null,
          accountId: input.accountId,
          linkedAccountId: input.linkedAccountId || null,
        });
        return { id: input.id };
      }
    );
  }

  async deleteSavingsGoal(actor: MutationActor, savingsGoalId: string) {
    return this.store.runMutation(
      {
        expectedVersion: actor.expectedVersion,
        actorEmail: actor.actorEmail,
        audit: {
          action: 'savings_deleted',
          entityType: 'savings',
          entityId: savingsGoalId,
          summary: 'Deleted savings goal',
        },
      },
      async ({ transaction, collectionRef }) => {
        const ref = collectionRef('savingsGoals', savingsGoalId);
        const existing = await transaction.get(ref);
        if (!existing.exists) throw new Error('Savings goal not found');
        transaction.delete(ref);
        return { id: savingsGoalId };
      }
    );
  }
}
