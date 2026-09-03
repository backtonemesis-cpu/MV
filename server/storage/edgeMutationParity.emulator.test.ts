import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import type { HouseholdData } from '../../src/types';
import { initDb, getHouseholdData as getSqliteHouseholdData } from '../db';
import { getMvFirestore } from '../firestoreAdmin';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import { FirestoreHouseholdStore } from './firestoreStore';
import {
  FirestoreEdgeMutationStore,
  SqliteEdgeMutationStore,
  type EdgeMutationStore,
} from './edgeMutations';
import { HOUSEHOLD_ID } from './contracts';
import type { MutationActor, TransactionMutationInput } from './coreMutations';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const OWNER_EMAIL = 'backtonemesis@gmail.com';
const VESTA_EMAIL = 'vestajuskaite@gmail.com';
const T0 = '2026-09-03T15:00:00.000Z';

function actor(expectedVersion: number, minute = expectedVersion): MutationActor {
  return {
    expectedVersion,
    actorEmail: OWNER_EMAIL,
    now: `2026-09-03T15:${String(minute).padStart(2, '0')}:00.000Z`,
  };
}

function seedSqlite(db: DatabaseSync) {
  db.exec(`
    DELETE FROM transaction_splits;
    DELETE FROM transactions;
    DELETE FROM planned_payments;
    DELETE FROM planned_incomes;
    DELETE FROM savings_goals;
    DELETE FROM audit_logs;
    DELETE FROM categories;
    DELETE FROM accounts;
    DELETE FROM user_sessions;
    DELETE FROM user_preferences;
    DELETE FROM users;
  `);

  db.prepare(`
    UPDATE household_meta
    SET name = ?, currency = 'GBP', version = 1, updated_at = ?
    WHERE id = ?
  `).run('Marius & Vesta Household', T0, HOUSEHOLD_ID);

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, email, password_hash, salt, display_name, role,
      joined_at, approved_at, approved_by, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(
    'member-marius', OWNER_EMAIL, 'unused', 'unused', 'Marius', 'owner',
    '2026-08-01T10:00:00.000Z', '2026-08-01T10:00:00.000Z', OWNER_EMAIL, T0
  );
  insertUser.run(
    'member-vesta', VESTA_EMAIL, 'unused', 'unused', 'Vesta', 'pending',
    '2026-08-02T10:00:00.000Z', null, null, T0
  );

  db.prepare(`
    INSERT INTO user_sessions (token_hash, user_id, email, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('session-vesta', 'member-vesta', VESTA_EMAIL, 'pending', 1999999999999, T0);

  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      id, name, type, currency, starting_balance_pence, current_balance_pence,
      owner_person, is_active, created_at, updated_at, schema_version
    ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, 1, ?, ?, ?)
  `);
  insertAccount.run('acc-main', 'Marius Current', 'current', 100_000, 100_000, 'Marius', T0, T0, CURRENT_SCHEMA_VERSION);
  insertAccount.run('acc-savings', 'Joint Savings', 'savings', 20_000, 20_000, 'Joint', T0, T0, CURRENT_SCHEMA_VERSION);
  insertAccount.run('acc-referenced', 'Referenced Account', 'current', 5_000, 5_000, 'Joint', T0, T0, CURRENT_SCHEMA_VERSION);
  insertAccount.run('acc-unused', 'Unused Account', 'cash', 2_000, 2_000, 'Joint', T0, T0, CURRENT_SCHEMA_VERSION);

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, group_name, monthly_budget_pence, icon, is_archived)
    VALUES (?, ?, ?, 0, ?, 0)
  `);
  insertCategory.run('cat-groceries', 'Groceries', 'Living', 'shopping-basket');
  insertCategory.run('cat-housing', 'Housing', 'Bills', 'home');
  insertCategory.run('cat-salary', 'Salary', 'Income', 'wallet');
  insertCategory.run('cat-transfer', 'Internal Transfer', 'Savings', 'arrow-right-left');

  db.prepare(`
    INSERT INTO transactions (
      id, date, description, amount_pence, type, category_id, account_id,
      payer, is_transfer, is_repayment, is_savings, is_refund,
      schema_version, created_at, created_by
    ) VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, 0, 0, 0, 0, ?, ?, ?)
  `).run(
    'tx-reference',
    '2026-09-03',
    'Keeps account referenced',
    1_000,
    'cat-groceries',
    'acc-referenced',
    'Joint',
    CURRENT_SCHEMA_VERSION,
    T0,
    OWNER_EMAIL
  );

  const insertPayment = db.prepare(`
    INSERT INTO planned_payments (
      id, name, amount_pence, month, responsible_person, account_id,
      due_date, category_id, status, include_in_transfer_plan, notes,
      schema_version, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPayment.run(
    'bill-source-rent', 'Rent', 50_000, '2026-09', 'Marius', 'acc-main',
    '2026-09-05', 'cat-housing', 'unpaid', 1, 'Carry over', CURRENT_SCHEMA_VERSION, T0, OWNER_EMAIL
  );
  insertPayment.run(
    'bill-source-broadband', 'Broadband', 3_000, '2026-09', 'Vesta', 'acc-main',
    '2026-09-12', 'cat-housing', 'unpaid', 1, 'Carry over too', CURRENT_SCHEMA_VERSION, T0, OWNER_EMAIL
  );
  insertPayment.run(
    'bill-paid-water', 'Water', 2_000, '2026-09', 'Marius', 'acc-main',
    '2026-09-15', 'cat-housing', 'paid', 1, null, CURRENT_SCHEMA_VERSION, T0, OWNER_EMAIL
  );
  insertPayment.run(
    'bill-target-rent', 'Rent', 50_000, '2026-10', 'Marius', 'acc-main',
    '2026-10-05', 'cat-housing', 'unpaid', 1, 'Already present', CURRENT_SCHEMA_VERSION, T0, OWNER_EMAIL
  );

  db.prepare(`
    INSERT INTO planned_incomes (
      id, name, expected_amount_pence, month, source_person, account_id,
      expected_date, status, notes, schema_version, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'income-benefit', 'Child Benefit', 10_000, '2026-09', 'Vesta', 'acc-main',
    '2026-09-18', 'expected', 'Expected household income', CURRENT_SCHEMA_VERSION, T0, OWNER_EMAIL
  );
}

async function seedFirestore(db: Firestore) {
  const household = db.collection('households').doc(HOUSEHOLD_ID);
  await db.recursiveDelete(household);

  await household.set({
    id: HOUSEHOLD_ID,
    name: 'Marius & Vesta Household',
    currency: 'GBP',
  });
  await household.collection('meta').doc('state').set({
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: T0,
  });

  await Promise.all([
    household.collection('members').doc('member-marius').set({
      email: OWNER_EMAIL,
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-08-01T10:00:00.000Z',
      approvedAt: '2026-08-01T10:00:00.000Z',
      approvedBy: OWNER_EMAIL,
      lastActiveAt: T0,
    }),
    household.collection('members').doc('member-vesta').set({
      email: VESTA_EMAIL,
      name: 'Vesta',
      role: 'pending',
      joinedAt: '2026-08-02T10:00:00.000Z',
      lastActiveAt: T0,
    }),
  ]);

  const accountData = [
    ['acc-main', 'Marius Current', 'current', 100_000, 'Marius'],
    ['acc-savings', 'Joint Savings', 'savings', 20_000, 'Joint'],
    ['acc-referenced', 'Referenced Account', 'current', 5_000, 'Joint'],
    ['acc-unused', 'Unused Account', 'cash', 2_000, 'Joint'],
  ] as const;
  await Promise.all(
    accountData.map(([id, name, type, balance, ownerPerson]) =>
      household.collection('accounts').doc(id).set({
        name,
        type,
        currency: 'GBP',
        startingBalancePence: balance,
        currentBalancePence: balance,
        ownerPerson,
        isActive: true,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      })
    )
  );

  const categories = [
    ['cat-groceries', 'Groceries', 'Living', 'shopping-basket'],
    ['cat-housing', 'Housing', 'Bills', 'home'],
    ['cat-salary', 'Salary', 'Income', 'wallet'],
    ['cat-transfer', 'Internal Transfer', 'Savings', 'arrow-right-left'],
  ] as const;
  await Promise.all(
    categories.map(([id, name, group, icon]) =>
      household.collection('categories').doc(id).set({
        name,
        group,
        monthlyBudgetPence: 0,
        icon,
        isArchived: false,
      })
    )
  );

  await household.collection('transactions').doc('tx-reference').set({
    date: '2026-09-03',
    description: 'Keeps account referenced',
    amountPence: 1_000,
    type: 'expense',
    categoryId: 'cat-groceries',
    accountId: 'acc-referenced',
    payer: 'Joint',
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: T0,
    createdBy: OWNER_EMAIL,
  });

  const paymentData = [
    ['bill-source-rent', 'Rent', 50_000, '2026-09', 'Marius', '2026-09-05', 'unpaid', true, 'Carry over'],
    ['bill-source-broadband', 'Broadband', 3_000, '2026-09', 'Vesta', '2026-09-12', 'unpaid', true, 'Carry over too'],
    ['bill-paid-water', 'Water', 2_000, '2026-09', 'Marius', '2026-09-15', 'paid', true, null],
    ['bill-target-rent', 'Rent', 50_000, '2026-10', 'Marius', '2026-10-05', 'unpaid', true, 'Already present'],
  ] as const;
  await Promise.all(
    paymentData.map(([id, name, amountPence, month, responsiblePerson, dueDate, status, includeInTransferPlan, notes]) =>
      household.collection('plannedPayments').doc(id).set({
        name,
        amountPence,
        month,
        responsiblePerson,
        accountId: 'acc-main',
        dueDate,
        categoryId: 'cat-housing',
        status,
        includeInTransferPlan,
        notes,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: T0,
        createdBy: OWNER_EMAIL,
      })
    )
  );

  await household.collection('plannedIncomes').doc('income-benefit').set({
    name: 'Child Benefit',
    expectedAmountPence: 10_000,
    month: '2026-09',
    sourcePerson: 'Vesta',
    accountId: 'acc-main',
    expectedDate: '2026-09-18',
    status: 'expected',
    notes: 'Expected household income',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: T0,
    createdBy: OWNER_EMAIL,
  });
}

function projection(data: HouseholdData) {
  return {
    id: data.id,
    name: data.name,
    version: data.version,
    members: data.members,
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    savingsGoals: data.savingsGoals,
    plannedPayments: data.plannedPayments,
    plannedIncomes: data.plannedIncomes,
    audit: data.auditLogs
      .map((entry) => ({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
      }))
      .sort((a, b) =>
        `${a.action}:${a.entityType}:${a.entityId}`.localeCompare(
          `${b.action}:${b.entityType}:${b.entityId}`
        )
      ),
  };
}

describeEmulator('SQLite and Firestore edge mutation parity', () => {
  const firestore = getMvFirestore();
  const readStore = new FirestoreHouseholdStore(firestore);
  let sqlite: DatabaseSync;
  let sqliteEdge: EdgeMutationStore;
  let firestoreEdge: EdgeMutationStore;

  beforeAll(() => {
    sqlite = initDb(':memory:');
    sqliteEdge = new SqliteEdgeMutationStore(sqlite);
    firestoreEdge = new FirestoreEdgeMutationStore(firestore, readStore);
  });

  beforeEach(async () => {
    seedSqlite(sqlite);
    await seedFirestore(firestore);
  });

  afterAll(async () => {
    await firestore.recursiveDelete(firestore.collection('households').doc(HOUSEHOLD_ID));
    sqlite.close();
  });

  async function expectParity(expectedVersion: number) {
    const sqliteData = getSqliteHouseholdData();
    const firestoreData = await readStore.getHouseholdData();
    expect(sqliteData.version).toBe(expectedVersion);
    expect(firestoreData.version).toBe(expectedVersion);
    expect(projection(firestoreData)).toEqual(projection(sqliteData));
    return firestoreData;
  }

  async function runBoth<T>(
    sqliteAction: () => Promise<T>,
    firestoreAction: () => Promise<T>
  ) {
    const sqliteResult = await sqliteAction();
    const firestoreResult = await firestoreAction();
    expect(firestoreResult).toEqual(sqliteResult);
    return firestoreResult;
  }

  it('prevents duplicate idempotent transaction retries without version or audit inflation', async () => {
    const first: TransactionMutationInput = {
      id: 'tx-idempotent-first',
      date: '2026-09-04',
      description: 'Tesco groceries',
      amountPence: 4_321,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-main',
      payer: 'Marius',
      idempotencyKey: 'bank-feed-20260904-001',
      taxYear: '2026/27',
    };

    await runBoth(
      () => sqliteEdge.createTransactionIdempotent(actor(1), first),
      () => firestoreEdge.createTransactionIdempotent(actor(1), first)
    );
    await expectParity(2);

    const duplicate = {
      ...first,
      id: 'tx-idempotent-second',
      description: 'Must not be inserted twice',
    };
    const result = await runBoth(
      () => sqliteEdge.createTransactionIdempotent(actor(2), duplicate),
      () => firestoreEdge.createTransactionIdempotent(actor(2), duplicate)
    );

    expect(result).toEqual({
      value: { id: 'tx-idempotent-first', duplicatePrevented: true },
      version: 2,
    });

    const data = await expectParity(2);
    expect(data.transactions.filter((tx) => tx.idempotencyKey === 'bank-feed-20260904-001')).toHaveLength(1);
    expect(data.auditLogs.filter((entry) => entry.action === 'transaction_created')).toHaveLength(1);
  });

  it('keeps planned payment and income edit/delete behaviour equivalent', async () => {
    await runBoth(
      () =>
        sqliteEdge.updatePlannedPayment(actor(1), {
          id: 'bill-source-broadband',
          name: 'Vodafone Broadband',
          amountPence: 3_250,
          month: '2026-09',
          responsiblePerson: 'Vesta',
          accountId: 'acc-main',
          dueDate: '2026-09-13',
          categoryId: 'cat-housing',
          status: 'unpaid',
          includeInTransferPlan: false,
          notes: 'Updated bill',
        }),
      () =>
        firestoreEdge.updatePlannedPayment(actor(1), {
          id: 'bill-source-broadband',
          name: 'Vodafone Broadband',
          amountPence: 3_250,
          month: '2026-09',
          responsiblePerson: 'Vesta',
          accountId: 'acc-main',
          dueDate: '2026-09-13',
          categoryId: 'cat-housing',
          status: 'unpaid',
          includeInTransferPlan: false,
          notes: 'Updated bill',
        })
    );

    await runBoth(
      () =>
        sqliteEdge.updatePlannedIncome(actor(2), {
          id: 'income-benefit',
          name: 'Child Benefit Updated',
          expectedAmountPence: 10_500,
          month: '2026-09',
          sourcePerson: 'Vesta',
          accountId: 'acc-main',
          expectedDate: '2026-09-19',
          status: 'expected',
          notes: 'Updated expected income',
        }),
      () =>
        firestoreEdge.updatePlannedIncome(actor(2), {
          id: 'income-benefit',
          name: 'Child Benefit Updated',
          expectedAmountPence: 10_500,
          month: '2026-09',
          sourcePerson: 'Vesta',
          accountId: 'acc-main',
          expectedDate: '2026-09-19',
          status: 'expected',
          notes: 'Updated expected income',
        })
    );
    await expectParity(3);

    await runBoth(
      () => sqliteEdge.deletePlannedPayment(actor(3), 'bill-source-broadband'),
      () => firestoreEdge.deletePlannedPayment(actor(3), 'bill-source-broadband')
    );
    await runBoth(
      () => sqliteEdge.deletePlannedIncome(actor(4), 'income-benefit'),
      () => firestoreEdge.deletePlannedIncome(actor(4), 'income-benefit')
    );

    const data = await expectParity(5);
    expect(data.plannedPayments.some((item) => item.id === 'bill-source-broadband')).toBe(false);
    expect(data.plannedIncomes?.some((item) => item.id === 'income-benefit')).toBe(false);
  });

  it('bulk toggles only the selected unpaid payments and leaves paid bills untouched', async () => {
    const result = await runBoth(
      () =>
        sqliteEdge.bulkTogglePlannedPayments(actor(1), {
          month: '2026-09',
          include: false,
          onlyUnpaid: true,
          paymentIds: ['bill-source-rent', 'bill-paid-water'],
        }),
      () =>
        firestoreEdge.bulkTogglePlannedPayments(actor(1), {
          month: '2026-09',
          include: false,
          onlyUnpaid: true,
          paymentIds: ['bill-source-rent', 'bill-paid-water'],
        })
    );
    expect(result.value.updatedCount).toBe(1);

    const data = await expectParity(2);
    expect(data.plannedPayments.find((item) => item.id === 'bill-source-rent')?.includeInTransferPlan).toBe(false);
    expect(data.plannedPayments.find((item) => item.id === 'bill-paid-water')?.includeInTransferPlan).toBe(true);
  });

  it('imports prior-month bills idempotently, skips an existing equivalent bill and shifts due-date month', async () => {
    const first = await runBoth(
      () =>
        sqliteEdge.importMonth(actor(1), {
          sourceMonth: '2026-09',
          targetMonth: '2026-10',
          paymentIds: ['bill-source-rent', 'bill-source-broadband'],
        }),
      () =>
        firestoreEdge.importMonth(actor(1), {
          sourceMonth: '2026-09',
          targetMonth: '2026-10',
          paymentIds: ['bill-source-rent', 'bill-source-broadband'],
        })
    );
    expect(first.value).toEqual({ importedCount: 1, targetMonth: '2026-10' });

    let data = await expectParity(2);
    expect(data.plannedPayments.find((item) => item.id === 'bill-import-2026-10-bill-source-broadband')).toMatchObject({
      name: 'Broadband',
      month: '2026-10',
      dueDate: '2026-10-12',
      status: 'unpaid',
      includeInTransferPlan: true,
    });

    const second = await runBoth(
      () =>
        sqliteEdge.importMonth(actor(2), {
          sourceMonth: '2026-09',
          targetMonth: '2026-10',
          paymentIds: ['bill-source-rent', 'bill-source-broadband'],
        }),
      () =>
        firestoreEdge.importMonth(actor(2), {
          sourceMonth: '2026-09',
          targetMonth: '2026-10',
          paymentIds: ['bill-source-rent', 'bill-source-broadband'],
        })
    );
    expect(second.value).toEqual({ importedCount: 0, targetMonth: '2026-10' });

    data = await expectParity(3);
    expect(data.plannedPayments.filter((item) => item.name === 'Broadband' && item.month === '2026-10')).toHaveLength(1);
    expect(data.auditLogs.filter((entry) => entry.action === 'month_imported')).toHaveLength(2);
  });

  it('soft-archives referenced accounts and hard-deletes unreferenced accounts', async () => {
    const archived = await runBoth(
      () => sqliteEdge.archiveOrDeleteAccount(actor(1), 'acc-referenced'),
      () => firestoreEdge.archiveOrDeleteAccount(actor(1), 'acc-referenced')
    );
    expect(archived.value).toEqual({ id: 'acc-referenced', archived: true });

    const deleted = await runBoth(
      () => sqliteEdge.archiveOrDeleteAccount(actor(2), 'acc-unused'),
      () => firestoreEdge.archiveOrDeleteAccount(actor(2), 'acc-unused')
    );
    expect(deleted.value).toEqual({ id: 'acc-unused', archived: false });

    const data = await expectParity(3);
    expect(data.accounts.some((item) => item.id === 'acc-referenced')).toBe(false);
    expect(data.accounts.some((item) => item.id === 'acc-unused')).toBe(false);

    const sqliteArchived = sqlite.prepare('SELECT is_active FROM accounts WHERE id = ?').get('acc-referenced') as any;
    const sqliteDeleted = sqlite.prepare('SELECT id FROM accounts WHERE id = ?').get('acc-unused');
    expect(Boolean(sqliteArchived?.is_active)).toBe(false);
    expect(sqliteDeleted).toBeUndefined();

    const fsArchived = await firestore.collection('households').doc(HOUSEHOLD_ID).collection('accounts').doc('acc-referenced').get();
    const fsDeleted = await firestore.collection('households').doc(HOUSEHOLD_ID).collection('accounts').doc('acc-unused').get();
    expect(fsArchived.exists).toBe(true);
    expect(fsArchived.data()?.isActive).toBe(false);
    expect(fsDeleted.exists).toBe(false);
  });

  it('keeps owner-only governance state equivalent and prevents sole-owner demotion/removal', async () => {
    await expect(sqliteEdge.changeMemberRole(actor(1), 'member-marius', 'view_only')).rejects.toThrow(
      'Cannot demote the sole household owner'
    );
    await expect(firestoreEdge.changeMemberRole(actor(1), 'member-marius', 'view_only')).rejects.toThrow(
      'Cannot demote the sole household owner'
    );
    await expectParity(1);

    await runBoth(
      () => sqliteEdge.approveMember(actor(1), 'member-vesta', 'editor'),
      () => firestoreEdge.approveMember(actor(1), 'member-vesta', 'editor')
    );
    await runBoth(
      () => sqliteEdge.changeMemberRole(actor(2), 'member-vesta', 'view_only'),
      () => firestoreEdge.changeMemberRole(actor(2), 'member-vesta', 'view_only')
    );

    let data = await expectParity(3);
    expect(data.members.find((item) => item.id === 'member-vesta')).toMatchObject({
      role: 'view_only',
      approvedBy: OWNER_EMAIL,
    });

    const sqliteSession = sqlite.prepare('SELECT role FROM user_sessions WHERE user_id = ?').get('member-vesta') as any;
    expect(sqliteSession?.role).toBe('view_only');

    await runBoth(
      () => sqliteEdge.removeMember(actor(3), 'member-vesta'),
      () => firestoreEdge.removeMember(actor(3), 'member-vesta')
    );

    data = await expectParity(4);
    expect(data.members.find((item) => item.id === 'member-vesta')?.role).toBe('removed');
    expect(sqlite.prepare('SELECT role FROM user_sessions WHERE user_id = ?').get('member-vesta')).toBeUndefined();

    await expect(sqliteEdge.removeMember(actor(4), 'member-marius')).rejects.toThrow('Cannot remove household owner');
    await expect(firestoreEdge.removeMember(actor(4), 'member-marius')).rejects.toThrow('Cannot remove household owner');

    data = await expectParity(4);
    expect(data.auditLogs).toHaveLength(3);
  });
});
