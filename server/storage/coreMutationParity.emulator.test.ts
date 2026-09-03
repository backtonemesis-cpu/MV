import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import type { HouseholdData } from '../../src/types';
import { initDb, getHouseholdData as getSqliteHouseholdData } from '../db';
import { getMvFirestore } from '../firestoreAdmin';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import { FirestoreHouseholdStore } from './firestoreStore';
import {
  FirestoreCoreMutationStore,
  SqliteCoreMutationStore,
  type MutationActor,
  type TransactionMutationInput,
} from './coreMutations';
import { HOUSEHOLD_ID } from './contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const OWNER_EMAIL = 'backtonemesis@gmail.com';
const BASE_TIME = '2026-09-03T12:00:00.000Z';

function actor(expectedVersion: number, minute = expectedVersion): MutationActor {
  return {
    expectedVersion,
    actorEmail: OWNER_EMAIL,
    now: `2026-09-03T12:${String(minute).padStart(2, '0')}:00.000Z`,
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
  `).run('Marius & Vesta Household', BASE_TIME, HOUSEHOLD_ID);

  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, salt, display_name, role,
      joined_at, approved_at, approved_by, last_active_at
    ) VALUES (?, ?, ?, ?, ?, 'owner', ?, ?, ?, ?)
  `).run(
    'member-marius',
    OWNER_EMAIL,
    'unused',
    'unused',
    'Marius',
    '2026-08-01T10:00:00.000Z',
    '2026-08-01T10:00:00.000Z',
    OWNER_EMAIL,
    BASE_TIME
  );

  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      id, name, type, currency, starting_balance_pence, current_balance_pence,
      owner_person, is_active, created_at, updated_at, schema_version
    ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, 1, ?, ?, ?)
  `);
  insertAccount.run(
    'acc-main',
    'Marius Current',
    'current',
    100_000,
    100_000,
    'Marius',
    BASE_TIME,
    BASE_TIME,
    CURRENT_SCHEMA_VERSION
  );
  insertAccount.run(
    'acc-savings',
    'Joint Savings',
    'savings',
    20_000,
    20_000,
    'Joint',
    BASE_TIME,
    BASE_TIME,
    CURRENT_SCHEMA_VERSION
  );

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, group_name, monthly_budget_pence, icon, is_archived)
    VALUES (?, ?, ?, 0, ?, 0)
  `);
  insertCategory.run('cat-groceries', 'Groceries', 'Living', 'shopping-basket');
  insertCategory.run('cat-family', 'Family', 'Family', 'users');
  insertCategory.run('cat-transfer', 'Internal Transfer', 'Savings', 'arrow-right-left');
  insertCategory.run('cat-housing', 'Housing', 'Bills', 'home');
  insertCategory.run('cat-salary', 'Salary', 'Income', 'wallet');
}

async function seedFirestore(db: Firestore) {
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
  await db.recursiveDelete(householdRef);

  await householdRef.set({
    id: HOUSEHOLD_ID,
    name: 'Marius & Vesta Household',
    currency: 'GBP',
  });
  await householdRef.collection('meta').doc('state').set({
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: BASE_TIME,
  });
  await householdRef.collection('members').doc('member-marius').set({
    email: OWNER_EMAIL,
    name: 'Marius',
    role: 'owner',
    joinedAt: '2026-08-01T10:00:00.000Z',
    approvedAt: '2026-08-01T10:00:00.000Z',
    approvedBy: OWNER_EMAIL,
    lastActiveAt: BASE_TIME,
  });

  await Promise.all([
    householdRef.collection('accounts').doc('acc-main').set({
      name: 'Marius Current',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 100_000,
      currentBalancePence: 100_000,
      ownerPerson: 'Marius',
      isActive: true,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    }),
    householdRef.collection('accounts').doc('acc-savings').set({
      name: 'Joint Savings',
      type: 'savings',
      currency: 'GBP',
      startingBalancePence: 20_000,
      currentBalancePence: 20_000,
      ownerPerson: 'Joint',
      isActive: true,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    }),
  ]);

  const categories = [
    ['cat-groceries', 'Groceries', 'Living', 'shopping-basket'],
    ['cat-family', 'Family', 'Family', 'users'],
    ['cat-transfer', 'Internal Transfer', 'Savings', 'arrow-right-left'],
    ['cat-housing', 'Housing', 'Bills', 'home'],
    ['cat-salary', 'Salary', 'Income', 'wallet'],
  ] as const;

  await Promise.all(
    categories.map(([id, name, group, icon]) =>
      householdRef.collection('categories').doc(id).set({
        name,
        group,
        monthlyBudgetPence: 0,
        icon,
        isArchived: false,
      })
    )
  );
}

