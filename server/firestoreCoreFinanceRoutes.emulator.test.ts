import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from './firestoreAdmin';
import { createFirestoreCoreFinanceRouter } from './firestoreCoreFinanceRoutes';
import { FirestoreCoreMutationStore } from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { HOUSEHOLD_ID } from './storage/contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('Firestore core finance HTTP routes', () => {
  const db = getMvFirestore();
  const store = new FirestoreHouseholdStore(db);
  const core = new FirestoreCoreMutationStore(db, store);
  const edge = new FirestoreEdgeMutationStore(db, store);
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
  let server: Server | null = null;
  let baseUrl = '';

  async function startApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = {
        id: 'firebase-marius',
        email: 'backtonemesis@gmail.com',
        name: 'Marius',
        role: 'owner',
      };
      next();
    });
    app.use(
      '/api',
      createFirestoreCoreFinanceRouter({ db, store, core, edge })
    );

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test HTTP server did not bind to a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function request(
    path: string,
    method: string,
    body?: Record<string, unknown>
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
    await store.ensureHousehold();
    await householdRef.collection('members').doc('firebase-marius').set({
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-09-04T00:00:00.000Z',
      lastActiveAt: '2026-09-04T00:00:00.000Z',
    });

    await startApp();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
      server = null;
    }
  });

  afterAll(async () => {
    await db.recursiveDelete(householdRef);
  });

  it('creates an account, records one idempotent expense, and preserves version on retry', async () => {
    let result = await request('/api/accounts', 'POST', {
      expectedVersion: 1,
      name: 'Marius Current',
      type: 'current',
      ownerPerson: 'Marius',
      startingBalancePence: 100000,
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);
    const accountId = result.payload.id;

    await householdRef.collection('categories').doc('cat-groceries').set({
      name: 'Groceries',
      group: 'Living',
      monthlyBudgetPence: 0,
      isArchived: false,
    });

    result = await request('/api/transactions', 'POST', {
      expectedVersion: 2,
      date: '2026-09-04',
      description: 'Tesco groceries',
      amountPence: 4321,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId,
      payer: 'Marius',
      idempotencyKey: 'bank-20260904-001',
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(3);
    const transactionId = result.payload.id;

    result = await request('/api/transactions', 'POST', {
      expectedVersion: 3,
      date: '2026-09-04',
      description: 'Duplicate retry',
      amountPence: 4321,
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId,
      payer: 'Marius',
      idempotencyKey: 'bank-20260904-001',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.duplicatePrevented).toBe(true);
    expect(result.payload.transaction.id).toBe(transactionId);
    expect(result.payload.version).toBe(3);

    const data = await store.getHouseholdData();
    expect(data.transactions).toHaveLength(1);
    expect(data.accounts.find((account) => account.id === accountId)?.currentBalancePence).toBe(95679);
    expect(data.version).toBe(3);
  });

  it('reconciles an account through HTTP and reports the reconstructed current balance', async () => {
    let result = await request('/api/accounts', 'POST', {
      expectedVersion: 1,
      name: 'Cash',
      type: 'cash',
      ownerPerson: 'Joint',
      startingBalancePence: 5000,
    });
    const accountId = result.payload.id;
    expect(result.payload.version).toBe(2);

    result = await request(`/api/accounts/${accountId}/reconcile`, 'POST', {
      expectedVersion: 2,
      reconciledBalancePence: 12000,
      reconciliationDate: '2026-09-04',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      success: true,
      accountId,
      reconciledBalancePence: 12000,
      reconciliationDate: '2026-09-04',
      calculatedCurrentBalancePence: 12000,
      version: 3,
    });
  });

  it('creates, updates and deletes a savings goal with account reference validation', async () => {
    let result = await request('/api/accounts', 'POST', {
      expectedVersion: 1,
      name: 'Joint Savings',
      type: 'savings',
      ownerPerson: 'Joint',
      startingBalancePence: 25000,
    });
    const accountId = result.payload.id;

    result = await request('/api/savings-goals', 'POST', {
      expectedVersion: 2,
      name: 'Home Reserve',
      targetPence: 500000,
      currentPence: 25000,
      accountId,
      linkedAccountId: accountId,
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(3);
    const goalId = result.payload.id;

    result = await request(`/api/savings-goals/${goalId}`, 'PUT', {
      expectedVersion: 3,
      name: 'Home Reserve Updated',
      targetPence: 550000,
      currentPence: 30000,
      accountId,
      linkedAccountId: accountId,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(4);

    result = await request(`/api/savings-goals/${goalId}`, 'DELETE', {
      expectedVersion: 4,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(5);

    const data = await store.getHouseholdData();
    expect(data.savingsGoals).toEqual([]);
  });

  it('returns 409 and leaves Firestore unchanged on a stale mutation version', async () => {
    const first = await request('/api/accounts', 'POST', {
      expectedVersion: 1,
      name: 'Current',
      type: 'current',
      ownerPerson: 'Marius',
      startingBalancePence: 10000,
    });
    expect(first.response.status).toBe(201);

    const stale = await request('/api/accounts', 'POST', {
      expectedVersion: 1,
      name: 'Must Not Persist',
      type: 'cash',
      ownerPerson: 'Marius',
      startingBalancePence: 1000,
    });
    expect(stale.response.status).toBe(409);
    expect(stale.payload.serverVersion).toBe(2);

    const data = await store.getHouseholdData();
    expect(data.accounts.map((account) => account.name)).toEqual(['Current']);
    expect(data.version).toBe(2);
  });

  it('rejects missing Firestore account/category references before writing', async () => {
    const result = await request('/api/transactions', 'POST', {
      expectedVersion: 1,
      date: '2026-09-04',
      description: 'Invalid transaction',
      amountPence: 1000,
      type: 'expense',
      categoryId: 'missing-category',
      accountId: 'missing-account',
      payer: 'Marius',
    });
    expect(result.response.status).toBe(400);
    expect(result.payload.error).toBe('Validation failed');

    const data = await store.getHouseholdData();
    expect(data.transactions).toEqual([]);
    expect(data.version).toBe(1);
  });
});
