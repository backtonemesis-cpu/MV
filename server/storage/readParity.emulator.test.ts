import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import type { HouseholdData } from '../../src/types';
import { initDb, getHouseholdData as getSqliteHouseholdData } from '../db';
import { getMvFirestore } from '../firestoreAdmin';
import { FirestoreHouseholdStore } from './firestoreStore';
import { HOUSEHOLD_ID } from './contracts';
import { CURRENT_SCHEMA_VERSION } from '../migrations';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const OWNER_EMAIL = 'backtonemesis@gmail.com';
const VESTA_EMAIL = 'vestajuskaite@gmail.com';
const FIXTURE_VERSION = 7;
const T0 = '2026-09-01T09:00:00.000Z';

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
    SET name = ?, currency = 'GBP', version = ?, updated_at = ?
    WHERE id = ?
  `).run('Marius & Vesta Household', FIXTURE_VERSION, T0, HOUSEHOLD_ID);

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, email, password_hash, salt, display_name, role,
      joined_at, approved_at, approved_by, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(
    'member-marius', OWNER_EMAIL, 'unused', 'unused', 'Marius', 'owner',
    '2026-08-01T10:00:00.000Z', '2026-08-01T10:00:00.000Z', OWNER_EMAIL, '2026-09-03T20:00:00.000Z'
  );
  insertUser.run(
    'member-vesta', VESTA_EMAIL, 'unused', 'unused', 'Vesta', 'editor',
    '2026-08-02T10:00:00.000Z', '2026-08-02T11:00:00.000Z', OWNER_EMAIL, '2026-09-03T19:30:00.000Z'
  );

  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      id, name, type, currency, starting_balance_pence, current_balance_pence,
      owner_person, is_active, reconciled_at, reconciliation_date,
      reconciled_balance_pence, credit_limit_pence, balance_owed_pence, notes,
      created_at, updated_at, schema_version, metadata_json
    ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAccount.run(
    'acc-main', 'Marius Current', 'current', 50_000, 0, 'Marius',
    '2026-09-03T08:00:00.000Z', '2026-09-03', 100_000, null, null,
    'Statement reconciled', T0, T0, CURRENT_SCHEMA_VERSION,
    JSON.stringify({ source: 'parity-fixture' })
  );
  insertAccount.run(
    'acc-savings', 'Joint Savings', 'savings', 10_000, 0, 'Joint',
    null, null, null, null, null,
    'Household savings', T0, T0, CURRENT_SCHEMA_VERSION,
    JSON.stringify({ source: 'parity-fixture' })
  );

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, group_name, monthly_budget_pence, icon, is_archived)
    VALUES (?, ?, ?, ?, ?, 0)
  `);
  insertCategory.run('cat-benefits', 'Salary & Benefits', 'Income', 0, 'wallet');
  insertCategory.run('cat-childcare', 'Child Maintenance / Care', 'Family', 40_000, 'users');
  insertCategory.run('cat-groceries', 'Groceries & Food', 'Living', 50_000, 'shopping-basket');
  insertCategory.run('cat-transfer', 'Internal Transfer', 'Savings', 0, 'arrow-right-left');

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (
      id, date, description, amount_pence, type, category_id, account_id,
      target_account_id, payer, notes, is_transfer, is_repayment, is_savings,
      is_refund, original_transaction_id, planned_payment_id, planned_income_id,
      created_at, created_by, updated_at, updated_by, schema_version,
      metadata_json, idempotency_key, tax_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTransaction.run(
    'tx-old', '2026-09-02', 'Already inside statement balance', 5_000, 'expense',
    'cat-groceries', 'acc-main', null, 'Marius', 'Pre-reconciliation activity',
    0, 0, 0, 0, null, null, null,
    '2026-09-02T10:00:00.000Z', OWNER_EMAIL, null, null, CURRENT_SCHEMA_VERSION,
    JSON.stringify({ source: 'statement' }), 'idem-old', '2026/27'
  );
  insertTransaction.run(
    'tx-income', '2026-09-04', 'Marius salary', 200_000, 'income',
    'cat-benefits', 'acc-main', null, 'Marius', 'Actual salary receipt',
    0, 0, 0, 0, null, null, 'income-salary',
    '2026-09-04T08:00:00.000Z', OWNER_EMAIL, '2026-09-04T08:01:00.000Z', OWNER_EMAIL,
    CURRENT_SCHEMA_VERSION, JSON.stringify({ source: 'bank' }), 'idem-income', '2026/27'
  );
  insertTransaction.run(
    'tx-bill', '2026-09-04', 'Family household payment', 3_000, 'expense',
    'cat-groceries', 'acc-main', null, 'Joint', 'Split across household categories',
    0, 0, 0, 0, null, 'bill-family', null,
    '2026-09-04T09:00:00.000Z', VESTA_EMAIL, '2026-09-04T09:05:00.000Z', VESTA_EMAIL,
    CURRENT_SCHEMA_VERSION, JSON.stringify({ receipt: 'fixture-001' }), 'idem-bill', '2026/27'
  );
  insertTransaction.run(
    'tx-transfer', '2026-09-05', 'Move money to joint savings', 25_000, 'transfer',
    'cat-transfer', 'acc-main', 'acc-savings', 'Joint', 'Internal household transfer',
    1, 0, 1, 0, null, null, null,
    '2026-09-05T12:00:00.000Z', OWNER_EMAIL, null, null, CURRENT_SCHEMA_VERSION,
    JSON.stringify({ purpose: 'savings' }), 'idem-transfer', '2026/27'
  );
  insertTransaction.run(
    'tx-refund', '2026-09-06', 'Groceries refund', 500, 'refund',
    'cat-groceries', 'acc-main', null, 'Marius', 'Credit returned',
    0, 0, 0, 1, 'tx-bill', null, null,
    '2026-09-06T14:00:00.000Z', OWNER_EMAIL, null, null, CURRENT_SCHEMA_VERSION,
    JSON.stringify({ source: 'merchant-refund' }), 'idem-refund', '2026/27'
  );

  const insertSplit = db.prepare(`
    INSERT INTO transaction_splits (id, transaction_id, category_id, amount_pence, payer, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertSplit.run('split-a', 'tx-bill', 'cat-groceries', 2_000, 'Joint', 'Food portion');
  insertSplit.run('split-b', 'tx-bill', 'cat-childcare', 1_000, 'Vesta', 'Family portion');

  db.prepare(`
    INSERT INTO planned_payments (
      id, name, amount_pence, actual_amount_pence, actual_date, actual_transaction_id,
      month, responsible_person, account_id, due_date, category_id, status,
      include_in_transfer_plan, notes, created_at, created_by, updated_at, updated_by,
      schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'bill-family', 'Family household payment', 3_000, 3_000, '2026-09-04', 'tx-bill',
    '2026-09', 'Joint', 'acc-main', '2026-09-04', 'cat-groceries', 'paid', 1,
    'Actual transaction linked', T0, OWNER_EMAIL, '2026-09-04T09:05:00.000Z', VESTA_EMAIL,
    CURRENT_SCHEMA_VERSION, JSON.stringify({ recurring: true })
  );

  db.prepare(`
    INSERT INTO planned_incomes (
      id, name, expected_amount_pence, actual_amount_pence, month, source_person,
      account_id, expected_date, actual_date, status, notes, actual_transaction_id,
      created_at, created_by, updated_at, updated_by, schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'income-salary', 'Marius Salary', 200_000, 200_000, '2026-09', 'Marius',
    'acc-main', '2026-09-04', '2026-09-04', 'received', 'Actual receipt linked', 'tx-income',
    T0, OWNER_EMAIL, '2026-09-04T08:01:00.000Z', OWNER_EMAIL,
    CURRENT_SCHEMA_VERSION, JSON.stringify({ regularIncome: true })
  );

  db.prepare(`
    INSERT INTO savings_goals (
      id, name, target_pence, current_pence, target_date, account_id,
      linked_account_id, created_at, updated_at, schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'goal-home', 'Home Reserve', 500_000, 35_000, '2026-12-31', 'acc-savings',
    'acc-savings', T0, T0, CURRENT_SCHEMA_VERSION, JSON.stringify({ priority: 'high' })
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (
      id, timestamp, actor_email, action, entity_type, entity_id, summary, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(
    'audit-2', '2026-09-06T14:01:00.000Z', OWNER_EMAIL, 'refund_recorded',
    'transaction', 'tx-refund', 'Recorded returned credit', JSON.stringify({ amountPence: 500 })
  );
  insertAudit.run(
    'audit-1', '2026-09-04T09:06:00.000Z', VESTA_EMAIL, 'planned_payment_paid',
    'planned_payment', 'bill-family', 'Linked bill to actual transaction', JSON.stringify({ transactionId: 'tx-bill' })
  );
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
    version: FIXTURE_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: T0,
  });

  await Promise.all([
    householdRef.collection('members').doc('member-marius').set({
      email: OWNER_EMAIL,
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-08-01T10:00:00.000Z',
      approvedAt: '2026-08-01T10:00:00.000Z',
      approvedBy: OWNER_EMAIL,
      lastActiveAt: '2026-09-03T20:00:00.000Z',
    }),
    householdRef.collection('members').doc('member-vesta').set({
      email: VESTA_EMAIL,
      name: 'Vesta',
      role: 'editor',
      joinedAt: '2026-08-02T10:00:00.000Z',
      approvedAt: '2026-08-02T11:00:00.000Z',
      approvedBy: OWNER_EMAIL,
      lastActiveAt: '2026-09-03T19:30:00.000Z',
    }),
  ]);

  await Promise.all([
    householdRef.collection('accounts').doc('acc-main').set({
      name: 'Marius Current', type: 'current', currency: 'GBP',
      startingBalancePence: 50_000, currentBalancePence: 0, ownerPerson: 'Marius', isActive: true,
      reconciledAt: '2026-09-03T08:00:00.000Z', reconciliationDate: '2026-09-03',
      reconciledBalancePence: 100_000, notes: 'Statement reconciled',
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { source: 'parity-fixture' },
    }),
    householdRef.collection('accounts').doc('acc-savings').set({
      name: 'Joint Savings', type: 'savings', currency: 'GBP',
      startingBalancePence: 10_000, currentBalancePence: 0, ownerPerson: 'Joint', isActive: true,
      notes: 'Household savings', schemaVersion: CURRENT_SCHEMA_VERSION,
      metadata: { source: 'parity-fixture' },
    }),
  ]);

  const categoryData = [
    ['cat-benefits', 'Salary & Benefits', 'Income', 0, 'wallet'],
    ['cat-childcare', 'Child Maintenance / Care', 'Family', 40_000, 'users'],
    ['cat-groceries', 'Groceries & Food', 'Living', 50_000, 'shopping-basket'],
    ['cat-transfer', 'Internal Transfer', 'Savings', 0, 'arrow-right-left'],
  ] as const;
  await Promise.all(categoryData.map(([id, name, group, monthlyBudgetPence, icon]) =>
    householdRef.collection('categories').doc(id).set({
      name, group, monthlyBudgetPence, icon, isArchived: false,
    })
  ));

  const txs = householdRef.collection('transactions');
  await Promise.all([
    txs.doc('tx-old').set({
      date: '2026-09-02', description: 'Already inside statement balance', amountPence: 5_000,
      type: 'expense', categoryId: 'cat-groceries', accountId: 'acc-main', payer: 'Marius',
      notes: 'Pre-reconciliation activity', isTransfer: false, isRepayment: false, isSavings: false, isRefund: false,
      createdAt: '2026-09-02T10:00:00.000Z', createdBy: OWNER_EMAIL,
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { source: 'statement' }, idempotencyKey: 'idem-old', taxYear: '2026/27',
    }),
    txs.doc('tx-income').set({
      date: '2026-09-04', description: 'Marius salary', amountPence: 200_000,
      type: 'income', categoryId: 'cat-benefits', accountId: 'acc-main', payer: 'Marius',
      notes: 'Actual salary receipt', isTransfer: false, isRepayment: false, isSavings: false, isRefund: false,
      plannedIncomeId: 'income-salary', createdAt: '2026-09-04T08:00:00.000Z', createdBy: OWNER_EMAIL,
      updatedAt: '2026-09-04T08:01:00.000Z', updatedBy: OWNER_EMAIL,
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { source: 'bank' }, idempotencyKey: 'idem-income', taxYear: '2026/27',
    }),
    txs.doc('tx-bill').set({
      date: '2026-09-04', description: 'Family household payment', amountPence: 3_000,
      type: 'expense', categoryId: 'cat-groceries', accountId: 'acc-main', payer: 'Joint',
      notes: 'Split across household categories', isTransfer: false, isRepayment: false, isSavings: false, isRefund: false,
      plannedPaymentId: 'bill-family', createdAt: '2026-09-04T09:00:00.000Z', createdBy: VESTA_EMAIL,
      updatedAt: '2026-09-04T09:05:00.000Z', updatedBy: VESTA_EMAIL,
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { receipt: 'fixture-001' }, idempotencyKey: 'idem-bill', taxYear: '2026/27',
    }),
    txs.doc('tx-transfer').set({
      date: '2026-09-05', description: 'Move money to joint savings', amountPence: 25_000,
      type: 'transfer', categoryId: 'cat-transfer', accountId: 'acc-main', targetAccountId: 'acc-savings', payer: 'Joint',
      notes: 'Internal household transfer', isTransfer: true, isRepayment: false, isSavings: true, isRefund: false,
      createdAt: '2026-09-05T12:00:00.000Z', createdBy: OWNER_EMAIL,
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { purpose: 'savings' }, idempotencyKey: 'idem-transfer', taxYear: '2026/27',
    }),
    txs.doc('tx-refund').set({
      date: '2026-09-06', description: 'Groceries refund', amountPence: 500,
      type: 'refund', categoryId: 'cat-groceries', accountId: 'acc-main', payer: 'Marius',
      notes: 'Credit returned', isTransfer: false, isRepayment: false, isSavings: false, isRefund: true,
      originalTransactionId: 'tx-bill', createdAt: '2026-09-06T14:00:00.000Z', createdBy: OWNER_EMAIL,
      schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { source: 'merchant-refund' }, idempotencyKey: 'idem-refund', taxYear: '2026/27',
    }),
  ]);

  await Promise.all([
    txs.doc('tx-bill').collection('splits').doc('split-a').set({
      categoryId: 'cat-groceries', amountPence: 2_000, payer: 'Joint', notes: 'Food portion',
    }),
    txs.doc('tx-bill').collection('splits').doc('split-b').set({
      categoryId: 'cat-childcare', amountPence: 1_000, payer: 'Vesta', notes: 'Family portion',
    }),
  ]);

  await householdRef.collection('plannedPayments').doc('bill-family').set({
    name: 'Family household payment', amountPence: 3_000, actualAmountPence: 3_000,
    actualDate: '2026-09-04', actualTransactionId: 'tx-bill', month: '2026-09',
    responsiblePerson: 'Joint', accountId: 'acc-main', dueDate: '2026-09-04', categoryId: 'cat-groceries',
    status: 'paid', includeInTransferPlan: true, notes: 'Actual transaction linked',
    createdAt: T0, createdBy: OWNER_EMAIL, updatedAt: '2026-09-04T09:05:00.000Z', updatedBy: VESTA_EMAIL,
    schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { recurring: true },
  });

  await householdRef.collection('plannedIncomes').doc('income-salary').set({
    name: 'Marius Salary', expectedAmountPence: 200_000, actualAmountPence: 200_000,
    month: '2026-09', sourcePerson: 'Marius', accountId: 'acc-main', expectedDate: '2026-09-04',
    actualDate: '2026-09-04', status: 'received', notes: 'Actual receipt linked', actualTransactionId: 'tx-income',
    createdAt: T0, createdBy: OWNER_EMAIL, updatedAt: '2026-09-04T08:01:00.000Z', updatedBy: OWNER_EMAIL,
    schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { regularIncome: true },
  });

  await householdRef.collection('savingsGoals').doc('goal-home').set({
    name: 'Home Reserve', targetPence: 500_000, currentPence: 35_000,
    targetDate: '2026-12-31', accountId: 'acc-savings', linkedAccountId: 'acc-savings',
    schemaVersion: CURRENT_SCHEMA_VERSION, metadata: { priority: 'high' },
  });

  await Promise.all([
    householdRef.collection('audit').doc('audit-2').set({
      timestamp: '2026-09-06T14:01:00.000Z', actorEmail: OWNER_EMAIL,
      action: 'refund_recorded', entityType: 'transaction', entityId: 'tx-refund',
      summary: 'Recorded returned credit', details: { amountPence: 500 },
    }),
    householdRef.collection('audit').doc('audit-1').set({
      timestamp: '2026-09-04T09:06:00.000Z', actorEmail: VESTA_EMAIL,
      action: 'planned_payment_paid', entityType: 'planned_payment', entityId: 'bill-family',
      summary: 'Linked bill to actual transaction', details: { transactionId: 'tx-bill' },
    }),
  ]);
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
    auditLogs: data.auditLogs,
  };
}

describeEmulator('SQLite and Firestore household read parity', () => {
  const firestore = getMvFirestore();
  const firestoreStore = new FirestoreHouseholdStore(firestore);
  let sqlite: DatabaseSync;

  beforeAll(async () => {
    sqlite = initDb(':memory:');
    seedSqlite(sqlite);
    await seedFirestore(firestore);
  });

  afterAll(async () => {
    await firestore.recursiveDelete(firestore.collection('households').doc(HOUSEHOLD_ID));
    sqlite.close();
  });

  it('returns equivalent API-shaped household financial data from both backends', async () => {
    const sqliteData = getSqliteHouseholdData();
    const firestoreData = await firestoreStore.getHouseholdData();

    expect(parityProjection(firestoreData)).toEqual(parityProjection(sqliteData));

    const main = firestoreData.accounts.find((account) => account.id === 'acc-main');
    const savings = firestoreData.accounts.find((account) => account.id === 'acc-savings');
    expect(main?.currentBalancePence).toBe(272_500);
    expect(savings?.currentBalancePence).toBe(35_000);

    const bill = firestoreData.plannedPayments.find((item) => item.id === 'bill-family');
    expect(bill).toMatchObject({
      actualAmountPence: 3_000,
      actualDate: '2026-09-04',
      actualTransactionId: 'tx-bill',
    });

    const income = firestoreData.plannedIncomes?.find((item) => item.id === 'income-salary');
    expect(income).toMatchObject({
      actualAmountPence: 200_000,
      actualDate: '2026-09-04',
      actualTransactionId: 'tx-income',
    });

    expect(firestoreData.transactions.find((item) => item.id === 'tx-income')?.plannedIncomeId)
      .toBe('income-salary');
    expect(firestoreData.transactions.find((item) => item.id === 'tx-bill')?.splits)
      .toEqual([
        { id: 'split-a', categoryId: 'cat-groceries', amountPence: 2_000, payer: 'Joint', notes: 'Food portion' },
        { id: 'split-b', categoryId: 'cat-childcare', amountPence: 1_000, payer: 'Vesta', notes: 'Family portion' },
      ]);
  });
});
