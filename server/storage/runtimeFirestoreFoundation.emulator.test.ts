import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from '../firestoreAdmin';
import { FirestoreEdgeMutationStore } from './edgeMutations';
import { FirestoreHouseholdStore } from './firestoreStore';
import { HOUSEHOLD_ID } from './contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('empty Firestore runtime identity and governance foundation', () => {
  const db = getMvFirestore();
  const store = new FirestoreHouseholdStore(db);
  const edge = new FirestoreEdgeMutationStore(db, store);
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
  });

  afterAll(async () => {
    await db.recursiveDelete(householdRef);
  });

  it('establishes only verified identities and invents no financial data', async () => {
    const marius = await store.getOrCreateVerifiedMember({
      uid: 'firebase-marius',
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
    });

    expect(marius).toMatchObject({
      id: 'firebase-marius',
      email: 'backtonemesis@gmail.com',
      role: 'owner',
    });

    let household = await store.getHouseholdData();
    expect(household.version).toBe(2);
    expect(household.accounts).toEqual([]);
    expect(household.categories.length).toBeGreaterThanOrEqual(16);
    expect(household.categories.map((category) => category.id)).toEqual(
      expect.arrayContaining(['cat-housing', 'cat-salary', 'cat-transfer'])
    );
    expect(household.transactions).toEqual([]);
    expect(household.savingsGoals).toEqual([]);
    expect(household.plannedPayments).toEqual([]);
    expect(household.plannedIncomes).toEqual([]);
    expect(household.members).toHaveLength(1);
    expect(household.auditLogs.map((entry) => entry.action)).toContain('owner_identity_registered');

    const vesta = await store.getOrCreateVerifiedMember({
      uid: 'firebase-vesta',
      email: 'vestajuskaite@gmail.com',
      name: 'Vesta',
    });

    expect(vesta).toMatchObject({
      id: 'firebase-vesta',
      email: 'vestajuskaite@gmail.com',
      role: 'pending',
    });

    household = await store.getHouseholdData();
    expect(household.version).toBe(3);
    expect(household.members.find((member) => member.id === 'firebase-vesta')?.role).toBe('pending');
    expect(household.auditLogs.map((entry) => entry.action)).toContain('member_access_requested');

    await store.savePreferences('firebase-marius', { theme: 'dark', accent: 'blue' });
    await store.savePreferences('firebase-vesta', { theme: 'light', accent: 'rose' });
    await expect(store.getPreferences('firebase-marius')).resolves.toEqual({
      theme: 'dark',
      accent: 'blue',
    });
    await expect(store.getPreferences('firebase-vesta')).resolves.toEqual({
      theme: 'light',
      accent: 'rose',
    });

    const approval = await edge.approveMember(
      {
        expectedVersion: 3,
        actorEmail: 'backtonemesis@gmail.com',
        now: '2026-09-04T00:20:00.000Z',
      },
      'firebase-vesta',
      'editor'
    );
    expect(approval.version).toBe(4);

    household = await store.getHouseholdData();
    expect(household.version).toBe(4);
    expect(household.members.find((member) => member.id === 'firebase-vesta')).toMatchObject({
      role: 'editor',
      approvedBy: 'backtonemesis@gmail.com',
    });
    expect(household.auditLogs.map((entry) => entry.action)).toContain('member_approved');

    await expect(
      edge.changeMemberRole(
        {
          expectedVersion: 4,
          actorEmail: 'backtonemesis@gmail.com',
          now: '2026-09-04T00:21:00.000Z',
        },
        'firebase-vesta',
        'owner'
      )
    ).rejects.toThrow('Only Marius may hold the Household Owner role');

    await expect(
      edge.changeMemberRole(
        {
          expectedVersion: 4,
          actorEmail: 'backtonemesis@gmail.com',
          now: '2026-09-04T00:22:00.000Z',
        },
        'firebase-marius',
        'view_only'
      )
    ).rejects.toThrow('Cannot demote the sole household owner');

    await expect(
      edge.removeMember(
        {
          expectedVersion: 4,
          actorEmail: 'backtonemesis@gmail.com',
          now: '2026-09-04T00:23:00.000Z',
        },
        'firebase-marius'
      )
    ).rejects.toThrow('Cannot remove household owner');

    household = await store.getHouseholdData();
    expect(household.version).toBe(4);
    expect(household.members.filter((member) => member.role === 'owner')).toEqual([
      expect.objectContaining({
        id: 'firebase-marius',
        email: 'backtonemesis@gmail.com',
      }),
    ]);
  });

  it('does not inject standard categories into an existing or migrated household', async () => {
    await householdRef.set({
      id: HOUSEHOLD_ID,
      name: 'Existing Household',
      currency: 'GBP',
    });
    await householdRef.collection('meta').doc('state').set({
      version: 9,
      schemaVersion: 3,
      updatedAt: '2026-09-04T00:00:00.000Z',
    });
    await householdRef.collection('categories').doc('cat-custom').set({
      name: 'Custom',
      group: 'Custom',
      monthlyBudgetPence: 0,
      isArchived: false,
    });

    await store.ensureHousehold();

    const categories = await householdRef.collection('categories').get();
    expect(categories.docs.map((doc) => doc.id)).toEqual(['cat-custom']);
    const meta = await householdRef.collection('meta').doc('state').get();
    expect(meta.data()?.version).toBe(9);
  });

  it('refuses a verified email already bound to a different Firebase UID', async () => {
    await store.getOrCreateVerifiedMember({
      uid: 'firebase-marius',
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
    });

    await expect(
      store.getOrCreateVerifiedMember({
        uid: 'other-uid',
        email: 'backtonemesis@gmail.com',
        name: 'Marius',
      })
    ).rejects.toThrow('already bound to a different Firebase UID');
  });
});
