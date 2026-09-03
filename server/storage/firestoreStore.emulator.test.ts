import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from '../firestoreAdmin';
import { FirestoreHouseholdStore } from './firestoreStore';
import { HOUSEHOLD_ID } from './contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('FirestoreHouseholdStore emulator integration', () => {
  const db = getMvFirestore();
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
  const store = new FirestoreHouseholdStore(db);

  async function clearHousehold() {
    await db.recursiveDelete(householdRef);
  }

  beforeEach(async () => {
    await clearHousehold();
  });

  afterAll(async () => {
    await clearHousehold();
  });

  it('initializes only household metadata and never invents financial records', async () => {
    await store.ensureHousehold();
    const data = await store.getHouseholdData();

    expect(data.id).toBe(HOUSEHOLD_ID);
    expect(data.version).toBe(1);
    expect(data.accounts).toEqual([]);
    expect(data.transactions).toEqual([]);
    expect(data.plannedPayments).toEqual([]);
    expect(data.plannedIncomes).toEqual([]);
    expect(data.savingsGoals).toEqual([]);
    expect(data.members).toEqual([]);
  });

  it('reconstructs current account balance from the reconciliation anchor and only later movements', async () => {
    await store.ensureHousehold();

    await householdRef.collection('accounts').doc('acc-main').set({
      name: 'Marius Current',
      type: 'current',
      currency: 'GBP',
      startingBalancePence: 50_000,
      currentBalancePence: 0,
      ownerPerson: 'Marius',
      isActive: true,
      reconciledBalancePence: 124_782,
      reconciliationDate: '2026-09-03',
      schemaVersion: 3,
    });

    const transactions = householdRef.collection('transactions');
    await transactions.doc('old-expense').set({
      date: '2026-09-02',
      description: 'Already in statement balance',
      amountPence: 5_000,
      type: 'expense',
      categoryId: 'cat-test',
      accountId: 'acc-main',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-02T10:00:00.000Z',
      createdBy: 'backtonemesis@gmail.com',
    });
    await transactions.doc('later-expense').set({
      date: '2026-09-04',
      description: 'Later expense',
      amountPence: 1_500,
      type: 'expense',
      categoryId: 'cat-test',
      accountId: 'acc-main',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      createdAt: '2026-09-04T10:00:00.000Z',
      createdBy: 'backtonemesis@gmail.com',
    });
    await transactions.doc('later-refund').set({
      date: '2026-09-05',
      description: 'Refund returned',
      amountPence: 500,
      type: 'refund',
      categoryId: 'cat-test',
      accountId: 'acc-main',
      payer: 'Marius',
      isTransfer: false,
      isRepayment: false,
      isSavings: false,
      isRefund: true,
      createdAt: '2026-09-05T10:00:00.000Z',
      createdBy: 'backtonemesis@gmail.com',
    });

    const data = await store.getHouseholdData();
    const account = data.accounts.find((item) => item.id === 'acc-main');

    expect(account?.currentBalancePence).toBe(123_782);
  });

  it('atomically bumps version and appends audit, while stale versions fail without partial writes', async () => {
    await store.ensureHousehold();

    const result = await store.runMutation(
      {
        expectedVersion: 1,
        actorEmail: 'backtonemesis@gmail.com',
        audit: {
          action: 'category_created',
          entityType: 'category',
          entityId: 'cat-test',
          summary: 'Created test category',
        },
      },
      ({ transaction, collectionRef }) => {
        transaction.create(collectionRef('categories', 'cat-test'), {
          name: 'Test',
          group: 'Test',
          monthlyBudgetPence: 0,
          isArchived: false,
        });
        return { id: 'cat-test' };
      }
    );

    expect(result.version).toBe(2);

    const meta = await householdRef.collection('meta').doc('state').get();
    const audit = await householdRef.collection('audit').get();
    const category = await householdRef.collection('categories').doc('cat-test').get();

    expect(meta.data()?.version).toBe(2);
    expect(category.exists).toBe(true);
    expect(audit.size).toBe(1);

    await expect(
      store.runMutation(
        {
          expectedVersion: 1,
          actorEmail: 'backtonemesis@gmail.com',
          audit: {
            action: 'category_created',
            entityType: 'category',
            entityId: 'cat-stale',
            summary: 'This stale write must fail',
          },
        },
        ({ transaction, collectionRef }) => {
          transaction.create(collectionRef('categories', 'cat-stale'), {
            name: 'Stale',
            group: 'Test',
            monthlyBudgetPence: 0,
            isArchived: false,
          });
          return { id: 'cat-stale' };
        }
      )
    ).rejects.toMatchObject({ status: 409, serverVersion: 2 });

    const staleCategory = await householdRef.collection('categories').doc('cat-stale').get();
    const auditAfterConflict = await householdRef.collection('audit').get();

    expect(staleCategory.exists).toBe(false);
    expect(auditAfterConflict.size).toBe(1);
  });
});
