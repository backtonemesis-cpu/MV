import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from '../firestoreAdmin';
import { FirestoreAdminDataService } from './firestoreAdminData';
import { FirestoreHouseholdStore } from './firestoreStore';
import { HOUSEHOLD_ID } from './contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('Firestore admin data service', () => {
  const db = getMvFirestore();
  const store = new FirestoreHouseholdStore(db);
  const service = new FirestoreAdminDataService(db, store);
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

  async function seedIdentity() {
    await householdRef.collection('members').doc('firebase-marius').set({
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-09-04T00:00:00.000Z',
      lastActiveAt: '2026-09-04T00:00:00.000Z',
    });
    await householdRef.collection('preferences').doc('firebase-marius').set({
      theme: 'dark',
      accent: 'blue',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });
  }

  async function seedFinance() {
    await Promise.all([
      householdRef.collection('accounts').doc('acc-main').set({
        name: 'Marius Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 100000,
        currentBalancePence: 1,
        ownerPerson: 'Marius',
        isActive: true,
        schemaVersion: 3,
      }),
      householdRef.collection('accounts').doc('acc-archived').set({
        name: 'Old Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 5000,
        currentBalancePence: 5000,
        ownerPerson: 'Marius',
        isActive: false,
        schemaVersion: 3,
      }),
      householdRef.collection('plannedPayments').doc('bill-rent').set({
        name: 'Rent',
        amountPence: 50000,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: 'acc-main',
        dueDate: '2026-09-10',
        categoryId: 'cat-housing',
        status: 'unpaid',
        includeInTransferPlan: true,
        schemaVersion: 3,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'backtonemesis@gmail.com',
      }),
      householdRef.collection('plannedIncomes').doc('inc-salary').set({
        name: 'Salary',
        expectedAmountPence: 200000,
        month: '2026-09',
        sourcePerson: 'Marius',
        accountId: 'acc-main',
        expectedDate: '2026-09-12',
        status: 'expected',
        schemaVersion: 3,
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'backtonemesis@gmail.com',
      }),
      householdRef.collection('savingsGoals').doc('sav-home').set({
        name: 'Home reserve',
        targetPence: 500000,
        currentPence: 25000,
        accountId: 'acc-main',
        schemaVersion: 3,
      }),
    ]);

    const txRef = householdRef.collection('transactions').doc('tx-grocery');
    await txRef.set({
      date: '2026-09-04',
      description: 'Groceries',
      amountPence: 10000,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-main',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      schemaVersion: 3,
      createdAt: '2026-09-04T08:00:00.000Z',
      createdBy: 'backtonemesis@gmail.com',
    });
    await Promise.all([
      txRef.collection('splits').doc('split-food').set({
        categoryId: 'cat-groceries',
        amountPence: 6000,
        payer: 'Marius',
      }),
      txRef.collection('splits').doc('split-dining').set({
        categoryId: 'cat-dining',
        amountPence: 4000,
        payer: 'Marius',
      }),
    ]);
  }

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
    await store.ensureHousehold();
    await seedIdentity();
  });

  afterAll(async () => {
    await db.recursiveDelete(householdRef);
  });

  it('exports all financial/config records, including archived accounts and top-level splits, with calculated balances', async () => {
    await seedFinance();

    const backup = await service.exportBackup('backtonemesis@gmail.com');

    expect(backup.exportVersion).toBe('3.0');
    expect(backup.householdId).toBe(HOUSEHOLD_ID);
    expect(backup.accounts.map((item: any) => item.id)).toEqual(
      expect.arrayContaining(['acc-main', 'acc-archived'])
    );
    expect(
      backup.accounts.find((item: any) => item.id === 'acc-main')
        .currentBalancePence
    ).toBe(90000);
    expect(backup.splits).toHaveLength(2);
    expect(backup.splits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'split-food',
          transactionId: 'tx-grocery',
          amountPence: 6000,
        }),
      ])
    );
    expect(backup).not.toHaveProperty('members');
    expect(backup).not.toHaveProperty('preferences');
  });

  it('restores the validated financial dataset atomically while preserving identity, preferences and existing audit history', async () => {
    await seedFinance();
    const backup = await service.exportBackup('backtonemesis@gmail.com');

    const mutation = await store.runMutation(
      {
        expectedVersion: 1,
        actorEmail: 'backtonemesis@gmail.com',
        audit: {
          action: 'test_change',
          entityType: 'transaction',
          entityId: 'tx-later',
          summary: 'Create later transaction before restore',
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('transactions', 'tx-later'), {
          date: '2026-09-05',
          description: 'Later expense',
          amountPence: 2000,
          type: 'expense',
          categoryId: 'cat-dining',
          accountId: 'acc-main',
          payer: 'Marius',
          isTransfer: false,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          schemaVersion: 3,
          createdAt: '2026-09-05T10:00:00.000Z',
          createdBy: 'backtonemesis@gmail.com',
        });
        return { id: 'tx-later' };
      }
    );
    expect(mutation.version).toBe(2);

    const result = await service.restore(
      backup,
      2,
      'backtonemesis@gmail.com'
    );
    expect(result.version).toBe(3);
    expect(result.reconciliation).toMatchObject({
      preTransactions: 2,
      postTransactions: 1,
      postBalancePence: 95000,
    });

    const data = await store.getHouseholdData();
    expect(data.version).toBe(3);
    expect(data.transactions.map((tx) => tx.id)).toEqual(['tx-grocery']);
    expect(
      data.accounts.find((account) => account.id === 'acc-main')
        ?.currentBalancePence
    ).toBe(90000);
    expect(data.members).toEqual([
      expect.objectContaining({
        id: 'firebase-marius',
        email: 'backtonemesis@gmail.com',
        role: 'owner',
      }),
    ]);
    await expect(store.getPreferences('firebase-marius')).resolves.toEqual({
      theme: 'dark',
      accent: 'blue',
    });

    const audit = await householdRef.collection('audit').get();
    const actions = audit.docs.map((doc) => doc.data().action);
    expect(actions).toEqual(
      expect.arrayContaining(['test_change', 'database_restored'])
    );
    expect(audit.size).toBe(2);

    await expect(
      service.restore(backup, 2, 'backtonemesis@gmail.com')
    ).rejects.toMatchObject({ status: 409, serverVersion: 3 });

    const afterStale = await store.getHouseholdData();
    expect(afterStale.version).toBe(3);
    expect(afterStale.transactions.map((tx) => tx.id)).toEqual(['tx-grocery']);
    const auditAfterStale = await householdRef.collection('audit').get();
    expect(auditAfterStale.size).toBe(2);
  });

  it('resets only financial records while preserving categories, identity, preferences and audit history', async () => {
    await seedFinance();

    const result = await service.reset(1, 'backtonemesis@gmail.com');
    expect(result.version).toBe(2);

    const data = await store.getHouseholdData();
    expect(data.accounts).toEqual([]);
    expect(data.transactions).toEqual([]);
    expect(data.plannedPayments).toEqual([]);
    expect(data.plannedIncomes).toEqual([]);
    expect(data.savingsGoals).toEqual([]);
    expect(data.categories.map((item) => item.id)).toEqual(
      expect.arrayContaining(['cat-housing', 'cat-salary', 'cat-transfer'])
    );
    expect(data.members).toHaveLength(1);
    await expect(store.getPreferences('firebase-marius')).resolves.toEqual({
      theme: 'dark',
      accent: 'blue',
    });
    expect(data.auditLogs.map((item) => item.action)).toContain(
      'household_reset'
    );

    await expect(
      service.reset(1, 'backtonemesis@gmail.com')
    ).rejects.toMatchObject({ status: 409, serverVersion: 2 });
    const afterStale = await store.getHouseholdData();
    expect(afterStale.version).toBe(2);
    expect(afterStale.auditLogs).toHaveLength(1);
  });

  it('refuses an uploaded identity override and preserves sole-owner authority as a warning-only ignored field', async () => {
    const backup = await service.exportBackup('backtonemesis@gmail.com');
    const result = await service.preflightRestore({
      ...backup,
      members: [
        {
          email: 'attacker@example.com',
          role: 'owner',
        },
      ],
      users: [{ email: 'attacker@example.com' }],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('ignored');
    expect(result.checks.join(' ')).toContain('backtonemesis@gmail.com');
  });

  it('refuses in-app restores that exceed the verified atomic Firestore write limit', async () => {
    const oversized = {
      exportVersion: '3.0',
      schemaVersion: 3,
      householdId: HOUSEHOLD_ID,
      name: 'Marius & Vesta Household',
      accounts: [],
      categories: Array.from({ length: 451 }, (_, index) => ({
        id: `cat-large-${String(index).padStart(3, '0')}`,
        name: `Category ${index}`,
        group: 'Large',
        monthlyBudgetPence: 0,
        isArchived: false,
      })),
      transactions: [],
      splits: [],
      plannedPayments: [],
      plannedIncomes: [],
      savingsGoals: [],
      auditLogs: [],
    };

    const preflight = await service.preflightRestore(oversized);
    expect(preflight.valid).toBe(false);
    expect(preflight.estimatedAtomicWrites).toBeGreaterThan(
      preflight.maxAtomicWrites
    );
    expect(preflight.errors.join(' ')).toContain('atomic Firestore writes');
  });
});
