import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Firestore } from 'firebase-admin/firestore';
import { initDb } from '../db';
import { getMvFirestore } from '../firestoreAdmin';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import { HOUSEHOLD_ID } from './contracts';
import {
  MIGRATION_CONFIRMATION,
  exportSqliteMigrationBundle,
  migrateSqliteToFirestore,
  migrationFingerprint,
  readFirestoreMigrationBundle,
  validateMigrationBundle,
} from './sqliteFirestoreMigration';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const OWNER_EMAIL = 'backtonemesis@gmail.com';
const VESTA_EMAIL = 'vestajuskaite@gmail.com';
const T0 = '2026-09-03T18:00:00.000Z';

function seedSource(db: DatabaseSync) {
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
    SET name = ?, currency = 'GBP', version = 42, updated_at = ?,
        is_locked = 1, closed_at = ?
    WHERE id = ?
  `).run(
    'Marius & Vesta Household',
    T0,
    '2026-09-03T17:59:00.000Z',
    HOUSEHOLD_ID
  );

  const user = db.prepare(`
    INSERT INTO users (
      id, email, password_hash, salt, display_name, role,
      joined_at, approved_at, approved_by, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  user.run(
    'legacy-marius',
    OWNER_EMAIL,
    'legacy-secret-hash',
    'legacy-salt',
    'Marius',
    'owner',
    '2026-08-01T10:00:00.000Z',
    '2026-08-01T10:00:00.000Z',
    OWNER_EMAIL,
    T0
  );
  user.run(
    'legacy-vesta',
    VESTA_EMAIL,
    'legacy-secret-hash-2',
    'legacy-salt-2',
    'Vesta',
    'editor',
    '2026-08-02T10:00:00.000Z',
    '2026-08-02T11:00:00.000Z',
    OWNER_EMAIL,
    T0
  );
  user.run(
    'legacy-removed',
    'removed@example.com',
    'old-hash',
    'old-salt',
    'Removed Member',
    'removed',
    '2026-08-03T10:00:00.000Z',
    '2026-08-03T11:00:00.000Z',
    OWNER_EMAIL,
    '2026-08-20T10:00:00.000Z'
  );

  db.prepare(`
    INSERT INTO user_sessions (token_hash, user_id, email, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'legacy-session-hash',
    'legacy-vesta',
    VESTA_EMAIL,
    'editor',
    1999999999999,
    T0
  );

  const pref = db.prepare(`
    INSERT INTO user_preferences (user_id, theme, accent_color, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  pref.run('legacy-marius', 'dark', 'blue', T0);
  pref.run('legacy-vesta', 'light', 'rose', T0);

  const account = db.prepare(`
    INSERT INTO accounts (
      id, name, type, currency, starting_balance_pence, current_balance_pence,
      owner_person, is_active, reconciled_at, reconciliation_date,
      reconciled_balance_pence, credit_limit_pence, balance_owed_pence,
      notes, created_at, updated_at, schema_version, metadata_json
    ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  account.run(
    'acc-main',
    'Marius Current',
    'current',
    100000,
    250500,
    'Marius',
    1,
    null,
    null,
    null,
    null,
    null,
    'Main current account',
    T0,
    T0,
    CURRENT_SCHEMA_VERSION,
    JSON.stringify({ source: 'fixture' })
  );
  account.run(
    'acc-savings',
    'Joint Savings',
    'savings',
    50000,
    70000,
    'Joint',
    1,
    null,
    null,
    null,
    null,
    null,
    null,
    T0,
    T0,
    CURRENT_SCHEMA_VERSION,
    null
  );
  account.run(
    'acc-archived',
    'Old Cash',
    'cash',
    1000,
    1000,
    'Marius',
    0,
    null,
    null,
    null,
    null,
    null,
    'Archived but must migrate',
    T0,
    T0,
    CURRENT_SCHEMA_VERSION,
    null
  );

  const category = db.prepare(`
    INSERT INTO categories (id, name, group_name, monthly_budget_pence, icon, is_archived)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  category.run('cat-salary', 'Salary', 'Income', 0, 'wallet', 0);
  category.run('cat-groceries', 'Groceries', 'Living', 0, 'basket', 0);
  category.run('cat-housing', 'Housing', 'Bills', 0, 'home', 0);
  category.run('cat-transfer', 'Internal Transfer', 'Savings', 0, 'arrow', 0);
  category.run('cat-old', 'Old Category', 'Archive', 0, null, 1);

  const tx = db.prepare(`
    INSERT INTO transactions (
      id, date, description, amount_pence, type, category_id, account_id,
      target_account_id, payer, notes, is_transfer, is_repayment, is_savings,
      is_refund, original_transaction_id, planned_payment_id, planned_income_id,
      created_at, created_by, updated_at, updated_by, schema_version,
      metadata_json, idempotency_key, tax_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  tx.run(
    'tx-income',
    '2026-09-01',
    'Marius Salary',
    200000,
    'income',
    'cat-salary',
    'acc-main',
    null,
    'Marius',
    null,
    0,
    0,
    0,
    0,
    null,
    null,
    'income-salary',
    T0,
    OWNER_EMAIL,
    null,
    null,
    CURRENT_SCHEMA_VERSION,
    null,
    'bank-income-001',
    '2026/27'
  );
  tx.run(
    'tx-expense',
    '2026-09-02',
    'Household payment',
    30000,
    'expense',
    'cat-housing',
    'acc-main',
    null,
    'Joint',
    'Split household payment',
    0,
    0,
    0,
    0,
    null,
    'bill-house',
    null,
    T0,
    OWNER_EMAIL,
    null,
    null,
    CURRENT_SCHEMA_VERSION,
    JSON.stringify({ receipt: true }),
    'bank-expense-001',
    '2026/27'
  );
  tx.run(
    'tx-refund',
    '2026-09-03',
    'Groceries refund',
    500,
    'refund',
    'cat-groceries',
    'acc-main',
    null,
    'Marius',
    null,
    0,
    0,
    0,
    1,
    'tx-expense',
    null,
    null,
    T0,
    OWNER_EMAIL,
    null,
    null,
    CURRENT_SCHEMA_VERSION,
    null,
    'bank-refund-001',
    '2026/27'
  );
  tx.run(
    'tx-transfer',
    '2026-09-03',
    'Move to savings',
    20000,
    'transfer',
    'cat-transfer',
    'acc-main',
    'acc-savings',
    'Joint',
    null,
    1,
    0,
    1,
    0,
    null,
    null,
    null,
    T0,
    OWNER_EMAIL,
    null,
    null,
    CURRENT_SCHEMA_VERSION,
    null,
    'transfer-001',
    '2026/27'
  );

  const split = db.prepare(`
    INSERT INTO transaction_splits (id, transaction_id, category_id, amount_pence, payer, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  split.run('split-housing', 'tx-expense', 'cat-housing', 20000, 'Marius', null);
  split.run('split-groceries', 'tx-expense', 'cat-groceries', 10000, 'Vesta', null);

  db.prepare(`
    INSERT INTO planned_payments (
      id, name, amount_pence, actual_amount_pence, actual_date, actual_transaction_id,
      month, responsible_person, account_id, due_date, category_id, status,
      include_in_transfer_plan, notes, created_at, created_by, updated_at, updated_by,
      schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'bill-house',
    'Household payment',
    30000,
    30000,
    '2026-09-02',
    'tx-expense',
    '2026-09',
    'Joint',
    'acc-main',
    '2026-09-02',
    'cat-housing',
    'paid',
    1,
    'Linked paid bill',
    T0,
    OWNER_EMAIL,
    T0,
    OWNER_EMAIL,
    CURRENT_SCHEMA_VERSION,
    null
  );

  db.prepare(`
    INSERT INTO planned_incomes (
      id, name, expected_amount_pence, actual_amount_pence, month, source_person,
      account_id, expected_date, actual_date, status, notes, actual_transaction_id,
      created_at, created_by, updated_at, updated_by, schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'income-salary',
    'Marius Salary',
    200000,
    200000,
    '2026-09',
    'Marius',
    'acc-main',
    '2026-09-01',
    '2026-09-01',
    'received',
    null,
    'tx-income',
    T0,
    OWNER_EMAIL,
    T0,
    OWNER_EMAIL,
    CURRENT_SCHEMA_VERSION,
    null
  );

  db.prepare(`
    INSERT INTO savings_goals (
      id, name, target_pence, current_pence, target_date, account_id,
      linked_account_id, created_at, updated_at, schema_version, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sav-home',
    'Home Reserve',
    500000,
    70000,
    '2027-01-01',
    'acc-savings',
    'acc-savings',
    T0,
    T0,
    CURRENT_SCHEMA_VERSION,
    JSON.stringify({ mortgageEvidence: true })
  );

  const audit = db.prepare(`
    INSERT INTO audit_logs (
      id, timestamp, actor_email, action, entity_type, entity_id, summary, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let index = 0; index < 205; index += 1) {
    audit.run(
      `log-${String(index).padStart(3, '0')}`,
      `2026-09-03T17:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
      OWNER_EMAIL,
      index === 204 ? 'migration_fixture_final' : 'fixture_event',
      'system',
      `fixture-${index}`,
      `Fixture audit ${index}`,
      index === 204 ? JSON.stringify({ final: true }) : null
    );
  }
}

describeEmulator('guarded SQLite to Firestore migration', () => {
  const firestore: Firestore = getMvFirestore();
  let sqlite: DatabaseSync;

  const resolveUid = async (email: string) => {
    if (email === OWNER_EMAIL) return 'firebase-uid-marius';
    if (email === VESTA_EMAIL) return 'firebase-uid-vesta';
    throw new Error(`No Firebase account for ${email}`);
  };

  beforeAll(() => {
    sqlite = initDb(':memory:');
  });

  beforeEach(async () => {
    seedSource(sqlite);
    await firestore.recursiveDelete(
      firestore.collection('households').doc(HOUSEHOLD_ID)
    );
  });

  afterAll(async () => {
    await firestore.recursiveDelete(
      firestore.collection('households').doc(HOUSEHOLD_ID)
    );
    sqlite.close();
  });

  it('dry-runs without writing and reports the full migration evidence', async () => {
    const result = await migrateSqliteToFirestore({
      sourceDb: sqlite,
      targetDb: firestore,
      resolveFirebaseUid: resolveUid,
    });

    expect(result.dryRun).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.source.valid).toBe(true);
    expect(result.source.evidence.counts).toMatchObject({
      members: 3,
      preferences: 2,
      accounts: 3,
      categories: 5,
      transactions: 4,
      splits: 2,
      plannedPayments: 1,
      plannedIncomes: 1,
      savingsGoals: 1,
      auditLogs: 205,
    });
    expect(result.source.evidence.datasetVersion).toBe(42);
    expect(result.identityBindings).toEqual([
      {
        email: OWNER_EMAIL,
        firestoreMemberId: 'firebase-uid-marius',
        role: 'owner',
      },
      {
        email: 'removed@example.com',
        firestoreMemberId: expect.stringMatching(/^removed-/),
        role: 'removed',
      },
      {
        email: VESTA_EMAIL,
        firestoreMemberId: 'firebase-uid-vesta',
        role: 'editor',
      },
    ]);
    expect(
      await firestore.collection('households').doc(HOUSEHOLD_ID).get()
    ).toMatchObject({ exists: false });
  });

  it('fails before writing if an active member cannot be bound to Firebase identity', async () => {
    await expect(
      migrateSqliteToFirestore({
        sourceDb: sqlite,
        targetDb: firestore,
        resolveFirebaseUid: async (email) => {
          if (email === OWNER_EMAIL) return 'firebase-uid-marius';
          throw new Error('Firebase user missing');
        },
      })
    ).rejects.toThrow('Firebase user missing');

    expect(
      (
        await firestore.collection('households').doc(HOUSEHOLD_ID).get()
      ).exists
    ).toBe(false);
  });

  it('refuses invalid source balances without touching Firestore', async () => {
    sqlite
      .prepare('UPDATE accounts SET current_balance_pence = ? WHERE id = ?')
      .run(999999, 'acc-main');

    const result = await migrateSqliteToFirestore({
      sourceDb: sqlite,
      targetDb: firestore,
      resolveFirebaseUid: resolveUid,
    });

    expect(result.source.valid).toBe(false);
    expect(result.source.errors.join(' ')).toContain('does not reconcile');
    expect(
      (
        await firestore.collection('households').doc(HOUSEHOLD_ID).get()
      ).exists
    ).toBe(false);
  });

  it('requires the explicit live-migration confirmation token', async () => {
    await expect(
      migrateSqliteToFirestore({
        sourceDb: sqlite,
        targetDb: firestore,
        resolveFirebaseUid: resolveUid,
        dryRun: false,
      })
    ).rejects.toThrow(MIGRATION_CONFIRMATION);

    expect(
      (
        await firestore.collection('households').doc(HOUSEHOLD_ID).get()
      ).exists
    ).toBe(false);
  });

  it('migrates every authoritative record, binds UIDs, verifies fingerprint, and finalizes readiness', async () => {
    const sourceBundle = exportSqliteMigrationBundle(sqlite);
    const sourceValidation = validateMigrationBundle(sourceBundle);
    expect(sourceValidation.valid).toBe(true);

    const result = await migrateSqliteToFirestore({
      sourceDb: sqlite,
      targetDb: firestore,
      resolveFirebaseUid: resolveUid,
      dryRun: false,
      confirmation: MIGRATION_CONFIRMATION,
    });

    expect(result.applied).toBe(true);
    expect(result.equivalentAfterMigration).toBe(true);
    expect(result.targetAfter?.fingerprint).toBe(
      sourceValidation.evidence.fingerprint
    );
    expect(result.excludedLegacyFields).toEqual([
      'users.password_hash',
      'users.salt',
      'user_sessions.*',
    ]);

    const household = firestore.collection('households').doc(HOUSEHOLD_ID);
    const [state, migration, owner, vesta, archived, audits] = await Promise.all([
      household.collection('meta').doc('state').get(),
      household.collection('meta').doc('migration').get(),
      household.collection('members').doc('firebase-uid-marius').get(),
      household.collection('members').doc('firebase-uid-vesta').get(),
      household.collection('accounts').doc('acc-archived').get(),
      household.collection('audit').get(),
    ]);

    expect(state.data()).toMatchObject({
      version: 42,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      isLocked: true,
      closedAt: '2026-09-03T17:59:00.000Z',
      migrationState: 'complete',
    });
    expect(migration.data()).toMatchObject({
      state: 'complete',
      sourceFingerprint: sourceValidation.evidence.fingerprint,
      targetFingerprint: sourceValidation.evidence.fingerprint,
      sourceVersion: 42,
    });
    expect(owner.data()).toMatchObject({
      email: OWNER_EMAIL,
      role: 'owner',
      legacyId: 'legacy-marius',
    });
    expect(vesta.data()).toMatchObject({
      email: VESTA_EMAIL,
      role: 'editor',
      legacyId: 'legacy-vesta',
    });
    expect(archived.data()).toMatchObject({
      name: 'Old Cash',
      isActive: false,
      currentBalancePence: 1000,
    });
    expect(audits.size).toBe(205);

    const [ownerPref, vestaPref] = await Promise.all([
      household.collection('preferences').doc('firebase-uid-marius').get(),
      household.collection('preferences').doc('firebase-uid-vesta').get(),
    ]);
    expect(ownerPref.data()).toMatchObject({ theme: 'dark', accent: 'blue' });
    expect(vestaPref.data()).toMatchObject({ theme: 'light', accent: 'rose' });

    const targetBundle = await readFirestoreMigrationBundle(firestore);
    expect(targetBundle).not.toBeNull();
    expect(migrationFingerprint(targetBundle!)).toBe(
      migrationFingerprint(sourceBundle)
    );

    expect(
      (
        await household
          .collection('transactions')
          .doc('tx-expense')
          .collection('splits')
          .get()
      ).size
    ).toBe(2);

    expect(
      (
        await household.collection('members').where('email', '==', 'removed@example.com').get()
      ).docs[0]?.data().role
    ).toBe('removed');

    // Legacy local-auth secrets/sessions are deliberately not copied.
    expect((await household.collection('sessions').get()).empty).toBe(true);
  });

  it('refuses to overwrite a non-empty target unless replacement is explicitly enabled', async () => {
    const household = firestore.collection('households').doc(HOUSEHOLD_ID);
    await household.set({ name: 'Existing Firestore household' });

    await expect(
      migrateSqliteToFirestore({
        sourceDb: sqlite,
        targetDb: firestore,
        resolveFirebaseUid: resolveUid,
        dryRun: false,
        confirmation: MIGRATION_CONFIRMATION,
      })
    ).rejects.toThrow('Refusing to overwrite');

    expect((await household.get()).data()?.name).toBe(
      'Existing Firestore household'
    );
  });
});