function parityProjection(data: HouseholdData) {
  return {
    id: data.id,
    name: data.name,
    version: data.version,
    schemaStatus: data.schemaStatus && {
      currentSchemaVersion: data.schemaStatus.currentSchemaVersion,
      minSupportedClientVersion: data.schemaStatus.minSupportedClientVersion,
      latestAppliedVersion: data.schemaStatus.latestAppliedVersion,
      isUpToDate: data.schemaStatus.isUpToDate,
    },
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

describeEmulator('SQLite and Firestore core mutation parity', () => {
  const firestore = getMvFirestore();
  const firestoreReadStore = new FirestoreHouseholdStore(firestore);
  const firestoreMutations = new FirestoreCoreMutationStore(firestore, firestoreReadStore);
  let sqlite: DatabaseSync;
  let sqliteMutations: SqliteCoreMutationStore;

  beforeAll(() => {
    sqlite = initDb(':memory:');
    sqliteMutations = new SqliteCoreMutationStore(sqlite);
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
    const firestoreData = await firestoreReadStore.getHouseholdData();

    expect(sqliteData.version).toBe(expectedVersion);
    expect(firestoreData.version).toBe(expectedVersion);
    expect(parityProjection(firestoreData)).toEqual(parityProjection(sqliteData));
    return firestoreData;
  }

  async function runBoth<T>(
    sqliteAction: () => Promise<T>,
    firestoreAction: () => Promise<T>
  ) {
    const sqliteResult = await sqliteAction();
    const firestoreResult = await firestoreAction();
    expect(firestoreResult).toEqual(sqliteResult);
  }

  it('keeps create, edit, refund, split replacement and delete transaction behaviour equivalent', async () => {
    const purchase: TransactionMutationInput = {
      id: 'tx-purchase',
      date: '2026-09-04',
      description: 'Household shop',
      amountPence: 3_000,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-main',
      payer: 'Joint',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      splits: [
        { id: 'split-food', categoryId: 'cat-groceries', amountPence: 2_000, payer: 'Joint' },
        { id: 'split-family', categoryId: 'cat-family', amountPence: 1_000, payer: 'Vesta' },
      ],
    };

    await runBoth(
      () => sqliteMutations.createTransaction(actor(1), purchase),
      () => firestoreMutations.createTransaction(actor(1), purchase)
    );
    await expectParity(2);

    const edited: TransactionMutationInput = {
      ...purchase,
      description: 'Household shop corrected',
      amountPence: 3_500,
      splits: [
        { id: 'split-food-v2', categoryId: 'cat-groceries', amountPence: 2_500, payer: 'Joint' },
        { id: 'split-family-v2', categoryId: 'cat-family', amountPence: 1_000, payer: 'Vesta' },
      ],
    };
    await runBoth(
      () => sqliteMutations.updateTransaction(actor(2), edited),
      () => firestoreMutations.updateTransaction(actor(2), edited)
    );
    await expectParity(3);

    const refund: TransactionMutationInput = {
      id: 'tx-refund',
      date: '2026-09-05',
      description: 'Returned groceries credit',
      amountPence: 500,
      type: 'refund',
      categoryId: 'cat-groceries',
      accountId: 'acc-main',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: true,
      originalTransactionId: 'tx-purchase',
    };
    await runBoth(
      () => sqliteMutations.createTransaction(actor(3), refund),
      () => firestoreMutations.createTransaction(actor(3), refund)
    );
    let data = await expectParity(4);
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(97_000);

    await runBoth(
      () => sqliteMutations.deleteTransaction(actor(4), 'tx-purchase'),
      () => firestoreMutations.deleteTransaction(actor(4), 'tx-purchase')
    );
    data = await expectParity(5);
    expect(data.transactions.find((item) => item.id === 'tx-purchase')).toBeUndefined();
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(100_500);
  });

  it('keeps internal transfer movements out of spending while moving balances exactly once', async () => {
    await runBoth(
      () =>
        sqliteMutations.executeTransfer(actor(1), {
          id: 'tx-transfer-new',
          sourceAccountId: 'acc-main',
          destinationAccountId: 'acc-savings',
          amountPence: 25_000,
          description: 'Fund household savings',
          date: '2026-09-04',
          payer: 'Joint',
        }),
      () =>
        firestoreMutations.executeTransfer(actor(1), {
          id: 'tx-transfer-new',
          sourceAccountId: 'acc-main',
          destinationAccountId: 'acc-savings',
          amountPence: 25_000,
          description: 'Fund household savings',
          date: '2026-09-04',
          payer: 'Joint',
        })
    );

    const data = await expectParity(2);
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(75_000);
    expect(data.accounts.find((item) => item.id === 'acc-savings')?.currentBalancePence).toBe(45_000);
    expect(data.transactions.find((item) => item.id === 'tx-transfer-new')).toMatchObject({
      type: 'transfer',
      isTransfer: true,
      accountId: 'acc-main',
      targetAccountId: 'acc-savings',
    });
  });

  it('keeps account creation, editing and reconciliation-anchor behaviour equivalent', async () => {
    await runBoth(
      () =>
        sqliteMutations.createAccount(actor(1), {
          id: 'acc-cash',
          name: 'Household Cash',
          type: 'cash',
          startingBalancePence: 5_000,
          ownerPerson: 'Joint',
          notes: 'Cash envelope',
        }),
      () =>
        firestoreMutations.createAccount(actor(1), {
          id: 'acc-cash',
          name: 'Household Cash',
          type: 'cash',
          startingBalancePence: 5_000,
          ownerPerson: 'Joint',
          notes: 'Cash envelope',
        })
    );

    await runBoth(
      () =>
        sqliteMutations.updateAccount(actor(2), {
          id: 'acc-cash',
          name: 'Household Cash Updated',
          type: 'cash',
          startingBalancePence: 6_000,
          ownerPerson: 'Joint',
          notes: 'Updated opening cash',
        }),
      () =>
        firestoreMutations.updateAccount(actor(2), {
          id: 'acc-cash',
          name: 'Household Cash Updated',
          type: 'cash',
          startingBalancePence: 6_000,
          ownerPerson: 'Joint',
          notes: 'Updated opening cash',
        })
    );

    const preAnchor: TransactionMutationInput = {
      id: 'tx-pre-anchor',
      date: '2026-09-09',
      description: 'Before reconciliation',
      amountPence: 2_000,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-cash',
      payer: 'Joint',
    };
    await runBoth(
      () => sqliteMutations.createTransaction(actor(3), preAnchor),
      () => firestoreMutations.createTransaction(actor(3), preAnchor)
    );

    await runBoth(
      () => sqliteMutations.reconcileAccount(actor(4), 'acc-cash', 10_000, '2026-09-10'),
      () => firestoreMutations.reconcileAccount(actor(4), 'acc-cash', 10_000, '2026-09-10')
    );

    const postAnchor: TransactionMutationInput = {
      id: 'tx-post-anchor',
      date: '2026-09-11',
      description: 'After reconciliation',
      amountPence: 1_000,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-cash',
      payer: 'Joint',
    };
    await runBoth(
      () => sqliteMutations.createTransaction(actor(5), postAnchor),
      () => firestoreMutations.createTransaction(actor(5), postAnchor)
    );

    const data = await expectParity(6);
    expect(data.accounts.find((item) => item.id === 'acc-cash')).toMatchObject({
      startingBalancePence: 6_000,
      reconciledBalancePence: 10_000,
      reconciliationDate: '2026-09-10',
      currentBalancePence: 9_000,
    });
  });

  it('keeps planned bill payment linkage and linked-transaction deletion reset equivalent', async () => {
    await runBoth(
      () =>
        sqliteMutations.createPlannedPayment(actor(1), {
          id: 'bill-rent',
          name: 'Rent',
          amountPence: 50_000,
          month: '2026-09',
          responsiblePerson: 'Marius',
          accountId: 'acc-main',
          dueDate: '2026-09-10',
          categoryId: 'cat-housing',
          status: 'unpaid',
          includeInTransferPlan: true,
        }),
      () =>
        firestoreMutations.createPlannedPayment(actor(1), {
          id: 'bill-rent',
          name: 'Rent',
          amountPence: 50_000,
          month: '2026-09',
          responsiblePerson: 'Marius',
          accountId: 'acc-main',
          dueDate: '2026-09-10',
          categoryId: 'cat-housing',
          status: 'unpaid',
          includeInTransferPlan: true,
        })
    );

    await runBoth(
      () =>
        sqliteMutations.payPlannedPayment(actor(2), 'bill-rent', {
          actualTransactionId: 'tx-rent',
          actualAmountPence: 50_000,
          actualDate: '2026-09-10',
        }),
      () =>
        firestoreMutations.payPlannedPayment(actor(2), 'bill-rent', {
          actualTransactionId: 'tx-rent',
          actualAmountPence: 50_000,
          actualDate: '2026-09-10',
        })
    );

    let data = await expectParity(3);
    expect(data.plannedPayments.find((item) => item.id === 'bill-rent')).toMatchObject({
      status: 'paid',
      actualAmountPence: 50_000,
      actualDate: '2026-09-10',
      actualTransactionId: 'tx-rent',
    });
    expect(data.transactions.find((item) => item.id === 'tx-rent')?.plannedPaymentId).toBe('bill-rent');
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(50_000);

    await runBoth(
      () => sqliteMutations.deleteTransaction(actor(3), 'tx-rent'),
      () => firestoreMutations.deleteTransaction(actor(3), 'tx-rent')
    );

    data = await expectParity(4);
    expect(data.plannedPayments.find((item) => item.id === 'bill-rent')).toMatchObject({
      status: 'unpaid',
    });
    expect(data.plannedPayments.find((item) => item.id === 'bill-rent')?.actualTransactionId).toBeUndefined();
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(100_000);
  });

  it('keeps planned income receipt linkage and linked-transaction deletion reset equivalent', async () => {
    await runBoth(
      () =>
        sqliteMutations.createPlannedIncome(actor(1), {
          id: 'income-salary',
          name: 'Marius Salary',
          expectedAmountPence: 200_000,
          month: '2026-09',
          sourcePerson: 'Marius',
          accountId: 'acc-main',
          expectedDate: '2026-09-12',
          status: 'expected',
        }),
      () =>
        firestoreMutations.createPlannedIncome(actor(1), {
          id: 'income-salary',
          name: 'Marius Salary',
          expectedAmountPence: 200_000,
          month: '2026-09',
          sourcePerson: 'Marius',
          accountId: 'acc-main',
          expectedDate: '2026-09-12',
          status: 'expected',
        })
    );

    await runBoth(
      () =>
        sqliteMutations.receivePlannedIncome(actor(2), 'income-salary', {
          actualTransactionId: 'tx-salary',
          actualAmountPence: 200_000,
          actualDate: '2026-09-12',
        }),
      () =>
        firestoreMutations.receivePlannedIncome(actor(2), 'income-salary', {
          actualTransactionId: 'tx-salary',
          actualAmountPence: 200_000,
          actualDate: '2026-09-12',
        })
    );

    let data = await expectParity(3);
    expect(data.plannedIncomes?.find((item) => item.id === 'income-salary')).toMatchObject({
      status: 'received',
      actualAmountPence: 200_000,
      actualDate: '2026-09-12',
      actualTransactionId: 'tx-salary',
    });
    expect(data.transactions.find((item) => item.id === 'tx-salary')?.plannedIncomeId).toBe('income-salary');
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(300_000);

    await runBoth(
      () => sqliteMutations.deleteTransaction(actor(3), 'tx-salary'),
      () => firestoreMutations.deleteTransaction(actor(3), 'tx-salary')
    );

    data = await expectParity(4);
    expect(data.plannedIncomes?.find((item) => item.id === 'income-salary')).toMatchObject({
      status: 'expected',
    });
    expect(data.plannedIncomes?.find((item) => item.id === 'income-salary')?.actualTransactionId).toBeUndefined();
    expect(data.accounts.find((item) => item.id === 'acc-main')?.currentBalancePence).toBe(100_000);
  });

  it('keeps savings goal create, update and delete mutations equivalent', async () => {
    await runBoth(
      () =>
        sqliteMutations.createSavingsGoal(actor(1), {
          id: 'goal-home',
          name: 'Home Reserve',
          targetPence: 500_000,
          currentPence: 20_000,
          targetDate: '2026-12-31',
          accountId: 'acc-savings',
          linkedAccountId: 'acc-savings',
        }),
      () =>
        firestoreMutations.createSavingsGoal(actor(1), {
          id: 'goal-home',
          name: 'Home Reserve',
          targetPence: 500_000,
          currentPence: 20_000,
          targetDate: '2026-12-31',
          accountId: 'acc-savings',
          linkedAccountId: 'acc-savings',
        })
    );

    await runBoth(
      () =>
        sqliteMutations.updateSavingsGoal(actor(2), {
          id: 'goal-home',
          name: 'Home Reserve Updated',
          targetPence: 550_000,
          currentPence: 25_000,
          targetDate: '2027-01-31',
          accountId: 'acc-savings',
          linkedAccountId: 'acc-savings',
        }),
      () =>
        firestoreMutations.updateSavingsGoal(actor(2), {
          id: 'goal-home',
          name: 'Home Reserve Updated',
          targetPence: 550_000,
          currentPence: 25_000,
          targetDate: '2027-01-31',
          accountId: 'acc-savings',
          linkedAccountId: 'acc-savings',
        })
    );

    await expectParity(3);

    await runBoth(
      () => sqliteMutations.deleteSavingsGoal(actor(3), 'goal-home'),
      () => firestoreMutations.deleteSavingsGoal(actor(3), 'goal-home')
    );

    const data = await expectParity(4);
    expect(data.savingsGoals).toEqual([]);
  });

  it('rejects stale versions without partial business writes or false audit entries on either backend', async () => {
    const valid: TransactionMutationInput = {
      id: 'tx-valid',
      date: '2026-09-04',
      description: 'Valid expense',
      amountPence: 1_000,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-main',
      payer: 'Marius',
    };
    await runBoth(
      () => sqliteMutations.createTransaction(actor(1), valid),
      () => firestoreMutations.createTransaction(actor(1), valid)
    );
    await expectParity(2);

    const stale: TransactionMutationInput = {
      ...valid,
      id: 'tx-stale',
      description: 'Must never persist',
    };

    await expect(sqliteMutations.createTransaction(actor(1), stale)).rejects.toMatchObject({
      status: 409,
      serverVersion: 2,
    });
    await expect(firestoreMutations.createTransaction(actor(1), stale)).rejects.toMatchObject({
      status: 409,
      serverVersion: 2,
    });

    const data = await expectParity(2);
    expect(data.transactions.find((item) => item.id === 'tx-stale')).toBeUndefined();
    expect(data.auditLogs).toHaveLength(1);
  });
});
